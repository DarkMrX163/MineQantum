import { BLOCK, BlockId, CHUNK_SIZE_X, CHUNK_SIZE_Z, CHUNK_SIZE_Y } from "./types";
import { getBlockIndex } from "./ChunkMeshGenerator";

export const VILLAGE_CENTER_X = 48;
export const VILLAGE_CENTER_Z = 48;
export const VILLAGE_BASE_Y = 22;
export const VILLAGE_RADIUS = 20;

export interface VillagerSpawnPoint {
  role: string;
  x: number;
  y: number;
  z: number;
}

export const VILLAGER_SPAWN_POINTS: VillagerSpawnPoint[] = [
  { role: "Elder", x: 48, y: 23, z: 45 },
  { role: "Farmer", x: 44, y: 23, z: 54 },
  { role: "Blacksmith", x: 55, y: 23, z: 46 },
  { role: "Librarian", x: 52, y: 23, z: 55 },
  { role: "Cottager", x: 41, y: 23, z: 41 },
];

/**
 * Checks if global coordinate is within the village bounds.
 */
export function isInsideVillage(gx: number, gz: number): boolean {
  return Math.hypot(gx - VILLAGE_CENTER_X, gz - VILLAGE_CENTER_Z) <= VILLAGE_RADIUS;
}

/**
 * Smoothly blends natural terrain height to the village plateau at Y=22.
 */
export function adjustTerrainHeightForVillage(
  gx: number,
  gz: number,
  naturalHeight: number
): number {
  const dist = Math.hypot(gx - VILLAGE_CENTER_X, gz - VILLAGE_CENTER_Z);
  if (dist > VILLAGE_RADIUS + 4) return naturalHeight;

  if (dist <= 12) {
    return VILLAGE_BASE_Y;
  }

  // Smooth cosine blend between plateau and natural terrain
  const t = (dist - 12) / (VILLAGE_RADIUS + 4 - 12);
  const factor = 0.5 * (1 - Math.cos(t * Math.PI));
  return Math.round(VILLAGE_BASE_Y * (1 - factor) + naturalHeight * factor);
}

/**
 * Voxel blueprint map for village structures.
 * Keys are "gx,gy,gz", values are BlockId.
 */
class VillageBlueprint {
  private blocks: Map<string, BlockId> = new Map();

  public set(x: number, y: number, z: number, blockId: BlockId) {
    this.blocks.set(`${x},${y},${z}`, blockId);
  }

  public get(x: number, y: number, z: number): BlockId | undefined {
    return this.blocks.get(`${x},${y},${z}`);
  }

  public fill(
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number,
    blockId: BlockId
  ) {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    const minZ = Math.min(z1, z2);
    const maxZ = Math.max(z1, z2);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          this.set(x, y, z, blockId);
        }
      }
    }
  }

  public fillHollowBox(
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number,
    wallBlock: BlockId,
    innerBlock: BlockId = BLOCK.AIR
  ) {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    const minZ = Math.min(z1, z2);
    const maxZ = Math.max(z1, z2);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const isEdge =
            x === minX ||
            x === maxX ||
            y === minY ||
            y === maxY ||
            z === minZ ||
            z === maxZ;
          this.set(x, y, z, isEdge ? wallBlock : innerBlock);
        }
      }
    }
  }
}

let cachedBlueprint: VillageBlueprint | null = null;

/**
 * Builds the complete static blueprint of the Minecraft Plains Village.
 */
