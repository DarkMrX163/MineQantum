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
} as const;

export type BlockId = typeof BLOCK[keyof typeof BLOCK];

export interface BlockInfo {
  id: number;
  name: string;
  transparent: boolean;
  lightEmission?: number; // 0 to 15
  lightDamping?: number;  // 0 to 15 (opaque blocks = 15)
  tiles: {
    top: number;
    bottom: number;
    sides: number;
  };
}

// Atlas is an 8x8 grid of 16x16 pixel textures (Total canvas: 128x128 or 256x256)
export const ATLAS_GRID_SIZE = 8;

export const BLOCK_DEFS: Record<number, BlockInfo> = {
  [BLOCK.AIR]: { id: 0, name: 'Air', transparent: true, lightEmission: 0, lightDamping: 0, tiles: { top: 0, bottom: 0, sides: 0 } },
  [BLOCK.STONE]: { id: 1, name: 'Stone', transparent: false, tiles: { top: 1, bottom: 1, sides: 1 } },
  [BLOCK.DIRT]: { id: 2, name: 'Dirt', transparent: false, tiles: { top: 2, bottom: 2, sides: 2 } },
  [BLOCK.GRASS]: { id: 3, name: 'Grass', transparent: false, tiles: { top: 3, bottom: 2, sides: 4 } }, // 3=Grass top, 2=Dirt bottom, 4=Grass side
  [BLOCK.WOOD]: { id: 4, name: 'Wood Log', transparent: false, tiles: { top: 6, bottom: 6, sides: 5 } },
  [BLOCK.LEAVES]: { id: 5, name: 'Leaves', transparent: true, lightDamping: 1, tiles: { top: 7, bottom: 7, sides: 7 } },
  [BLOCK.SAND]: { id: 6, name: 'Sand', transparent: false, tiles: { top: 8, bottom: 8, sides: 8 } },
  [BLOCK.WATER]: { id: 7, name: 'Water', transparent: true, lightDamping: 2, tiles: { top: 9, bottom: 9, sides: 9 } },
  [BLOCK.BRICK]: { id: 8, name: 'Red Brick', transparent: false, tiles: { top: 10, bottom: 10, sides: 10 } },
  [BLOCK.GLASS]: { id: 9, name: 'Glass', transparent: true, lightDamping: 0, tiles: { top: 11, bottom: 11, sides: 11 } },
  [BLOCK.PLANKS]: { id: 10, name: 'Wooden Planks', transparent: false, tiles: { top: 12, bottom: 12, sides: 12 } },
  [BLOCK.TORCH]: { id: 11, name: 'Torch', transparent: true, lightEmission: 14, lightDamping: 0, tiles: { top: 13, bottom: 13, sides: 13 } },
  [BLOCK.LAVA]: { id: 12, name: 'Lava', transparent: false, lightEmission: 15, lightDamping: 0, tiles: { top: 14, bottom: 14, sides: 14 } },
};

export type FaceDirection = 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz';

export interface FaceData {
  dir: [number, number, number];
  corners: [
    [number, number, number],
    [number, number, number],
    [number, number, number],
    [number, number, number]
  ];
  uvs: [number, number][];
  faceName: 'sides' | 'top' | 'bottom';
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
