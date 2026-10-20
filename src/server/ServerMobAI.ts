/**
 * Server-Side Mob Artificial Intelligence Module (Node.js)
 * 
 * Features:
 * 1. Finite State Machine (FSM):
 *    - IDLE: Pauses, scans for nearby players in 16-block detection radius
 *    - WANDER: Moves randomly across safe terrain
 *    - CHASE: Tracks target player, navigates around obstacles
 *    - ATTACK: Zombie melee attack (< 1.5 blocks) / Creeper detonation
 * 2. Creeper Detonation:
 *    - When distance < 3 blocks: activates 1.5-second fuse, swells & flashes
 *    - Defuses if player flees beyond 4.5 blocks
 *    - Explodes at fuse expiry: radius = 3 blocks, spherical voxel destruction & player damage
 * 3. Voxel Grid Pathfinding & Safety Navigation:
 *    - 1-block obstacle jump (steps up 1 block if 2 blocks headroom)
 *    - Pit avoidance: refuses to step into cliffs / pits > 3 blocks deep
 * 4. Hostile Mob Spawner:
 *    - Spawns Zombies & Creepers at distance 24–64 blocks from players
 *    - Checks for darkness (light < 7 or nighttime) & solid ground
 *    - Mob cap & automatic despawning beyond 72 blocks
 */

export const FSM_STATE = {
  IDLE: 'IDLE',
  WANDER: 'WANDER',
  CHASE: 'CHASE',
  ATTACK: 'ATTACK',
} as const;

export type FSMStateType = typeof FSM_STATE[keyof typeof FSM_STATE];

export interface PlayerTarget {
  id: string;
  x: number;
  y: number;
  z: number;
}

export interface ServerMob {
  id: string;
  type: 'zombie' | 'creeper' | 'steve';
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  vx: number;
  vy: number;
  vz: number;
  state: FSMStateType;
  targetPlayerId: string | null;
  wanderTarget: { x: number; y: number; z: number } | null;
  stateTimer: number;
  walkTime: number;
  isMoving: boolean;
  attackCooldown: number;
  health: number;
  // Creeper specific
  isFusing: boolean;
  fuseTimer: number;       // 1.5 seconds fuse
  fuseProgress: number;    // 0.0 to 1.0
}

export interface WorldAccessor {
  getBlock(gx: number, gy: number, gz: number): number;
  setBlock(gx: number, gy: number, gz: number, blockType: number): void;
  getLightLevel?(gx: number, gy: number, gz: number, isNight: boolean): number;
}

export interface MobAIConfig {
  detectionRadius?: number;     // 16 blocks default
  attackRadius?: number;        // 1.5 blocks for Zombie
  creeperFuseDistance?: number; // 3.0 blocks
  creeperCancelDistance?: number;// 4.5 blocks
  creeperFuseDuration?: number; // 1.5 seconds
  creeperExplosionRadius?: number; // 3 blocks
  maxFallDistance?: number;     // 3 blocks safety limit
  zombieSpeed?: number;         // blocks / sec
  creeperSpeed?: number;
  mobCap?: number;              // 20 mobs limit
}

export class ServerMobAIEngine {
  public mobs: Map<string, ServerMob> = new Map();
  private world: WorldAccessor;
  private config: Required<MobAIConfig>;
  private mobCounter: number = 0;
  private spawnTimer: number = 0;
  public isNight: boolean = false;

  // Event callbacks for network broadcasts
  public onBlockDestroyed?: (x: number, y: number, z: number, blockType: number) => void;
  public onExplosion?: (x: number, y: number, z: number, radius: number) => void;
  public onPlayerDamaged?: (playerId: string, damage: number, knockback: { x: number; y: number; z: number }) => void;
  public onMobSpawned?: (mob: ServerMob) => void;
  public onMobDespawned?: (mobId: string) => void;

  constructor(world: WorldAccessor, config: MobAIConfig = {}) {
    this.world = world;
    this.config = {
      detectionRadius: config.detectionRadius ?? 16.0,
      attackRadius: config.attackRadius ?? 1.5,
      creeperFuseDistance: config.creeperFuseDistance ?? 3.0,
      creeperCancelDistance: config.creeperCancelDistance ?? 4.5,
      creeperFuseDuration: config.creeperFuseDuration ?? 1.5,
      creeperExplosionRadius: config.creeperExplosionRadius ?? 3.0,
      maxFallDistance: config.maxFallDistance ?? 3,
      zombieSpeed: config.zombieSpeed ?? 2.2,
      creeperSpeed: config.creeperSpeed ?? 2.5,
      mobCap: config.mobCap ?? 20,
    };
  }

