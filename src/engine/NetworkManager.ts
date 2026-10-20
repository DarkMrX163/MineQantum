import * as THREE from "three";
import { ChunkManager } from "./ChunkManager";
import {
  EntityModelBuilder,
  HumanoidModel,
  CreeperModel,
} from "./EntityModelBuilder";
import { sound } from "./AudioEngine";

export interface RemotePlayer {
  id: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  color: string;
  targetPos: THREE.Vector3;
  targetYaw: number;
  mesh?: THREE.Group;
  headMesh?: THREE.Mesh;
  humanoidModel?: HumanoidModel;
  walkTime?: number;
}

export interface NetworkMob {
  id: string;
  type: "zombie" | "creeper" | "steve";
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  state: string;
  isFusing: boolean;
  fuseProgress: number;
  isMoving: boolean;
  targetPos: THREE.Vector3;
  targetYaw: number;
  model: HumanoidModel | CreeperModel;
  walkTime: number;
}

export class NetworkManager {
  private ws: WebSocket | null = null;
  public myId: string | null = null;
  public myColor: string = "#10b981";
  public remotePlayers: Map<string, RemotePlayer> = new Map();
  public serverMobs: Map<string, NetworkMob> = new Map();

  // Callbacks
  public onLocalPlayerDamaged?: (
    damage: number,
    knockback: { x: number; y: number; z: number },
  ) => void;
  public onExplosionEffect?: (
    x: number,
    y: number,
    z: number,
    radius: number,
  ) => void;

  private scene: THREE.Scene;
  private chunkManager: ChunkManager;

  // Connection state
  public isConnected: boolean = false;
  private isConnecting: boolean = false;
  public connectedPlayerCount: number = 1;

  // Throttling for sending position (20–30 times / sec)
  private lastPositionSendTime: number = 0;
  private readonly SEND_INTERVAL_MS: number = 40; // ~25 times per second

  constructor(scene: THREE.Scene, chunkManager: ChunkManager) {
    this.scene = scene;
    this.chunkManager = chunkManager;
    this.connect();
  }

  /**
   * Establishes WebSocket connection to server
   */
  public connect(): void {
    if (
      this.isConnecting ||
      (this.ws &&
        (this.ws.readyState === WebSocket.OPEN ||
          this.ws.readyState === WebSocket.CONNECTING))
    ) {
      return;
    }

    this.isConnecting = true;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const defaultWsUrl = `${protocol}//${window.location.host}`;
    const envWsUrl = import.meta.env.VITE_WS_URL;
    const wsUrl =
      envWsUrl && envWsUrl.trim().length > 0 ? envWsUrl : defaultWsUrl;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.isConnecting = false;
        console.log("[NetworkManager] Connected to WebSocket server");
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleServerMessage(msg);
        } catch (e) {
          console.error("[NetworkManager] Error parsing message", e);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.isConnecting = false;
        console.log("[NetworkManager] Connection closed. Retrying in 5s...");
        setTimeout(() => this.connect(), 5000);
      };

