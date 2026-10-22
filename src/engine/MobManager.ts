import * as THREE from "three";
import { BLOCK, BLOCK_DEFS } from "./types";
import { sound } from "./AudioEngine";
import {
  EntityModelBuilder,
  HumanoidParts,
  CreeperParts,
  BirdParts,
} from "./EntityModelBuilder";

export type MobType =
  | "zombie"
  | "creeper"
  | "steve"
  | "alex"
  | "miner"
  | "knight"
  | "engineer"
  | "skeleton"
  | "enderman"
  | "cow"
  | "sheep"
  | "pig"
  | "bird"
  | "villager"
  | "wolf"
  | "pet_wolf";

export interface ActiveMob {
  id: string;
  type: MobType;
  parts: any;
  meshGroup: THREE.Group;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotationY: number;
  targetRotationY: number;
  targetPos: THREE.Vector3 | null;
  state: "idle" | "wander" | "chase" | "fusing";
  stateTimer: number;
  fuseTimer: number; // For Creeper countdown (1.5s)
  health: number;
  walkCycle: number;
  walkSpeed: number;
  material: THREE.MeshLambertMaterial;
  attackCooldown: number;
}

export class MobManager {
  public mobs: Map<string, ActiveMob> = new Map();
  private scene: THREE.Scene;
  private chunkManager?: any;
  private zombieMaterial: THREE.MeshLambertMaterial;
  private creeperMaterial: THREE.MeshLambertMaterial;
  private playerMaterial: THREE.MeshLambertMaterial;
  private skeletonMaterial: THREE.MeshLambertMaterial;
  private endermanMaterial: THREE.MeshLambertMaterial;
  private cowMaterial: THREE.MeshLambertMaterial;
  private sheepMaterial: THREE.MeshLambertMaterial;
  private pigMaterial: THREE.MeshLambertMaterial;
  private birdMaterial: THREE.MeshLambertMaterial;
  private villagerMaterial: THREE.MeshLambertMaterial;

  // Callbacks
  public onPlayerAttackedByMob?: (
    damage: number,
    knockback: { x: number; y: number; z: number },
  ) => void;
  public onMobKilled?: (type: MobType, pos: THREE.Vector3) => void;
  public onFriendlyPetGiveFood?: (pos: THREE.Vector3, foodType: string) => void;

  constructor(scene: THREE.Scene, chunkManager?: any) {
    this.scene = scene;
    this.chunkManager = chunkManager;
    this.zombieMaterial = EntityModelBuilder.createMobMaterial("zombie");
    this.creeperMaterial = EntityModelBuilder.createMobMaterial("creeper");
    this.playerMaterial = EntityModelBuilder.createMobMaterial("player");
    this.skeletonMaterial = EntityModelBuilder.createMobMaterial("skeleton");
    this.endermanMaterial = EntityModelBuilder.createMobMaterial("enderman");
    this.cowMaterial = EntityModelBuilder.createMobMaterial("cow");
    this.sheepMaterial = EntityModelBuilder.createMobMaterial("sheep");
    this.pigMaterial = EntityModelBuilder.createMobMaterial("pig");
    this.birdMaterial = EntityModelBuilder.createMobMaterial("bird");
    this.villagerMaterial = EntityModelBuilder.createMobMaterial("villager");
  }

  public clearAllMobs(): void {
    this.clearAll();
  }

  /**
   * Player melee attack against mobs in front of crosshair (reach ~3.5 blocks)
   */
  public hitMobAtRay(
    camera: THREE.PerspectiveCamera,
    weaponDamage: number = 4,
  ): { hit: boolean; mobType?: string; isDead?: boolean } {
    const rayOrigin = camera.position;
    const rayDir = new THREE.Vector3();
    camera.getWorldDirection(rayDir);

    let closestMob: ActiveMob | null = null;
    let closestDist = 3.6;

    this.mobs.forEach((mob) => {
      // Vector from camera to mob center
      const mobCenter = mob.position.clone().add(new THREE.Vector3(0, 1.0, 0));
      const toMob = new THREE.Vector3().subVectors(mobCenter, rayOrigin);
      const proj = toMob.dot(rayDir);

      if (proj > 0.4 && proj < closestDist) {
        // Distance from mob center to ray line
        const perpDist = toMob.clone().addScaledVector(rayDir, -proj).length();
        if (perpDist < 0.9) {
          closestDist = proj;
          closestMob = mob;
        }
      }
    });

    if (closestMob) {
      const mob: ActiveMob = closestMob;
      mob.health -= weaponDamage;

      // Visual damage animation: flash red for 200ms
      mob.material.color.setHex(0xff0000);
      setTimeout(() => {
        if (mob.material) {
          mob.material.color.setHex(0xffffff);
        }
      }, 200);

      // Knockback mob backwards + vertical lift
      mob.position.x += rayDir.x * 1.1;
      mob.position.z += rayDir.z * 1.1;
      mob.position.y += 0.35;
      mob.meshGroup.position.copy(mob.position);

      if (mob.type === "villager") {
        sound.playVillager("hurt");
        mob.walkSpeed = 0.9;
        mob.state = "wander";
        mob.stateTimer = 4.0;
      }

      const isDead = mob.health <= 0;
      if (isDead) {
        this.scene.remove(mob.meshGroup);
        this.mobs.delete(mob.id);
        if (this.onMobKilled) {
          this.onMobKilled(mob.type, mob.position.clone());
        }
      }

      return { hit: true, mobType: mob.type, isDead };
    }

    return { hit: false };
  }

