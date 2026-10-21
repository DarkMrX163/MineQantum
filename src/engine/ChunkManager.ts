import * as THREE from "three";
import {
  CHUNK_SIZE_X,
  CHUNK_SIZE_Y,
  CHUNK_SIZE_Z,
  BLOCK,
  BlockId,
  ChunkStats,
} from "./types";
import { generateChunkGeometry, getBlockIndex } from "./ChunkMeshGenerator";
import { generateTerrain } from "./ChunkTerrainGenerator";
import {
  LightManager,
  unpackSky,
  unpackBlock,
  packLight,
  getLightEmission,
  isLightTransparent,
} from "./LightingEngine";

export class Chunk {
  public cx: number;
  public cz: number;
  public data: Uint8Array;
  public lightMap: Uint8Array; // 16x16x64 bytes: (skyLight << 4) | blockLight
  public mesh: THREE.Mesh | null = null;
  public isDirty: boolean = true;
  public hasGeneratedMesh: boolean = false;
  public renderedFaces: number = 0;
  public naiveFaces: number = 0;

  constructor(cx: number, cz: number) {
    this.cx = cx;
    this.cz = cz;
    // Flat array size 16 x 16 x 64 = 16384 bytes
    this.data = new Uint8Array(CHUNK_SIZE_X * CHUNK_SIZE_Z * CHUNK_SIZE_Y);
    this.lightMap = new Uint8Array(CHUNK_SIZE_X * CHUNK_SIZE_Z * CHUNK_SIZE_Y);
  }

  public getBlock(x: number, y: number, z: number): number {
    if (
      x < 0 ||
      x >= CHUNK_SIZE_X ||
      y < 0 ||
      y >= CHUNK_SIZE_Y ||
      z < 0 ||
      z >= CHUNK_SIZE_Z
    ) {
      return BLOCK.AIR;
    }
    return this.data[getBlockIndex(x, y, z)];
  }

  public setBlock(x: number, y: number, z: number, blockId: number): void {
    if (
      x < 0 ||
      x >= CHUNK_SIZE_X ||
      y < 0 ||
      y >= CHUNK_SIZE_Y ||
      z < 0 ||
      z >= CHUNK_SIZE_Z
    ) {
      return;
    }
    const idx = getBlockIndex(x, y, z);
    if (this.data[idx] !== blockId) {
      this.data[idx] = blockId;
      this.isDirty = true;
    }
  }

  public getLight(x: number, y: number, z: number): number {
    if (
      x < 0 ||
      x >= CHUNK_SIZE_X ||
      y < 0 ||
      y >= CHUNK_SIZE_Y ||
      z < 0 ||
      z >= CHUNK_SIZE_Z
    ) {
      return y >= CHUNK_SIZE_Y ? 15 << 4 : 0;
    }
    return this.lightMap[getBlockIndex(x, y, z)];
  }

  public setLight(x: number, y: number, z: number, val: number): void {
    if (
      x < 0 ||
      x >= CHUNK_SIZE_X ||
      y < 0 ||
      y >= CHUNK_SIZE_Y ||
      z < 0 ||
      z >= CHUNK_SIZE_Z
    ) {
      return;
    }
    const idx = getBlockIndex(x, y, z);
    if (this.lightMap[idx] !== val) {
      this.lightMap[idx] = val;
      this.isDirty = true;
    }
  }

  public getSkyLight(x: number, y: number, z: number): number {
    return unpackSky(this.getLight(x, y, z));
  }

  public getBlockLight(x: number, y: number, z: number): number {
    return unpackBlock(this.getLight(x, y, z));
  }
}

export class ChunkManager {
  private chunks: Map<string, Chunk> = new Map();
  private sharedMaterial: THREE.Material;
  public lightManager: LightManager;

  public terrainScale: number = 0.015;
  public terrainHeight: number = 18;
  public baseHeight: number = 20;
  public caveThreshold: number = 0.42;
  public skyIntensity: number = 1.0; // 1.0 = Daytime, 0.15 = Nighttime
  public enableAO: boolean = true; // 4-level Ambient Occlusion (0%, 20%, 40%, 60%)

