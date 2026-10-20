import { createNoise2D, createNoise3D } from 'simplex-noise';
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z, BLOCK, BlockId } from './types';
import { getBlockIndex } from './ChunkMeshGenerator';

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
 * Generates authentic Minecraft terrain for a 16x16x64 voxel chunk:
 * 1. Multi-octave terrain heightmap (continental hills, plains, valleys).
 * 2. Water level at seaLevel = 18 with lakes, ocean, and sand beaches.
 * 3. Stratigraphy: Grass, Sand beaches, Dirt, Stone, Bedrock.
 * 4. Subterranean cave carving via 3D Simplex noise.
 * 5. Procedural Oak Trees with Wood logs and Leaves canopy.
 */
export function generateTerrain(
  chunkX: number,
  chunkZ: number,
  _options: TerrainOptions = {}
): Uint8Array {
  const data = new Uint8Array(CHUNK_SIZE_X * CHUNK_SIZE_Z * CHUNK_SIZE_Y);
  const worldOffsetX = chunkX * CHUNK_SIZE_X;
  const worldOffsetZ = chunkZ * CHUNK_SIZE_Z;

  // Pass 1: Terrain heightmaps, strata, caves, water & sand beaches
  for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
    for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
      const gx = worldOffsetX + lx;
      const gz = worldOffsetZ + lz;

      // Multi-octave continental terrain noise
      const continental = noise2D(gx * 0.007, gz * 0.007);
      const hills = noise2D(gx * 0.02, gz * 0.02) * 0.5;
      const detail = noise2D(gx * 0.05, gz * 0.05) * 0.15;

      const rawHeight = Math.floor(20 + continental * 14 + hills * 8 + detail * 4);
      const surfaceY = Math.min(CHUNK_SIZE_Y - 8, Math.max(2, rawHeight));

      const maxY = Math.max(surfaceY, SEA_LEVEL);
      for (let y = 0; y <= maxY; y++) {
        let block: BlockId = BLOCK.AIR;

        if (y === 0) {
          block = BLOCK.STONE; // Bedrock
        } else if (y <= surfaceY) {
          if (surfaceY <= SEA_LEVEL) {
            // Underwater terrain: Sand / Gravel surface
            block = y === surfaceY ? BLOCK.SAND : (y >= surfaceY - 3 ? BLOCK.SAND : BLOCK.STONE);
          } else if (surfaceY <= SEA_LEVEL + 2) {
            // Beach: Sand surface
            block = y === surfaceY ? BLOCK.SAND : (y >= surfaceY - 3 ? BLOCK.SAND : BLOCK.STONE);
          } else {
            // Grassy terrain
            if (y === surfaceY) block = BLOCK.GRASS;
            else if (y >= surfaceY - 3) block = BLOCK.DIRT;
            else block = BLOCK.STONE;
          }

          // Subterranean Cave Carving (y = 2 to surfaceY - 2)
          if (y > 1 && y < surfaceY - 2) {
            const caveVal = noise3D(gx * 0.04, y * 0.06, gz * 0.04);
            if (caveVal > 0.44) {
              block = BLOCK.AIR;
            }
          }
        } else if (y <= SEA_LEVEL) {
          // Water body (Lakes / Ocean)
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

          // Tree spawn chance (~2.2% on grassy ground)
          const rnd = hash2D(treeGx, treeGz);
          if (rnd > 0.022) continue;

          // Surface Y calculation for tree base
          const c = noise2D(treeGx * 0.007, treeGz * 0.007);
          const h = noise2D(treeGx * 0.02, treeGz * 0.02) * 0.5;
          const d = noise2D(treeGx * 0.05, treeGz * 0.05) * 0.15;
          const treeSurfaceY = Math.min(CHUNK_SIZE_Y - 8, Math.max(2, Math.floor(20 + c * 14 + h * 8 + d * 4)));

          // Trees only spawn on grass above water level
          if (treeSurfaceY <= SEA_LEVEL + 2) continue;

          const trunkHeight = 4 + Math.floor(hash2D(treeGx * 7, treeGz * 13) * 3); // 4 to 6 blocks

          for (let dy = 0; dy <= trunkHeight + 1; dy++) {
            const leafY = treeSurfaceY + 1 + dy;
            if (leafY < 1 || leafY >= CHUNK_SIZE_Y) continue;

            const isTrunk = dy < trunkHeight;
            let radius = 0;

            if (dy >= trunkHeight - 2 && dy < trunkHeight) radius = 2; // 5x5 canopy
            else if (dy === trunkHeight) radius = 1; // 3x3 canopy
            else if (dy === trunkHeight + 1) radius = 1; // Top cap

            for (let ox = -radius; ox <= radius; ox++) {
              for (let oz = -radius; oz <= radius; oz++) {
                const targetGx = treeGx + ox;
                const targetGz = treeGz + oz;

                const targetLx = targetGx - worldOffsetX;
                const targetLz = targetGz - worldOffsetZ;

                if (targetLx >= 0 && targetLx < CHUNK_SIZE_X && targetLz >= 0 && targetLz < CHUNK_SIZE_Z) {
                  const idx = getBlockIndex(targetLx, leafY, targetLz);

                  if (ox === 0 && oz === 0 && isTrunk) {
                    data[idx] = BLOCK.WOOD; // Wood Log Trunk
                  } else if (radius > 0) {
                    const isCorner = Math.abs(ox) === radius && Math.abs(oz) === radius;
                    if (!isCorner || (dy === trunkHeight - 1 && hash2D(targetGx, targetGz) > 0.4)) {
                      if (data[idx] === BLOCK.AIR || data[idx] === BLOCK.LEAVES) {
                        data[idx] = BLOCK.LEAVES; // Oak Leaves
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

  return data;
}
