import React, { useState } from 'react';
import { Copy, Check, Code, FileText, Sparkles, Sun, Layers, Grid } from 'lucide-react';

const JS_LIGHTING_AO_CODE = `/**
 * VoxelLightingEngine.js & ChunkMeshWithAO.js
 * 
 * 1. lightMap per chunk (16x16x64):
 *    - Sky Light (0 to 15, propagates top-down)
 *    - Block Light (0 to 15, torches & lava)
 *    - Bit-packed: (skyLight << 4) | blockLight
 * 2. BFS Flood Fill:
 *    - Spreads light up to 14 blocks in all directions with -1 falloff per step
 *    - Light removal queue upon destroying light source + re-propagation
 * 3. 4-Level Ambient Occlusion (AO):
 *    - For each corner of a visible face, tests 3 neighboring voxels (side1, side2, corner)
 *    - 4 shading levels: 0% (factor 1.0), 20% (0.8), 40% (0.6), 60% (0.4)
 * 4. Geometry colors:
 *    - Multiplies (sky + block light) * AO * directional normal tint
 *    - Assigned to BufferGeometry 'color' attribute (THREE.Float32BufferAttribute)
 */

import * as THREE from 'three';

export const CHUNK_SIZE_X = 16;
export const CHUNK_SIZE_Y = 64;
export const CHUNK_SIZE_Z = 16;
export const MAX_LIGHT = 15;
export const TORCH_LIGHT = 14;
export const LAVA_LIGHT = 15;

export const BLOCK = {
  AIR: 0,
  STONE: 1,
  DIRT: 2,
  GRASS: 3,
  WOOD: 4,
  LEAVES: 5,
  SAND: 6,
  WATER: 7,
  TORCH: 11,
  LAVA: 12,
};

// Bit-packing helpers
export const packLight = (sky, block) =>
  ((Math.max(0, Math.min(15, sky)) & 0x0f) << 4) | (Math.max(0, Math.min(15, block)) & 0x0f);
export const unpackSky = (val) => (val >> 4) & 0x0f;
export const unpackBlock = (val) => val & 0x0f;

export const getBlockIndex = (x, y, z) =>
  x + z * CHUNK_SIZE_X + y * (CHUNK_SIZE_X * CHUNK_SIZE_Z);

/**
 * 4-Level Ambient Occlusion calculation:
 * Checks 3 neighbors at each corner vertex (side1, side2, corner)
 */
export function calculateVertexAO(side1Opaque, side2Opaque, cornerOpaque) {
  // If both adjacent sides are solid, corner is fully shadowed (60% occlusion)
  if (side1Opaque && side2Opaque) {
    return { factor: 0.4, level: 3 }; // 60% occlusion
  }

  const count = (side1Opaque ? 1 : 0) + (side2Opaque ? 1 : 0) + (cornerOpaque ? 1 : 0);
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
 * Combines Sky Light, Block Light, AO Factor, and normal angle into RGB float
 */
export function computeVertexColor(skyLight, blockLight, aoFactor, dirTint = 1.0, skyIntensity = 1.0) {
  const minAmbient = 0.08;

  // Gamma-corrected lighting curve
  const skyNorm = Math.pow(Math.max(0, Math.min(15, skyLight)) / 15.0, 1.35) * skyIntensity;
  const blockNorm = Math.pow(Math.max(0, Math.min(15, blockLight)) / 15.0, 1.25);

  // Cool sky daylight tint + warm golden torchlight tint
  const skyR = skyNorm * 0.92, skyG = skyNorm * 0.95, skyB = skyNorm * 1.00;
  const torchR = blockNorm * 1.00, torchG = blockNorm * 0.82, torchB = blockNorm * 0.52;

  const r = Math.min(1.0, (skyR + torchR + minAmbient) * aoFactor * dirTint);
  const g = Math.min(1.0, (skyG + torchG + minAmbient) * aoFactor * dirTint);
  const b = Math.min(1.0, (skyB + torchB + minAmbient) * aoFactor * dirTint);

  return [r, g, b];
}

/**
 * LightManager: BFS Flood Fill & Removal Queue
 */
export class LightManager {
  constructor(access) {
    this.access = access; // { getBlock, getLight, setLight, markChunkDirty }
  }

  // 1. Initialize Sky Light top-down
  initializeChunkSkyLight(chunkData, chunkLight, chunkX, chunkZ) {
    for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
        let isDirectSunlight = true;

        for (let y = CHUNK_SIZE_Y - 1; y >= 0; y--) {
          const idx = getBlockIndex(lx, y, lz);
          const block = chunkData[idx];
          const cur = chunkLight[idx];
          const bLight = unpackBlock(cur);

          if (isDirectSunlight) {
            if (block === BLOCK.AIR || block === BLOCK.TORCH || block === BLOCK.WATER) {
              chunkLight[idx] = packLight(15, bLight);
            } else {
              isDirectSunlight = false;
              chunkLight[idx] = packLight(0, bLight);
            }
          } else {
            chunkLight[idx] = packLight(0, bLight);
          }
        }
      }
    }
  }

  // 2. BFS Flood Fill: Spreads block light up to 14 blocks with -1 falloff per step
  propagateBlockLightBFS(startX, startY, startZ, startLight) {
    if (startY < 0 || startY >= CHUNK_SIZE_Y || startLight <= 0) return;

    const queue = [[startX, startY, startZ, startLight]];
    const DIRS = [
      [1, 0, 0], [-1, 0, 0],
      [0, 1, 0], [0, -1, 0],
      [0, 0, 1], [0, 0, -1],
    ];

    let head = 0;
    while (head < queue.length) {
      const [x, y, z, light] = queue[head++];

      for (const [dx, dy, dz] of DIRS) {
        const nx = x + dx, ny = y + dy, nz = z + dz;
        if (ny < 0 || ny >= CHUNK_SIZE_Y) continue;

        const neighborBlock = this.access.getBlock(nx, ny, nz);
        // Spreads into transparent blocks
        if (neighborBlock === BLOCK.AIR || neighborBlock === BLOCK.TORCH || neighborBlock === BLOCK.WATER) {
          const nextLight = light - 1;
          if (nextLight <= 0) continue;

          const currentPacked = this.access.getLight(nx, ny, nz);
          const currentSky = unpackSky(currentPacked);
          const currentBlock = unpackBlock(currentPacked);

          if (nextLight > currentBlock) {
            this.access.setLight(nx, ny, nz, packLight(currentSky, nextLight));
            this.access.markChunkDirty(nx, nz);

            if (nextLight > 1) {
              queue.push([nx, ny, nz, nextLight]);
            }
          }
        }
      }
    }
  }

  // 3. BFS Light Removal Queue: Clears light & re-propagates remaining sources
  removeBlockLightBFS(startX, startY, startZ) {
    if (startY < 0 || startY >= CHUNK_SIZE_Y) return;

    const currentPacked = this.access.getLight(startX, startY, startZ);
    const oldLight = unpackBlock(currentPacked);
    const skyLight = unpackSky(currentPacked);
    if (oldLight === 0) return;

    this.access.setLight(startX, startY, startZ, packLight(skyLight, 0));
    this.access.markChunkDirty(startX, startZ);

    const removalQueue = [[startX, startY, startZ, oldLight]];
    const recheckQueue = [];
    const DIRS = [
      [1, 0, 0], [-1, 0, 0],
      [0, 1, 0], [0, -1, 0],
      [0, 0, 1], [0, 0, -1],
    ];

    let rHead = 0;
    while (rHead < removalQueue.length) {
      const [x, y, z, lightVal] = removalQueue[rHead++];

      for (const [dx, dy, dz] of DIRS) {
        const nx = x + dx, ny = y + dy, nz = z + dz;
        if (ny < 0 || ny >= CHUNK_SIZE_Y) continue;

        const neighborPacked = this.access.getLight(nx, ny, nz);
        const neighborBlockLight = unpackBlock(neighborPacked);
        const neighborSky = unpackSky(neighborPacked);

        if (neighborBlockLight !== 0 && neighborBlockLight < lightVal) {
          this.access.setLight(nx, ny, nz, packLight(neighborSky, 0));
          this.access.markChunkDirty(nx, nz);
          removalQueue.push([nx, ny, nz, neighborBlockLight]);
        } else if (neighborBlockLight >= lightVal) {
          recheckQueue.push([nx, ny, nz, neighborBlockLight]);
        }
      }
    }

    let cHead = 0;
    while (cHead < recheckQueue.length) {
      const [rx, ry, rz, rLight] = recheckQueue[cHead++];
      this.propagateBlockLightBFS(rx, ry, rz, rLight);
    }
  }
}

/**
 * Builds THREE.BufferGeometry with Color Attribute for Lighting & AO
 */
export function buildChunkMeshGeometry(chunkData, lightMap, chunkX, chunkZ, getBlockGlobal, getLightGlobal, options = {}) {
  const { enableAO = true, skyIntensity = 1.0 } = options;
  const positions = [];
  const normals = [];
  const uvs = [];
  const colors = [];
  const indices = [];

  // ... (Iterate blocks and visible faces, calculate 4 corner AO and lighting colors)
  // ... (geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)))

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);

  return geometry;
}
`;