  /**
   * Player interaction (Right-click) with friendly Villagers
   */
  public interactWithVillagerAtRay(
    camera: THREE.PerspectiveCamera,
  ): { interacted: boolean; message?: string } {
    const rayOrigin = camera.position;
    const rayDir = new THREE.Vector3();
    camera.getWorldDirection(rayDir);

    let closestVillager: ActiveMob | null = null;
    let closestDist = 3.6;

    this.mobs.forEach((mob) => {
      if (mob.type !== "villager") return;
      const mobCenter = mob.position.clone().add(new THREE.Vector3(0, 1.0, 0));
      const toMob = new THREE.Vector3().subVectors(mobCenter, rayOrigin);
      const proj = toMob.dot(rayDir);

      if (proj > 0.4 && proj < closestDist) {
        const perpDist = toMob.clone().addScaledVector(rayDir, -proj).length();
        if (perpDist < 0.9) {
          closestDist = proj;
          closestVillager = mob;
        }
      }
    });

    if (closestVillager) {
      const v: ActiveMob = closestVillager;
      v.targetRotationY = Math.atan2(
        rayOrigin.x - v.position.x,
        rayOrigin.z - v.position.z,
      );
      v.state = "idle";
      v.stateTimer = 4.0;
      sound.playVillager("trade");

      if (this.onFriendlyPetGiveFood) {
        const gifts = ["bread", "wheat", "apple", "emerald"];
        const gift = gifts[Math.floor(Math.random() * gifts.length)];
        this.onFriendlyPetGiveFood(
          v.position.clone().add(new THREE.Vector3(0, 0.5, 0)),
          gift,
        );
      }

      return {
        interacted: true,
        message: "Житель: Хрррм! Приветствую в нашей деревне!",
      };
    }

    return { interacted: false };
  }

  /**
   * Player interaction (Right-click) with mobs using held item (Bone to tame Wolf, Wheat to feed animals)
   */
  public interactMobAtRay(
    camera: THREE.PerspectiveCamera,
    heldItemId?: string | null,
  ): { interacted: boolean; message?: string } {
    if (!heldItemId) return { interacted: false };

    const rayOrigin = camera.position;
    const rayDir = new THREE.Vector3();
    camera.getWorldDirection(rayDir);

    let closestMob: ActiveMob | null = null;
    let closestDist = 3.8;

    this.mobs.forEach((mob) => {
      const mobCenter = mob.position.clone().add(new THREE.Vector3(0, 0.8, 0));
      const toMob = new THREE.Vector3().subVectors(mobCenter, rayOrigin);
      const proj = toMob.dot(rayDir);

      if (proj > 0.3 && proj < closestDist) {
        const perpDist = toMob.clone().addScaledVector(rayDir, -proj).length();
        if (perpDist < 1.1) {
          closestDist = proj;
          closestMob = mob;
        }
      }
    });

    if (!closestMob) return { interacted: false };

    const mob: ActiveMob = closestMob;

    // 1. Taming Wild Wolf with Bone
    if ((mob.type === "wolf" || mob.type === "pet_wolf") && heldItemId === "bone") {
      if (mob.type === "wolf") {
        if (Math.random() < 0.7) {
          mob.type = "pet_wolf";
          mob.health = 24;
          sound.playLevelUp();

          // Add Red Collar Mesh to Wolf
          const collarGeo = new THREE.BoxGeometry(0.42, 0.15, 0.42);
          const collarMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
          const collarMesh = new THREE.Mesh(collarGeo, collarMat);
          collarMesh.position.set(0, 0.55, 0.2);
          mob.meshGroup.add(collarMesh);

          return {
            interacted: true,
            message: "🐕 Вы успешно приручили дикого волка! Теперь это ваш верный питомец.",
          };
        } else {
          sound.playPop();
          return {
            interacted: true,
            message: "🦴 Волк съел кость, но пока не приручился. Попробуйте ещё!",
          };
        }
      } else {
        // Feed tamed pet wolf
        mob.health = Math.min(24, mob.health + 8);
        sound.playPop();
        if (this.onFriendlyPetGiveFood) {
          this.onFriendlyPetGiveFood(mob.position.clone(), "bone");
        }
        return { interacted: true, message: "💖 Вы покормили питомца!" };
      }
    }

    // 2. Feeding Farm Animals with Wheat/Food
    if (
      (mob.type === "cow" || mob.type === "sheep" || mob.type === "pig") &&
      (heldItemId === "wheat" || heldItemId === "apple" || heldItemId === "bread")
    ) {
      mob.health = Math.min(15, mob.health + 5);
      sound.playPop();
      if (this.onFriendlyPetGiveFood) {
        this.onFriendlyPetGiveFood(mob.position.clone(), heldItemId);
      }
      return { interacted: true, message: "🌾 Вы покормили животное!" };
    }

    return { interacted: false };
  }

