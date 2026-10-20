/**
 * Voxel Lighting Engine with Sky Light & Block Light Flood Fill (BFS)
 * and 4-Level Ambient Occlusion (AO).
 *
 * Light levels: 0 to 15.
 * Packed in a single byte:
 * - Upper 4 bits: Sky Light (0 to 15, propagates top-down)
 * - Lower 4 bits: Block Light (0 to 15, from torches, lava, etc.)
 */

import {
  CHUNK_SIZE_X,
  CHUNK_SIZE_Y,
  CHUNK_SIZE_Z,
  BLOCK,
  BLOCK_DEFS,
} from "./types";
import { getBlockIndex } from "./ChunkMeshGenerator";

export const MAX_LIGHT = 15;
export const TORCH_LIGHT = 14;
export const LAVA_LIGHT = 15;

/**
 * Bit-packing helpers for light byte
 */
export function packLight(sky: number, block: number): number {
  return (
    ((Math.max(0, Math.min(15, sky)) & 0x0f) << 4) |
    (Math.max(0, Math.min(15, block)) & 0x0f)
  );
}

export function unpackSky(val: number): number {
  return (val >> 4) & 0x0f;
}

export function unpackBlock(val: number): number {
  return val & 0x0f;
}

/**
 * Returns true if the block lets light pass through (Air, Torch, Water, Glass, Leaves)
 */
export function isLightTransparent(blockId: number): boolean {
  if (blockId === BLOCK.AIR || blockId === BLOCK.TORCH) return true;
  const def = BLOCK_DEFS[blockId];
  return def ? def.transparent : false;
}

/**
 * Returns the light emission level of a block (Torch = 14, Lava = 15, etc.)
 */
export function getLightEmission(blockId: number): number {
  const def = BLOCK_DEFS[blockId];
  return def?.lightEmission ?? 0;
}

/**
 * 4 levels of Ambient Occlusion shading:
 * 0% occlusion (factor 1.0)
 * 20% occlusion (factor 0.8)
 * 40% occlusion (factor 0.6)
 * 60% occlusion (factor 0.4)
 */
export function calculateVertexAO(
  side1IsOpaque: boolean,
  side2IsOpaque: boolean,
  cornerIsOpaque: boolean,
): { factor: number; level: number } {
  // If both adjacent edges are blocked, the corner is completely shadowed (60% occlusion)
  if (side1IsOpaque && side2IsOpaque) {
    return { factor: 0.4, level: 3 };
  }

  const count =
    (side1IsOpaque ? 1 : 0) +
    (side2IsOpaque ? 1 : 0) +
    (cornerIsOpaque ? 1 : 0);
  switch (count) {
    case 3:
      return { factor: 0.4, level: 3 }; // 60% occlusion
    case 2:
      return { factor: 0.6, level: 2 }; // 40% occlusion
    case 1:
      return { factor: 0.8, level: 1 }; // 20% occlusion
    case 0:
    default:
      return { factor: 1.0, level: 0 }; // 0% occlusion
  }
}

/**
 * Converts discrete light levels (0 to 15) and vertex AO factor into final RGB float values.
 * - Sky light: daylight tint [0.92, 0.95, 1.0] scaled by skyIntensity (day/night)
 * - Block light: warm golden torch tint [1.0, 0.82, 0.52]
 * - AO factor: 1.0, 0.8, 0.6, 0.4
 * - Direction tint: subtle Lambertian normal angle shading
 */