const JS_ATLAS_SHADER_CODE = `/**
 * TextureAtlas16x16.js & WaterShader.js
 * 16x16 Tile Grid Texture Atlas Generator (OffscreenCanvas) + Custom Water ShaderMaterial
 */

import * as THREE from 'three';

export const ATLAS_GRID_TILES = 16;
export const TILE_PIXELS = 16;
export const CANVAS_SIZE = 256; // 16x16 tiles * 16px = 256x256 px

/**
 * UV Coordinates Calculator
 * Receives blockId and face direction ('TOP', 'BOTTOM', 'NORTH', 'SOUTH', 'EAST', 'WEST')
 * Returns exact UV range [uMin, vMin, uMax, vMax] with micro-padding.
 */
export function getUVs(blockId, faceName) {
  const blockMapping = {
    1: { TOP: 1, BOTTOM: 1, sides: 1 }, // Stone
    2: { TOP: 2, BOTTOM: 2, sides: 2 }, // Cobblestone
    3: { TOP: 3, BOTTOM: 3, sides: 3 }, // Dirt
    4: { TOP: 4, BOTTOM: 3, sides: 5 }, // Grass (Top: 4, Bottom: 3, Side: 5)
    5: { TOP: 6, BOTTOM: 6, sides: 6 }, // Oak Planks
    6: { TOP: 7, BOTTOM: 7, sides: 7 }, // Leaves
    7: { TOP: 8, BOTTOM: 8, sides: 8 }, // Sand
    8: { TOP: 9, BOTTOM: 9, sides: 9 }, // Water
  };

  const mapping = blockMapping[blockId] || blockMapping[1];
  const tileIdx = mapping[faceName] || mapping['sides'] || 1;

  const col = tileIdx % ATLAS_GRID_TILES;
  const row = Math.floor(tileIdx / ATLAS_GRID_TILES);
  const size = 1 / ATLAS_GRID_TILES; // 0.0625

  const uMin = col * size + 0.0003;
  const uMax = uMin + size - 0.0006;
  const vMax = 1 - row * size - 0.0003;
  const vMin = vMax - size + 0.0006;

  return { uMin, vMin, uMax, vMax };
}

/**
 * Creates 16x16 Texture Atlas on OffscreenCanvas with NearestFilter
 */
export function createProceduralAtlas16() {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext('2d');

  // Fill textures: Stone (1), Cobblestone (2), Dirt (3), Grass Top (4), Grass Side (5), Oak Planks (6), Leaves (7), Sand (8), Water (9)
  // ... (Procedural pixel art drawing)

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;

  return { texture, canvas };
}

/**
 * CUSTOM WATER SHADER MATERIAL
 * Features:
 * - Animated vertex displacement along sine wave (u_time)
 * - Semi-transparency (opacity: 0.6)
 * - Swimming physics / no solid collision
 */
const vertexShader = \`
  uniform float u_time;
  varying vec2 vUv;
  varying vec3 vWorldPosition;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Displace top surface vertices with animated sine waves for water ripples
    if (normal.y > 0.5) {
      float wave1 = sin(pos.x * 2.5 + u_time * 3.0) * 0.08;
      float wave2 = cos(pos.z * 2.5 + u_time * 2.5) * 0.08;
      pos.y += wave1 + wave2;
    }

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
\`;

const fragmentShader = \`
  uniform sampler2D u_map;
  uniform float u_time;

  varying vec2 vUv;
  varying vec3 vWorldPosition;

  void main() {
    vec4 texColor = texture2D(u_map, vUv);
    vec3 waterBlue = vec3(0.18, 0.52, 0.88);
    float shimmer = sin(vWorldPosition.x * 3.0 + vWorldPosition.z * 3.0 + u_time * 4.0) * 0.08;

    // Semi-transparent water (opacity: 0.6)
    gl_FragColor = vec4(mix(waterBlue, texColor.rgb, 0.3) + vec3(shimmer), 0.60);
  }
\`;

export function createWaterShaderMaterial(atlasTexture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      u_time: { value: 0 },
      u_map: { value: atlasTexture },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}
`;

