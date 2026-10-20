import * as THREE from "three";
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
  | "bird";

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

  public spawnMob(type: MobType, position: THREE.Vector3): ActiveMob {
    const id = `mob_${type}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    let parts: any;
    let mat: THREE.MeshLambertMaterial;

    if (
      this.chunkManager &&
      typeof this.chunkManager.getTopGroundY === "function"
    ) {
      const topY = this.chunkManager.getTopGroundY(position.x, position.z);
      position.y = topY;
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
      position.y = Math.max(position.y + 12, 32);
    } else {
      mat = this.pigMaterial.clone();
      parts = EntityModelBuilder.buildQuadruped(mat, "pig");
    }

    parts.group.position.copy(position);
    this.scene.add(parts.group);

    const mob: ActiveMob = {
      id,
      type,
      parts,
      meshGroup: parts.group,
      position: position.clone(),
      velocity: new THREE.Vector3(0, 0, 0),
      rotationY: Math.random() * Math.PI * 2,
      targetRotationY: 0,
      targetPos: null,
      state: "wander",
      stateTimer: 2 + Math.random() * 3,
      fuseTimer: 0,
      health: 20,
      walkCycle: Math.random() * 10,
      walkSpeed: 0,
      material: mat,
      attackCooldown: 0,
    };

    this.mobs.set(id, mob);
    return mob;
  }

  public getMobCount(): number {
    return this.mobs.size;
  }

  public update(
    deltaTime: number,
    playerPosition: THREE.Vector3,
    onExplosion?: (pos: THREE.Vector3, radius: number) => void,
  ): void {
    const toRemove: string[] = [];

    this.mobs.forEach((mob, id) => {
      // Calculate distance to player
      const dx = playerPosition.x - mob.position.x;
      const dz = playerPosition.z - mob.position.z;
      const distToPlayer = Math.sqrt(dx * dx + dz * dz);

      mob.stateTimer -= deltaTime;
      if (mob.attackCooldown > 0) {
        mob.attackCooldown -= deltaTime;
      }

      // Peaceful animals & birds wander on their own independently of player
      if (
        mob.type === "cow" ||
        mob.type === "sheep" ||
        mob.type === "pig" ||
        mob.type === "bird"
      ) {
        if (mob.stateTimer <= 0) {
          if (mob.state === "idle") {
            mob.state = "wander";
            mob.targetRotationY = Math.random() * Math.PI * 2;
            mob.walkSpeed = mob.type === "bird" ? 0.7 : 0.4;
            mob.stateTimer = 4 + Math.random() * 5;
          } else {
            mob.state = "idle";
            mob.walkSpeed = 0;
            mob.stateTimer = 2 + Math.random() * 3;
          }
        }
      } else if (mob.type === "steve") {
        if (distToPlayer < 3.0) {
          // Close to player: stop walking and stand politely facing player
          mob.walkSpeed = 0;
          mob.targetRotationY = Math.atan2(dx, dz);
          mob.state = "idle";

          // Give food gift if cooldown ready (ONLY Steve, count: 1)
          if (distToPlayer < 2.8 && mob.attackCooldown <= 0) {
            mob.attackCooldown = 30.0; // 30s gift cooldown
            if (this.onFriendlyPetGiveFood) {
              const foods = ["apple", "bread", "cooked_beef"];
              const randomFood =
                foods[Math.floor(Math.random() * foods.length)];
              this.onFriendlyPetGiveFood(mob.position.clone(), randomFood);
            }
          }
        } else if (distToPlayer < 16) {
          // Follow player at friendly distance
          mob.state = "chase";
          mob.targetRotationY = Math.atan2(dx, dz);
          mob.walkSpeed = 0.6;
        } else {
          // Wander peacefully
          if (mob.stateTimer <= 0) {
            mob.state = mob.state === "idle" ? "wander" : "idle";
            mob.targetRotationY = Math.random() * Math.PI * 2;
            mob.walkSpeed = mob.state === "wander" ? 0.4 : 0;
            mob.stateTimer = 3 + Math.random() * 3;
          }
        }
      } else if (
        mob.type === "alex" ||
        mob.type === "miner" ||
        mob.type === "knight" ||
        mob.type === "engineer"
      ) {
        if (distToPlayer < 3.0) {
          mob.walkSpeed = 0;
          mob.targetRotationY = Math.atan2(dx, dz);
          mob.state = "idle";
        } else if (distToPlayer < 16) {
          mob.state = "chase";
          mob.targetRotationY = Math.atan2(dx, dz);
          mob.walkSpeed = 0.6;
        } else {
          if (mob.stateTimer <= 0) {
            mob.state = mob.state === "idle" ? "wander" : "idle";
            mob.targetRotationY = Math.random() * Math.PI * 2;
            mob.walkSpeed = mob.state === "wander" ? 0.4 : 0;
            mob.stateTimer = 3 + Math.random() * 3;
          }
        }
      } else if (distToPlayer < 16) {
        // Hostile monsters (Zombie, Creeper, Skeleton, Enderman) chase aggressively
        mob.state = "chase";
        mob.targetRotationY = Math.atan2(dx, dz);

        if (mob.type === "skeleton") {
          // Skeleton keeps 8-12 block archery distance and shoots arrows
          mob.walkSpeed = distToPlayer < 7 ? 0 : 0.7;
          if (mob.attackCooldown <= 0) {
            mob.attackCooldown = 2.0; // 2s arrow shot
            const kx = Math.sin(mob.rotationY) * 2.5;
            const kz = Math.cos(mob.rotationY) * 2.5;
            if (this.onPlayerAttackedByMob) {
              this.onPlayerAttackedByMob(2, { x: kx, y: 2.2, z: kz });
            }
          }
        } else if (mob.type === "enderman") {
          // Enderman moves fast and teleports on hit
          mob.walkSpeed = 1.3;
          if (distToPlayer < 1.8 && mob.attackCooldown <= 0) {
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

        // Zombie Melee Attack (< 1.4 blocks)
        if (
          mob.type === "zombie" &&
          distToPlayer < 1.4 &&
          mob.attackCooldown <= 0
        ) {
          mob.attackCooldown = 1.0; // 1s attack cooldown
          const kx = Math.sin(mob.rotationY) * 3.5;
          const kz = Math.cos(mob.rotationY) * 3.5;
          if (this.onPlayerAttackedByMob) {
            this.onPlayerAttackedByMob(3, { x: kx, y: 3.2, z: kz });
          }
        }

        // Creeper close fuse logic
        if (mob.type === "creeper") {
          if (distToPlayer < 3.2) {
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
              if (distToPlayer < 5.0 && this.onPlayerAttackedByMob) {
                const explosionDamage = Math.max(
                  2,
                  Math.floor(18 * (1.0 - distToPlayer / 5.0)),
                );
                const dirX =
                  (playerPosition.x - mob.position.x) / (distToPlayer || 1);
                const dirZ =
                  (playerPosition.z - mob.position.z) / (distToPlayer || 1);
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
        // Wandering / Idle
        if (mob.stateTimer <= 0) {
          if (mob.state === "idle") {
            mob.state = "wander";
            mob.targetRotationY = Math.random() * Math.PI * 2;
            mob.walkSpeed = 0.5;
            mob.stateTimer = 3 + Math.random() * 4;
          } else {
            mob.state = "idle";
            mob.walkSpeed = 0;
            mob.stateTimer = 2 + Math.random() * 2;
          }
        }
      }

      // Smooth rotate towards target angle
      let angleDiff = mob.targetRotationY - mob.rotationY;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      mob.rotationY += angleDiff * Math.min(1, deltaTime * 6.0);
      mob.meshGroup.rotation.y = mob.rotationY;

      // Move forward if walking
      if (mob.walkSpeed > 0.05) {
        const speed = mob.walkSpeed * (mob.type === "creeper" ? 2.5 : 2.2);
        mob.position.x += Math.sin(mob.rotationY) * speed * deltaTime;
        mob.position.z += Math.cos(mob.rotationY) * speed * deltaTime;
        mob.walkCycle += deltaTime * 8.0 * mob.walkSpeed;
      }

      // Ground / Flight altitude alignment
      if (
        this.chunkManager &&
        typeof this.chunkManager.getTopGroundY === "function"
      ) {
        const topY = this.chunkManager.getTopGroundY(
          mob.position.x,
          mob.position.z,
        );
        if (mob.type === "bird") {
          const targetFlyY = topY + 14 + Math.sin(mob.walkCycle * 0.4) * 3;
          mob.position.y = THREE.MathUtils.lerp(
            mob.position.y,
            targetFlyY,
            Math.min(1.0, deltaTime * 4.0),
          );
        } else {
          if (mob.position.y < topY) {
            mob.position.y = topY;
          } else {
            mob.position.y = THREE.MathUtils.lerp(
              mob.position.y,
              topY,
              Math.min(1.0, deltaTime * 12.0),
            );
          }
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
