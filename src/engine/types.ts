/**
 * Voxel Constants & Block Definitions
 * Size: 16 x 16 x 64 blocks
 */

export const CHUNK_SIZE_X = 16;
export const CHUNK_SIZE_Z = 16;
export const CHUNK_SIZE_Y = 64;
export const CHUNK_TOTAL_BLOCKS = CHUNK_SIZE_X * CHUNK_SIZE_Z * CHUNK_SIZE_Y; // 16384 blocks

export const BLOCK = {
  AIR: 0,
  STONE: 1,
  DIRT: 2,
  GRASS: 3,
  WOOD: 4,
  LEAVES: 5,
  SAND: 6,
  WATER: 7,
  BRICK: 8,
  GLASS: 9,
  PLANKS: 10,
  TORCH: 11,
  LAVA: 12,
  CRAFTING_TABLE: 13,
  COAL_ORE: 14,
  IRON_ORE: 15,
  GOLD_ORE: 16,
  DIAMOND_ORE: 17,
  REDSTONE_ORE: 18,
  CAMPFIRE: 19,
  DOOR: 20,
  DOOR_OPEN: 21,
  PATH: 22,
  CHEST: 23,
  ENCHANTING_TABLE: 24,
  BREWING_STAND: 25,
} as const;

export type BlockId = (typeof BLOCK)[keyof typeof BLOCK];

export interface BlockInfo {
  id: number;
  name: string;
  transparent: boolean;
  solid?: boolean; // If false, player can walk through (Air, Water, Torch, Lava)
  lightEmission?: number; // 0 to 15
  lightDamping?: number; // 0 to 15 (opaque blocks = 15)
  tiles: {
    top: number;
    bottom: number;
    sides: number;
  };
}

// Atlas is an 8x8 grid of 16x16 pixel textures (Total canvas: 128x128 or 256x256)
export const ATLAS_GRID_SIZE = 8;