  public spawnMob(type: MobType, position: THREE.Vector3): ActiveMob {
    const id = `mob_${type}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    let parts: any;
    let mat: THREE.MeshLambertMaterial;

    if (this.chunkManager) {
      const groundY = this.getGroundYAt(position.x, position.y, position.z);
      position.y = type === "bird" ? Math.max(groundY + 12, 32) : groundY;
    }

    if (type === "zombie") {
      mat = this.zombieMaterial.clone();
      parts = EntityModelBuilder.buildHumanoid(mat, "zombie");
    } else if (type === "steve") {
      mat = this.playerMaterial.clone();
      parts = EntityModelBuilder.buildSteveCompanion(mat);
    } else if (type === "alex") {
      mat = EntityModelBuilder.createMobMaterial("alex");
      parts = EntityModelBuilder.buildSteveCompanion(mat);
    } else if (type === "miner") {
      mat = EntityModelBuilder.createMobMaterial("miner");
      parts = EntityModelBuilder.buildSteveCompanion(mat);
    } else if (type === "knight") {
      mat = EntityModelBuilder.createMobMaterial("knight");
      parts = EntityModelBuilder.buildSteveCompanion(mat);
    } else if (type === "engineer") {
      mat = EntityModelBuilder.createMobMaterial("engineer");
      parts = EntityModelBuilder.buildSteveCompanion(mat);
    } else if (type === "skeleton") {
      mat = this.skeletonMaterial.clone();
      parts = EntityModelBuilder.buildHumanoid(mat, "skeleton");
    } else if (type === "enderman") {
      mat = this.endermanMaterial.clone();
      parts = EntityModelBuilder.buildHumanoid(mat, "enderman", 1 / 12); // taller scale
    } else if (type === "creeper") {
      mat = this.creeperMaterial.clone();
      parts = EntityModelBuilder.buildCreeper(mat);
    } else if (type === "cow") {
      mat = this.cowMaterial.clone();
      parts = EntityModelBuilder.buildQuadruped(mat, "cow");
    } else if (type === "sheep") {
      mat = this.sheepMaterial.clone();
      parts = EntityModelBuilder.buildQuadruped(mat, "sheep");
    } else if (type === "pig") {
      mat = this.pigMaterial.clone();
      parts = EntityModelBuilder.buildQuadruped(mat, "pig");
    } else if (type === "bird") {
      mat = this.birdMaterial.clone();
      parts = EntityModelBuilder.buildBird(mat);
    } else if (type === "villager") {
      mat = this.villagerMaterial.clone();
      parts = EntityModelBuilder.buildVillager(mat);
    } else if (type === "wolf" || type === "pet_wolf") {
      mat = new THREE.MeshLambertMaterial({
        color: type === "pet_wolf" ? 0xe5e7eb : 0x9ca3af,
      });
      parts = EntityModelBuilder.buildWolf(mat, type === "pet_wolf");
    } else {
      mat = this.pigMaterial.clone();
      parts = EntityModelBuilder.buildQuadruped(mat, "pig");
    }

    parts.group.position.copy(position);
    this.scene.add(parts.group);

    const initialRotation = Math.random() * Math.PI * 2;
    const mob: ActiveMob = {
      id,
      type,
      parts,
      meshGroup: parts.group,
      position: position.clone(),
      velocity: new THREE.Vector3(0, 0, 0),
      rotationY: initialRotation,
      targetRotationY: initialRotation,
      targetPos: null,
      state: "wander",
      stateTimer: 2 + Math.random() * 3,
      fuseTimer: 0,
      health: 20,
      walkCycle: Math.random() * 10,
      walkSpeed: type === "bird" ? 0.7 : 0.38,
      material: mat,
      attackCooldown: 0,
    };

    mob.targetPos = this.findWalkableWanderTarget(mob, 8);
    mob.targetRotationY = Math.atan2(
      mob.targetPos.x - mob.position.x,
      mob.targetPos.z - mob.position.z,
    );

    this.mobs.set(id, mob);
    return mob;
  }

  public getMobCount(): number {
    return this.mobs.size;
  }

  /**
   * Checks if a voxel block is solid for mob navigation and collisions.
   */
  public isBlockSolid(blockId: number): boolean {
    if (
      blockId === BLOCK.AIR ||
      blockId === BLOCK.WATER ||
      blockId === BLOCK.TORCH ||
      blockId === BLOCK.LAVA
    ) {
      return false;
    }
    const def = BLOCK_DEFS[blockId];
    if (def && def.solid === false) {
      return false;
    }
    return true;
  }

  /**
   * Resolves ground Y level near the given position (handles slopes, overhangs, and caves).
   */
  public getGroundYAt(x: number, yHint: number, z: number): number {
    if (!this.chunkManager) return Math.floor(yHint);

    const ix = Math.floor(x);
    const iz = Math.floor(z);

    // If chunkManager has getBlockGlobal, scan locally near mob's current elevation
    if (typeof this.chunkManager.getBlockGlobal === "function") {
      const startY = Math.min(63, Math.floor(yHint) + 3);
      const endY = Math.max(1, Math.floor(yHint) - 8);

      for (let y = startY; y >= endY; y--) {
        const b = this.chunkManager.getBlockGlobal(ix, y, iz);
        if (this.isBlockSolid(b)) {
          const above = this.chunkManager.getBlockGlobal(ix, y + 1, iz);
          if (!this.isBlockSolid(above)) {
            return y + 1; // Walkable surface
          }
        }
      }
    }

    if (typeof this.chunkManager.getTopGroundY === "function") {
      return this.chunkManager.getTopGroundY(x, z);
    }

    return yHint;
  }

  /**
   * Finds a walkable destination on the terrain within a search radius for wandering mobs.
   */
  public findWalkableWanderTarget(
    mob: ActiveMob,
    radius: number = 8,
  ): THREE.Vector3 {
    let bestTarget: THREE.Vector3 | null = null;
    let minScore = 999;

    // Probe candidate directions around the mob
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 3.5 + Math.random() * (radius - 3.5);
      const candX = mob.position.x + Math.sin(angle) * dist;
      const candZ = mob.position.z + Math.cos(angle) * dist;
      const groundY = this.getGroundYAt(candX, mob.position.y, candZ);

      // Avoid lava or dangerous blocks at destination
      if (
        this.chunkManager &&
        typeof this.chunkManager.getBlockGlobal === "function"
      ) {
        const footBlock = this.chunkManager.getBlockGlobal(
          Math.floor(candX),
          Math.floor(groundY - 1),
          Math.floor(candZ),
        );
        if (footBlock === BLOCK.LAVA) continue;
      }

      const heightDiff = Math.abs(groundY - mob.position.y);
      if (heightDiff <= 2.5 && heightDiff < minScore) {
        minScore = heightDiff;
        bestTarget = new THREE.Vector3(candX, groundY, candZ);
      }
    }

    if (bestTarget) {
      return bestTarget;
    }

    // Fallback: pick a gentle random offset
    const angle = Math.random() * Math.PI * 2;
    const dist = 4.0;
    const fx = mob.position.x + Math.sin(angle) * dist;
    const fz = mob.position.z + Math.cos(angle) * dist;
    const fy = this.getGroundYAt(fx, mob.position.y, fz);
    return new THREE.Vector3(fx, fy, fz);
  }

  /**
   * Checks if there is a clear unblocked line of sight between two positions (no solid blocks).
   */
  public hasLineOfSight(from: THREE.Vector3, to: THREE.Vector3): boolean {
    if (!this.chunkManager || typeof this.chunkManager.raycast !== "function") {
      return true;
    }
    const eyeFrom = from.clone().add(new THREE.Vector3(0, 1.4, 0));
    const eyeTo = to.clone().add(new THREE.Vector3(0, 1.0, 0));
    const dir = new THREE.Vector3().subVectors(eyeTo, eyeFrom);
    const dist = dir.length();
    if (dist < 0.3) return true;
    dir.normalize();
    const hit = this.chunkManager.raycast(eyeFrom, dir, dist - 0.2);
    // If raycast hits a solid block, line of sight is obstructed
    return !hit;
  }

  public update(
    deltaTime: number,
    playerPosition: THREE.Vector3,
    onExplosion?: (pos: THREE.Vector3, radius: number) => void,
  ): void {
    const toRemove: string[] = [];

    this.mobs.forEach((mob, id) => {
      // Calculate 3D and horizontal distance and elevation to player
      const dx = playerPosition.x - mob.position.x;
      const dy = playerPosition.y - mob.position.y;
      const dz = playerPosition.z - mob.position.z;
      const horizontalDist = Math.sqrt(dx * dx + dz * dz);
      const dist3D = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const distToPlayer = horizontalDist;

      mob.stateTimer -= deltaTime;
      if (mob.attackCooldown > 0) {
        mob.attackCooldown -= deltaTime;
      }

      // Distant mobs (> 50 blocks) pause AI to preserve 60 FPS and avoid probing unloaded chunks
      if (distToPlayer > 50) {
        return;
      }

      // Peaceful animals, villagers & birds wander on their own independently of player
      if (
        mob.type === "cow" ||
        mob.type === "sheep" ||
        mob.type === "pig" ||
        mob.type === "villager"
      ) {
        // If Villager is close to player (< 3.5 blocks), look at player and greet!
        if (mob.type === "villager" && distToPlayer < 3.5) {
          mob.targetRotationY = Math.atan2(dx, dz);
          mob.walkSpeed = 0;
          mob.state = "idle";
          if (Math.random() < 0.005) {
            sound.playVillager("idle");
          }
        } else if (mob.state === "wander") {
          const distToTarget = mob.targetPos
            ? Math.hypot(
                mob.targetPos.x - mob.position.x,
                mob.targetPos.z - mob.position.z,
              )
            : 0;

          if (!mob.targetPos || distToTarget < 1.0 || mob.stateTimer <= 0) {
            mob.state = "idle";
            mob.walkSpeed = 0;
            mob.targetPos = null;
            mob.stateTimer = 1.8 + Math.random() * 3.0;
          } else {
            mob.targetRotationY = Math.atan2(
              mob.targetPos.x - mob.position.x,
              mob.targetPos.z - mob.position.z,
            );
            mob.walkSpeed = 0.38;
          }
        } else {
          // Idle state: look around periodically, then wander
          mob.walkSpeed = 0;
          if (Math.random() < 0.02) {
            mob.targetRotationY += (Math.random() - 0.5) * 1.5;
          }
          if (mob.stateTimer <= 0) {
            mob.state = "wander";
            mob.targetPos = this.findWalkableWanderTarget(mob, 8);
            mob.targetRotationY = Math.atan2(
              mob.targetPos.x - mob.position.x,
              mob.targetPos.z - mob.position.z,
            );
            mob.walkSpeed = 0.38;
            mob.stateTimer = 4.0 + Math.random() * 4.5;
          }
        }
      } else if (mob.type === "bird") {
        if (mob.state === "wander") {
          const distToTarget = mob.targetPos
            ? Math.hypot(
                mob.targetPos.x - mob.position.x,
                mob.targetPos.z - mob.position.z,
              )
            : 0;
          if (!mob.targetPos || distToTarget < 2.0 || mob.stateTimer <= 0) {
            mob.state = "idle";
            mob.walkSpeed = 0.25;
            mob.targetPos = null;
            mob.stateTimer = 2.0 + Math.random() * 3.0;
          } else {
            mob.targetRotationY = Math.atan2(
              mob.targetPos.x - mob.position.x,
              mob.targetPos.z - mob.position.z,
            );
            mob.walkSpeed = 0.75;
          }
        } else {
          if (Math.random() < 0.03) {
            mob.targetRotationY += (Math.random() - 0.5) * 0.8;
          }
          if (mob.stateTimer <= 0) {
            mob.state = "wander";
            const flyDist = 15 + Math.random() * 20;
            const flyAngle = Math.random() * Math.PI * 2;
            mob.targetPos = new THREE.Vector3(
              mob.position.x + Math.sin(flyAngle) * flyDist,
              mob.position.y,
              mob.position.z + Math.cos(flyAngle) * flyDist,
            );
            mob.targetRotationY = flyAngle;
            mob.walkSpeed = 0.75;
            mob.stateTimer = 6.0 + Math.random() * 6.0;
          }
        }
      } else if (mob.type === "pet_wolf") {
        let nearestHostile: ActiveMob | null = null;
        let nearestHostileDist = 18.0;

        this.mobs.forEach((other) => {
          if (
            other.type === "zombie" ||
            other.type === "skeleton" ||
            other.type === "creeper" ||
            other.type === "enderman"
          ) {
            const d = mob.position.distanceTo(other.position);
            if (d < nearestHostileDist) {
              nearestHostileDist = d;
              nearestHostile = other;
            }
          }
        });

        if (nearestHostile) {
          const target: ActiveMob = nearestHostile;
          const hx = target.position.x - mob.position.x;
          const hz = target.position.z - mob.position.z;
          const hDist = Math.hypot(hx, hz);

          if (hDist < 1.4) {
            mob.walkSpeed = 0;
            if (mob.attackCooldown <= 0) {
              mob.attackCooldown = 0.8;
              target.health -= 5;
              sound.playHurt();
              target.material.color.setHex(0xff0000);
              setTimeout(
                () => target.material && target.material.color.setHex(0xffffff),
                200,
              );
            }
          } else {
            mob.state = "chase";
            mob.targetPos = target.position.clone();
            mob.targetRotationY = Math.atan2(hx, hz);
            mob.walkSpeed = 0.85;
          }
        } else {
          const px = playerPosition.x - mob.position.x;
          const pz = playerPosition.z - mob.position.z;
          const pDist = Math.hypot(px, pz);

          if (pDist > 22.0) {
            mob.position.copy(playerPosition).add(new THREE.Vector3(1, 0, 1));
            mob.meshGroup.position.copy(mob.position);
          } else if (pDist > 3.5) {
            mob.state = "chase";
            mob.targetPos = playerPosition.clone();
            mob.targetRotationY = Math.atan2(px, pz);
            mob.walkSpeed = 0.65;
          } else {
            mob.walkSpeed = 0;
            mob.state = "idle";
            mob.targetRotationY = Math.atan2(px, pz);
          }
        }
      } else if (mob.type === "steve") {
        if (dist3D < 3.0 && Math.abs(dy) <= 2.0) {
          // Close to player: stop walking and stand politely facing player
          mob.walkSpeed = 0;
          mob.targetRotationY = Math.atan2(dx, dz);
          mob.state = "idle";
          mob.targetPos = null;

          // Give food gift if cooldown ready (ONLY Steve, count: 1)
          if (dist3D < 2.8 && mob.attackCooldown <= 0) {
            mob.attackCooldown = 30.0; // 30s gift cooldown
            if (this.onFriendlyPetGiveFood) {
              const foods = ["apple", "bread", "cooked_beef"];
              const randomFood =
                foods[Math.floor(Math.random() * foods.length)];
              this.onFriendlyPetGiveFood(mob.position.clone(), randomFood);
            }
          }
        } else if (dist3D < 16 && Math.abs(dy) <= 6.0) {
          // Follow player at friendly distance
          mob.state = "chase";
          mob.targetRotationY = Math.atan2(dx, dz);
          mob.walkSpeed = 0.58;
          mob.targetPos = null;
        } else {
          // Wander nearby terrain naturally
          if (mob.state === "wander") {
            const distToTarget = mob.targetPos
              ? Math.hypot(
                  mob.targetPos.x - mob.position.x,
                  mob.targetPos.z - mob.position.z,
                )
              : 0;
            if (!mob.targetPos || distToTarget < 1.0 || mob.stateTimer <= 0) {
              mob.state = "idle";
              mob.walkSpeed = 0;
              mob.targetPos = null;
              mob.stateTimer = 2.0 + Math.random() * 3.0;
            } else {
              mob.targetRotationY = Math.atan2(
                mob.targetPos.x - mob.position.x,
                mob.targetPos.z - mob.position.z,
              );
              mob.walkSpeed = 0.42;
            }
          } else {
            mob.walkSpeed = 0;
            if (Math.random() < 0.02) {
              mob.targetRotationY += (Math.random() - 0.5) * 1.5;
            }
            if (mob.stateTimer <= 0) {
              mob.state = "wander";
              mob.targetPos = this.findWalkableWanderTarget(mob, 7);
              mob.targetRotationY = Math.atan2(
                mob.targetPos.x - mob.position.x,
                mob.targetPos.z - mob.position.z,
              );
              mob.walkSpeed = 0.42;
              mob.stateTimer = 3.5 + Math.random() * 4.0;
            }
          }
        }
      } else if (
        mob.type === "alex" ||
        mob.type === "miner" ||
        mob.type === "knight" ||
        mob.type === "engineer"
      ) {
        if (dist3D < 3.0 && Math.abs(dy) <= 2.0) {
          mob.walkSpeed = 0;
          mob.targetRotationY = Math.atan2(dx, dz);
          mob.state = "idle";
          mob.targetPos = null;
        } else if (dist3D < 16 && Math.abs(dy) <= 6.0) {
          mob.state = "chase";
          mob.targetRotationY = Math.atan2(dx, dz);
          mob.walkSpeed = 0.58;
          mob.targetPos = null;
        } else {
          if (mob.state === "wander") {
            const distToTarget = mob.targetPos
              ? Math.hypot(
                  mob.targetPos.x - mob.position.x,
                  mob.targetPos.z - mob.position.z,
                )
              : 0;
            if (!mob.targetPos || distToTarget < 1.0 || mob.stateTimer <= 0) {
              mob.state = "idle";
              mob.walkSpeed = 0;
              mob.targetPos = null;
              mob.stateTimer = 2.0 + Math.random() * 3.0;
            } else {
              mob.targetRotationY = Math.atan2(
                mob.targetPos.x - mob.position.x,
                mob.targetPos.z - mob.position.z,
              );
              mob.walkSpeed = 0.42;
            }
          } else {
            mob.walkSpeed = 0;
            if (Math.random() < 0.02) {
              mob.targetRotationY += (Math.random() - 0.5) * 1.5;
            }
            if (mob.stateTimer <= 0) {
              mob.state = "wander";
              mob.targetPos = this.findWalkableWanderTarget(mob, 7);
              mob.targetRotationY = Math.atan2(
                mob.targetPos.x - mob.position.x,
                mob.targetPos.z - mob.position.z,
              );
              mob.walkSpeed = 0.42;
              mob.stateTimer = 3.5 + Math.random() * 4.0;
            }
          }
        }
      } else if (
        dist3D < 16 &&
        Math.abs(dy) <= 6.0 &&
        this.hasLineOfSight(mob.position, playerPosition)
      ) {
        // Hostile monsters chase aggressively only if they have direct line of sight and player is reachable
        mob.state = "chase";
        mob.targetPos = null;
        mob.targetRotationY = Math.atan2(dx, dz);

        if (mob.type === "skeleton") {
          // Skeleton keeps 7-12 block archery distance and shoots arrows ONLY with line of sight
          mob.walkSpeed = dist3D < 7 ? 0 : 0.7;
          if (mob.attackCooldown <= 0) {
            mob.attackCooldown = 2.0; // 2s arrow shot
            const kx = Math.sin(mob.rotationY) * 2.5;
            const kz = Math.cos(mob.rotationY) * 2.5;
            if (this.onPlayerAttackedByMob) {
              this.onPlayerAttackedByMob(2, { x: kx, y: 2.2, z: kz });
            }
          }
        } else if (mob.type === "enderman") {
          // Enderman moves fast and attacks within 1.8 blocks in 3D
          mob.walkSpeed = 1.3;
          if (dist3D < 1.8 && Math.abs(dy) <= 1.8 && mob.attackCooldown <= 0) {
            mob.attackCooldown = 1.0;
            const kx = Math.sin(mob.rotationY) * 4.5;
            const kz = Math.cos(mob.rotationY) * 4.5;
            if (this.onPlayerAttackedByMob) {
              this.onPlayerAttackedByMob(4, { x: kx, y: 3.5, z: kz });
            }
            // Teleport nearby
            const tpAngle = Math.random() * Math.PI * 2;
            mob.position.x += Math.cos(tpAngle) * 7.0;
            mob.position.z += Math.sin(tpAngle) * 7.0;
          }
        } else {
          mob.walkSpeed = 1.0;
        }

        // Zombie Melee Attack (< 1.6 blocks in 3D, and same elevation)
        if (
          mob.type === "zombie" &&
          dist3D < 1.6 &&
          Math.abs(dy) <= 1.4 &&
          mob.attackCooldown <= 0
        ) {
          mob.attackCooldown = 1.0; // 1s attack cooldown
          const kx = Math.sin(mob.rotationY) * 3.5;
          const kz = Math.cos(mob.rotationY) * 3.5;
          if (this.onPlayerAttackedByMob) {
            this.onPlayerAttackedByMob(3, { x: kx, y: 3.2, z: kz });
          }
        }

        // Creeper close fuse logic (< 3.2 blocks in 3D, and same elevation)
        if (mob.type === "creeper") {
          if (dist3D < 3.2 && Math.abs(dy) <= 2.0) {
            mob.state = "fusing";
            mob.walkSpeed = 0.2;
            mob.fuseTimer += deltaTime;

            // Flash white when fusing
            const flash = Math.sin(mob.fuseTimer * 20) > 0;
            mob.material.color.setHex(flash ? 0xffffff : 0x88ff88);

            if (mob.fuseTimer >= 1.5) {
              // DETONATE!
              toRemove.push(id);
              if (onExplosion) {
                onExplosion(mob.position.clone(), 3.5);
              }
              if (dist3D < 5.0 && this.onPlayerAttackedByMob) {
                const explosionDamage = Math.max(
                  2,
                  Math.floor(18 * (1.0 - dist3D / 5.0)),
                );
                const dirX =
                  (playerPosition.x - mob.position.x) / (dist3D || 1);
                const dirZ =
                  (playerPosition.z - mob.position.z) / (dist3D || 1);
                this.onPlayerAttackedByMob(explosionDamage, {
                  x: dirX * 6.5,
                  y: 4.8,
                  z: dirZ * 6.5,
                });
              }
              return;
            }
          } else {
            mob.fuseTimer = Math.max(0, mob.fuseTimer - deltaTime * 0.5);
            mob.material.color.setHex(0xffffff);
          }
        }
      } else {
        // Active wandering and patrolling when player is underground, behind walls, or far away
        if (mob.type === "creeper" && mob.fuseTimer > 0) {
          mob.fuseTimer = Math.max(0, mob.fuseTimer - deltaTime);
          mob.material.color.setHex(0xffffff);
        }

        if (mob.state === "wander") {
          const distToTarget = mob.targetPos
            ? Math.hypot(
                mob.targetPos.x - mob.position.x,
                mob.targetPos.z - mob.position.z,
              )
            : 0;

          if (!mob.targetPos || distToTarget < 1.0 || mob.stateTimer <= 0) {
            mob.state = "idle";
            mob.walkSpeed = 0;
            mob.targetPos = null;
            mob.stateTimer = 1.8 + Math.random() * 2.5;
          } else {
            mob.targetRotationY = Math.atan2(
              mob.targetPos.x - mob.position.x,
              mob.targetPos.z - mob.position.z,
            );
            mob.walkSpeed = 0.42;
          }
        } else {
          // Idle state for monster: look around periodically, then wander
          mob.walkSpeed = 0;
          if (Math.random() < 0.025) {
            mob.targetRotationY += (Math.random() - 0.5) * 1.8;
          }
          if (mob.stateTimer <= 0) {
            mob.state = "wander";
            mob.targetPos = this.findWalkableWanderTarget(mob, 8);
            mob.targetRotationY = Math.atan2(
              mob.targetPos.x - mob.position.x,
              mob.targetPos.z - mob.position.z,
            );
            mob.walkSpeed = 0.42;
            mob.stateTimer = 3.5 + Math.random() * 4.5;
          }
        }
      }

      // Smooth rotate towards target angle
      let angleDiff = mob.targetRotationY - mob.rotationY;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      mob.rotationY += angleDiff * Math.min(1, deltaTime * 6.0);
      mob.meshGroup.rotation.y = mob.rotationY;

      // Move forward if walking with obstacle avoidance & step-assist
      if (mob.walkSpeed > 0.05) {
        const speedMultiplier =
          mob.type === "creeper"
            ? 2.4
            : mob.type === "enderman" && mob.state === "chase"
              ? 3.2
              : 2.2;
        const currentSpeed = mob.walkSpeed * speedMultiplier;
        const stepDist = currentSpeed * deltaTime;

        if (mob.type === "bird") {
          mob.position.x += Math.sin(mob.rotationY) * stepDist;
          mob.position.z += Math.cos(mob.rotationY) * stepDist;
          mob.walkCycle += deltaTime * 8.0 * mob.walkSpeed;
        } else {
          // Ground navigation with obstacle detection & step-assist (auto-jump 1 block)
          const probeDist = 0.6;
          const aheadX = mob.position.x + Math.sin(mob.rotationY) * probeDist;
          const aheadZ = mob.position.z + Math.cos(mob.rotationY) * probeDist;
          const aheadGroundY = this.getGroundYAt(
            aheadX,
            mob.position.y,
            aheadZ,
          );
          const heightDiff = aheadGroundY - mob.position.y;

          let isBlocked = false;
          if (heightDiff > 1.25) {
            // High wall (2+ blocks high)
            isBlocked = true;
          } else if (heightDiff < -3.5 && mob.state !== "chase") {
            // Steep drop off / cliff when wandering
            isBlocked = true;
          }

          if (isBlocked) {
            // Pathfinding steering: probe left and right angles to find open passage
            const leftAngle = mob.rotationY + Math.PI * 0.38;
            const rightAngle = mob.rotationY - Math.PI * 0.38;

            const leftGroundY = this.getGroundYAt(
              mob.position.x + Math.sin(leftAngle) * probeDist,
              mob.position.y,
              mob.position.z + Math.cos(leftAngle) * probeDist,
            );
            const rightGroundY = this.getGroundYAt(
              mob.position.x + Math.sin(rightAngle) * probeDist,
              mob.position.y,
              mob.position.z + Math.cos(rightAngle) * probeDist,
            );

            const leftDiff = Math.abs(leftGroundY - mob.position.y);
            const rightDiff = Math.abs(rightGroundY - mob.position.y);

            if (leftDiff <= 1.25 && leftDiff <= rightDiff) {
              mob.targetRotationY = leftAngle;
            } else if (rightDiff <= 1.25) {
              mob.targetRotationY = rightAngle;
            } else {
              // Dead end: turn around and repath
              mob.targetRotationY += Math.PI * 0.75;
              mob.targetPos = null;
              mob.state = "idle";
              mob.stateTimer = 1.0;
            }
          } else {
            // Clear or step-able path: advance
            mob.position.x += Math.sin(mob.rotationY) * stepDist;
            mob.position.z += Math.cos(mob.rotationY) * stepDist;
            mob.walkCycle += deltaTime * 8.0 * mob.walkSpeed;

            // Step-assist: smoothly ascend 1-block steps
            if (heightDiff > 0 && heightDiff <= 1.25) {
              mob.position.y = Math.min(
                aheadGroundY,
                mob.position.y + deltaTime * 8.0,
              );
            }
          }
        }
      }

      // Ground / Flight altitude alignment
      if (mob.type === "bird") {
        const topY = this.getGroundYAt(
          mob.position.x,
          mob.position.y,
          mob.position.z,
        );
        const targetFlyY = topY + 14 + Math.sin(mob.walkCycle * 0.4) * 3;
        mob.position.y = THREE.MathUtils.lerp(
          mob.position.y,
          targetFlyY,
          Math.min(1.0, deltaTime * 4.0),
        );
      } else {
        const groundY = this.getGroundYAt(
          mob.position.x,
          mob.position.y,
          mob.position.z,
        );
        if (mob.position.y < groundY) {
          mob.position.y = groundY;
        } else if (mob.position.y > groundY) {
          mob.position.y = THREE.MathUtils.lerp(
            mob.position.y,
            groundY,
            Math.min(1.0, deltaTime * 14.0),
          );
        }
      }

      mob.meshGroup.position.copy(mob.position);

      // Animate limb swings / wings procedurally via EntityModelBuilder
      if (mob.type === "cow" || mob.type === "sheep" || mob.type === "pig") {
        EntityModelBuilder.animateQuadrupedWalk(
          mob.parts,
          mob.walkCycle,
          mob.walkSpeed,
        );
      } else if (mob.type === "bird") {
        EntityModelBuilder.animateBirdFlight(
          mob.parts as BirdParts,
          mob.walkCycle,
        );
      } else if (mob.type === "creeper") {
        const fuseProgress = Math.min(1.0, mob.fuseTimer / 1.5);
        EntityModelBuilder.animateCreeperWalk(
          mob.parts as CreeperParts,
          mob.walkCycle,
          mob.walkSpeed,
          fuseProgress,
        );
      } else {
        EntityModelBuilder.animateHumanoidWalk(
          mob.parts as HumanoidParts,
          mob.walkCycle,
          mob.walkSpeed,
        );
      }
    });

    for (const id of toRemove) {
      const mob = this.mobs.get(id);
      if (mob) {
        this.scene.remove(mob.meshGroup);
        this.mobs.delete(id);
      }
    }
  }

  public clearAll(): void {
    this.mobs.forEach((mob) => {
      this.scene.remove(mob.meshGroup);
    });
    this.mobs.clear();
  }
}