export function computeVertexColor(
  skyLight: number,
  blockLight: number,
  aoFactor: number,
  dirTint: number = 1.0,
  skyIntensity: number = 1.0,
): [number, number, number] {
  const minAmbient = 0.08;

  // Normalized intensity curves (gamma curve for realistic voxel lighting)
  const skyNorm =
    Math.pow(Math.max(0, Math.min(15, skyLight)) / 15.0, 1.35) * skyIntensity;
  const blockNorm = Math.pow(
    Math.max(0, Math.min(15, blockLight)) / 15.0,
    1.25,
  );

  // Color blending
  const skyR = skyNorm * 0.92;
  const skyG = skyNorm * 0.95;
  const skyB = skyNorm * 1.0;

  const torchR = blockNorm * 1.0;
  const torchG = blockNorm * 0.82;
  const torchB = blockNorm * 0.52;

  // Combined light with minimum ambient baseline
  const r = Math.min(1.0, (skyR + torchR + minAmbient) * aoFactor * dirTint);
  const g = Math.min(1.0, (skyG + torchG + minAmbient) * aoFactor * dirTint);
  const b = Math.min(1.0, (skyB + torchB + minAmbient) * aoFactor * dirTint);

  return [r, g, b];
}

export interface ChunkLightingAccess {
  getBlockGlobal(gx: number, gy: number, gz: number): number;
  getLightGlobal(gx: number, gy: number, gz: number): number;
  setLightGlobal(gx: number, gy: number, gz: number, val: number): void;
  markChunkDirtyAt(gx: number, gz: number): void;
}

/**
 * LightManager handles BFS flood-fill lighting across chunks:
 * 1. Sky light initialization (propagates from Y=63 straight down through transparent blocks).
 * 2. Block light propagation BFS (spans 14 blocks with -1 falloff per step).
 * 3. Block light removal queue BFS (re-propagates remaining light when torch/lava is destroyed).
 */
export class LightManager {
  private access: ChunkLightingAccess;

  constructor(access: ChunkLightingAccess) {
    this.access = access;
  }