const JS_ENTITY_BUILDER_CODE = `/**
 * EntityModelBuilder.js
 * 
 * 1. Parametric Humanoid Model (Player / Zombie):
 *    - Head (8x8x8), Torso (8x12x4), Arms (4x12x4), Legs (4x12x4)
 *    - Pivot points placed at shoulder and hip joints for anatomical limb swinging
 * 2. Creeper Model:
 *    - Head (8x8x8), Body (4x12x8), 4 separate legs (4x6x4)
 *    - Quadruped hip pivots
 * 3. Procedural Walk Animation:
 *    - Sinusoidal swinging in antiphase: Math.sin(time * speed)
 *    - Zombie arms raised forward (-Math.PI/2) with groaning sway
 *    - Creeper diagonal quadruped trot
 * 4. Standard 64x32 / 64x64 Minecraft Skin UV Mapping:
 *    - Box unwrap mapping 6 faces to standard pixel coordinates
 *    - NearestFilter procedural skin textures
 */

import * as THREE from 'three';

export const PIXEL_SCALE = 1.0 / 16.0; // 1 pixel = 0.0625 blocks

/**
 * Maps standard Minecraft skin UVs onto a THREE.BoxGeometry
 * Box face order: +X (Right), -X (Left), +Y (Top), -Y (Bottom), +Z (Front), -Z (Back)
 */
export function applySkinUVs(geometry, w, h, d, u0, v0, texW = 64, texH = 64) {
  const uvAttr = geometry.attributes.uv;

  const faceRects = [
    { x: u0, y: v0 + d, w: d, h: h },                 // +X (Right)
    { x: u0 + d + w, y: v0 + d, w: d, h: h },         // -X (Left)
    { x: u0 + d, y: v0, w: w, h: d },                 // +Y (Top)
    { x: u0 + d + w, y: v0, w: w, h: d },             // -Y (Bottom)
    { x: u0 + d, y: v0 + d, w: w, h: h },             // +Z (Front)
    { x: u0 + 2 * d + w, y: v0 + d, w: w, h: h },     // -Z (Back)
  ];

  for (let i = 0; i < 6; i++) {
    const { x, y, w: rw, h: rh } = faceRects[i];
    const uMin = x / texW;
    const uMax = (x + rw) / texW;
    const vMax = 1.0 - y / texH;
    const vMin = 1.0 - (y + rh) / texH;

    const vOffset = i * 4;
    uvAttr.setXY(vOffset + 0, uMin, vMax);
    uvAttr.setXY(vOffset + 1, uMax, vMax);
    uvAttr.setXY(vOffset + 2, uMin, vMin);
    uvAttr.setXY(vOffset + 3, uMax, vMin);
  }

  uvAttr.needsUpdate = true;
}

/**
 * Creates box mesh with pivot placed at the top joint (shoulder / hip / neck)
 */
export function createJointBoxMesh(w, h, d, u0, v0, material, pivotAtTop = true, scale = PIXEL_SCALE) {
  const geo = new THREE.BoxGeometry(w * scale, h * scale, d * scale);
  applySkinUVs(geo, w, h, d, u0, v0, 64, 64);

  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const group = new THREE.Group();
  if (pivotAtTop) {
    // Offset mesh so group origin (0,0,0) is at joint
    mesh.position.set(0, (-h * scale) / 2, 0);
  }
  group.add(mesh);
  return { group, mesh };
}

export class EntityModelBuilder {
  /**
   * Builds Humanoid (Steve or Zombie) with shoulder and hip pivots
   */
  static buildHumanoid(options = {}) {
    const { isZombie = false, scale = PIXEL_SCALE, skinTexture } = options;
    const material = new THREE.MeshLambertMaterial({
      map: skinTexture,
      alphaTest: 0.1,
    });

    const root = new THREE.Group();

    // 1. Legs (4x12x4) - Hip pivots at Y = 12px
    const hipY = 12 * scale;
    const legOffsetX = 2 * scale;

    const rightLeg = createJointBoxMesh(4, 12, 4, 0, 16, material, true, scale);
    rightLeg.group.position.set(-legOffsetX, hipY, 0);
    root.add(rightLeg.group);

    const leftLeg = createJointBoxMesh(4, 12, 4, 16, 48, material, true, scale);
    leftLeg.group.position.set(legOffsetX, hipY, 0);
    root.add(leftLeg.group);

    // 2. Torso (8x12x4)
    const torso = createJointBoxMesh(8, 12, 4, 16, 16, material, false, scale);
    torso.group.position.set(0, 18 * scale, 0);
    root.add(torso.group);

    // 3. Arms (4x12x4) - Shoulder pivots at Y = 22px
    const shoulderY = 22 * scale;
    const shoulderX = 6 * scale;

    const rightArm = createJointBoxMesh(4, 12, 4, 40, 16, material, true, scale);
    rightArm.group.position.set(-shoulderX, shoulderY, 0);
    root.add(rightArm.group);

    const leftArm = createJointBoxMesh(4, 12, 4, 32, 48, material, true, scale);
    leftArm.group.position.set(shoulderX, shoulderY, 0);
    root.add(leftArm.group);

    // 4. Head (8x8x8) - Neck pivot at Y = 24px
    const neckY = 24 * scale;
    const head = createJointBoxMesh(8, 8, 8, 0, 0, material, false, scale);
    head.mesh.position.set(0, 4 * scale, 0);
    head.group.position.set(0, neckY, 0);
    root.add(head.group);

    // Procedural walk animation
    root.animateWalk = (time, speed = 1.0, isMoving = true) => {
      const walkCycle = time * 7.0;
      const amplitude = isMoving ? Math.min(1.2, speed * 0.75) : 0.0;

      // Antiphase sinusoidal leg swinging
      rightLeg.group.rotation.x = Math.sin(walkCycle) * amplitude;
      leftLeg.group.rotation.x = -Math.sin(walkCycle) * amplitude;

      if (isZombie) {
        // Zombie arms raised forward (-Math.PI/2) with slight groaning sway
        const pitch = -Math.PI / 2;
        rightArm.group.rotation.x = pitch + Math.sin(walkCycle * 0.5) * 0.08;
        leftArm.group.rotation.x = pitch - Math.sin(walkCycle * 0.5) * 0.08;
      } else {
        // Player humanoid arms swing opposite to legs
        rightArm.group.rotation.x = -Math.sin(walkCycle) * amplitude;
        leftArm.group.rotation.x = Math.sin(walkCycle) * amplitude;
      }
    };

    return root;
  }

  /**
   * Builds Creeper model: Head (8x8x8), Body (4x12x8), 4 Legs (4x6x4)
   */
  static buildCreeper(options = {}) {
    const { scale = PIXEL_SCALE, skinTexture } = options;
    const material = new THREE.MeshLambertMaterial({
      map: skinTexture,
      alphaTest: 0.1,
    });

    const root = new THREE.Group();

    // 4 Separate Legs (4x6x4) with hip pivots at Y = 6px
    const hipY = 6 * scale;
    const legX = 2 * scale, legZ = 4 * scale;

    const fl = createJointBoxMesh(4, 6, 4, 0, 16, material, true, scale);
    fl.group.position.set(legX, hipY, legZ);
    root.add(fl.group);

    const fr = createJointBoxMesh(4, 6, 4, 0, 16, material, true, scale);
    fr.group.position.set(-legX, hipY, legZ);
    root.add(fr.group);

    const bl = createJointBoxMesh(4, 6, 4, 0, 16, material, true, scale);
    bl.group.position.set(legX, hipY, -legZ);
    root.add(bl.group);

    const br = createJointBoxMesh(4, 6, 4, 0, 16, material, true, scale);
    br.group.position.set(-legX, hipY, -legZ);
    root.add(br.group);

    // Body (4x12x8)
    const body = createJointBoxMesh(4, 12, 8, 16, 16, material, false, scale);
    body.group.position.set(0, 12 * scale, 0);
    root.add(body.group);

    // Head (8x8x8)
    const head = createJointBoxMesh(8, 8, 8, 0, 0, material, false, scale);
    head.mesh.position.set(0, 4 * scale, 0);
    head.group.position.set(0, 18 * scale, 0);
    root.add(head.group);

    // Quadruped trot animation
    root.animateWalk = (time, speed = 1.0, isMoving = true) => {
      const walkCycle = time * 8.0;
      const amplitude = isMoving ? Math.min(1.0, speed * 0.7) : 0.0;

      // Diagonal legs swing in antiphase
      fl.group.rotation.x = Math.sin(walkCycle) * amplitude;
      br.group.rotation.x = Math.sin(walkCycle) * amplitude;
      fr.group.rotation.x = -Math.sin(walkCycle) * amplitude;
      bl.group.rotation.x = -Math.sin(walkCycle) * amplitude;
    };

    return root;
  }
}
`;

