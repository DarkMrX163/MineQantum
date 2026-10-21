import * as THREE from "three";
import { sound } from "./AudioEngine";

export type EventType =
  | "treasure_hunt"
  | "monster_hunter"
  | "night_siege"
  | "climb_challenge"
  | "ancient_pyramid_search"
  | "boss_raid"
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
  bossMobId?: string;
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
  private beaconBeam: THREE.Mesh | null = null;

  public onEventCompleted?: (rewardMsg: string) => void;
  public onEventStarted?: (title: string) => void;
  public onRewardItemsDropped?: (items: { id: string; count: number }[], pos: THREE.Vector3) => void;

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
            "ancient_pyramid_search",
            "boss_raid",
            "monster_hunter",
            "night_siege",
            "climb_challenge",
          ][Math.floor(Math.random() * 6)] as EventType);

    const pos = playerPos || new THREE.Vector3(8, 20, 8);

    if (selectedType === "treasure_hunt") {
      // Find a safe ground spot 25 to 40 blocks away
      const angle = Math.random() * Math.PI * 2;
      const dist = 28 + Math.random() * 15;
      const tx = Math.floor(pos.x + Math.sin(angle) * dist);
      const tz = Math.floor(pos.z + Math.cos(angle) * dist);
      const ty = this.chunkManager.getTopGroundY(tx, tz);
      const targetPos = new THREE.Vector3(tx + 0.5, ty, tz + 0.5);

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
    } else if (selectedType === "ancient_pyramid_search") {
      // Spawn Ancient Pyramid Shrine 32-45 blocks away
      const angle = Math.random() * Math.PI * 2;
      const dist = 32 + Math.random() * 14;
      const tx = Math.floor(pos.x + Math.sin(angle) * dist);
      const tz = Math.floor(pos.z + Math.cos(angle) * dist);
      const ty = this.chunkManager.getTopGroundY(tx, tz);

      // Build 3D Sandstone Pyramid Shrine into the world voxels
      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          this.chunkManager.setBlockGlobal(tx + dx, ty, tz + dz, 8, this.scene); // Brick base
        }
      }
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          this.chunkManager.setBlockGlobal(tx + dx, ty + 1, tz + dz, 6, this.scene); // Sand mid
        }
      }

      const targetPos = new THREE.Vector3(tx + 0.5, ty + 2, tz + 0.5);
      this.spawnTreasureChest(targetPos, 0x38bdf8); // Cyan beacon beam

      this.currentEvent = {
        type: "ancient_pyramid_search",
        title: "🏺 ИВЕНТ: Древняя Пирамида & Алтарь Реликвий (5:00)",
        description: "Найдите древние руины с золотым алтарём на вершине!",
        durationLeft: 300,
        totalDuration: 300,
        targetPos,
        isCompleted: false,
      };
    } else if (selectedType === "boss_raid") {
      // Spawn Giant Boss Zombie
      const bossPos = new THREE.Vector3(pos.x + 16, this.chunkManager.getTopGroundY(pos.x + 16, pos.z + 16), pos.z + 16);
      let bossId = "";
      if (this.mobManager) {
        const mob = this.mobManager.spawnMob("zombie", bossPos);
        mob.health = 60;
        mob.walkSpeed = 2.8;
        mob.meshGroup.scale.set(2.4, 2.4, 2.4); // Giant scale!
        bossId = mob.id;
      }

      this.currentEvent = {
        type: "boss_raid",
        title: "👹 ИВЕНТ: Рейд на Босса — Царь Зомби [60 HP] (4:00)",
        description: "Одолейте свирепого Гигантского Царя Зомби!",
        durationLeft: 240,
        totalDuration: 240,
        bossMobId: bossId,
        targetPos: bossPos,
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

  private spawnTreasureChest(pos: THREE.Vector3, beamColor: number = 0xf59e0b): void {
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

    // Tall Beacon Beam reaching high into sky
    const beamGeo = new THREE.CylinderGeometry(0.35, 0.35, 90, 12);
    const beamMat = new THREE.MeshBasicMaterial({
      color: beamColor,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(0, 45, 0);
    group.add(beam);

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
      color: beamColor,
      size: 0.35,
      transparent: true,
      opacity: 0.9,
    });
    const sparkles = new THREE.Points(pGeo, pMat);
    sparkles.position.copy(pos);
    this.scene.add(sparkles);
    this.treasureSparkle = sparkles;
  }

  public notifyMobKilled(mobId?: string, mobType?: string): void {
    if (!this.currentEvent || this.currentEvent.isCompleted) return;

    if (this.currentEvent.type === "monster_hunter") {
      this.currentEvent.currentKills = (this.currentEvent.currentKills || 0) + 1;
      sound.playItemPickup();
      if (
        this.currentEvent.currentKills >= (this.currentEvent.targetKillsNeeded || 4)
      ) {
        this.triggerVictory(
          "🏆 ПОБЕДА В ИВЕНТЕ! Вы уничтожили всех монстров и получили Изумруды & Золото!",
          [
            { id: "emerald", count: 4 },
            { id: "gold_ingot", count: 6 },
            { id: "cooked_beef", count: 4 },
          ]
        );
      }
    } else if (this.currentEvent.type === "boss_raid") {
      if ((mobId && mobId === this.currentEvent.bossMobId) || mobType === "zombie") {
        this.triggerVictory(
          "🏆 ПОБЕДА В ИВЕНТЕ! Царь Зомби повержен! Награда: Легендарное Оружие & Алмазы!",
          [
            { id: "diamond_sword", count: 1 },
            { id: "diamond", count: 6 },
            { id: "golden_apple", count: 3 },
            { id: "emerald", count: 5 },
          ]
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
      (this.currentEvent.type === "treasure_hunt" || this.currentEvent.type === "ancient_pyramid_search") &&
      this.currentEvent.targetPos
    ) {
      const dist = playerPos.distanceTo(this.currentEvent.targetPos);
      if (dist < 3.0) {
        const rewardMsg = this.currentEvent.type === "ancient_pyramid_search"
          ? "🏆 ПОБЕДА В ИВЕНТЕ! Вы разгадали тайну Древней Пирамиды! Награда: Алмазный Запас & Реликвии!"
          : "🏆 ПОБЕДА В ИВЕНТЕ! Вы нашли Спрятанное Сокровище! Награда: Алмазы & Изумруды!";

        const loot = this.currentEvent.type === "ancient_pyramid_search"
          ? [
              { id: "diamond_pickaxe", count: 1 },
              { id: "diamond", count: 8 },
              { id: "golden_apple", count: 4 },
              { id: "emerald", count: 10 },
            ]
          : [
              { id: "diamond", count: 4 },
              { id: "gold_ingot", count: 8 },
              { id: "golden_apple", count: 2 },
              { id: "emerald", count: 5 },
            ];

        this.triggerVictory(rewardMsg, loot, this.currentEvent.targetPos);
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
          `🏆 ПОБЕДА В ИВЕНТЕ! Вы покорили высоту Y=${Math.floor(playerPos.y)}! Награда: Высотный Вызов!`,
          [
            { id: "diamond", count: 3 },
            { id: "golden_apple", count: 2 },
            { id: "emerald", count: 4 },
          ],
          playerPos
        );
        return;
      }
    }

    // Time expired
    if (this.currentEvent.durationLeft <= 0) {
      if (this.currentEvent.type === "night_siege") {
        this.triggerVictory(
          "🏆 ПОБЕДА В ИВЕНТЕ! Вы выдержали Ночную Осаду! Награда: Алхимия & Редкие Руды!",
          [
            { id: "diamond_sword", count: 1 },
            { id: "golden_apple", count: 3 },
            { id: "emerald", count: 6 },
          ],
          playerPos
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

  private triggerVictory(
    msg: string,
    rewards?: { id: string; count: number }[],
    dropPos?: THREE.Vector3
  ): void {
    if (!this.currentEvent) return;
    this.currentEvent.isCompleted = true;
    this.currentEvent.winnerMessage = msg;
    sound.playLevelUp();

    if (rewards && rewards.length > 0 && this.onRewardItemsDropped) {
      this.onRewardItemsDropped(rewards, dropPos || this.currentEvent.targetPos || new THREE.Vector3(8, 22, 8));
    }

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
