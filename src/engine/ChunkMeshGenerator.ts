import * as THREE from "three";
import {
  CHUNK_SIZE_X,
  CHUNK_SIZE_Y,
  CHUNK_SIZE_Z,
  BLOCK_DEFS,
  BLOCK,
  BlockId,
} from "./types";
import { getTileUVs } from "./TextureAtlas";
import {
  calculateVertexAO,
  computeVertexColor,
  unpackSky,
  unpackBlock,
  isLightTransparent,
} from "./LightingEngine";

// Face Directions with normals, names, corner positions, and AO neighbor offsets
export const FACES = [
  {
    // +X (Right / East)
    dir: [1, 0, 0] as [number, number, number],
    normal: [1, 0, 0],
    faceName: "sides" as const,
    dirTint: 0.82,
    corners: [
      [1, 0, 1],
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
    ] as const,
    aoOffsets: [
      [
        [1, 0, 1],
        [1, -1, 0],
        [1, -1, 1],
      ],
      [
        [1, 0, -1],
        [1, -1, 0],
        [1, -1, -1],
      ],
      [
        [1, 0, -1],
        [1, 1, 0],
        [1, 1, -1],
      ],
      [
        [1, 0, 1],
        [1, 1, 0],
        [1, 1, 1],
      ],
    ],
  },
  {
    // -X (Left / West)
    dir: [-1, 0, 0] as [number, number, number],
    normal: [-1, 0, 0],
    faceName: "sides" as const,
    dirTint: 0.82,
    corners: [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
    ] as const,
    aoOffsets: [
      [
        [-1, 0, -1],
        [-1, -1, 0],
        [-1, -1, -1],
      ],
      [
        [-1, 0, 1],
        [-1, -1, 0],
        [-1, -1, 1],
      ],
      [
        [-1, 0, 1],
        [-1, 1, 0],
        [-1, 1, 1],
      ],
      [
        [-1, 0, -1],
        [-1, 1, 0],
        [-1, 1, -1],
      ],
    ],
  },
  {
    // +Y (Top / Up)
    dir: [0, 1, 0] as [number, number, number],
    normal: [0, 1, 0],
    faceName: "top" as const,
    dirTint: 1.0,
    corners: [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0],
    ] as const,
    aoOffsets: [
      [
        [-1, 1, 0],
        [0, 1, 1],
        [-1, 1, 1],
      ],
      [
        [1, 1, 0],
        [0, 1, 1],
        [1, 1, 1],
      ],
      [
        [1, 1, 0],
        [0, 1, -1],
        [1, 1, -1],
      ],
      [
        [-1, 1, 0],
        [0, 1, -1],
        [-1, 1, -1],
      ],
    ],
  },
  {
    // -Y (Bottom / Down)
    dir: [0, -1, 0] as [number, number, number],
    normal: [0, -1, 0],
    faceName: "bottom" as const,
    dirTint: 0.55,
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ] as const,
    aoOffsets: [
      [
        [-1, -1, 0],
        [0, -1, -1],
        [-1, -1, -1],
      ],
      [
        [1, -1, 0],
        [0, -1, -1],
        [1, -1, -1],
      ],
      [
        [1, -1, 0],
        [0, -1, 1],
        [1, -1, 1],
      ],
      [
        [-1, -1, 0],
        [0, -1, 1],
        [-1, -1, 1],
      ],
    ],
  },
  {
    // +Z (Front / South)
    dir: [0, 0, 1] as [number, number, number],
    normal: [0, 0, 1],
    faceName: "sides" as const,
    dirTint: 0.9,
    corners: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ] as const,
    aoOffsets: [
      [
        [-1, 0, 1],
        [0, -1, 1],
        [-1, -1, 1],
      ],
      [
        [1, 0, 1],
        [0, -1, 1],
        [1, -1, 1],
      ],
      [
        [1, 0, 1],
        [0, 1, 1],
        [1, 1, 1],
      ],
      [
        [-1, 0, 1],
        [0, 1, 1],
        [-1, 1, 1],
      ],
    ],
  },
  {
    // -Z (Back / North)
    dir: [0, 0, -1] as [number, number, number],
    normal: [0, 0, -1],
    faceName: "sides" as const,
    dirTint: 0.9,
    corners: [
      [1, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
    ] as const,
    aoOffsets: [
      [
        [1, 0, -1],
        [0, -1, -1],
        [1, -1, -1],
      ],
      [
        [-1, 0, -1],
        [0, -1, -1],
        [-1, -1, -1],
      ],
      [
        [-1, 0, -1],
        [0, 1, -1],
        [-1, 1, -1],
      ],
      [
        [1, 0, -1],
        [0, 1, -1],
        [1, 1, -1],
      ],
    ],
  },
];