  /**
   * Spawns an individual mob with initial state
   */
  public spawnMob(
    type: 'zombie' | 'creeper' | 'steve',
    x: number,
    y: number,
    z: number
  ): ServerMob {
    const id = `mob_${type}_${++this.mobCounter}_${Date.now().toString(36)}`;
    const mob: ServerMob = {
      id,
      type,
      x,
      y,
      z,
      yaw: Math.random() * Math.PI * 2,
      pitch: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      state: FSM_STATE.IDLE,
      targetPlayerId: null,
      wanderTarget: null,
      stateTimer: 1.0 + Math.random() * 2.0,
      walkTime: 0,
      isMoving: false,
      attackCooldown: 0,
      health: type === 'creeper' ? 20 : 20,
      isFusing: false,
      fuseTimer: this.config.creeperFuseDuration,
      fuseProgress: 0,
    };

    this.mobs.set(id, mob);
    if (this.onMobSpawned) {
      this.onMobSpawned(mob);
    }
    return mob;
  }

  /**
   * Removes a mob from the server
   */
  public removeMob(mobId: string): void {
    if (this.mobs.delete(mobId)) {
      if (this.onMobDespawned) {
        this.onMobDespawned(mobId);
      }
    }
  }

  /**
   * Main 20 TPS server tick loop:
   * Updates FSM, pathfinding, obstacle navigation, attacks, and spawner
   */
  public update(delta: number, players: PlayerTarget[]): void {
    const dt = Math.min(0.1, delta);

    // 1. Spawner Tick
    this.updateSpawner(dt, players);

    // 2. Mob Behavior & FSM Update
    const mobList = Array.from(this.mobs.values());
    for (const mob of mobList) {
      this.updateMobFSM(mob, dt, players);
    }
  }