  constructor(material: THREE.Material) {
    this.sharedMaterial = material;

    this.lightManager = new LightManager({
      getBlockGlobal: (gx, gy, gz) => this.getBlockGlobal(gx, gy, gz),
      getLightGlobal: (gx, gy, gz) => this.getLightGlobal(gx, gy, gz),
      setLightGlobal: (gx, gy, gz, val) => this.setLightGlobal(gx, gy, gz, val),
      markChunkDirtyAt: (gx, gz) => this.markChunkDirtyAt(gx, gz),
      isChunkLoaded: (gx, gz) => this.isChunkLoaded(gx, gz),
    });
  }

  public isChunkLoaded(gx: number, gz: number): boolean {
    const cx = Math.floor(gx / CHUNK_SIZE_X);
    const cz = Math.floor(gz / CHUNK_SIZE_Z);
    return this.chunks.has(this.getChunkKey(cx, cz));
  }

  public getChunkKey(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  public getChunk(cx: number, cz: number): Chunk | undefined {
    return this.chunks.get(this.getChunkKey(cx, cz));
  }

  public markChunkDirtyAt(gx: number, gz: number): void {
    const cx = Math.floor(gx / CHUNK_SIZE_X);
    const cz = Math.floor(gz / CHUNK_SIZE_Z);
    const chunk = this.getChunk(cx, cz);
    if (chunk) {
      chunk.isDirty = true;
    }
  }

  public getOrCreateChunk(cx: number, cz: number): Chunk {
    const key = this.getChunkKey(cx, cz);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = new Chunk(cx, cz);
      // Immediately register in map before generation/lighting to prevent re-entrant recursion
      this.chunks.set(key, chunk);

      chunk.data = generateTerrain(cx, cz, {
        baseHeight: this.baseHeight,
        heightAmplitude: this.terrainHeight,
        noiseScale2D: this.terrainScale,
        caveThreshold: this.caveThreshold,
      });

      // Initialize sky light and block lights in this chunk
      this.lightManager.initializeChunkSkyLight(
        chunk.data,
        chunk.lightMap,
        cx,
        cz,
      );
    }
    return chunk;
  }