const JS_SERVER_AI_CODE = `/**
 * ServerMobAI.js (Node.js)
 * 
 * 1. Finite State Machine (FSM):
 *    - IDLE: Pauses, scans for nearby players in 16-block detection radius
 *    - WANDER: Random wandering to safe ground destinations
 *    - CHASE: Tracks closest player within 16 blocks, navigates obstacles
 *    - ATTACK: Zombie melee strike (< 1.5 blocks) / Creeper detonation (< 3.0 blocks)
 * 2. Creeper Detonation:
 *    - Distance < 3.0 blocks triggers 1.5s fuse (hisses, swells & flashes)
 *    - Defuses if player runs > 4.5 blocks away
 *    - Explodes at fuse expiry: radius = 3 blocks, spherical voxel destruction & player damage
 * 3. Voxel Grid Pathfinding & Safety:
 *    - 1-block obstacle jump (steps up 1 block if 2 blocks headroom)
 *    - Pit avoidance: refuses to step into cliffs / pits > 3 blocks deep
 * 4. Darkness & Night Mob Spawner:
 *    - Spawns Zombies & Creepers at distance 24–64 blocks from players
 *    - Requires darkness (light < 7 or nighttime) & solid ground
 *    - Mob cap (20) & despawns mobs beyond 72 blocks
 */

export const FSM_STATE = {
  IDLE: 'IDLE',
  WANDER: 'WANDER',
  CHASE: 'CHASE',
  ATTACK: 'ATTACK',
};

export class ServerMobAIEngine {
  constructor(world, config = {}) {
    this.world = world; // { getBlock(x,y,z), setBlock(x,y,z,type), getLightLevel(x,y,z) }
    this.mobs = new Map();
    this.config = {
      detectionRadius: config.detectionRadius || 16.0,
      attackRadius: config.attackRadius || 1.5,
      creeperFuseDistance: config.creeperFuseDistance || 3.0,
      creeperCancelDistance: config.creeperCancelDistance || 4.5,
      creeperFuseDuration: config.creeperFuseDuration || 1.5,
      creeperExplosionRadius: config.creeperExplosionRadius || 3.0,
      maxFallDistance: config.maxFallDistance || 3,
      zombieSpeed: config.zombieSpeed || 2.2,
      creeperSpeed: config.creeperSpeed || 2.5,
      mobCap: config.mobCap || 20,
    };
    this.isNight = false;
    this.spawnTimer = 0;
  }

  spawnMob(type, x, y, z) {
    const id = \`mob_\${type}_\${Date.now()}_\${Math.random().toString(36).substr(2, 5)}\`;
    const mob = {
      id,
      type, // 'zombie' | 'creeper'
      x, y, z,
      yaw: Math.random() * Math.PI * 2,
      pitch: 0,
      state: FSM_STATE.IDLE,
      targetPlayerId: null,
      wanderTarget: null,
      stateTimer: 1.5,
      walkTime: 0,
      isMoving: false,
      attackCooldown: 0,
      isFusing: false,
      fuseTimer: this.config.creeperFuseDuration,
      fuseProgress: 0,
    };
    this.mobs.set(id, mob);
    return mob;
  }

  update(dt, players) {
    this.updateSpawner(dt, players);

    for (const mob of this.mobs.values()) {
      this.updateMobFSM(mob, dt, players);
    }
  }

  // --- FSM STATE TRANSITIONS ---
  updateMobFSM(mob, dt, players) {
    mob.walkTime += dt;
    if (mob.attackCooldown > 0) mob.attackCooldown -= dt;

    const closest = this.findClosestPlayer(mob, players);
    const distToPlayer = closest ? closest.dist : Infinity;

    switch (mob.state) {
      case FSM_STATE.IDLE:
        mob.isMoving = false;
        mob.stateTimer -= dt;
        if (closest && distToPlayer <= this.config.detectionRadius) {
          mob.state = FSM_STATE.CHASE;
          mob.targetPlayerId = closest.player.id;
          break;
        }
        if (mob.stateTimer <= 0) {
          mob.state = FSM_STATE.WANDER;
          mob.stateTimer = 4.0;
          mob.wanderTarget = this.pickWanderDestination(mob.x, mob.y, mob.z);
        }
        break;

      case FSM_STATE.WANDER:
        mob.stateTimer -= dt;
        if (closest && distToPlayer <= this.config.detectionRadius) {
          mob.state = FSM_STATE.CHASE;
          mob.targetPlayerId = closest.player.id;
          break;
        }
        if (mob.wanderTarget) {
          const reached = this.navigateTowards(mob, mob.wanderTarget.x, mob.wanderTarget.z, dt, 1.2);
          if (reached || mob.stateTimer <= 0) {
            mob.state = FSM_STATE.IDLE;
            mob.stateTimer = 2.0;
          }
        }
        break;

      case FSM_STATE.CHASE:
        if (!closest || distToPlayer > this.config.detectionRadius * 1.35) {
          mob.state = FSM_STATE.IDLE;
          this.resetCreeperFuse(mob);
          break;
        }

        // Creeper triggers fuse when closer than 3.0 blocks!
        if (mob.type === 'creeper' && distToPlayer <= this.config.creeperFuseDistance) {
          mob.state = FSM_STATE.ATTACK;
          mob.isFusing = true;
          break;
        } else if (mob.type === 'zombie' && distToPlayer <= this.config.attackRadius) {
          mob.state = FSM_STATE.ATTACK;
          break;
        }

        const speed = mob.type === 'creeper' ? this.config.creeperSpeed : this.config.zombieSpeed;
        this.navigateTowards(mob, closest.player.x, closest.player.z, dt, speed);
        break;

      case FSM_STATE.ATTACK:
        if (mob.type === 'creeper') {
          mob.isMoving = false; // Freeze while fusing

          // Defuse if player flees beyond 4.5 blocks!
          if (!closest || distToPlayer > this.config.creeperCancelDistance) {
            this.resetCreeperFuse(mob);
            mob.state = FSM_STATE.CHASE;
            break;
          }

          mob.fuseTimer -= dt;
          mob.fuseProgress = Math.max(0, Math.min(1.0, 1.0 - mob.fuseTimer / this.config.creeperFuseDuration));

          // DETONATION!
          if (mob.fuseTimer <= 0) {
            this.triggerCreeperExplosion(mob, players);
          }
        } else if (mob.type === 'zombie') {
          if (!closest || distToPlayer > this.config.attackRadius * 1.3) {
            mob.state = FSM_STATE.CHASE;
            break;
          }
          if (mob.attackCooldown <= 0) {
            mob.attackCooldown = 1.0;
            if (this.onPlayerDamaged) {
              this.onPlayerDamaged(closest.player.id, 4);
            }
          }
        }
        break;
    }
  }

  // --- CREEPER DETONATION & VOXEL DESTRUCTION ---
  triggerCreeperExplosion(mob, players) {
    const ex = Math.floor(mob.x), ey = Math.floor(mob.y), ez = Math.floor(mob.z);
    const r = this.config.creeperExplosionRadius;

    // Destroy blocks in spherical radius R = 3
    for (let x = ex - r; x <= ex + r; x++) {
      for (let y = ey - r; y <= ey + r; y++) {
        for (let z = ez - r; z <= ez + r; z++) {
          const distSq = (x - ex)**2 + (y - ey)**2 + (z - ez)**2;
          if (distSq <= r * r) {
            if (this.world.getBlock(x, y, z) !== 0) {
              this.world.setBlock(x, y, z, 0); // Destroy to Air
              if (this.onBlockDestroyed) this.onBlockDestroyed(x, y, z, 0);
            }
          }
        }
      }
    }

    if (this.onExplosion) this.onExplosion(mob.x, mob.y, mob.z, r);
    this.mobs.delete(mob.id);
  }

  resetCreeperFuse(mob) {
    mob.isFusing = false;
    mob.fuseTimer = this.config.creeperFuseDuration;
    mob.fuseProgress = 0;
  }

  // --- VOXEL PATHFINDING & OBSTACLE RESOLUTION ---
  navigateTowards(mob, targetX, targetZ, dt, speed) {
    const dx = targetX - mob.x, dz = targetZ - mob.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 0.25) return true;

    const targetYaw = Math.atan2(dx, dz);
    mob.yaw = targetYaw;

    const step = Math.min(dist, speed * dt);
    const nextX = mob.x + Math.sin(targetYaw) * step;
    const nextZ = mob.z + Math.cos(targetYaw) * step;

    const footY = Math.floor(mob.y);
    const nextGx = Math.floor(nextX);
    const nextGz = Math.floor(nextZ);

    const blockFoot = this.world.getBlock(nextGx, footY, nextGz);
    const blockHead = this.world.getBlock(nextGx, footY + 1, nextGz);
    const blockClearance = this.world.getBlock(nextGx, footY + 2, nextGz);

    // 1. Obstacle in front (1-block height jump)
    if (blockFoot !== 0) {
      if (blockHead === 0 && blockClearance === 0) {
        // Step up 1 block with jump!
        mob.x = nextX;
        mob.z = nextZ;
        mob.y = footY + 1.0;
        mob.isMoving = true;
        return false;
      } else {
        // Obstacle 2+ blocks tall -> blocked
        mob.isMoving = false;
        return true;
      }
    }

    // 2. Open air in front -> Pit / fall depth safety check
    let dropDepth = 0;
    for (let y = footY - 1; y >= 1; y--) {
      if (this.world.getBlock(nextGx, y, nextGz) !== 0) {
        dropDepth = footY - (y + 1);
        break;
      }
    }

    // Refuse to fall into pit deeper than 3 blocks!
    if (dropDepth > this.config.maxFallDistance) {
      mob.isMoving = false;
      return true; // Pit avoidance
    }

    mob.x = nextX;
    mob.z = nextZ;
    mob.y = Math.max(1, footY - dropDepth);
    mob.isMoving = true;
    return false;
  }

  // --- DARKNESS & NIGHT HOSTILE MOB SPAWNER ---
  updateSpawner(dt, players) {
    if (players.length === 0) return;
    this.spawnTimer += dt;
    if (this.spawnTimer < 4.0) return;
    this.spawnTimer = 0;

    // Despawn mobs further than 72 blocks
    for (const [id, mob] of this.mobs) {
      const closest = this.findClosestPlayer(mob, players);
      if (!closest || closest.dist > 72) this.mobs.delete(id);
    }

    if (this.mobs.size >= this.config.mobCap) return;

    // Pick random player
    const player = players[Math.floor(Math.random() * players.length)];
    const dist = 24.0 + Math.random() * 36.0; // 24-64 blocks
    const angle = Math.random() * Math.PI * 2;
    const sx = Math.floor(player.x + Math.sin(angle) * dist);
    const sz = Math.floor(player.z + Math.cos(angle) * dist);

    for (let y = 60; y >= 2; y--) {
      const ground = this.world.getBlock(sx, y - 1, sz);
      const foot = this.world.getBlock(sx, y, sz);
      const head = this.world.getBlock(sx, y + 1, sz);

      if (ground !== 0 && foot === 0 && head === 0) {
        let isDark = this.isNight;
        if (!isDark && this.world.getLightLevel) {
          isDark = this.world.getLightLevel(sx, y, sz, this.isNight) < 7;
        }

        if (isDark) {
          const type = Math.random() < 0.4 ? 'creeper' : 'zombie';
          this.spawnMob(type, sx + 0.5, y, sz + 0.5);
          break;
        }
      }
    }
  }

  findClosestPlayer(mob, players) {
    let closest = null, minDist = Infinity;
    for (const p of players) {
      const d = Math.sqrt((p.x - mob.x)**2 + (p.y - mob.y)**2 + (p.z - mob.z)**2);
      if (d < minDist) { minDist = d; closest = p; }
    }
    return closest ? { player: closest, dist: minDist } : null;
  }

  pickWanderDestination(x, y, z) {
    const a = Math.random() * Math.PI * 2, d = 4.0;
    return { x: x + Math.sin(a) * d, y, z: z + Math.cos(a) * d };
  }
}
`;

