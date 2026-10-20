import * as THREE from 'three';
import { ChunkManager } from './ChunkManager';

export interface RemotePlayer {
  id: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  color: string;
  mesh?: THREE.Group;
}

export class MultiplayerClient {
  private ws: WebSocket | null = null;
  public myId: string | null = null;
  public myColor: string = '#10b981';
  public remotePlayers: Map<string, RemotePlayer> = new Map();
  private scene: THREE.Scene;
  private chunkManager: ChunkManager;

  public isConnected: boolean = false;
  public connectedPlayerCount: number = 1;

  constructor(scene: THREE.Scene, chunkManager: ChunkManager) {
    this.scene = scene;
    this.chunkManager = chunkManager;
    this.connect();
  }

  private isConnecting: boolean = false;

  private connect(): void {
    if (this.isConnecting || (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING))) {
      return;
    }

    this.isConnecting = true;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.isConnecting = false;
        console.log('[MultiplayerClient] Connected to WebSocket server');
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch (e) {
          console.error('[MultiplayerClient] Failed to parse message', e);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.isConnecting = false;
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

  private handleMessage(msg: any): void {
    switch (msg.type) {
      case 'init': {
        this.myId = msg.id;
        this.myColor = msg.color;
        if (Array.isArray(msg.players)) {
          msg.players.forEach((p: RemotePlayer) => this.addRemotePlayer(p));
        }
        this.connectedPlayerCount = this.remotePlayers.size + 1;
        break;
      }

      case 'player_joined': {
        if (msg.player && msg.player.id !== this.myId) {
          this.addRemotePlayer(msg.player);
          this.connectedPlayerCount = this.remotePlayers.size + 1;
        }
        break;
      }

      case 'player_left': {
        if (msg.id) {
          this.removeRemotePlayer(msg.id);
          this.connectedPlayerCount = this.remotePlayers.size + 1;
        }
        break;
      }

      case 'tick': {
        // 20 TPS tick containing all player positions
        if (Array.isArray(msg.players)) {
          msg.players.forEach((p: RemotePlayer) => {
            if (p.id !== this.myId) {
              this.updateRemotePlayer(p);
            }
          });
        }
        break;
      }

      case 'block_update': {
        // Broadcasted block edit from server
        if (msg.playerId !== this.myId) {
          this.chunkManager.setBlockGlobal(
            msg.x,
            msg.y,
            msg.z,
            msg.blockType,
            this.scene
          );
        }
        break;
      }

      case 'chunk_data': {
        // Received chunk data from server
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
   * Sends local player movement to server
   */
  public sendPlayerMove(x: number, y: number, z: number, yaw: number = 0, pitch: number = 0): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'player_move',
          x,
          y,
          z,
          yaw,
          pitch,
        })
      );
    }
  }

  /**
   * Sends block edit to server for validation & world state persistence
   */
  public sendBlockEdit(x: number, y: number, z: number, blockType: number): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'block_edit',
          x,
          y,
          z,
          blockType,
        })
      );
    }
  }

  /**
   * Adds 3D avatar mesh for a remote player in Three.js scene
   */
  private addRemotePlayer(p: RemotePlayer): void {
    if (this.remotePlayers.has(p.id)) return;

    const group = new THREE.Group();

    // Body (0.6 x 1.2 x 0.4)
    const bodyGeo = new THREE.BoxGeometry(0.5, 1.0, 0.4);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(p.color || '#3b82f6'),
      roughness: 0.5,
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 0.5;
    group.add(bodyMesh);

    // Head (0.4 x 0.4 x 0.4)
    const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    const headMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fde047'),
      roughness: 0.4,
    });
    const headMesh = new THREE.Mesh(headGeo, headMat);
    headMesh.position.y = 1.2;
    group.add(headMesh);

    group.position.set(p.x, p.y, p.z);
    this.scene.add(group);

    p.mesh = group;
    this.remotePlayers.set(p.id, p);
  }

  private updateRemotePlayer(p: RemotePlayer): void {
    const existing = this.remotePlayers.get(p.id);
    if (existing) {
      existing.x = p.x;
      existing.y = p.y;
      existing.z = p.z;
      existing.yaw = p.yaw;
      existing.pitch = p.pitch;

      if (existing.mesh) {
        // Smooth position interpolation
        existing.mesh.position.lerp(new THREE.Vector3(p.x, p.y, p.z), 0.3);
        existing.mesh.rotation.y = p.yaw;
      }
    } else {
      this.addRemotePlayer(p);
    }
  }

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