      this.ws.onerror = () => {
        this.isConnected = false;
        this.isConnecting = false;
      };
    } catch (e) {
      this.isConnected = false;
      this.isConnecting = false;
    }
  }

  /**
   * Processes incoming packets from WebSocket server
   */
  private handleServerMessage(msg: any): void {
    switch (msg.type) {
      case "init": {
        this.myId = msg.id;
        this.myColor = msg.color;
        if (Array.isArray(msg.players)) {
          msg.players.forEach((p: RemotePlayer) => this.addRemotePlayer(p));
        }
        if (Array.isArray(msg.mobs)) {
          this.onReceiveMobsTick(msg.mobs);
        }
        this.connectedPlayerCount = this.remotePlayers.size + 1;
        break;
      }

      case "player_joined": {
        if (msg.player && msg.player.id !== this.myId) {
          this.addRemotePlayer(msg.player);
          this.connectedPlayerCount = this.remotePlayers.size + 1;
        }
        break;
      }

      case "player_left": {
        if (msg.id) {
          this.removeRemotePlayer(msg.id);
          this.connectedPlayerCount = this.remotePlayers.size + 1;
        }
        break;
      }

      case "tick": {
        // 20 TPS server tick containing all active players and mobs
        if (Array.isArray(msg.players)) {
          msg.players.forEach((p: RemotePlayer) => {
            if (p.id !== this.myId) {
              this.onReceivePlayerTick(p);
            }
          });
        }
        if (Array.isArray(msg.mobs)) {
          this.onReceiveMobsTick(msg.mobs);
        }
        break;
      }

      case "explosion": {
        sound.playBlockBreak();
        if (this.onExplosionEffect) {
          this.onExplosionEffect(msg.x, msg.y, msg.z, msg.radius);
        }
        break;
      }

      case "player_damaged": {
        if (msg.playerId === this.myId && this.onLocalPlayerDamaged) {
          this.onLocalPlayerDamaged(msg.damage, msg.knockback);
        }
        break;
      }

      case "block_update": {
        // Block modification event received from server -> local rebuild of chunk mesh
        this.chunkManager.setBlockGlobal(
          msg.x,
          msg.y,
          msg.z,
          msg.blockType,
          this.scene,
        );
        break;
      }

      case "chunk_data": {
        // Streamed chunk block data from server
        const { cx, cz, data } = msg;
        const chunk = this.chunkManager.getOrCreateChunk(cx, cz);
        chunk.data = new Uint8Array(data);
        chunk.isDirty = true;
        this.chunkManager.rebuildDirtyMeshes(this.scene);
        break;
      }
    }
  }

  /**
   * Throttled sending of local player position and head rotation (20-30 times/sec)
   */
  public sendPosition(
    x: number,
    y: number,
    z: number,
    yaw: number = 0,
    pitch: number = 0,
  ): void {
    const now = performance.now();
    if (now - this.lastPositionSendTime < this.SEND_INTERVAL_MS) {
      return; // Skip packet due to throttling
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: "player_move",
          x,
          y,
          z,
          yaw,
          pitch,
        }),
      );
      this.lastPositionSendTime = now;
    }
  }

  /**
   * Sends block modification event to server for validation & broadcast
   */
  public sendBlockEdit(
    x: number,
    y: number,
    z: number,
    blockType: number,
  ): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: "block_edit",
          x,
          y,
          z,
          blockType,
        }),
      );
    }
  }

  /**
   * Per-frame animation tick to perform linear interpolation (lerp) on remote player models
   */
  public update(delta: number): void {
    // Lerp factor based on frame delta
    const lerpSpeed = Math.min(1.0, delta * 15.0);

    this.remotePlayers.forEach((player) => {
      if (player.mesh) {
        const prevX = player.mesh.position.x;
        const prevZ = player.mesh.position.z;

        // Linear Interpolation (lerp) for position
        player.mesh.position.lerp(player.targetPos, lerpSpeed);

        // Smooth rotation interpolation
        player.mesh.rotation.y = THREE.MathUtils.lerp(
          player.mesh.rotation.y,
          player.targetYaw,
          lerpSpeed,
        );

        if (player.headMesh) {
          player.headMesh.rotation.x = THREE.MathUtils.lerp(
            player.headMesh.rotation.x,
            player.pitch,
            lerpSpeed,
          );
        }

        if (player.humanoidModel) {
          const dx = player.mesh.position.x - prevX;
          const dz = player.mesh.position.z - prevZ;
          const movedDist = Math.sqrt(dx * dx + dz * dz);
          const isMoving = movedDist > 0.005;

          player.walkTime = (player.walkTime || 0) + delta;
          const moveSpeed = Math.min(
            2.0,
            (movedDist / Math.max(0.001, delta)) * 0.5,
          );
          player.humanoidModel.animateWalk(
            player.walkTime,
            moveSpeed,
            isMoving,
          );
          player.humanoidModel.setLookDirection(0, player.pitch);
        }
      }
    });

    // Interpolate Server-Side AI Mobs (Zombies & Creepers)
    this.serverMobs.forEach((mob) => {
      mob.model.position.lerp(mob.targetPos, lerpSpeed);
      mob.model.rotation.y = THREE.MathUtils.lerp(
        mob.model.rotation.y,
        mob.targetYaw,
        lerpSpeed,
      );

      mob.walkTime += delta;
      mob.model.animateWalk(
        mob.walkTime,
        mob.isMoving ? 1.0 : 0.0,
        mob.isMoving,
      );

      // Creeper swelling and inflation when hissing/fusing (< 3 blocks)
      if (mob.type === "creeper") {
        if (mob.isFusing) {
          const swell = 1.0 + (mob.fuseProgress || 0) * 0.45;
          mob.model.scale.set(swell, swell, swell);
        } else {
          mob.model.scale.set(1.0, 1.0, 1.0);
        }
      }
    });
  }

  /**
   * Receives 20 TPS server tick containing active AI mobs
   */
  private onReceiveMobsTick(mobsData: any[]): void {
    const activeIds = new Set<string>();

    mobsData.forEach((data) => {
      activeIds.add(data.id);
      const existing = this.serverMobs.get(data.id);
      if (existing) {
        existing.targetPos.set(data.x, data.y, data.z);
        existing.targetYaw = data.yaw;
        existing.state = data.state;
        existing.isFusing = !!data.isFusing;
        existing.fuseProgress = data.fuseProgress || 0;
        existing.isMoving = !!data.isMoving;
      } else {
        // Construct new 3D mob model from EntityModelBuilder
        let model: HumanoidModel | CreeperModel;
        if (data.type === "creeper") {
          model = new CreeperModel();
        } else if (data.type === "zombie") {
          model = new HumanoidModel({ isZombie: true });
        } else {
          model = new HumanoidModel({ isZombie: false });
        }

        model.position.set(data.x, data.y, data.z);
        model.rotation.y = data.yaw || 0;
        this.scene.add(model);

        this.serverMobs.set(data.id, {
          id: data.id,
          type: data.type,
          x: data.x,
          y: data.y,
          z: data.z,
          yaw: data.yaw,
          pitch: data.pitch,
          state: data.state,
          isFusing: !!data.isFusing,
          fuseProgress: data.fuseProgress || 0,
          isMoving: !!data.isMoving,
          targetPos: new THREE.Vector3(data.x, data.y, data.z),
          targetYaw: data.yaw || 0,
          model,
          walkTime: 0,
        });
      }
    });

    // Remove despawned or dead mobs
    this.serverMobs.forEach((mob, id) => {
      if (!activeIds.has(id)) {
        this.scene.remove(mob.model);
        this.serverMobs.delete(id);
      }
    });
  }

  public sendSpawnMob(mobType: string, x: number, y: number, z: number): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "spawn_mob", mobType, x, y, z }));
    }
  }

  public sendClearMobs(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "clear_mobs" }));
    }
  }

  public sendSetNight(isNight: boolean): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "set_night", isNight }));
    }
  }

  /**
   * Creates classic Minecraft humanoid 3D character mesh for a remote player
   */
  private addRemotePlayer(p: RemotePlayer): void {
    if (this.remotePlayers.has(p.id)) return;

    // Build classic Humanoid model using EntityModelBuilder
    const humanoid = new HumanoidModel({ isZombie: false });
    humanoid.position.set(p.x, p.y, p.z);
    this.scene.add(humanoid);

    const playerRecord: RemotePlayer = {
      ...p,
      targetPos: new THREE.Vector3(p.x, p.y, p.z),
      targetYaw: p.yaw || 0,
      mesh: humanoid,
      headMesh: humanoid.head as unknown as THREE.Mesh,
      humanoidModel: humanoid,
      walkTime: 0,
    };

    this.remotePlayers.set(p.id, playerRecord);
  }

  /**
   * Updates target position for remote player when network tick arrives
   */
  private onReceivePlayerTick(p: RemotePlayer): void {
    const existing = this.remotePlayers.get(p.id);
    if (existing) {
      existing.targetPos.set(p.x, p.y, p.z);
      existing.targetYaw = p.yaw;
      existing.pitch = p.pitch;
    } else {
      this.addRemotePlayer(p);
    }
  }

  /**
   * Removes remote player mesh on disconnect
   */
  private removeRemotePlayer(id: string): void {
    const existing = this.remotePlayers.get(id);
    if (existing) {
      if (existing.mesh) {
        this.scene.remove(existing.mesh);
        existing.mesh.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
          }
        });
      }
      this.remotePlayers.delete(id);
    }
  }
}
