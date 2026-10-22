import { createNoise2D, createNoise3D } from "simplex-noise";
import {
  CHUNK_SIZE_X,
  CHUNK_SIZE_Y,
  CHUNK_SIZE_Z,
  BLOCK,
  BlockId,
} from "./types";
import { getBlockIndex } from "./ChunkMeshGenerator";
import {
  adjustTerrainHeightForVillage,
  applyVillageToChunk,
  isInsideVillage,
} from "./VillageGenerator";

// Initialize Simplex noise generators
const noise2D = createNoise2D();
const noise3D = createNoise3D();

export const SEA_LEVEL = 18;

export interface TerrainOptions {
  baseHeight?: number;
  heightAmplitude?: number;
  noiseScale2D?: number;
  caveThreshold?: number;
  noiseScale3D?: number;
}

/**
 * Deterministic pseudo-random seed hash for tree spawning and biome variations
 */
export function hash2D(x: number, z: number): number {
  let h = (x * 374761393 + z * 668265263) ^ 0x5bf03635;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/**
 * Generates subterranean mineshaft passages with wooden supports and loot chests
 */
export function applyMineshaftToChunk(
  data: Uint8Array,
  chunkX: number,
  chunkZ: number,
): void {
  // Mineshafts generate in ~25% of underground chunks
  const chance = hash2D(chunkX * 13 + 999, chunkZ * 17 + 888);
  if (chance > 0.25) return;

  const startY = 8;
  const tunnelHeight = 3;

  // Carve primary X corridor or Z corridor
  const isXCorridor = chance < 0.125;

  if (isXCorridor) {
    const lz = 7;
    for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
      // Hollow out 3x3 tunnel
      for (let dy = 0; dy < tunnelHeight; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const y = startY + dy;
          const z = lz + dz;
          if (z >= 0 && z < CHUNK_SIZE_Z && y > 1 && y < CHUNK_SIZE_Y) {
            const idx = getBlockIndex(lx, y, z);
            data[idx] = BLOCK.AIR;
          }
        }
      }

      // Wooden support arch every 4 blocks
      if (lx % 4 === 0) {
        // Floor wood planks
        const floorIdx = getBlockIndex(lx, startY - 1, lz);
        data[floorIdx] = BLOCK.WOOD;

        // Side wood pillars
        const leftPillar = getBlockIndex(lx, startY, lz - 1);
        const rightPillar = getBlockIndex(lx, startY, lz + 1);
        data[leftPillar] = BLOCK.WOOD;
        data[rightPillar] = BLOCK.WOOD;

        // Top wood beam
        const topBeam = getBlockIndex(lx, startY + tunnelHeight - 1, lz);
        data[topBeam] = BLOCK.WOOD;
      }

      // Loot Chest spawn chance (~5% in mineshaft corridor)
      if (lx === 8 && hash2D(chunkX * 31, chunkZ * 43) < 0.5) {
        const chestIdx = getBlockIndex(lx, startY, lz);
        data[chestIdx] = BLOCK.CHEST;
      }
    }
  } else {
    const lx = 7;
    for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
      for (let dy = 0; dy < tunnelHeight; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const y = startY + dy;
          const x = lx + dx;
          if (x >= 0 && x < CHUNK_SIZE_X && y > 1 && y < CHUNK_SIZE_Y) {
            const idx = getBlockIndex(x, y, lz);
            data[idx] = BLOCK.AIR;
          }
        }
      }

      if (lz % 4 === 0) {
        const floorIdx = getBlockIndex(lx, startY - 1, lz);
        data[floorIdx] = BLOCK.WOOD;

        const leftPillar = getBlockIndex(lx - 1, startY, lz);
        const rightPillar = getBlockIndex(lx + 1, startY, lz);
        data[leftPillar] = BLOCK.WOOD;
        data[rightPillar] = BLOCK.WOOD;

        const topBeam = getBlockIndex(lx, startY + tunnelHeight - 1, lz);
        data[topBeam] = BLOCK.WOOD;
      }

      if (lz === 8 && hash2D(chunkX * 47, chunkZ * 59) < 0.5) {
        const chestIdx = getBlockIndex(lx, startY, lz);
        data[chestIdx] = BLOCK.CHEST;
      }
    }
  }
}

/**
 * Generates authentic Minecraft terrain for a 16x16x64 voxel chunk
 */