function buildVillageBlueprint(): VillageBlueprint {
  if (cachedBlueprint) return cachedBlueprint;

  const bp = new VillageBlueprint();
  cachedBlueprint = bp;
  const by = VILLAGE_BASE_Y; // 22

  // ==========================================
  // 1. Village Paths (BLOCK.PATH)
  // ==========================================
  // Main North-South Street (Z: 35..61, X: 47..49)
  for (let z = 35; z <= 61; z++) {
    for (let x = 47; x <= 49; x++) {
      bp.set(x, by, z, BLOCK.PATH);
    }
  }

  // Main East-West Street (X: 35..61, Z: 47..49)
  for (let x = 35; x <= 61; x++) {
    for (let z = 47; z <= 49; z++) {
      bp.set(x, by, z, BLOCK.PATH);
    }
  }

  // Pathway connecting to House 1 doorway (South wall at X: 41, Z: 43)
  for (let z = 43; z <= 47; z++) {
    bp.set(41, by, z, BLOCK.PATH);
    bp.set(42, by, z, BLOCK.PATH);
  }

  // Pathway connecting to House 2 doorway (South wall at X: 56, Z: 44)
  for (let z = 44; z <= 47; z++) {
    bp.set(56, by, z, BLOCK.PATH);
    bp.set(55, by, z, BLOCK.PATH);
  }

  // Pathway connecting to House 3 doorway (North wall at X: 41, Z: 52)
  for (let z = 49; z <= 52; z++) {
    bp.set(41, by, z, BLOCK.PATH);
    bp.set(42, by, z, BLOCK.PATH);
  }

  // Pathway connecting to House 4 doorway (West wall at X: 53, Z: 55)
  for (let x = 49; x <= 53; x++) {
    bp.set(x, by, 55, BLOCK.PATH);
    bp.set(x, by, 56, BLOCK.PATH);
  }

  // Winding Trail from Village towards Player Spawn (from 35, 48 towards 16, 20)
  const trailPoints = [
    [34, 48], [33, 47], [32, 46], [31, 45], [30, 44],
    [29, 43], [28, 41], [27, 40], [26, 38], [25, 36],
    [24, 34], [23, 32], [22, 30], [21, 28], [20, 26],
    [19, 24], [18, 22], [17, 20], [16, 18], [15, 16],
  ];
  for (const [tx, tz] of trailPoints) {
    bp.set(tx, by, tz, BLOCK.PATH);
    bp.set(tx + 1, by, tz, BLOCK.PATH);
  }

  // ==========================================
  // 2. Central Village Well (Centered at 48, 48)
  // ==========================================
  // Foundation down into ground (y=16..by-1)
  bp.fill(46, 16, 46, 50, by - 1, 50, BLOCK.STONE);
  // Cobblestone rim at by
  bp.fill(46, by, 46, 50, by, 50, BLOCK.STONE);
  // Water well pool: 2x2 water inside
  bp.fill(47, by - 4, 47, 49, by, 49, BLOCK.WATER);
  // 4 corner wood posts
  for (let py = by + 1; py <= by + 3; py++) {
    bp.set(46, py, 46, BLOCK.WOOD);
    bp.set(50, py, 46, BLOCK.WOOD);
    bp.set(46, py, 50, BLOCK.WOOD);
    bp.set(50, py, 50, BLOCK.WOOD);
  }
  // Well roof canopy (Wooden planks with wood trim)
  bp.fill(45, by + 4, 45, 51, by + 4, 51, BLOCK.PLANKS);
  bp.fill(46, by + 5, 46, 50, by + 5, 50, BLOCK.PLANKS);

  // ==========================================
  // 3. House 1: Plains Cottage (X: 38..44, Z: 37..43)
  // ==========================================
  // Cobblestone foundation down to bedrock / solid strata
  bp.fill(38, 16, 37, 44, by - 1, 43, BLOCK.STONE);
  // Floor at by
  bp.fill(38, by, 37, 44, by, 43, BLOCK.PLANKS);

  // Hollow living space inside (air from by+1 to by+3)
  bp.fill(38, by + 1, 37, 44, by + 3, 43, BLOCK.PLANKS);
  bp.fill(39, by + 1, 38, 43, by + 3, 42, BLOCK.AIR);

  // Corner wood log pillars
  for (let y = by + 1; y <= by + 4; y++) {
    bp.set(38, y, 37, BLOCK.WOOD);
    bp.set(44, y, 37, BLOCK.WOOD);
    bp.set(38, y, 43, BLOCK.WOOD);
    bp.set(44, y, 43, BLOCK.WOOD);
  }

  // Windows (Glass)
  bp.set(41, by + 2, 37, BLOCK.GLASS); // North window
  bp.set(38, by + 2, 40, BLOCK.GLASS); // West window
  bp.set(44, by + 2, 40, BLOCK.GLASS); // East window

  // Doorway on South wall (X=41, Z=43): Door at by+1 and by+2
  bp.set(41, by + 1, 43, BLOCK.DOOR);
  bp.set(41, by + 2, 43, BLOCK.DOOR);
  bp.set(41, by + 3, 43, BLOCK.PLANKS); // Lintel above door

  // Roof & Overhang at by+4 and by+5
  bp.fill(37, by + 4, 36, 45, by + 4, 44, BLOCK.PLANKS);
  bp.fill(38, by + 5, 37, 44, by + 5, 43, BLOCK.WOOD);

  // Interior Furniture & Lighting
  bp.set(39, by + 1, 38, BLOCK.CRAFTING_TABLE); // Crafting table in corner
  bp.set(41, by + 3, 38, BLOCK.TORCH); // Warm interior torch on North wall

  // ==========================================
  // 4. House 2: Blacksmith & Workshop (X: 53..61, Z: 37..44)
  // ==========================================
  bp.fill(53, 16, 37, 61, by - 1, 44, BLOCK.STONE);
  bp.fill(53, by, 37, 61, by, 44, BLOCK.STONE); // Cobblestone floor

  // Walls & Air inside
  bp.fill(53, by + 1, 37, 61, by + 3, 44, BLOCK.PLANKS);
  bp.fill(54, by + 1, 38, 60, by + 3, 43, BLOCK.AIR);

  // Forge area in red brick
  bp.fill(58, by + 1, 37, 61, by + 3, 40, BLOCK.BRICK);
  bp.set(59, by + 1, 39, BLOCK.CAMPFIRE); // Forge fireplace
  bp.set(59, by + 2, 39, BLOCK.AIR);
  bp.set(59, by + 3, 39, BLOCK.AIR);
  // Chimney
  for (let cy = by + 4; cy <= by + 6; cy++) {
    bp.set(59, cy, 39, BLOCK.STONE);
  }

  // Wood corner pillars
  for (let y = by + 1; y <= by + 4; y++) {
    bp.set(53, y, 37, BLOCK.WOOD);
    bp.set(61, y, 37, BLOCK.WOOD);
    bp.set(53, y, 44, BLOCK.WOOD);
    bp.set(61, y, 44, BLOCK.WOOD);
  }

  // Windows
  bp.set(53, by + 2, 41, BLOCK.GLASS);
  bp.set(61, by + 2, 41, BLOCK.GLASS);
  bp.set(55, by + 2, 37, BLOCK.GLASS);

  // Doorway on South wall (X=56, Z=44)
  bp.set(56, by + 1, 44, BLOCK.DOOR);
  bp.set(56, by + 2, 44, BLOCK.DOOR);
  bp.set(56, by + 3, 44, BLOCK.STONE);

  // Roof
  bp.fill(52, by + 4, 36, 62, by + 4, 45, BLOCK.STONE);

  // Interior Furniture & Lighting
  bp.set(54, by + 1, 38, BLOCK.CRAFTING_TABLE);
  bp.set(56, by + 3, 38, BLOCK.TORCH);

  // ==========================================
  // 5. House 3: Farmer's House & Crop Garden (X: 37..44, Z: 52..58)
  // ==========================================
  bp.fill(37, 16, 52, 44, by - 1, 58, BLOCK.STONE);
  bp.fill(37, by, 52, 44, by, 58, BLOCK.PLANKS);

  bp.fill(37, by + 1, 52, 44, by + 3, 58, BLOCK.PLANKS);
  bp.fill(38, by + 1, 53, 43, by + 3, 57, BLOCK.AIR);

  // Wood corner pillars
  for (let y = by + 1; y <= by + 4; y++) {
    bp.set(37, y, 52, BLOCK.WOOD);
    bp.set(44, y, 52, BLOCK.WOOD);
    bp.set(37, y, 58, BLOCK.WOOD);
    bp.set(44, y, 58, BLOCK.WOOD);
  }

  // Windows
  bp.set(37, by + 2, 55, BLOCK.GLASS);
  bp.set(41, by + 2, 58, BLOCK.GLASS);

  // Doorway on North wall (X=41, Z=52)
  bp.set(41, by + 1, 52, BLOCK.DOOR);
  bp.set(41, by + 2, 52, BLOCK.DOOR);
  bp.set(41, by + 3, 52, BLOCK.PLANKS);

  // Roof
  bp.fill(36, by + 4, 51, 45, by + 4, 59, BLOCK.PLANKS);
  bp.fill(37, by + 5, 52, 44, by + 5, 58, BLOCK.WOOD);

  // Interior
  bp.set(38, by + 1, 57, BLOCK.CRAFTING_TABLE);
  bp.set(41, by + 3, 57, BLOCK.TORCH);

  // Adjoining Crop Garden (X: 44..46, Z: 53..57)
  bp.fill(44, by, 53, 46, by, 57, BLOCK.DIRT);
  bp.set(45, by, 54, BLOCK.WATER);
  bp.set(45, by, 55, BLOCK.WATER);
  bp.set(45, by, 56, BLOCK.WATER);

  // ==========================================
  // 6. House 4: Village Library / Cleric House (X: 53..60, Z: 51..57)
  // ==========================================
  bp.fill(53, 16, 51, 60, by - 1, 57, BLOCK.STONE);
  bp.fill(53, by, 51, 60, by, 57, BLOCK.PLANKS);

  bp.fill(53, by + 1, 51, 60, by + 3, 57, BLOCK.PLANKS);
  bp.fill(54, by + 1, 52, 59, by + 3, 56, BLOCK.AIR);

  for (let y = by + 1; y <= by + 4; y++) {
    bp.set(53, y, 51, BLOCK.WOOD);
    bp.set(60, y, 51, BLOCK.WOOD);
    bp.set(53, y, 57, BLOCK.WOOD);
    bp.set(60, y, 57, BLOCK.WOOD);
  }

  // Windows
  bp.set(57, by + 2, 51, BLOCK.GLASS);
  bp.set(57, by + 2, 57, BLOCK.GLASS);
  bp.set(60, by + 2, 54, BLOCK.GLASS);

  // Doorway on West wall (X=53, Z=54)
  bp.set(53, by + 1, 54, BLOCK.DOOR);
  bp.set(53, by + 2, 54, BLOCK.DOOR);
  bp.set(53, by + 3, 54, BLOCK.PLANKS);

  // Roof
  bp.fill(52, by + 4, 50, 61, by + 4, 58, BLOCK.PLANKS);
  bp.fill(54, by + 5, 52, 59, by + 5, 56, BLOCK.PLANKS);

  // Interior
  bp.set(59, by + 1, 52, BLOCK.CRAFTING_TABLE);
  bp.set(59, by + 3, 54, BLOCK.TORCH);

  // ==========================================
  // 7. Village Street Lamps
  // ==========================================
  const lampPositions = [
    [46, 45],
    [50, 45],
    [46, 51],
    [50, 51],
    [40, 44],
    [54, 45],
  ];
  for (const [lx, lz] of lampPositions) {
    bp.set(lx, by + 1, lz, BLOCK.WOOD);
    bp.set(lx, by + 2, lz, BLOCK.WOOD);
    bp.set(lx, by + 3, lz, BLOCK.TORCH);
  }

  cachedBlueprint = bp;
  return bp;
}

/**
 * Injects village structures and pathways into chunk voxel data.
 */
export function applyVillageToChunk(
  data: Uint8Array,
  chunkX: number,
  chunkZ: number
): void {
  const worldMinX = chunkX * CHUNK_SIZE_X;
  const worldMaxX = worldMinX + CHUNK_SIZE_X - 1;
  const worldMinZ = chunkZ * CHUNK_SIZE_Z;
  const worldMaxZ = worldMinZ + CHUNK_SIZE_Z - 1;

  // Check if chunk overlaps the village bounding box (X: 30..65, Z: 30..65)
  if (
    worldMaxX < 28 ||
    worldMinX > 66 ||
    worldMaxZ < 28 ||
    worldMinZ > 66
  ) {
    return;
  }

  const bp = buildVillageBlueprint();

  for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
    const gz = worldMinZ + lz;
    for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
      const gx = worldMinX + lx;

      for (let gy = 1; gy < CHUNK_SIZE_Y - 1; gy++) {
        const blockId = bp.get(gx, gy, gz);
        if (blockId !== undefined) {
          const idx = getBlockIndex(lx, gy, lz);
          data[idx] = blockId;
        }
      }
    }
  }
}