  /**
   * Reads a block ID given global world coordinates (gx, gy, gz)
   */
  public getBlockGlobal(gx: number, gy: number, gz: number): number {
    if (gy < 0 || gy >= CHUNK_SIZE_Y) return BLOCK.AIR;

    const cx = Math.floor(gx / CHUNK_SIZE_X);
    const cz = Math.floor(gz / CHUNK_SIZE_Z);
    const chunk = this.chunks.get(this.getChunkKey(cx, cz));

    if (!chunk) return BLOCK.AIR;

    const lx = ((gx % CHUNK_SIZE_X) + CHUNK_SIZE_X) % CHUNK_SIZE_X;
    const lz = ((gz % CHUNK_SIZE_Z) + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;

    return chunk.getBlock(lx, gy, lz);
  }

  /**
   * Finds top solid ground Y coordinate at global (gx, gz)
   */
  public getTopGroundY(gx: number, gz: number): number {
    const ix = Math.floor(gx);
    const iz = Math.floor(gz);
    for (let y = CHUNK_SIZE_Y - 1; y >= 1; y--) {
      const blockId = this.getBlockGlobal(ix, y, iz);
      if (
        blockId !== BLOCK.AIR &&
        blockId !== BLOCK.WATER &&
        blockId !== BLOCK.LAVA &&
        blockId !== BLOCK.TORCH
      ) {
        return y + 1; // Stand on top surface of solid block
      }
    }
    return 16; // default surface level fallback
  }

  /**
   * Reads packed light value (sky + block) at global coordinates (gx, gy, gz)
   */
  public getLightGlobal(gx: number, gy: number, gz: number): number {
    if (gy >= CHUNK_SIZE_Y) return 15 << 4;
    if (gy < 0) return 0;

    const cx = Math.floor(gx / CHUNK_SIZE_X);
    const cz = Math.floor(gz / CHUNK_SIZE_Z);
    const chunk = this.chunks.get(this.getChunkKey(cx, cz));

    if (!chunk) return 15 << 4;

    const lx = ((gx % CHUNK_SIZE_X) + CHUNK_SIZE_X) % CHUNK_SIZE_X;
    const lz = ((gz % CHUNK_SIZE_Z) + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;

    return chunk.getLight(lx, gy, lz);
  }

  /**
   * Sets packed light value at global coordinates
   */
  public setLightGlobal(gx: number, gy: number, gz: number, val: number): void {
    if (gy < 0 || gy >= CHUNK_SIZE_Y) return;

    const cx = Math.floor(gx / CHUNK_SIZE_X);
    const cz = Math.floor(gz / CHUNK_SIZE_Z);
    const chunk = this.chunks.get(this.getChunkKey(cx, cz));
    if (!chunk) return;

    const lx = ((gx % CHUNK_SIZE_X) + CHUNK_SIZE_X) % CHUNK_SIZE_X;
    const lz = ((gz % CHUNK_SIZE_Z) + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;

    chunk.setLight(lx, gy, lz, val);
  }

  /**
   * Sets a block at global world coordinates, updates light levels, marks chunk dirty,
   * and triggers mesh rebuilds.
   */
  public setBlockGlobal(
    gx: number,
    gy: number,
    gz: number,
    blockId: number,
    scene?: THREE.Scene,
  ): void {
    if (gy < 0 || gy >= CHUNK_SIZE_Y) return;

    const oldBlock = this.getBlockGlobal(gx, gy, gz);
    if (oldBlock === blockId) return;

    const oldEmission = getLightEmission(oldBlock);
    const newEmission = getLightEmission(blockId);

    // If an emitting light source was destroyed, remove its light via BFS removal queue
    if (oldEmission > 0) {
      this.lightManager.removeBlockLightBFS(gx, gy, gz);
    }

    const cx = Math.floor(gx / CHUNK_SIZE_X);
    const cz = Math.floor(gz / CHUNK_SIZE_Z);
    const chunk = this.getOrCreateChunk(cx, cz);

    const lx = ((gx % CHUNK_SIZE_X) + CHUNK_SIZE_X) % CHUNK_SIZE_X;
    const lz = ((gz % CHUNK_SIZE_Z) + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;

    // If placing an opaque block where light existed, clear light through it
    if (!isLightTransparent(blockId) && newEmission === 0) {
      const curLight = chunk.getLight(lx, gy, lz);
      if (unpackBlock(curLight) > 0) {
        this.lightManager.removeBlockLightBFS(gx, gy, gz);
      }
    }

    chunk.setBlock(lx, gy, lz, blockId);

    // If placing a new light source (torch / lava), propagate its light via BFS flood-fill
    if (newEmission > 0) {
      const curLight = chunk.getLight(lx, gy, lz);
      const sky = unpackSky(curLight);
      chunk.setLight(lx, gy, lz, packLight(sky, newEmission));
      this.lightManager.propagateBlockLightBFS(gx, gy, gz, newEmission);
    }

    // Sky light column update:
    // If solid block is placed in sunlight, block sunlight down the column
    if (!isLightTransparent(blockId)) {
      for (let y = gy; y >= 0; y--) {
        const blk = chunk.getBlock(lx, y, lz);
        if (!isLightTransparent(blk) && y < gy) break;
        const cur = chunk.getLight(lx, y, lz);
        chunk.setLight(lx, y, lz, packLight(0, unpackBlock(cur)));
      }
    } else if (isLightTransparent(blockId) && !isLightTransparent(oldBlock)) {
      // If solid block is removed, check if open to sunlight from above
      let hasSun = true;
      for (let y = gy + 1; y < CHUNK_SIZE_Y; y++) {
        if (!isLightTransparent(chunk.getBlock(lx, y, lz))) {
          hasSun = false;
          break;
        }
      }
      if (hasSun) {
        for (let y = gy; y >= 0; y--) {
          if (!isLightTransparent(chunk.getBlock(lx, y, lz))) break;
          const cur = chunk.getLight(lx, y, lz);
          chunk.setLight(lx, y, lz, packLight(15, unpackBlock(cur)));
        }
      }

      // Flood surrounding block light from neighbors into newly excavated space
      const DIRS = [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
        [0, 0, 1],
        [0, 0, -1],
      ];
      for (const [dx, dy, dz] of DIRS) {
        const ny = gy + dy;
        if (ny < 0 || ny >= CHUNK_SIZE_Y) continue;
        const nLight = this.getLightGlobal(gx + dx, ny, gz + dz);
        const bLight = unpackBlock(nLight);
        if (bLight > 1) {
          this.lightManager.propagateBlockLightBFS(
            gx + dx,
            ny,
            gz + dz,
            bLight,
          );
        }
      }
    }

    // If block is on chunk boundary, mark neighboring chunk dirty so bordering faces update
    if (lx === 0) {
      const neighbor = this.getChunk(cx - 1, cz);
      if (neighbor) neighbor.isDirty = true;
    } else if (lx === CHUNK_SIZE_X - 1) {
      const neighbor = this.getChunk(cx + 1, cz);
      if (neighbor) neighbor.isDirty = true;
    }

    if (lz === 0) {
      const neighbor = this.getChunk(cx, cz - 1);
      if (neighbor) neighbor.isDirty = true;
    } else if (lz === CHUNK_SIZE_Z - 1) {
      const neighbor = this.getChunk(cx, cz + 1);
      if (neighbor) neighbor.isDirty = true;
    }

    if (scene) {
      this.rebuildDirtyMeshes(scene);
    }
  }

  private lastPlayerChunkX: number | null = null;
  private lastPlayerChunkZ: number | null = null;
  private lastRenderDistance: number | null = null;
  private lastNaiveMode: boolean | null = null;

  /**
   * Rebuilds meshes for dirty chunks with lighting and AO.
   * Limits rebuilds per frame (default 4) to ensure a stable 60 FPS without stutter.
   */
  public rebuildDirtyMeshes(
    scene: THREE.Scene,
    naiveMode: boolean = false,
    maxRebuildsPerCall: number = 4,
  ): void {
    const boundGetBlockGlobal = (gx: number, gy: number, gz: number) =>
      this.getBlockGlobal(gx, gy, gz);
    const boundGetLightGlobal = (gx: number, gy: number, gz: number) =>
      this.getLightGlobal(gx, gy, gz);

    let rebuildsDone = 0;

    for (const chunk of this.chunks.values()) {
      if (!chunk.isDirty && chunk.hasGeneratedMesh) continue;

      if (rebuildsDone >= maxRebuildsPerCall) {
        // Leave remaining chunks for next frame to maintain smooth 60 FPS
        break;
      }

      // Dispose existing geometry
      if (chunk.mesh) {
        scene.remove(chunk.mesh);
        chunk.mesh.geometry.dispose();
        chunk.mesh = null;
      }

      // Generate open-face culled geometry with lighting and 4-level AO
      const { geometry, renderedFaceCount, naiveFaceCount } =
        generateChunkGeometry(
          chunk.data,
          chunk.lightMap,
          chunk.cx,
          chunk.cz,
          boundGetBlockGlobal,
          boundGetLightGlobal,
          {
            enableAO: this.enableAO,
            naiveNoCull: naiveMode,
            skyIntensity: this.skyIntensity,
          },
        );

      chunk.renderedFaces = renderedFaceCount;
      chunk.naiveFaces = naiveFaceCount;

      if (renderedFaceCount > 0) {
        const mesh = new THREE.Mesh(geometry, this.sharedMaterial);
        mesh.position.set(chunk.cx * CHUNK_SIZE_X, 0, chunk.cz * CHUNK_SIZE_Z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        chunk.mesh = mesh;
      }

      chunk.hasGeneratedMesh = true;
      chunk.isDirty = false;
      rebuildsDone++;
    }
  }

  /**
   * Sets day/night sky light intensity and triggers mesh rebuilds
   */
  public setSkyIntensity(intensity: number, scene?: THREE.Scene): void {
    this.skyIntensity = intensity;
    this.chunks.forEach((c) => {
      c.isDirty = true;
    });
    if (scene) {
      this.rebuildDirtyMeshes(scene, false, 999);
    }
  }

  /**
   * Toggles 4-level Ambient Occlusion and triggers mesh rebuilds
   */
  public setEnableAO(enable: boolean, scene?: THREE.Scene): void {
    this.enableAO = enable;
    this.chunks.forEach((c) => {
      c.isDirty = true;
    });
    if (scene) {
      this.rebuildDirtyMeshes(scene, false, 999);
    }
  }

  /**
   * Dynamically loads/unloads chunks around player position.
   * Only recomputes chunk set when the player crosses chunk boundaries,
   * with hysteresis buffering to prevent mesh thrashing at chunk borders.
   */
  public updateWorldAroundPlayer(
    playerX: number,
    playerZ: number,
    renderDistance: number,
    scene: THREE.Scene,
    naiveMode: boolean = false,
  ): void {
    const playerChunkX = Math.floor(playerX / CHUNK_SIZE_X);
    const playerChunkZ = Math.floor(playerZ / CHUNK_SIZE_Z);

    const chunkChanged =
      playerChunkX !== this.lastPlayerChunkX ||
      playerChunkZ !== this.lastPlayerChunkZ ||
      renderDistance !== this.lastRenderDistance ||
      naiveMode !== this.lastNaiveMode;

    if (chunkChanged) {
      this.lastPlayerChunkX = playerChunkX;
      this.lastPlayerChunkZ = playerChunkZ;
      this.lastRenderDistance = renderDistance;
      this.lastNaiveMode = naiveMode;

      const activeKeys = new Set<string>();
      const keepKeys = new Set<string>();

      for (let dx = -renderDistance; dx <= renderDistance; dx++) {
        for (let dz = -renderDistance; dz <= renderDistance; dz++) {
          if (
            dx * dx + dz * dz >
            (renderDistance + 0.5) * (renderDistance + 0.5)
          ) {
            continue;
          }

          const cx = playerChunkX + dx;
          const cz = playerChunkZ + dz;
          const key = this.getChunkKey(cx, cz);
          activeKeys.add(key);

          this.getOrCreateChunk(cx, cz);
        }
      }

      // Hysteresis unload distance: retain chunks within renderDistance + 1.25
      const unloadDistSq =
        (renderDistance + 1.25) * (renderDistance + 1.25);

      for (
        let dx = -renderDistance - 1;
        dx <= renderDistance + 1;
        dx++
      ) {
        for (
          let dz = -renderDistance - 1;
          dz <= renderDistance + 1;
          dz++
        ) {
          if (dx * dx + dz * dz <= unloadDistSq) {
            keepKeys.add(this.getChunkKey(playerChunkX + dx, playerChunkZ + dz));
          }
        }
      }

      // Unload chunks outside hysteresis distance
      this.chunks.forEach((chunk, key) => {
        if (!keepKeys.has(key)) {
          if (chunk.mesh) {
            scene.remove(chunk.mesh);
            chunk.mesh.geometry.dispose();
          }
          this.chunks.delete(key);
        }
      });
    }

    this.rebuildDirtyMeshes(scene, naiveMode, 4);
  }

  /**
   * DDA Voxel Raycaster for fast, precise block selection and placement
   */
  public raycast(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance: number = 8,
  ): {
    hit: boolean;
    blockPos: THREE.Vector3;
    placePos: THREE.Vector3;
    normal: THREE.Vector3;
    blockId: number;
  } | null {
    const dir = direction.clone().normalize();
    // Guard against division by zero to prevent NaN and infinite loops
    const dx = Math.abs(dir.x) < 1e-6 ? (dir.x < 0 ? -1e-6 : 1e-6) : dir.x;
    const dy = Math.abs(dir.y) < 1e-6 ? (dir.y < 0 ? -1e-6 : 1e-6) : dir.y;
    const dz = Math.abs(dir.z) < 1e-6 ? (dir.z < 0 ? -1e-6 : 1e-6) : dir.z;

    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);

    const stepX = dx > 0 ? 1 : -1;
    const stepY = dy > 0 ? 1 : -1;
    const stepZ = dz > 0 ? 1 : -1;

    const tDeltaX = Math.abs(1 / dx);
    const tDeltaY = Math.abs(1 / dy);
    const tDeltaZ = Math.abs(1 / dz);

    let tMaxX =
      dx > 0
        ? (Math.floor(origin.x) + 1 - origin.x) * tDeltaX
        : (origin.x - Math.floor(origin.x)) * tDeltaX;
    let tMaxY =
      dy > 0
        ? (Math.floor(origin.y) + 1 - origin.y) * tDeltaY
        : (origin.y - Math.floor(origin.y)) * tDeltaY;
    let tMaxZ =
      dz > 0
        ? (Math.floor(origin.z) + 1 - origin.z) * tDeltaZ
        : (origin.z - Math.floor(origin.z)) * tDeltaZ;

    let normal = new THREE.Vector3();
    let distance = 0;
    let stepCount = 0;

    while (distance <= maxDistance && stepCount++ < 100) {
      const blockId = this.getBlockGlobal(x, y, z);
      if (blockId !== BLOCK.AIR && blockId !== BLOCK.WATER) {
        const blockPos = new THREE.Vector3(x, y, z);
        const placePos = blockPos.clone().add(normal);
        return {
          hit: true,
          blockPos,
          placePos,
          normal,
          blockId,
        };
      }

      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          x += stepX;
          distance = tMaxX;
          tMaxX += tDeltaX;
          normal.set(-stepX, 0, 0);
        } else {
          z += stepZ;
          distance = tMaxZ;
          tMaxZ += tDeltaZ;
          normal.set(0, 0, -stepZ);
        }
      } else {
        if (tMaxY < tMaxZ) {
          y += stepY;
          distance = tMaxY;
          tMaxY += tDeltaY;
          normal.set(0, -stepY, 0);
        } else {
          z += stepZ;
          distance = tMaxZ;
          tMaxZ += tDeltaZ;
          normal.set(0, 0, -stepZ);
        }
      }
    }

    return null;
  }

  /**
   * Aggregates live stats across all active chunks
   */
  public getStats(): ChunkStats {
    let loadedChunks = 0;
    let renderedFaces = 0;
    let naiveFaceCount = 0;
    let totalBlocks = 0;

    this.chunks.forEach((chunk) => {
      loadedChunks++;
      renderedFaces += chunk.renderedFaces;
      naiveFaceCount += chunk.naiveFaces;
      totalBlocks += CHUNK_SIZE_X * CHUNK_SIZE_Y * CHUNK_SIZE_Z;
    });

    const cullingEfficiency =
      naiveFaceCount > 0 ? (1 - renderedFaces / naiveFaceCount) * 100 : 0;

    return {
      loadedChunks,
      totalBlocks,
      renderedFaces,
      totalVertices: renderedFaces * 4,
      drawCalls: loadedChunks,
      naiveFaceCount,
      cullingEfficiency: Math.round(cullingEfficiency * 10) / 10,
    };
  }

  /**
   * Clears all chunks and disposes geometries
   */
  public clearAll(scene: THREE.Scene): void {
    this.chunks.forEach((chunk) => {
      if (chunk.mesh) {
        scene.remove(chunk.mesh);
        chunk.mesh.geometry.dispose();
      }
    });
    this.chunks.clear();
  }
}