export interface GetBlockGlobalFn {
  (gx: number, gy: number, gz: number): number;
}

export interface GetLightGlobalFn {
  (gx: number, gy: number, gz: number): number;
}

/**
 * Helper to get flat index in 16x16x64 array:
 * index = x + z * 16 + y * 256
 */
export function getBlockIndex(x: number, y: number, z: number): number {
  return x + z * CHUNK_SIZE_X + y * (CHUNK_SIZE_X * CHUNK_SIZE_Z);
}

/**
 * Generates THREE.BufferGeometry for a single chunk (16x16x64) with:
 * 1. Open face culling
 * 2. 4-level Ambient Occlusion (0%, 20%, 40%, 60%)
 * 3. Sky Light (top-down) + Block Light (torches/lava) blending
 * 4. Storing result in BufferGeometry 'color' attribute.
 */
export function generateChunkGeometry(
  data: Uint8Array,
  lightMap: Uint8Array,
  chunkX: number,
  chunkZ: number,
  getBlockGlobal?: GetBlockGlobalFn,
  getLightGlobal?: GetLightGlobalFn,
  options: {
    enableAO?: boolean;
    naiveNoCull?: boolean;
    skyIntensity?: number;
  } = {},
): {
  geometry: THREE.BufferGeometry;
  renderedFaceCount: number;
  naiveFaceCount: number;
} {
  const { enableAO = true, naiveNoCull = false, skyIntensity = 1.0 } = options;

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  let faceIndex = 0;
  let renderedFaceCount = 0;
  let naiveFaceCount = 0;

  const worldOffsetX = chunkX * CHUNK_SIZE_X;
  const worldOffsetZ = chunkZ * CHUNK_SIZE_Z;

  // Local/Global Block Query
  const getBlockAt = (x: number, y: number, z: number): number => {
    if (y < 0 || y >= CHUNK_SIZE_Y) return BLOCK.AIR;
    if (x >= 0 && x < CHUNK_SIZE_X && z >= 0 && z < CHUNK_SIZE_Z) {
      return data[getBlockIndex(x, y, z)];
    }
    if (getBlockGlobal) {
      return getBlockGlobal(worldOffsetX + x, y, worldOffsetZ + z);
    }
    return BLOCK.AIR;
  };

  // Local/Global Light Query
  const getLightAt = (x: number, y: number, z: number): number => {
    if (y >= CHUNK_SIZE_Y) return 15 << 4; // Full sunlight above ceiling
    if (y < 0) return 0;
    if (x >= 0 && x < CHUNK_SIZE_X && z >= 0 && z < CHUNK_SIZE_Z) {
      return lightMap[getBlockIndex(x, y, z)];
    }
    if (getLightGlobal) {
      return getLightGlobal(worldOffsetX + x, y, worldOffsetZ + z);
    }
    return 15 << 4; // Default to sunlight outside
  };

  for (let y = 0; y < CHUNK_SIZE_Y; y++) {
    for (let z = 0; z < CHUNK_SIZE_Z; z++) {
      for (let x = 0; x < CHUNK_SIZE_X; x++) {
        const blockId = data[getBlockIndex(x, y, z)] as BlockId;

        // Skip air blocks
        if (blockId === BLOCK.AIR) continue;

        const blockDef = BLOCK_DEFS[blockId] || BLOCK_DEFS[BLOCK.STONE];

        // Process 6 faces
        for (const face of FACES) {
          naiveFaceCount++;

          const [dx, dy, dz] = face.dir;
          const nx = x + dx;
          const ny = y + dy;
          const nz = z + dz;

          // Check neighbor block
          const neighborBlockId = getBlockAt(nx, ny, nz);
          const neighborDef =
            BLOCK_DEFS[neighborBlockId] || BLOCK_DEFS[BLOCK.AIR];

          // Face Culling Logic:
          // Draw face if naiveNoCull is true OR neighbor is air OR neighbor is transparent (and not same block)
          const isNeighborTransparent = neighborDef.transparent;
          const shouldRenderFace =
            naiveNoCull ||
            neighborBlockId === BLOCK.AIR ||
            (isNeighborTransparent && neighborBlockId !== blockId);

          if (!shouldRenderFace) continue;

          renderedFaceCount++;

          // Select tile index based on top / bottom / side
          const tileIndex = blockDef.tiles[face.faceName];
          const tileUV = getTileUVs(tileIndex);

          const quadUVs = [
            [tileUV.uMin, tileUV.vMin],
            [tileUV.uMax, tileUV.vMin],
            [tileUV.uMax, tileUV.vMax],
            [tileUV.uMin, tileUV.vMax],
          ];

          // Query face lighting directly in front of face
          const facePackedLight = getLightAt(nx, ny, nz);
          const baseSkyLight = unpackSky(facePackedLight);
          const baseBlockLight = unpackBlock(facePackedLight);

          // Calculate Ambient Occlusion (AO) and Smooth Lighting for 4 corners of face
          const faceColors: [number, number, number][] = [];
          const cornerAOs: number[] = [];

          for (let i = 0; i < 4; i++) {
            let aoFactor = 1.0;
            let aoLevel = 0;

            const [o1, o2, oCorner] = face.aoOffsets[i];
            const blockSide1 = getBlockAt(x + o1[0], y + o1[1], z + o1[2]);
            const blockSide2 = getBlockAt(x + o2[0], y + o2[1], z + o2[2]);
            const blockCorner = getBlockAt(
              x + oCorner[0],
              y + oCorner[1],
              z + oCorner[2],
            );

            const side1Opaque = !isLightTransparent(blockSide1);
            const side2Opaque = !isLightTransparent(blockSide2);
            const cornerOpaque = !isLightTransparent(blockCorner);

            if (enableAO) {
              // 4 Levels of shading: 0%, 20%, 40%, 60%
              const aoResult = calculateVertexAO(
                side1Opaque,
                side2Opaque,
                cornerOpaque,
              );
              aoFactor = aoResult.factor;
              aoLevel = aoResult.level;
            }
            cornerAOs.push(aoLevel);

            // Smooth lighting across open corner neighbors
            let vertexSky = baseSkyLight;
            let vertexBlock = baseBlockLight;

            // Sample adjacent open blocks for smooth corner gradient
            if (!side1Opaque) {
              const l = getLightAt(x + o1[0], y + o1[1], z + o1[2]);
              vertexSky = Math.max(vertexSky, unpackSky(l));
              vertexBlock = Math.max(vertexBlock, unpackBlock(l));
            }
            if (!side2Opaque) {
              const l = getLightAt(x + o2[0], y + o2[1], z + o2[2]);
              vertexSky = Math.max(vertexSky, unpackSky(l));
              vertexBlock = Math.max(vertexBlock, unpackBlock(l));
            }

            // If block itself emits light (e.g. Lava or Torch), illuminate its own faces
            const selfEmission = blockDef.lightEmission ?? 0;
            if (selfEmission > 0) {
              vertexBlock = Math.max(vertexBlock, selfEmission);
            }

            // Compute combined RGB color with AO and normal direction tint
            const [cr, cg, cb] = computeVertexColor(
              vertexSky,
              vertexBlock,
              aoFactor,
              face.dirTint,
              skyIntensity,
            );

            faceColors.push([cr, cg, cb]);
          }

          // Add 4 corner vertices
          for (let i = 0; i < 4; i++) {
            const corner = face.corners[i];
            positions.push(x + corner[0], y + corner[1], z + corner[2]);
            normals.push(face.normal[0], face.normal[1], face.normal[2]);
            uvs.push(quadUVs[i][0], quadUVs[i][1]);
            colors.push(faceColors[i][0], faceColors[i][1], faceColors[i][2]);
          }

          // Add 2 triangles (6 indices) for quad
          // AO Diagonal Flip: If corner 0 & 2 have stronger occlusion than 1 & 3,
          // flip the split diagonal to avoid cross-quad interpolation artifacts.
          const vOffset = faceIndex * 4;
          if (
            enableAO &&
            cornerAOs[0] + cornerAOs[2] > cornerAOs[1] + cornerAOs[3]
          ) {
            indices.push(vOffset + 1, vOffset + 2, vOffset + 3);
            indices.push(vOffset + 3, vOffset, vOffset + 1);
          } else {
            indices.push(vOffset, vOffset + 1, vOffset + 2);
            indices.push(vOffset, vOffset + 2, vOffset + 3);
          }

          faceIndex++;
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);

  return {
    geometry,
    renderedFaceCount,
    naiveFaceCount,
  };
}