  /**
   * Finite State Machine (FSM) Transition Logic
   */
  private updateMobFSM(mob: ServerMob, dt: number, players: PlayerTarget[]): void {
    mob.walkTime += dt;
    if (mob.attackCooldown > 0) {
      mob.attackCooldown -= dt;
    }

    // Check distance to closest player
    const closest = this.findClosestPlayer(mob, players);
    const distToPlayer = closest ? closest.dist : Infinity;

    // --- State Transitions ---
    switch (mob.state) {
      case FSM_STATE.IDLE: {
        mob.isMoving = false;
        mob.stateTimer -= dt;

        // If hostile and player within detection radius (16 blocks) -> CHASE
        if (mob.type !== 'steve' && closest && distToPlayer <= this.config.detectionRadius) {
          mob.state = FSM_STATE.CHASE;
          mob.targetPlayerId = closest.player.id;
          break;
        }

        // Idle timer expired -> switch to WANDER
        if (mob.stateTimer <= 0) {
          mob.state = FSM_STATE.WANDER;
          mob.stateTimer = 4.0 + Math.random() * 4.0;
          mob.wanderTarget = this.pickWanderDestination(mob.x, mob.y, mob.z);
        }
        break;
      }

      case FSM_STATE.WANDER: {
        mob.stateTimer -= dt;

        // Player entered detection radius -> switch to CHASE
        if (mob.type !== 'steve' && closest && distToPlayer <= this.config.detectionRadius) {
          mob.state = FSM_STATE.CHASE;
          mob.targetPlayerId = closest.player.id;
          mob.wanderTarget = null;
          break;
        }

        if (mob.wanderTarget) {
          const reached = this.navigateTowards(mob, mob.wanderTarget.x, mob.wanderTarget.z, dt, 1.2);
          if (reached || mob.stateTimer <= 0) {
            mob.state = FSM_STATE.IDLE;
            mob.stateTimer = 1.5 + Math.random() * 2.5;
            mob.wanderTarget = null;
          }
        } else {
          mob.state = FSM_STATE.IDLE;
          mob.stateTimer = 2.0;
        }
        break;
      }

      case FSM_STATE.CHASE: {
        // Lost target or player disconnected
        const targetPlayer = closest?.player;
        if (!targetPlayer || distToPlayer > this.config.detectionRadius * 1.35) {
          mob.state = FSM_STATE.IDLE;
          mob.targetPlayerId = null;
          mob.stateTimer = 2.0;
          this.resetCreeperFuse(mob);
          break;
        }

        mob.targetPlayerId = targetPlayer.id;

        // Creeper Detonation Trigger (< 3.0 blocks)
        if (mob.type === 'creeper') {
          if (distToPlayer <= this.config.creeperFuseDistance) {
            mob.state = FSM_STATE.ATTACK;
            mob.isFusing = true;
            break;
          }
        } else if (mob.type === 'zombie') {
          // Zombie Attack Trigger (< 1.5 blocks)
          if (distToPlayer <= this.config.attackRadius) {
            mob.state = FSM_STATE.ATTACK;
            break;
          }
        }

        // Move towards target player
        const speed = mob.type === 'creeper' ? this.config.creeperSpeed : this.config.zombieSpeed;
        this.navigateTowards(mob, targetPlayer.x, targetPlayer.z, dt, speed);
        break;
      }

      case FSM_STATE.ATTACK: {
        const targetPlayer = closest?.player;

        // --- CREEPER DETONATION LOGIC ---
        if (mob.type === 'creeper') {
          mob.isMoving = false; // Creeper freezes while hissing/fusing

          // If player ran away (> 4.5 blocks), cancel fuse and resume chase!
          if (!targetPlayer || distToPlayer > this.config.creeperCancelDistance) {
            this.resetCreeperFuse(mob);
            mob.state = FSM_STATE.CHASE;
            break;
          }

          // Count down fuse
          mob.fuseTimer -= dt;
          mob.fuseProgress = Math.max(0, Math.min(1.0, 1.0 - mob.fuseTimer / this.config.creeperFuseDuration));

          // Look at player while hissing
          const dx = targetPlayer.x - mob.x;
          const dz = targetPlayer.z - mob.z;
          mob.yaw = Math.atan2(dx, dz);

          // DETONATE!
          if (mob.fuseTimer <= 0) {
            this.triggerCreeperExplosion(mob, players);
            return;
          }
        } else if (mob.type === 'zombie') {
          // --- ZOMBIE MELEE ATTACK LOGIC ---
          if (!targetPlayer || distToPlayer > this.config.attackRadius * 1.3) {
            mob.state = FSM_STATE.CHASE;
            break;
          }

          // Look at player
          const dx = targetPlayer.x - mob.x;
          const dz = targetPlayer.z - mob.z;
          mob.yaw = Math.atan2(dx, dz);

          if (mob.attackCooldown <= 0) {
            mob.attackCooldown = 1.0; // 1 attack per second

            // Calculate knockback direction
            const kx = Math.sin(mob.yaw) * 4.0;
            const kz = Math.cos(mob.yaw) * 4.0;
            if (this.onPlayerDamaged) {
              this.onPlayerDamaged(targetPlayer.id, 4, { x: kx, y: 3.5, z: kz });
            }
          }
        }
        break;
      }
    }
  }

  /**
   * Resets Creeper swelling and fuse state
   */
  private resetCreeperFuse(mob: ServerMob): void {
    mob.isFusing = false;
    mob.fuseTimer = this.config.creeperFuseDuration;
    mob.fuseProgress = 0;
  }

