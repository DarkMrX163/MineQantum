import * as THREE from "three";
import { sound } from "./AudioEngine";

export type EventType =
  | "treasure_hunt"
  | "monster_hunter"
  | "night_siege"
  | "climb_challenge"
  | "none";

export interface ActiveWorldEvent {
  type: EventType;
  title: string;
  description: string;
  durationLeft: number; // in seconds
  totalDuration: number;
  targetPos?: THREE.Vector3;
  targetKillsNeeded?: number;
  currentKills?: number;
  targetHeightNeeded?: number;
  isCompleted: boolean;
  winnerMessage?: string;
}

export class WorldEventManager {
  public currentEvent: ActiveWorldEvent | null = null;
  private scene: THREE.Scene;
  private chunkManager: any;
  private mobManager: any;
  private treasureMesh: THREE.Group | null = null;
  private treasureSparkle: THREE.Points | null = null;

  public onEventCompleted?: (rewardMsg: string) => void;
  public onEventStarted?: (title: string) => void;

  constructor(scene: THREE.Scene, chunkManager: any, mobManager: any) {
    this.scene = scene;
    this.chunkManager = chunkManager;
    this.mobManager = mobManager;
  }

  /**
   * Start a specific event or random event
   */
  public startEvent(
    type?: EventType,
    playerPos?: THREE.Vector3,
  ): ActiveWorldEvent {
    this.clearCurrentEvent();

    const selectedType: EventType =
      type && type !== "none"
        ? type
        : ([
            "treasure_hunt",
            "monster_hunter",
            "night_siege",
            "climb_challenge",
          ][Math.floor(Math.random() * 4)] as EventType);

    const pos = playerPos || new THREE.Vector3(8, 20, 8);

    if (selectedType === "treasure_hunt") {
      // Find a safe ground spot 25 to 40 blocks away
      const angle = Math.random() * Math.PI * 2;
      const dist = 28 + Math.random() * 15;
      const tx = pos.x + Math.sin(angle) * dist;
      const tz = pos.z + Math.cos(angle) * dist;
      const ty = this.chunkManager.getTopGroundY(tx, tz);
      const targetPos = new THREE.Vector3(tx, ty, tz);

      this.spawnTreasureChest(targetPos);

      this.currentEvent = {
        type: "treasure_hunt",
        title: "🔍 ИВЕНТ: Поиск Спрятанного Сокровища (5:00)",
        description: "Найдите золотой сундук сокровищ в течение 5 минут!",
        durationLeft: 300,
        totalDuration: 300,
        targetPos,
        isCompleted: false,
      };
    } else if (selectedType === "monster_hunter") {
      this.currentEvent = {
        type: "monster_hunter",
        title: "🏹 ИВЕНТ: Охотник на Монстров (3:00)",
        description: "Уничтожьте 4 враждебных монстров за 3 минуты!",
        durationLeft: 180,
        totalDuration: 180,
        targetKillsNeeded: 4,
        currentKills: 0,
        isCompleted: false,
      };
    } else if (selectedType === "night_siege") {
      // Spawn wave of hostile mobs
      if (this.mobManager) {
        this.mobManager.spawnMob(
          "zombie",
          new THREE.Vector3(pos.x + 12, pos.y, pos.z + 12),
        );
        this.mobManager.spawnMob(
          "skeleton",
          new THREE.Vector3(pos.x - 12, pos.y, pos.z - 12),
        );
        this.mobManager.spawnMob(
          "creeper",
          new THREE.Vector3(pos.x + 10, pos.y, pos.z - 10),
        );
      }

      this.currentEvent = {
        type: "night_siege",
        title: "⚔️ ИВЕНТ: Ночная Осада (3:00)",
        description: "Выдержите осаду волн монстров в течение 3 минут!",
        durationLeft: 180,
        totalDuration: 180,
        isCompleted: false,
      };
    } else if (selectedType === "climb_challenge") {
      const targetY = Math.max(42, Math.floor(pos.y + 16));
      this.currentEvent = {
        type: "climb_challenge",
        title: `🧗 ИВЕНТ: Высотный Вызов Y=${targetY} (3:00)`,
        description: `Поднимитесь на высоту Y=${targetY} за 3 минуты!`,
        durationLeft: 180,
        totalDuration: 180,
        targetHeightNeeded: targetY,
        isCompleted: false,
      };
    }

    sound.playLevelUp();
    if (this.onEventStarted && this.currentEvent) {
      this.onEventStarted(this.currentEvent.title);
    }

    return this.currentEvent!;
  }