  /**
   * Initializes sky light for a freshly loaded chunk.
   * Sunlight goes vertically down from y = 63 until hitting an opaque block.
   */
  public initializeChunkSkyLight(
    chunkData: Uint8Array,
    chunkLight: Uint8Array,
    chunkX: number,
    chunkZ: number,
  ): void {
    const worldOffsetX = chunkX * CHUNK_SIZE_X;
    const worldOffsetZ = chunkZ * CHUNK_SIZE_Z;

    const skyBFSQueue: [number, number, number, number][] = [];

    for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
        let isDirectSunlight = true;

        for (let y = CHUNK_SIZE_Y - 1; y >= 0; y--) {
          const idx = getBlockIndex(lx, y, lz);
          const block = chunkData[idx];
          const currentLight = chunkLight[idx];
          const blockLight = unpackBlock(currentLight);

          if (isDirectSunlight) {
            if (isLightTransparent(block)) {
              chunkLight[idx] = packLight(15, blockLight);
              // If next to border, queue for horizontal propagation
              if (lx === 0 || lx === 15 || lz === 0 || lz === 15) {
                skyBFSQueue.push([worldOffsetX + lx, y, worldOffsetZ + lz, 15]);
              }
            } else {
              // Hit solid block -> sunlight stops going straight down
              isDirectSunlight = false;
              chunkLight[idx] = packLight(0, blockLight);
            }
          } else {
            chunkLight[idx] = packLight(0, blockLight);
          }
        }
      }
    }

    // Spread initial block lights (e.g. from lava or torches inside chunk)
    for (let y = 0; y < CHUNK_SIZE_Y; y++) {
      for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
        for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
          const idx = getBlockIndex(lx, y, lz);
          const emission = getLightEmission(chunkData[idx]);
          if (emission > 0) {
            const sky = unpackSky(chunkLight[idx]);
            chunkLight[idx] = packLight(sky, emission);
            this.propagateBlockLightBFS(
              worldOffsetX + lx,
              y,
              worldOffsetZ + lz,
              emission,
            );
          }
        }
      }
    }
  }

  /**
   * BFS Flood-Fill: Places a light source (torch/lava) and spreads light up to 14 blocks with -1 decay.
   */
  public propagateBlockLightBFS(
    startX: number,
    startY: number,
    startZ: number,
    startLight: number,
  ): void {
    if (startY < 0 || startY >= CHUNK_SIZE_Y || startLight <= 0) return;

    // BFS Queue of [gx, gy, gz, lightLevel]
    const queue: [number, number, number, number][] = [
      [startX, startY, startZ, startLight],
    ];

    const DIRS = [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ];

    let head = 0;
    while (head < queue.length) {
      const [x, y, z, light] = queue[head++];

      for (const [dx, dy, dz] of DIRS) {
        const nx = x + dx;
        const ny = y + dy;
        const nz = z + dz;

        if (ny < 0 || ny >= CHUNK_SIZE_Y) continue;

        const neighborBlock = this.access.getBlockGlobal(nx, ny, nz);

        // Light only spreads into transparent blocks (air, water, glass, torch, leaves)
        if (isLightTransparent(neighborBlock)) {
          const damping = BLOCK_DEFS[neighborBlock]?.lightDamping ?? 0;
          const nextLight = light - 1 - damping;

          if (nextLight <= 0) continue;

          const currentPacked = this.access.getLightGlobal(nx, ny, nz);
          const currentSky = unpackSky(currentPacked);
          const currentBlock = unpackBlock(currentPacked);

          if (nextLight > currentBlock) {
            this.access.setLightGlobal(
              nx,
              ny,
              nz,
              packLight(currentSky, nextLight),
            );
            this.access.markChunkDirtyAt(nx, nz);

            if (nextLight > 1) {
              queue.push([nx, ny, nz, nextLight]);
            }
          }
        }
      }
    }
  }

  /**
   * BFS Light Removal Queue:
   * When a light source is destroyed (e.g. torch broken), clears the light and re-propagates remaining sources.
   */
  public removeBlockLightBFS(
    startX: number,
    startY: number,
    startZ: number,
  ): void {
    if (startY < 0 || startY >= CHUNK_SIZE_Y) return;

    const currentPacked = this.access.getLightGlobal(startX, startY, startZ);
    const oldBlockLight = unpackBlock(currentPacked);
    const skyLight = unpackSky(currentPacked);

    if (oldBlockLight === 0) return;

    // Reset source light to 0
    this.access.setLightGlobal(startX, startY, startZ, packLight(skyLight, 0));
    this.access.markChunkDirtyAt(startX, startZ);

    // Queue of [x, y, z, lightVal]
    const removalQueue: [number, number, number, number][] = [
      [startX, startY, startZ, oldBlockLight],
    ];
    const recheckQueue: [number, number, number, number][] = [];

    const DIRS = [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ];

    let rHead = 0;
    // 1. BFS to lower/clear light levels affected by this light source
    while (rHead < removalQueue.length) {
      const [x, y, z, lightVal] = removalQueue[rHead++];

      for (const [dx, dy, dz] of DIRS) {
        const nx = x + dx;
        const ny = y + dy;
        const nz = z + dz;

        if (ny < 0 || ny >= CHUNK_SIZE_Y) continue;

        const neighborPacked = this.access.getLightGlobal(nx, ny, nz);
        const neighborBlockLight = unpackBlock(neighborPacked);
        const neighborSky = unpackSky(neighborPacked);

        if (neighborBlockLight !== 0 && neighborBlockLight < lightVal) {
          // Darken this block
          this.access.setLightGlobal(nx, ny, nz, packLight(neighborSky, 0));
          this.access.markChunkDirtyAt(nx, nz);
          removalQueue.push([nx, ny, nz, neighborBlockLight]);
        } else if (neighborBlockLight >= lightVal) {
          // This neighbor is illuminated by another light source! Queue for re-propagation
          recheckQueue.push([nx, ny, nz, neighborBlockLight]);
        }
      }
    }

    // 2. Re-propagate surviving light sources into the cleared dark zones
    let cHead = 0;
    while (cHead < recheckQueue.length) {
      const [rx, ry, rz, rLight] = recheckQueue[cHead++];
      this.propagateBlockLightBFS(rx, ry, rz, rLight);
    }
  }
}