export const BLOCK_DEFS: Record<number, BlockInfo> = {
  [BLOCK.AIR]: {
    id: 0,
    name: "Air",
    transparent: true,
    solid: false,
    lightEmission: 0,
    lightDamping: 0,
    tiles: { top: 0, bottom: 0, sides: 0 },
  },
  [BLOCK.STONE]: {
    id: 1,
    name: "Stone",
    transparent: false,
    solid: true,
    tiles: { top: 1, bottom: 1, sides: 1 },
  },
  [BLOCK.DIRT]: {
    id: 2,
    name: "Dirt",
    transparent: false,
    solid: true,
    tiles: { top: 2, bottom: 2, sides: 2 },
  },
  [BLOCK.GRASS]: {
    id: 3,
    name: "Grass",
    transparent: false,
    solid: true,
    tiles: { top: 3, bottom: 2, sides: 4 },
  }, // 3=Grass top, 2=Dirt bottom, 4=Grass side
  [BLOCK.WOOD]: {
    id: 4,
    name: "Wood Log",
    transparent: false,
    solid: true,
    tiles: { top: 6, bottom: 6, sides: 5 },
  },
  [BLOCK.LEAVES]: {
    id: 5,
    name: "Leaves",
    transparent: true,
    solid: true,
    lightDamping: 1,
    tiles: { top: 7, bottom: 7, sides: 7 },
  },
  [BLOCK.SAND]: {
    id: 6,
    name: "Sand",
    transparent: false,
    solid: true,
    tiles: { top: 8, bottom: 8, sides: 8 },
  },
  [BLOCK.WATER]: {
    id: 7,
    name: "Water",
    transparent: true,
    solid: false,
    lightDamping: 2,
    tiles: { top: 9, bottom: 9, sides: 9 },
  },
  [BLOCK.BRICK]: {
    id: 8,
    name: "Red Brick",
    transparent: false,
    solid: true,
    tiles: { top: 10, bottom: 10, sides: 10 },
  },
  [BLOCK.GLASS]: {
    id: 9,
    name: "Glass",
    transparent: true,
    solid: true,
    lightDamping: 0,
    tiles: { top: 11, bottom: 11, sides: 11 },
  },
  [BLOCK.PLANKS]: {
    id: 10,
    name: "Wooden Planks",
    transparent: false,
    solid: true,
    tiles: { top: 12, bottom: 12, sides: 12 },
  },
  [BLOCK.TORCH]: {
    id: 11,
    name: "Torch",
    transparent: true,
    solid: false,
    lightEmission: 14,
    lightDamping: 0,
    tiles: { top: 13, bottom: 13, sides: 13 },
  },
  [BLOCK.LAVA]: {
    id: 12,
    name: "Lava",
    transparent: false,
    solid: false,
    lightEmission: 15,
    lightDamping: 0,
    tiles: { top: 14, bottom: 14, sides: 14 },
  },
  [BLOCK.CRAFTING_TABLE]: {
    id: 13,
    name: "Crafting Table",
    transparent: false,
    solid: true,
    tiles: { top: 15, bottom: 12, sides: 15 },
  },
  [BLOCK.COAL_ORE]: {
    id: 14,
    name: "Coal Ore",
    transparent: false,
    solid: true,
    tiles: { top: 16, bottom: 16, sides: 16 },
  },
  [BLOCK.IRON_ORE]: {
    id: 15,
    name: "Iron Ore",
    transparent: false,
    solid: true,
    tiles: { top: 17, bottom: 17, sides: 17 },
  },
  [BLOCK.GOLD_ORE]: {
    id: 16,
    name: "Gold Ore",
    transparent: false,
    solid: true,
    tiles: { top: 18, bottom: 18, sides: 18 },
  },
  [BLOCK.DIAMOND_ORE]: {
    id: 17,
    name: "Diamond Ore",
    transparent: false,
    solid: true,
    tiles: { top: 19, bottom: 19, sides: 19 },
  },
  [BLOCK.REDSTONE_ORE]: {
    id: 18,
    name: "Redstone Ore",
    transparent: false,
    solid: true,
    tiles: { top: 20, bottom: 20, sides: 20 },
  },
  [BLOCK.CAMPFIRE]: {
    id: 19,
    name: "Campfire",
    transparent: true,
    solid: false,
    lightEmission: 14,
    lightDamping: 0,
    tiles: { top: 12, bottom: 2, sides: 6 },
  },
  [BLOCK.DOOR]: {
    id: 20,
    name: "Oak Door",
    transparent: true,
    solid: true,
    tiles: { top: 12, bottom: 12, sides: 21 },
  },
  [BLOCK.DOOR_OPEN]: {
    id: 21,
    name: "Open Oak Door",
    transparent: true,
    solid: false,
    tiles: { top: 12, bottom: 12, sides: 22 },
  },
  [BLOCK.PATH]: {
    id: 22,
    name: "Village Path",
    transparent: false,
    solid: true,
    tiles: { top: 23, bottom: 2, sides: 2 },
  },
  [BLOCK.CHEST]: {
    id: 23,
    name: "Wooden Chest",
    transparent: false,
    solid: true,
    tiles: { top: 12, bottom: 12, sides: 15 },
  },
  [BLOCK.ENCHANTING_TABLE]: {
    id: 24,
    name: "Enchanting Table",
    transparent: true,
    solid: true,
    lightEmission: 7,
    tiles: { top: 19, bottom: 1, sides: 10 },
  },
  [BLOCK.BREWING_STAND]: {
    id: 25,
    name: "Brewing Stand",
    transparent: true,
    solid: false,
    lightEmission: 6,
    tiles: { top: 13, bottom: 12, sides: 13 },
  },
};

export type FaceDirection = "px" | "nx" | "py" | "ny" | "pz" | "nz";

export interface FaceData {
  dir: [number, number, number];
  corners: [
    [number, number, number],
    [number, number, number],
    [number, number, number],
    [number, number, number],
  ];
  uvs: [number, number][];
  faceName: "sides" | "top" | "bottom";
}

export interface ChunkStats {
  loadedChunks: number;
  totalBlocks: number;
  renderedFaces: number;
  totalVertices: number;
  drawCalls: number;
  naiveFaceCount: number;
  cullingEfficiency: number;
}
