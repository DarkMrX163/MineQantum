import * as THREE from "three";
import { createTextureAtlas, getTileUVs } from "./TextureAtlas";

export const ATLAS_GRID_TILES = 8;
export const TILE_PIXELS = 16;
export const CANVAS_SIZE = ATLAS_GRID_TILES * TILE_PIXELS; // 128x128 px

export type DirectionFace =
  "TOP" | "BOTTOM" | "NORTH" | "SOUTH" | "EAST" | "WEST" | "sides";

export interface UVRange {
  uMin: number;
  vMin: number;
  uMax: number;
  vMax: number;
}

// Block ID Constants
export const BLOCKS_16 = {
  AIR: 0,
  STONE: 1,
  COBBLESTONE: 2,
  DIRT: 3,
  GRASS: 4,
  OAK_PLANKS: 5,
  LEAVES: 6,
  SAND: 7,
  WATER: 8,
} as const;

// Mapping of Block ID + Face Direction to Tile Index on 8x8 Atlas Grid
export const BLOCK_FACE_TILES: Record<number, Record<string, number>> = {
  [BLOCKS_16.STONE]: {
    TOP: 1,
    BOTTOM: 1,
    NORTH: 1,
    SOUTH: 1,
    EAST: 1,
    WEST: 1,
    sides: 1,
  },
  [BLOCKS_16.COBBLESTONE]: {
    TOP: 2,
    BOTTOM: 2,
    NORTH: 2,
    SOUTH: 2,
    EAST: 2,
    WEST: 2,
    sides: 2,
  },
  [BLOCKS_16.DIRT]: {
    TOP: 2,
    BOTTOM: 2,
    NORTH: 2,
    SOUTH: 2,
    EAST: 2,
    WEST: 2,
    sides: 2,
  },
  [BLOCKS_16.GRASS]: {
    TOP: 3,
    BOTTOM: 2,
    NORTH: 4,
    SOUTH: 4,
    EAST: 4,
    WEST: 4,
    sides: 4,
  }, // 3=Grass top, 2=Dirt bottom, 4=Grass side
  [BLOCKS_16.OAK_PLANKS]: {
    TOP: 12,
    BOTTOM: 12,
    NORTH: 12,
    SOUTH: 12,
    EAST: 12,
    WEST: 12,
    sides: 12,
  },
  [BLOCKS_16.LEAVES]: {
    TOP: 7,
    BOTTOM: 7,
    NORTH: 7,
    SOUTH: 7,
    EAST: 7,
    WEST: 7,
    sides: 7,
  },
  [BLOCKS_16.SAND]: {
    TOP: 8,
    BOTTOM: 8,
    NORTH: 8,
    SOUTH: 8,
    EAST: 8,
    WEST: 8,
    sides: 8,
  },
  [BLOCKS_16.WATER]: {
    TOP: 9,
    BOTTOM: 9,
    NORTH: 9,
    SOUTH: 9,
    EAST: 9,
    WEST: 9,
    sides: 9,
  },
};

/**
 * Calculates exact UV coordinates [uMin, vMin, uMax, vMax] for a block ID and face direction
 */
export function getUVs(blockId: number, face: DirectionFace): UVRange {
  const blockMapping =
    BLOCK_FACE_TILES[blockId] || BLOCK_FACE_TILES[BLOCKS_16.STONE];
  const tileIdx = blockMapping[face] ?? blockMapping["sides"] ?? 1;
  return getTileUVs(tileIdx);
}

/**
 * Procedurally generates texture atlas on OffscreenCanvas / Canvas using createTextureAtlas()
 */
export function createProceduralAtlas16(): {
  texture: THREE.CanvasTexture;
  canvas: HTMLCanvasElement;
} {
  return createTextureAtlas();
}