export function generateTerrain(
  chunkX: number,
  chunkZ: number,
  _options: TerrainOptions = {},
): Uint8Array {
  const data = new Uint8Array(CHUNK_SIZE_X * CHUNK_SIZE_Z * CHUNK_SIZE_Y);
  const worldOffsetX = chunkX * CHUNK_SIZE_X;
  const worldOffsetZ = chunkZ * CHUNK_SIZE_Z;

  // Pass 1: Terrain heightmaps, strata, caves, water & sand beaches
  for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
    for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
      const gx = worldOffsetX + lx;
      const gz = worldOffsetZ + lz;

      const continental = noise2D(gx * 0.007, gz * 0.007);
      const hills = noise2D(gx * 0.02, gz * 0.02) * 0.5;
      const detail = noise2D(gx * 0.05, gz * 0.05) * 0.15;

      const rawHeight = Math.floor(
        20 + continental * 14 + hills * 8 + detail * 4,
      );
      const naturalSurfaceY = Math.min(CHUNK_SIZE_Y - 8, Math.max(2, rawHeight));
      const surfaceY = adjustTerrainHeightForVillage(gx, gz, naturalSurfaceY);

      const maxY = Math.max(surfaceY, SEA_LEVEL);
      for (let y = 0; y <= maxY; y++) {
        let block: BlockId = BLOCK.AIR;

        if (y === 0) {
          block = BLOCK.STONE;
        } else if (y <= surfaceY) {
          if (surfaceY <= SEA_LEVEL) {
            block =
              y === surfaceY
                ? BLOCK.SAND
                : y >= surfaceY - 3
                  ? BLOCK.SAND
                  : BLOCK.STONE;
          } else if (surfaceY <= SEA_LEVEL + 2) {
            block =
              y === surfaceY
                ? BLOCK.SAND
                : y >= surfaceY - 3
                  ? BLOCK.SAND
                  : BLOCK.STONE;
          } else {
            if (y === surfaceY) block = BLOCK.GRASS;
            else if (y >= surfaceY - 3) block = BLOCK.DIRT;
            else {
              block = BLOCK.STONE;
              if (y > 0 && y < surfaceY - 4) {
                const oreHash = hash2D(gx * 31 + y * 7, gz * 37);
                if (oreHash < 0.006 && y < 14) {
                  block = BLOCK.DIAMOND_ORE;
                } else if (oreHash < 0.018 && y < 25) {
                  block = BLOCK.GOLD_ORE;
                } else if (oreHash < 0.032 && y < 20) {
                  block = BLOCK.REDSTONE_ORE;
                } else if (oreHash < 0.060) {
                  block = BLOCK.IRON_ORE;
                } else if (oreHash < 0.105) {
                  block = BLOCK.COAL_ORE;
                }
              }
            }
          }

          if (y > 1 && y < surfaceY - 2) {
            const caveVal = noise3D(gx * 0.04, y * 0.06, gz * 0.04);
            if (caveVal > 0.44) {
              block = BLOCK.AIR;
            }
          }
        } else if (y <= SEA_LEVEL) {
          block = BLOCK.WATER;
        }

        const idx = getBlockIndex(lx, y, lz);
        data[idx] = block;
      }
    }
  }

  // Pass 2: Procedural Minecraft Oak Tree Spawning
  for (let czOffset = -1; czOffset <= 1; czOffset++) {
    for (let cxOffset = -1; cxOffset <= 1; cxOffset++) {
      const neighborChunkX = chunkX + cxOffset;
      const neighborChunkZ = chunkZ + czOffset;
      const nWorldX = neighborChunkX * CHUNK_SIZE_X;
      const nWorldZ = neighborChunkZ * CHUNK_SIZE_Z;

      for (let nLz = 0; nLz < CHUNK_SIZE_Z; nLz++) {
        for (let nLx = 0; nLx < CHUNK_SIZE_X; nLx++) {
          const treeGx = nWorldX + nLx;
          const treeGz = nWorldZ + nLz;

          const rnd = hash2D(treeGx, treeGz);
          if (rnd > 0.022) continue;

          if (isInsideVillage(treeGx, treeGz)) continue;

          const c = noise2D(treeGx * 0.007, treeGz * 0.007);
          const h = noise2D(treeGx * 0.02, treeGz * 0.02) * 0.5;
          const d = noise2D(treeGx * 0.05, treeGz * 0.05) * 0.15;
          const treeSurfaceY = Math.min(
            CHUNK_SIZE_Y - 8,
            Math.max(2, Math.floor(20 + c * 14 + h * 8 + d * 4)),
          );

          if (treeSurfaceY <= SEA_LEVEL + 2) continue;

          const trunkHeight =
            4 + Math.floor(hash2D(treeGx * 7, treeGz * 13) * 3);

          for (let dy = 0; dy <= trunkHeight + 1; dy++) {
            const leafY = treeSurfaceY + 1 + dy;
            if (leafY < 1 || leafY >= CHUNK_SIZE_Y) continue;

            const isTrunk = dy < trunkHeight;
            let radius = 0;

            if (dy >= trunkHeight - 2 && dy < trunkHeight)
              radius = 2;
            else if (dy === trunkHeight)
              radius = 1;
            else if (dy === trunkHeight + 1) radius = 1;

            for (let ox = -radius; ox <= radius; ox++) {
              for (let oz = -radius; oz <= radius; oz++) {
                const targetGx = treeGx + ox;
                const targetGz = treeGz + oz;

                const targetLx = targetGx - worldOffsetX;
                const targetLz = targetGz - worldOffsetZ;

                if (
                  targetLx >= 0 &&
                  targetLx < CHUNK_SIZE_X &&
                  targetLz >= 0 &&
                  targetLz < CHUNK_SIZE_Z
                ) {
                  const idx = getBlockIndex(targetLx, leafY, targetLz);

                  if (ox === 0 && oz === 0 && isTrunk) {
                    data[idx] = BLOCK.WOOD;
                  } else if (radius > 0) {
                    const isCorner =
                      Math.abs(ox) === radius && Math.abs(oz) === radius;
                    if (
                      !isCorner ||
                      (dy === trunkHeight - 1 &&
                        hash2D(targetGx, targetGz) > 0.4)
                    ) {
                      if (
                        data[idx] === BLOCK.AIR ||
                        data[idx] === BLOCK.LEAVES
                      ) {
                        data[idx] = BLOCK.LEAVES;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // Pass 3: Procedural Plains Village structures
  applyVillageToChunk(data, chunkX, chunkZ);

  // Pass 4: Subterranean Mineshaft generator
  applyMineshaftToChunk(data, chunkX, chunkZ);

  return data;
}
