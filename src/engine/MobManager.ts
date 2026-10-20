import * as THREE from 'three';
import { EntityModelBuilder, HumanoidParts, CreeperParts } from './EntityModelBuilder';

export type MobType = 'zombie' | 'creeper' | 'steve';

export interface ActiveMob {
  id: string;
  type: MobType;
  parts: HumanoidParts | CreeperParts;
  meshGroup: THREE.Group;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotationY: number;
  targetRotationY: number;
  targetPos: THREE.Vector3 | null;
  state: 'idle' | 'wander' | 'chase' | 'fusing';
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
  private zombieMaterial: THREE.MeshLambertMaterial;
  private creeperMaterial: THREE.MeshLambertMaterial;
  private playerMaterial: THREE.MeshLambertMaterial;

  // Callbacks
  public onPlayerAttackedByMob?: (damage: number, knockback: { x: number; y: number; z: number }) => void;
  public onMobKilled?: (type: MobType, pos: THREE.Vector3) => void;

  constructor(scene: THREE.Scene, _chunkManager?: any) {
    this.scene = scene;
    this.zombieMaterial = EntityModelBuilder.createMobMaterial('zombie');
    this.creeperMaterial = EntityModelBuilder.createMobMaterial('creeper');
    this.playerMaterial = EntityModelBuilder.createMobMaterial('player');
  }

  public clearAllMobs(): void {
    this.clearAll();
  }

  /**
   * Player melee attack against mobs in front of crosshair (reach ~3.5 blocks)
   */
  public hitMobAtRay(
    camera: THREE.PerspectiveCamera,
    weaponDamage: number = 4
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
    let parts: HumanoidParts | CreeperParts;
    let mat: THREE.MeshLambertMaterial;

    if (type === 'zombie') {
      mat = this.zombieMaterial.clone();
      parts = EntityModelBuilder.buildHumanoid(mat, 'zombie');
    } else if (type === 'steve') {
      mat = this.playerMaterial.clone();
      parts = EntityModelBuilder.buildHumanoid(mat, 'player');
    } else {
      mat = this.creeperMaterial.clone();
      parts = EntityModelBuilder.buildCreeper(mat);
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
      state: 'wander',
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
    onExplosion?: (pos: THREE.Vector3, radius: number) => void
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

      // Simple AI state logic
      if (distToPlayer < 14) {
        mob.state = 'chase';
        mob.targetRotationY = Math.atan2(dx, dz);
        mob.walkSpeed = 1.0;

        // Zombie Melee Attack (< 1.4 blocks)
        if (mob.type === 'zombie' && distToPlayer < 1.4 && mob.attackCooldown <= 0) {
          mob.attackCooldown = 1.0; // 1s attack cooldown
          const kx = Math.sin(mob.rotationY) * 3.5;
          const kz = Math.cos(mob.rotationY) * 3.5;
          if (this.onPlayerAttackedByMob) {
            this.onPlayerAttackedByMob(3, { x: kx, y: 3.2, z: kz });
          }
        }

        // Creeper close fuse logic
        if (mob.type === 'creeper') {
          if (distToPlayer < 3.2) {
            mob.state = 'fusing';
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
              // Deal explosion damage to player if within blast radius
              if (distToPlayer < 5.0 && this.onPlayerAttackedByMob) {
                const explosionDamage = Math.max(2, Math.floor(18 * (1.0 - distToPlayer / 5.0)));
                const dirX = (playerPosition.x - mob.position.x) / (distToPlayer || 1);
                const dirZ = (playerPosition.z - mob.position.z) / (distToPlayer || 1);
                this.onPlayerAttackedByMob(explosionDamage, { x: dirX * 6.5, y: 4.8, z: dirZ * 6.5 });
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
          if (mob.state === 'idle') {
            mob.state = 'wander';
            mob.targetRotationY = Math.random() * Math.PI * 2;
            mob.walkSpeed = 0.5;
            mob.stateTimer = 3 + Math.random() * 4;
          } else {
            mob.state = 'idle';
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
        const speed = mob.walkSpeed * (mob.type === 'creeper' ? 2.5 : 2.2);
        mob.position.x += Math.sin(mob.rotationY) * speed * deltaTime;
        mob.position.z += Math.cos(mob.rotationY) * speed * deltaTime;
        mob.walkCycle += deltaTime * 8.0 * mob.walkSpeed;
      }

      mob.meshGroup.position.copy(mob.position);

      // Animate limb swings procedurally via EntityModelBuilder
      if (mob.type === 'zombie') {
        EntityModelBuilder.animateHumanoidWalk(
          mob.parts as HumanoidParts,
          mob.walkCycle,
          mob.walkSpeed
        );
      } else if (mob.type === 'creeper') {
        const fuseProgress = Math.min(1.0, mob.fuseTimer / 1.5);
        EntityModelBuilder.animateCreeperWalk(
          mob.parts as CreeperParts,
          mob.walkCycle,
          mob.walkSpeed,
          fuseProgress
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