  /**
   * Triggers Creeper explosion:
   * 1. Spherical voxel destruction in radius = 3 blocks
   * 2. Player damage & knockback
   * 3. Broadcasts explosion event
   */
  private triggerCreeperExplosion(mob: ServerMob, players: PlayerTarget[]): void {
    const ex = Math.floor(mob.x);
    const ey = Math.floor(mob.y);
    const ez = Math.floor(mob.z);
    const radius = this.config.creeperExplosionRadius;
    const r2 = radius * radius;

    // 1. Destroy voxels in spherical blast radius
    const minX = Math.floor(ex - radius);
    const maxX = Math.ceil(ex + radius);
    const minY = Math.max(1, Math.floor(ey - radius));
    const maxY = Math.min(62, Math.ceil(ey + radius));
    const minZ = Math.floor(ez - radius);
    const maxZ = Math.ceil(ez + radius);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const dx = x - ex;
          const dy = y - ey;
          const dz = z - ez;
          if (dx * dx + dy * dy + dz * dz <= r2) {
            const block = this.world.getBlock(x, y, z);
            if (block !== 0) {
              this.world.setBlock(x, y, z, 0); // Destroy block to Air
              if (this.onBlockDestroyed) {
                this.onBlockDestroyed(x, y, z, 0);
              }
            }
          }
        }
      }
    }

    // 2. Damage nearby players within explosion radius
    players.forEach((p) => {
      const dx = p.x - mob.x;
      const dy = p.y - mob.y;
      const dz = p.z - mob.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist <= radius * 1.5) {
        const falloff = 1.0 - dist / (radius * 1.5);
        const damage = Math.round(15 * falloff);
        const kbStrength = 8.0 * falloff;
        const norm = dist > 0.01 ? 1 / dist : 1;

        if (this.onPlayerDamaged) {
          this.onPlayerDamaged(p.id, damage, {
            x: dx * norm * kbStrength,
            y: 4.5 * falloff,
            z: dz * norm * kbStrength,
          });
        }
      }
    });

    // 3. Broadcast explosion event
    if (this.onExplosion) {
      this.onExplosion(mob.x, mob.y, mob.z, radius);
    }

    // Remove exploded creeper
    this.removeMob(mob.id);
  }

  /**
   * Simplified Voxel Pathfinding & Navigation:
   * - Smoothly rotates toward target
   * - Steps forward
   * - 1-block obstacle jump (steps up 1 block if headroom available)
   * - Pit avoidance (refuses to fall down > 3 blocks)
   */
  private navigateTowards(
    mob: ServerMob,
    targetX: number,
    targetZ: number,
    dt: number,
    moveSpeed: number
  ): boolean {
    const dx = targetX - mob.x;
    const dz = targetZ - mob.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 0.25) {
      mob.isMoving = false;
      return true; // Reached target
    }

    const targetYaw = Math.atan2(dx, dz);
    // Smooth angle interpolation
    mob.yaw = this.lerpAngle(mob.yaw, targetYaw, dt * 10.0);

    const step = Math.min(dist, moveSpeed * dt);
    const nextX = mob.x + Math.sin(targetYaw) * step;
    const nextZ = mob.z + Math.cos(targetYaw) * step;

    // --- VOXEL SAFETY & OBSTACLE RESOLUTION ---
    const currentFootY = Math.floor(mob.y);
    const nextGridX = Math.floor(nextX);
    const nextGridZ = Math.floor(nextZ);

    const blockAtNextFoot = this.world.getBlock(nextGridX, currentFootY, nextGridZ);
    const blockAtNextHead = this.world.getBlock(nextGridX, currentFootY + 1, nextGridZ);
    const blockAtNextClearance = this.world.getBlock(nextGridX, currentFootY + 2, nextGridZ);

    // 1. Obstacle in front (1 block high) -> Check if can jump up!
    if (blockAtNextFoot !== 0) {
      // If 1 block high with open air above (headroom clearance)
      if (blockAtNextHead === 0 && blockAtNextClearance === 0) {
        // Jump over 1-block obstacle!
        mob.x = nextX;
        mob.z = nextZ;
        mob.y = currentFootY + 1.0;
        mob.isMoving = true;
        return false;
      } else {
        // Obstacle is 2+ blocks tall or ceiling blocked -> Cannot pass!
        mob.isMoving = false;
        return true; // Stop or pick alternate route
      }
    }

    // 2. Open air in front -> Pit / Fall Depth Safety Check
    // Check how far down the drop is
    let dropDepth = 0;
    for (let checkY = currentFootY - 1; checkY >= 1; checkY--) {
      const b = this.world.getBlock(nextGridX, checkY, nextGridZ);
      if (b !== 0) {
        dropDepth = currentFootY - (checkY + 1);
        break;
      }
    }

    // Pit Avoidance: if drop > 3 blocks, DO NOT WALK INTO PIT!
    if (dropDepth > this.config.maxFallDistance) {
      mob.isMoving = false;
      return true; // Refuse to fall into deadly pit/cliff
    }

    // Safe to step down
    mob.x = nextX;
    mob.z = nextZ;
    mob.y = Math.max(1, currentFootY - dropDepth);
    mob.isMoving = true;
    return false;
  }

  /**
   * Mob Spawner:
   * Spawns hostile mobs (Zombies, Creepers) at distance 24–64 blocks from players
   * in dark areas (light < 7 or nighttime).
   */
  private updateSpawner(dt: number, players: PlayerTarget[]): void {
    if (players.length === 0) return;

    this.spawnTimer += dt;
    if (this.spawnTimer < 4.0) return; // Check spawning every 4 seconds
    this.spawnTimer = 0;

    // Despawn mobs further than 72 blocks from all players
    this.mobs.forEach((mob) => {
      const closest = this.findClosestPlayer(mob, players);
      if (!closest || closest.dist > 72.0) {
        this.removeMob(mob.id);
      }
    });

    // Check Mob Cap
    if (this.mobs.size >= this.config.mobCap) return;

    // Pick random player to spawn around
    const player = players[Math.floor(Math.random() * players.length)];

    // Distance between 24 and 64 blocks
    const spawnDist = 24.0 + Math.random() * 36.0;
    const spawnAngle = Math.random() * Math.PI * 2;
    const spawnX = Math.floor(player.x + Math.sin(spawnAngle) * spawnDist);
    const spawnZ = Math.floor(player.z + Math.cos(spawnAngle) * spawnDist);

    // Find surface Y at (spawnX, spawnZ)
    for (let y = 60; y >= 2; y--) {
      const ground = this.world.getBlock(spawnX, y - 1, spawnZ);
      const foot = this.world.getBlock(spawnX, y, spawnZ);
      const head = this.world.getBlock(spawnX, y + 1, spawnZ);

      // Must have solid ground and 2 blocks of air above
      if (ground !== 0 && foot === 0 && head === 0) {
        // Darkness check: only spawn if nighttime OR dark cave/tunnel
        let isDark = this.isNight;
        if (!isDark && this.world.getLightLevel) {
          const light = this.world.getLightLevel(spawnX, y, spawnZ, this.isNight);
          isDark = light < 7;
        }

        if (isDark) {
          // 60% Zombie, 40% Creeper
          const mobType = Math.random() < 0.4 ? 'creeper' : 'zombie';
          this.spawnMob(mobType, spawnX + 0.5, y, spawnZ + 0.5);
          break;
        }
      }
    }
  }

  /**
   * Picks a random safe ground destination for wandering
   */
  private pickWanderDestination(x: number, y: number, z: number): { x: number; y: number; z: number } {
    const angle = Math.random() * Math.PI * 2;
    const dist = 3.0 + Math.random() * 5.0;
    const tx = x + Math.sin(angle) * dist;
    const tz = z + Math.cos(angle) * dist;
    return { x: tx, y, z: tz };
  }

  /**
   * Finds closest player to mob
   */
  private findClosestPlayer(mob: ServerMob, players: PlayerTarget[]): { player: PlayerTarget; dist: number } | null {
    if (players.length === 0) return null;
    let closest: PlayerTarget | null = null;
    let minDist = Infinity;

    for (const p of players) {
      const dx = p.x - mob.x;
      const dy = p.y - mob.y;
      const dz = p.z - mob.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < minDist) {
        minDist = dist;
        closest = p;
      }
    }

    return closest ? { player: closest, dist: minDist } : null;
  }

  /**
   * Lerps shortest angular difference
   */
  private lerpAngle(current: number, target: number, t: number): number {
    let diff = (target - current) % (Math.PI * 2);
    if (diff < -Math.PI) diff += Math.PI * 2;
    if (diff > Math.PI) diff -= Math.PI * 2;
    return current + diff * Math.min(1.0, Math.max(0, t));
  }

  /**
   * Serializes mob states for network tick broadcast (20 TPS)
   */
  public serializeMobs(): object[] {
    return Array.from(this.mobs.values()).map((mob) => ({
      id: mob.id,
      type: mob.type,
      x: Number(mob.x.toFixed(2)),
      y: Number(mob.y.toFixed(2)),
      z: Number(mob.z.toFixed(2)),
      yaw: Number(mob.yaw.toFixed(3)),
      pitch: Number(mob.pitch.toFixed(3)),
      state: mob.state,
      isFusing: mob.isFusing,
      fuseProgress: Number(mob.fuseProgress.toFixed(2)),
      isMoving: mob.isMoving,
    }));
  }
}