  private spawnTreasureChest(pos: THREE.Vector3): void {
    const group = new THREE.Group();

    // Chest Box (Golden chest body)
    const bodyGeo = new THREE.BoxGeometry(1.2, 0.9, 1.2);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.8,
      roughness: 0.2,
      emissive: 0xd97706,
      emissiveIntensity: 0.4,
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.set(0, 0.45, 0);
    group.add(bodyMesh);

    // Latch
    const latchGeo = new THREE.BoxGeometry(0.3, 0.3, 0.2);
    const latchMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const latchMesh = new THREE.Mesh(latchGeo, latchMat);
    latchMesh.position.set(0, 0.5, 0.62);
    group.add(latchMesh);

    group.position.copy(pos);
    this.scene.add(group);
    this.treasureMesh = group;

    // Glowing particle aura around chest
    const pCount = 30;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      pPos[i * 3] = (Math.random() - 0.5) * 2.2;
      pPos[i * 3 + 1] = Math.random() * 2.0;
      pPos[i * 3 + 2] = (Math.random() - 0.5) * 2.2;
    }
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0xfde047,
      size: 0.35,
      transparent: true,
      opacity: 0.9,
    });
    const sparkles = new THREE.Points(pGeo, pMat);
    sparkles.position.copy(pos);
    this.scene.add(sparkles);
    this.treasureSparkle = sparkles;
  }

  public notifyMobKilled(): void {
    if (
      this.currentEvent &&
      this.currentEvent.type === "monster_hunter" &&
      !this.currentEvent.isCompleted
    ) {
      this.currentEvent.currentKills =
        (this.currentEvent.currentKills || 0) + 1;
      sound.playItemPickup();
      if (
        this.currentEvent.currentKills >=
        (this.currentEvent.targetKillsNeeded || 4)
      ) {
        this.triggerVictory(
          "🏆 ПОБЕДА В ИВЕНТЕ! Вы успешно уничтожили всех монстров и получили +10 Золота!",
        );
      }
    }
  }

  public update(dt: number, playerPos: THREE.Vector3): void {
    if (!this.currentEvent || this.currentEvent.isCompleted) return;

    this.currentEvent.durationLeft -= dt;

    // Animate Treasure Chest floating sparkle aura
    if (this.treasureMesh) {
      this.treasureMesh.rotation.y += dt * 1.5;
    }

    // Event 1: Treasure Hunt check proximity
    if (
      this.currentEvent.type === "treasure_hunt" &&
      this.currentEvent.targetPos
    ) {
      const dist = playerPos.distanceTo(this.currentEvent.targetPos);
      if (dist < 2.8) {
        this.triggerVictory(
          "🏆 ПОБЕДА В ИВЕНТЕ! Вы нашли Спрятанное Сокровище! Награда: Легендарное Оружие & Изумруды!",
        );
        return;
      }
    }

    // Event 4: Climb challenge height check
    if (
      this.currentEvent.type === "climb_challenge" &&
      this.currentEvent.targetHeightNeeded
    ) {
      if (playerPos.y >= this.currentEvent.targetHeightNeeded) {
        this.triggerVictory(
          `🏆 ПОБЕДА В ИВЕНТЕ! Вы успешно покорили высоту Y=${Math.floor(playerPos.y)}! Награда: Алмазный Вызов!`,
        );
        return;
      }
    }

    // Time expired
    if (this.currentEvent.durationLeft <= 0) {
      if (this.currentEvent.type === "night_siege") {
        this.triggerVictory(
          "🏆 ПОБЕДА В ИВЕНТЕ! Вы выдержали Ночную Осаду! Награда: Алхимия & Редкие Руды!",
        );
      } else {
        sound.playBlockBreak();
        const msg = `⏳ Ивент закончился! Время истекло.`;
        this.currentEvent.isCompleted = true;
        this.currentEvent.winnerMessage = msg;
        if (this.onEventCompleted) this.onEventCompleted(msg);
        this.clearChest();
      }
    }
  }

  private triggerVictory(msg: string): void {
    if (!this.currentEvent) return;
    this.currentEvent.isCompleted = true;
    this.currentEvent.winnerMessage = msg;
    sound.playLevelUp();
    if (this.onEventCompleted) {
      this.onEventCompleted(msg);
    }
    this.clearChest();
  }

  private clearChest(): void {
    if (this.treasureMesh) {
      this.scene.remove(this.treasureMesh);
      this.treasureMesh = null;
    }
    if (this.treasureSparkle) {
      this.scene.remove(this.treasureSparkle);
      this.treasureSparkle = null;
    }
  }

  public clearCurrentEvent(): void {
    this.clearChest();
    this.currentEvent = null;
  }
}