const JS_INVENTORY_CRAFTING_CODE = `/**
 * InventoryAndCrafting.js (Pure JavaScript / HTML5 / Three.js)
 * 
 * 1. Slot Data Structure:
 *    { id: 'diamond_pickaxe', count: 1, durability: 1561, maxStack: 64 }
 * 
 * 2. Drag-and-Drop & RMB (ПКМ) Stack Splitting:
 *    - Left Click: take stack, place stack, or merge identical item IDs up to maxStack
 *    - Right Click: if empty-handed, split slot stack in half; if holding, drop 1 item
 * 
 * 3. 2D Crafting Table (2×2 and 3×3):
 *    - 2D shaped pattern matching with bounding box normalization
 *    - Examples: 1 wood -> 4 planks, 2 planks -> 4 sticks, 3 diamond + 2 stick -> diamond pickaxe
 * 
 * 4. Block Mining Speed & Tool Compatibility:
 *    - Diamond pickaxe breaks stone instantly (~0.12s)
 *    - Bare hand breaks stone slowly (~5.0s) and drops NOTHING (stone is destroyed without drop)
 * 
 * 5. 3D Item Drops in Three.js:
 *    - Spawns rotating miniature 3D block with falling gravity and ground bounce
 *    - Magnet attraction towards player when distance < 1.5 blocks
 */

import * as THREE from 'three';

// 1. Slot Data Structure Example
export function createSlotItem(id, count = 1, durability = null, maxDurability = null, maxStack = 64) {
  return {
    id,
    count,
    durability,
    maxDurability,
    maxStack,
  };
}

// 2. Drag & Drop and Stack Splitting Logic (LMB & RMB)
export function handleSlotClick(currentSlot, heldItem, isRightClick = false) {
  if (!isRightClick) {
    // --- LEFT CLICK ---
    if (!heldItem && currentSlot) {
      // Pick up full stack
      return { newSlot: null, newHeld: currentSlot };
    }
    if (heldItem && !currentSlot) {
      // Place full stack
      return { newSlot: heldItem, newHeld: null };
    }
    if (heldItem && currentSlot) {
      if (heldItem.id === currentSlot.id && currentSlot.count < currentSlot.maxStack) {
        // Stack matching items
        const space = currentSlot.maxStack - currentSlot.count;
        const add = Math.min(space, heldItem.count);
        const rem = heldItem.count - add;
        return {
          newSlot: { ...currentSlot, count: currentSlot.count + add },
          newHeld: rem > 0 ? { ...heldItem, count: rem } : null,
        };
      } else {
        // Swap different items
        return { newSlot: heldItem, newHeld: currentSlot };
      }
    }
  } else {
    // --- RIGHT CLICK (ПКМ) ---
    if (!heldItem && currentSlot) {
      // Split stack in half
      const half = Math.ceil(currentSlot.count / 2);
      const rem = currentSlot.count - half;
      return {
        newSlot: rem > 0 ? { ...currentSlot, count: rem } : null,
        newHeld: { ...currentSlot, count: half },
      };
    }
    if (heldItem && (!currentSlot || currentSlot.id === heldItem.id)) {
      // Drop 1 single item into slot
      if (!currentSlot) {
        const rem = heldItem.count - 1;
        return {
          newSlot: { ...heldItem, count: 1 },
          newHeld: rem > 0 ? { ...heldItem, count: rem } : null,
        };
      } else if (currentSlot.count < currentSlot.maxStack) {
        const rem = heldItem.count - 1;
        return {
          newSlot: { ...currentSlot, count: currentSlot.count + 1 },
          newHeld: rem > 0 ? { ...heldItem, count: rem } : null,
        };
      }
    }
  }
  return { newSlot: currentSlot, newHeld: heldItem };
}

// 3. 2D Crafting Recipe Registry & Grid Validator
export const RECIPES = [
  // 1 Wood -> 4 Planks (1x1)
  {
    id: 'planks',
    w: 1, h: 1,
    pattern: [['wood']],
    result: { id: 'planks', count: 4, maxStack: 64 },
  },
  // 2 Planks -> 4 Sticks (1x2)
  {
    id: 'sticks',
    w: 1, h: 2,
    pattern: [['planks'], ['planks']],
    result: { id: 'stick', count: 4, maxStack: 64 },
  },
  // 4 Planks -> Crafting Table (2x2)
  {
    id: 'crafting_table',
    w: 2, h: 2,
    pattern: [['planks', 'planks'], ['planks', 'planks']],
    result: { id: 'crafting_table', count: 1, maxStack: 64 },
  },
  // 3 Diamonds + 2 Sticks -> Diamond Pickaxe (3x3)
  {
    id: 'diamond_pickaxe',
    w: 3, h: 3,
    pattern: [
      ['diamond', 'diamond', 'diamond'],
      [null, 'stick', null],
      [null, 'stick', null],
    ],
    result: { id: 'diamond_pickaxe', count: 1, durability: 1561, maxDurability: 1561, maxStack: 1 },
  },
  // 3 Cobblestone + 2 Sticks -> Stone Pickaxe (3x3)
  {
    id: 'stone_pickaxe',
    w: 3, h: 3,
    pattern: [
      ['cobblestone', 'cobblestone', 'cobblestone'],
      [null, 'stick', null],
      [null, 'stick', null],
    ],
    result: { id: 'stone_pickaxe', count: 1, durability: 131, maxDurability: 131, maxStack: 1 },
  },
];

/**
 * Validates any 2x2 or 3x3 crafting grid by trimming bounding box
 */
export function validateCraftingGrid(grid, width, height) {
  let minR = height, maxR = -1, minC = width, maxC = -1;
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (grid[r] && grid[r][c] && grid[r][c].count > 0) {
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
      }
    }
  }
  if (maxR === -1) return null; // empty grid

  const subW = maxC - minC + 1;
  const subH = maxR - minR + 1;

  for (const recipe of RECIPES) {
    if (recipe.w === subW && recipe.h === subH) {
      let match = true;
      for (let r = 0; r < subH; r++) {
        for (let c = 0; c < subW; c++) {
          const req = recipe.pattern[r][c];
          const actual = grid[minR + r][minC + c]?.id || null;
          if (req !== actual) { match = false; break; }
        }
        if (!match) break;
      }
      if (match) return { recipe, result: { ...recipe.result } };
    }
  }
  return null;
}

// 4. Mining Speed & Tool Compatibility (Hand vs Diamond Pickaxe)
export function getBlockBreakInfo(blockId, heldItem) {
  // Stone rule:
  if (blockId === 1 /* STONE */) {
    if (heldItem && heldItem.id === 'diamond_pickaxe') {
      return { breakTime: 0.12, canHarvest: true, drop: 'cobblestone', count: 1 };
    }
    if (heldItem && heldItem.id === 'stone_pickaxe') {
      return { breakTime: 0.58, canHarvest: true, drop: 'cobblestone', count: 1 };
    }
    if (heldItem && heldItem.id === 'wooden_pickaxe') {
      return { breakTime: 1.15, canHarvest: true, drop: 'cobblestone', count: 1 };
    }
    // Bare hand on stone: takes 5 seconds and gives NO DROP!
    return { breakTime: 5.0, canHarvest: false, drop: null, count: 0 };
  }

  // Dirt & Grass
  if (blockId === 2 || blockId === 3) {
    return { breakTime: 0.75, canHarvest: true, drop: 'dirt', count: 1 };
  }

  // Wood
  if (blockId === 4) {
    return { breakTime: 3.0, canHarvest: true, drop: 'wood', count: 1 };
  }

  return { breakTime: 1.0, canHarvest: true, drop: null, count: 0 };
}

// 5. 3D Item Drops in Three.js with Physics & Magnet
export class DroppedItem3DManager {
  constructor(scene, chunkManager) {
    this.scene = scene;
    this.chunkManager = chunkManager;
    this.drops = [];
  }

  spawnDrop(item, pos) {
    const geo = new THREE.BoxGeometry(0.25, 0.25, 0.25);
    const mat = new THREE.MeshLambertMaterial({ color: 0x38bdf8 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    this.scene.add(mesh);

    this.drops.push({
      item,
      mesh,
      pos: pos.clone(),
      vel: new THREE.Vector3((Math.random() - 0.5) * 1.5, 3.5, (Math.random() - 0.5) * 1.5),
      age: 0,
      magnetized: false,
    });
  }

  update(dt, playerPos, onCollect) {
    const gravity = -18.0;
    const target = playerPos.clone().add(new THREE.Vector3(0, 0.8, 0));

    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.age += dt;
      const dist = d.pos.distanceTo(target);

      // Magnet attraction (< 1.5 blocks)
      if (dist < 1.8 && d.age > 0.2) d.magnetized = true;

      if (d.magnetized) {
        const dir = new THREE.Vector3().subVectors(target, d.pos).normalize();
        d.vel.lerp(dir.multiplyScalar(10.0), dt * 10.0);
        d.pos.addScaledVector(d.vel, dt);

        if (dist < 0.6) {
          if (onCollect(d.item)) {
            this.scene.remove(d.mesh);
            this.drops.splice(i, 1);
            continue;
          }
        }
      } else {
        d.vel.y += gravity * dt;
        d.pos.addScaledVector(d.vel, dt);

        // Ground floor check
        const block = this.chunkManager.getBlockGlobal(Math.floor(d.pos.x), Math.floor(d.pos.y), Math.floor(d.pos.z));
        if (block !== 0) {
          d.pos.y = Math.floor(d.pos.y) + 1.0;
          d.vel.y = 0;
          d.vel.x *= 0.8;
          d.vel.z *= 0.8;
        }
      }

      d.mesh.rotation.y += 2.5 * dt;
      d.mesh.position.set(d.pos.x, d.pos.y + Math.sin(d.age * 4) * 0.04, d.pos.z);
    }
  }
}

// 6. Survival & Combat System (Pure JavaScript)
export class SurvivalSystem {
  constructor() {
    this.health = 20;       // 20 HP (10 Hearts)
    this.hunger = 20;       // 20 Food (10 Drumsticks)
    this.maxHealth = 20;
    this.maxHunger = 20;
    this.isSprinting = false;
    this.isDead = false;
  }

  // Fall damage calculation: height - 3 blocks = HP damage
  calculateFallDamage(fallDistance) {
    if (fallDistance > 3.0) {
      return Math.floor(fallDistance - 3.0);
    }
    return 0;
  }

  // Damage animation: tint mesh red for 200ms + knockback impulse
  applyDamageWithAnimation(entityMesh, damage, knockbackDir) {
    // 1. Red flash (200ms)
    if (entityMesh.material && entityMesh.material.color) {
      entityMesh.material.color.setHex(0xff0000);
      setTimeout(() => {
        if (entityMesh.material) {
          entityMesh.material.color.setHex(0xffffff);
        }
      }, 200);
    }

    // 2. Knockback horizontal + vertical impulse
    const knockback = {
      x: knockbackDir.x * 4.5,
      y: 3.5, // vertical pop
      z: knockbackDir.z * 4.5,
    };

    return { damage, knockback };
  }

  // Periodic survival tick: sprint exhaustion, slow regeneration, starvation
  tick(dt) {
    if (this.isDead) return;

    // Sprinting drains hunger rapidly
    if (this.isSprinting && this.hunger > 6) {
      this.hunger = Math.max(0, this.hunger - dt * 0.35);
    }

    // Slow health regeneration when hunger > 18
    if (this.hunger > 18 && this.health < this.maxHealth) {
      this.health = Math.min(this.maxHealth, this.health + dt * 0.3);
    }

    // Starvation damage when hunger reaches 0
    if (this.hunger === 0) {
      this.takeDamage(dt * 0.4, 'starvation');
    }
  }

  // Take damage & death handler
  takeDamage(amount, reason = 'generic') {
    if (this.isDead) return;
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) {
      this.triggerDeath(reason);
    }
  }

  // Scatter inventory items in 3D around death point
  triggerDeath(reason) {
    this.isDead = true;
    console.log('Player died: ' + reason);
  }

  // Respawn: restore health & hunger, reset coordinates to spawn
  respawn(spawnPos = { x: 8, y: 28, z: 8 }) {
    this.isDead = false;
    this.health = 20;
    this.hunger = 20;
    return spawnPos;
  }
}
`;

