import * as THREE from "three";
import { BLOCK, BLOCK_DEFS } from "./types";
import { ITEM_REGISTRY } from "./InventorySystem";

export interface BlockParticle {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotationSpeed: THREE.Vector3;
  scale: number;
  maxLife: number;
  life: number;
}

export class BlockParticleManager {
  private particles: BlockParticle[] = [];
  private scene: THREE.Scene;
  private particleGeometry: THREE.BoxGeometry;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.particleGeometry = new THREE.BoxGeometry(0.12, 0.12, 0.12);
  }

  /**
   * Returns a hex color for any block ID
   */
  public getBlockColor(blockId: number): number {
    const colorMap: Record<number, number> = {
      [BLOCK.STONE]: 0x78716c,
      [BLOCK.DIRT]: 0x78350f,
      [BLOCK.GRASS]: 0x22c55e,
      [BLOCK.WOOD]: 0x854d0e,
      [BLOCK.LEAVES]: 0x15803d,
      [BLOCK.SAND]: 0xfacc15,
      [BLOCK.WATER]: 0x38bdf8,
      [BLOCK.BRICK]: 0xb91c1c,
      [BLOCK.GLASS]: 0xa5f3fc,
      [BLOCK.PLANKS]: 0xd97706,
      [BLOCK.TORCH]: 0xf59e0b,
      [BLOCK.LAVA]: 0xef4444,
      [BLOCK.CRAFTING_TABLE]: 0xb45309,
    };

    return colorMap[blockId] || 0x888888;
  }

  /**
   * Spawns a shatter particle burst when a block is destroyed
   */
  public spawnBreakEffect(
    blockId: number,
    blockPos: THREE.Vector3,
    count: number = 20,
  ): void {
    const hexColor = this.getBlockColor(blockId);
    const material = new THREE.MeshLambertMaterial({
      color: hexColor,
      transparent: true,
      opacity: 1.0,
    });

    const center = blockPos.clone();

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.particleGeometry, material.clone());

      // Random position inside 1x1x1 block volume
      const offset = new THREE.Vector3(
        (Math.random() - 0.5) * 0.8,
        (Math.random() - 0.5) * 0.8,
        (Math.random() - 0.5) * 0.8,
      );
      const pos = center.clone().add(offset);
      mesh.position.copy(pos);

      // Random scale (0.6x to 1.4x)
      const particleScale = 0.6 + Math.random() * 0.8;
      mesh.scale.set(particleScale, particleScale, particleScale);

      // Explosive velocity outwards + upward lift
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 4.5,
        2.0 + Math.random() * 3.5,
        (Math.random() - 0.5) * 4.5,
      );

      const rotSpeed = new THREE.Vector3(
        (Math.random() - 0.5) * 12.0,
        (Math.random() - 0.5) * 12.0,
        (Math.random() - 0.5) * 12.0,
      );

      const maxLife = 0.4 + Math.random() * 0.3; // 0.4s to 0.7s duration

      this.scene.add(mesh);

      this.particles.push({
        mesh,
        position: pos,
        velocity: vel,
        rotationSpeed: rotSpeed,
        scale: particleScale,
        maxLife,
        life: maxLife,
      });
    }
  }

  /**
   * Spawns subtle dust particles while player is holding down break button
   */
  public spawnDigDust(blockId: number, blockPos: THREE.Vector3): void {
    if (Math.random() > 0.4) return; // Limit dust frequency

    const hexColor = this.getBlockColor(blockId);
    const material = new THREE.MeshBasicMaterial({
      color: hexColor,
      transparent: true,
      opacity: 0.8,
    });

    const mesh = new THREE.Mesh(this.particleGeometry, material);
    const pos = blockPos
      .clone()
      .add(
        new THREE.Vector3(
          (Math.random() - 0.5) * 0.9,
          (Math.random() - 0.5) * 0.9,
          (Math.random() - 0.5) * 0.9,
        ),
      );
    mesh.position.copy(pos);

    const particleScale = 0.4 + Math.random() * 0.4;
    mesh.scale.set(particleScale, particleScale, particleScale);

    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 1.2,
      1.0 + Math.random() * 1.5,
      (Math.random() - 0.5) * 1.2,
    );

    const rotSpeed = new THREE.Vector3(
      (Math.random() - 0.5) * 6,
      (Math.random() - 0.5) * 6,
      (Math.random() - 0.5) * 6,
    );

    const maxLife = 0.25;

    this.scene.add(mesh);

    this.particles.push({
      mesh,
      position: pos,
      velocity: vel,
      rotationSpeed: rotSpeed,
      scale: particleScale,
      maxLife,
      life: maxLife,
    });
  }

  /**
   * Physics & Shrink Animation tick
   */
  public update(deltaTime: number): void {
    const dt = Math.min(deltaTime, 0.05);
    const gravity = -14.0;
    const toRemove: number[] = [];

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.life -= dt;

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        toRemove.push(i);
        continue;
      }

      // Physics movement
      p.velocity.y += gravity * dt;
      p.position.addScaledVector(p.velocity, dt);
      p.mesh.position.copy(p.position);

      // Rotation
      p.mesh.rotation.x += p.rotationSpeed.x * dt;
      p.mesh.rotation.y += p.rotationSpeed.y * dt;
      p.mesh.rotation.z += p.rotationSpeed.z * dt;

      // Shrink and fade out smoothly
      const progress = p.life / p.maxLife;
      const currentScale = p.scale * progress;
      p.mesh.scale.set(currentScale, currentScale, currentScale);

      if (p.mesh.material) {
        (p.mesh.material as THREE.Material).opacity = progress;
      }
    }

    // Clean up dead particles
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.particles.splice(toRemove[i], 1);
    }
  }

  public clearAll(): void {
    for (const p of this.particles) {
      this.scene.remove(p.mesh);
    }
    this.particles = [];
  }
}