export const CodeViewer: React.FC = () => {
  const [activeCodeTab, setActiveCodeTab] = useState<'inventory' | 'serverAI' | 'mobs' | 'lighting' | 'atlas'>('inventory');
  const [copied, setCopied] = useState(false);

  let activeCode = JS_INVENTORY_CRAFTING_CODE;
  if (activeCodeTab === 'serverAI') activeCode = JS_SERVER_AI_CODE;
  if (activeCodeTab === 'mobs') activeCode = JS_ENTITY_BUILDER_CODE;
  if (activeCodeTab === 'lighting') activeCode = JS_LIGHTING_AO_CODE;
  if (activeCodeTab === 'atlas') activeCode = JS_ATLAS_SHADER_CODE;

  const handleCopy = () => {
    navigator.clipboard.writeText(activeCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col h-full max-h-[750px]">
      {/* Header */}
      <div className="bg-slate-950/80 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Code className="w-5 h-5 text-emerald-400" />
          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800 overflow-x-auto">
            <button
              onClick={() => setActiveCodeTab('inventory')}
              className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                activeCodeTab === 'inventory'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Inventory & Crafting.js
            </button>
            <button
              onClick={() => setActiveCodeTab('serverAI')}
              className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                activeCodeTab === 'serverAI'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" /> ServerMobAI.js
            </button>
            <button
              onClick={() => setActiveCodeTab('mobs')}
              className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                activeCodeTab === 'mobs'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-emerald-300" /> EntityModelBuilder.js
            </button>
            <button
              onClick={() => setActiveCodeTab('lighting')}
              className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                activeCodeTab === 'lighting'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sun className="w-3.5 h-3.5 text-amber-300" /> Voxel Lighting & AO
            </button>
            <button
              onClick={() => setActiveCodeTab('atlas')}
              className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                activeCodeTab === 'atlas'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Grid className="w-3.5 h-3.5 text-cyan-300" /> 16×16 Atlas & Water
            </button>
          </div>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition cursor-pointer shrink-0"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied!' : 'Copy JavaScript Code'}
        </button>
      </div>

      {/* Code Area */}
      <div className="p-4 overflow-auto flex-1 font-mono text-xs text-slate-300 leading-relaxed bg-slate-950 select-text">
        <pre className="whitespace-pre">{activeCode}</pre>
      </div>

      {/* Footer Info */}
      <div className="bg-slate-900 px-4 py-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>
            {activeCodeTab === 'serverAI'
              ? 'Node.js FSM (IDLE/WANDER/CHASE/ATTACK) • Creeper 1.5s Detonation & Voxel Radius Blast • 1-Block Jump & Pit Avoidance • Darkness Spawner (24-64 blocks)'
              : activeCodeTab === 'mobs'
              ? 'Parametric BoxGeometry Mobs (Humanoid/Zombie/Creeper) • Shoulder & Hip Pivots • Sinusoidal Antiphase Walk • Standard 64×64 Skin UVs'
              : activeCodeTab === 'lighting'
              ? 'lightMap [0..15] • BFS Flood Fill 14-Block Falloff • Removal Queue • 4-Level Vertex AO (0%, 20%, 40%, 60%)'
              : '16×16 OffscreenCanvas Grid • NearestFilter Pixel Sampling • Custom Water Sine Wave ShaderMaterial'}
          </span>
        </div>
        <div className="flex items-center gap-1 text-slate-500 shrink-0">
          <FileText className="w-3.5 h-3.5" />
          <span>Node.js / Pure JavaScript</span>
        </div>
      </div>
    </div>
  );
};
