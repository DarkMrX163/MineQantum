import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createNoise2D, createNoise3D } from 'simplex-noise';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const app = express();
const httpServer = createServer(app);

// Initialize WebSocket Server
const wss = new WebSocketServer({ server: httpServer });

// Constants
const CHUNK_SIZE_X = 16;
const CHUNK_SIZE_Z = 16;
const CHUNK_SIZE_Y = 64;
const TICK_RATE_MS = 50; // 20 TPS (Ticks Per Second)

// Simplex Noise Generators for world terrain
const noise2D = createNoise2D();
const noise3D = createNoise3D();

// Data Structures
export interface PlayerState {
  id: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  color: string;
  lastUpdate: number;
}

export interface BlockEdit {
  x: number;
  y: number;
  z: number;
  blockType: number;
  playerId?: string;
}

// In-Memory Global World State
const connectedPlayers = new Map<WebSocket, PlayerState>();
// World edits map stored by chunk key "cx,cz" -> Map<blockIndex, blockType>
const worldChunkEdits = new Map<string, Map<number, number>>();

import { ServerMobAIEngine, WorldAccessor, PlayerTarget } from './src/server/ServerMobAI';

// Server World Accessor for Mob AI
const worldAccessor: WorldAccessor = {
  getBlock(gx: number, gy: number, gz: number): number {
    if (gy < 0 || gy >= CHUNK_SIZE_Y) return 0;
    const cx = Math.floor(gx / CHUNK_SIZE_X);
    const cz = Math.floor(gz / CHUNK_SIZE_Z);
    const chunkKey = `${cx},${cz}`;
    const lx = ((gx % CHUNK_SIZE_X) + CHUNK_SIZE_X) % CHUNK_SIZE_X;
    const lz = ((gz % CHUNK_SIZE_Z) + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;
    const idx = lx + lz * CHUNK_SIZE_X + gy * (CHUNK_SIZE_X * CHUNK_SIZE_Z);

    const edits = worldChunkEdits.get(chunkKey);
    if (edits && edits.has(idx)) {
      return edits.get(idx)!;
    }

    const chunk = generateServerChunk(cx, cz);
    return chunk[idx];
  },
  setBlock(gx: number, gy: number, gz: number, blockType: number): void {
    if (gy < 0 || gy >= CHUNK_SIZE_Y) return;
    const cx = Math.floor(gx / CHUNK_SIZE_X);
    const cz = Math.floor(gz / CHUNK_SIZE_Z);
    const chunkKey = `${cx},${cz}`;
    const lx = ((gx % CHUNK_SIZE_X) + CHUNK_SIZE_X) % CHUNK_SIZE_X;
    const lz = ((gz % CHUNK_SIZE_Z) + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;
    const idx = lx + lz * CHUNK_SIZE_X + gy * (CHUNK_SIZE_X * CHUNK_SIZE_Z);

    if (!worldChunkEdits.has(chunkKey)) {
      worldChunkEdits.set(chunkKey, new Map());
    }
    worldChunkEdits.get(chunkKey)!.set(idx, blockType);
  },
};

const mobAI = new ServerMobAIEngine(worldAccessor);

// Hook up Mob AI events to WebSocket broadcasts
mobAI.onBlockDestroyed = (x, y, z, blockType) => {
  broadcast({
    type: 'block_update',
    x,
    y,
    z,
    blockType,
    source: 'creeper_explosion',
  });
};

mobAI.onExplosion = (x, y, z, radius) => {
  broadcast({
    type: 'explosion',
    x,
    y,
    z,
    radius,
  });
};

mobAI.onPlayerDamaged = (playerId, damage, knockback) => {
  broadcast({
    type: 'player_damaged',
    playerId,
    damage,
    knockback,
  });
};

// Hash helper for server chunk generation
function hash2D(x: number, z: number): number {
  let h = (x * 374761393 + z * 668265263) ^ 0x5bf03635;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

const SEA_LEVEL = 18;

// Generate chunk block data on server matching client terrain & trees
function generateServerChunk(cx: number, cz: number): Uint8Array {
  const data = new Uint8Array(CHUNK_SIZE_X * CHUNK_SIZE_Z * CHUNK_SIZE_Y);
  const worldOffsetX = cx * CHUNK_SIZE_X;
  const worldOffsetZ = cz * CHUNK_SIZE_Z;

  // Pass 1: Terrain, lakes, sand beaches & caves
  for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
    for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
      const gx = worldOffsetX + lx;
      const gz = worldOffsetZ + lz;

      const continental = noise2D(gx * 0.007, gz * 0.007);
      const hills = noise2D(gx * 0.02, gz * 0.02) * 0.5;
      const detail = noise2D(gx * 0.05, gz * 0.05) * 0.15;

      const rawHeight = Math.floor(20 + continental * 14 + hills * 8 + detail * 4);
      const surfaceY = Math.min(CHUNK_SIZE_Y - 8, Math.max(2, rawHeight));

      const maxY = Math.max(surfaceY, SEA_LEVEL);
      for (let y = 0; y <= maxY; y++) {
        let block = 0; // Air

        if (y === 0) {
          block = 1; // Stone
        } else if (y <= surfaceY) {
          if (surfaceY <= SEA_LEVEL) {
            block = y === surfaceY ? 6 : (y >= surfaceY - 3 ? 6 : 1); // Sand
          } else if (surfaceY <= SEA_LEVEL + 2) {
            block = y === surfaceY ? 6 : (y >= surfaceY - 3 ? 6 : 1); // Sand Beach
          } else {
            if (y === surfaceY) block = 3; // Grass
            else if (y >= surfaceY - 3) block = 2; // Dirt
            else block = 1; // Stone
          }

          if (y > 1 && y < surfaceY - 2) {
            const caveVal = noise3D(gx * 0.04, y * 0.06, gz * 0.04);
            if (caveVal > 0.44) block = 0;
          }
        } else if (y <= SEA_LEVEL) {
          block = 7; // Water
        }

        const idx = lx + lz * CHUNK_SIZE_X + y * (CHUNK_SIZE_X * CHUNK_SIZE_Z);
        data[idx] = block;
      }
    }
  }

  // Pass 2: Oak Trees
  for (let czOffset = -1; czOffset <= 1; czOffset++) {
    for (let cxOffset = -1; cxOffset <= 1; cxOffset++) {
      const neighborChunkX = cx + cxOffset;
      const neighborChunkZ = cz + czOffset;
      const nWorldX = neighborChunkX * CHUNK_SIZE_X;
      const nWorldZ = neighborChunkZ * CHUNK_SIZE_Z;

      for (let nLz = 0; nLz < CHUNK_SIZE_Z; nLz++) {
        for (let nLx = 0; nLx < CHUNK_SIZE_X; nLx++) {
          const treeGx = nWorldX + nLx;
          const treeGz = nWorldZ + nLz;

          const rnd = hash2D(treeGx, treeGz);
          if (rnd > 0.022) continue;

          const c = noise2D(treeGx * 0.007, treeGz * 0.007);
          const h = noise2D(treeGx * 0.02, treeGz * 0.02) * 0.5;
          const d = noise2D(treeGx * 0.05, treeGz * 0.05) * 0.15;
          const treeSurfaceY = Math.min(CHUNK_SIZE_Y - 8, Math.max(2, Math.floor(20 + c * 14 + h * 8 + d * 4)));

          if (treeSurfaceY <= SEA_LEVEL + 2) continue;

          const trunkHeight = 4 + Math.floor(hash2D(treeGx * 7, treeGz * 13) * 3);

          for (let dy = 0; dy <= trunkHeight + 1; dy++) {
            const leafY = treeSurfaceY + 1 + dy;
            if (leafY < 1 || leafY >= CHUNK_SIZE_Y) continue;

            const isTrunk = dy < trunkHeight;
            let radius = 0;

            if (dy >= trunkHeight - 2 && dy < trunkHeight) radius = 2;
            else if (dy === trunkHeight) radius = 1;
            else if (dy === trunkHeight + 1) radius = 1;

            for (let ox = -radius; ox <= radius; ox++) {
              for (let oz = -radius; oz <= radius; oz++) {
                const targetGx = treeGx + ox;
                const targetGz = treeGz + oz;

                const targetLx = targetGx - worldOffsetX;
                const targetLz = targetGz - worldOffsetZ;

                if (targetLx >= 0 && targetLx < CHUNK_SIZE_X && targetLz >= 0 && targetLz < CHUNK_SIZE_Z) {
                  const idx = targetLx + targetLz * CHUNK_SIZE_X + leafY * (CHUNK_SIZE_X * CHUNK_SIZE_Z);

                  if (ox === 0 && oz === 0 && isTrunk) {
                    data[idx] = 4; // Wood
                  } else if (radius > 0) {
                    const isCorner = Math.abs(ox) === radius && Math.abs(oz) === radius;
                    if (!isCorner || (dy === trunkHeight - 1 && hash2D(targetGx, targetGz) > 0.4)) {
                      if (data[idx] === 0 || data[idx] === 5) {
                        data[idx] = 5; // Leaves
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

  // Apply saved player block edits for this chunk
  const chunkKey = `${cx},${cz}`;
  const edits = worldChunkEdits.get(chunkKey);
  if (edits) {
    edits.forEach((blockType, idx) => {
      data[idx] = blockType;
    });
  }

  return data;
}

// Generate unique player ID & random color
function generatePlayerId(): string {
  return 'player_' + Math.random().toString(36).substring(2, 9);
}
function getRandomColor(): string {
  const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Broadcast helper
function broadcast(message: object, excludeWs?: WebSocket) {
  const json = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client !== excludeWs) {
      client.send(json);
    }
  });
}

// WebSocket Connection Lifecycle
wss.on('connection', (ws: WebSocket) => {
  const playerId = generatePlayerId();
  const playerColor = getRandomColor();

  const playerState: PlayerState = {
    id: playerId,
    x: 8.0,
    y: 21.0,
    z: 8.0,
    yaw: 0,
    pitch: 0,
    color: playerColor,
    lastUpdate: Date.now(),
  };

  connectedPlayers.set(ws, playerState);

  // Send init handshake with assigned ID and current active players
  const otherPlayers = Array.from(connectedPlayers.values()).filter((p) => p.id !== playerId);
  ws.send(
    JSON.stringify({
      type: 'init',
      id: playerId,
      color: playerColor,
      players: otherPlayers,
      mobs: mobAI.serializeMobs(),
    })
  );

  // Notify other clients about new player
  broadcast(
    {
      type: 'player_joined',
      player: playerState,
    },
    ws
  );

  console.log(`[WebSocket] Player joined: ${playerId}`);

  // Message Handler
  ws.on('message', (messageRaw: string) => {
    try {
      const msg = JSON.parse(messageRaw.toString());

      if (msg.type === 'player_move') {
        // Update player coordinates & head orientation
        const p = connectedPlayers.get(ws);
        if (p) {
          p.x = Number(msg.x) || p.x;
          p.y = Number(msg.y) || p.y;
          p.z = Number(msg.z) || p.z;
          p.yaw = Number(msg.yaw) || 0;
          p.pitch = Number(msg.pitch) || 0;
          p.lastUpdate = Date.now();
        }
      } else if (msg.type === 'block_edit') {
        // Validate block edit
        const { x, y, z, blockType } = msg as BlockEdit;

        if (
          typeof x === 'number' &&
          typeof y === 'number' &&
          typeof z === 'number' &&
          y >= 0 &&
          y < CHUNK_SIZE_Y &&
          typeof blockType === 'number' &&
          blockType >= 0 &&
          blockType <= 12
        ) {
          // Save edit to server global world state
          const cx = Math.floor(x / CHUNK_SIZE_X);
          const cz = Math.floor(z / CHUNK_SIZE_Z);
          const chunkKey = `${cx},${cz}`;

          const lx = ((x % CHUNK_SIZE_X) + CHUNK_SIZE_X) % CHUNK_SIZE_X;
          const lz = ((z % CHUNK_SIZE_Z) + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;
          const blockIdx = lx + lz * CHUNK_SIZE_X + y * (CHUNK_SIZE_X * CHUNK_SIZE_Z);

          if (!worldChunkEdits.has(chunkKey)) {
            worldChunkEdits.set(chunkKey, new Map());
          }
          worldChunkEdits.get(chunkKey)!.set(blockIdx, blockType);

          // Broadcast block update to all clients
          broadcast({
            type: 'block_update',
            x,
            y,
            z,
            blockType,
            playerId,
          });
        }
      } else if (msg.type === 'spawn_mob') {
        const { mobType, x, y, z } = msg;
        if (mobType === 'zombie' || mobType === 'creeper' || mobType === 'steve') {
          mobAI.spawnMob(mobType, Number(x) || 8, Number(y) || 28, Number(z) || 8);
        }
      } else if (msg.type === 'clear_mobs') {
        mobAI.mobs.clear();
      } else if (msg.type === 'set_night') {
        mobAI.isNight = !!msg.isNight;
      } else if (msg.type === 'request_chunk') {
        // Stream chunk block data to client
        const cx = Number(msg.cx);
        const cz = Number(msg.cz);
        if (!isNaN(cx) && !isNaN(cz)) {
          const chunkData = generateServerChunk(cx, cz);
          ws.send(
            JSON.stringify({
              type: 'chunk_data',
              cx,
              cz,
              data: Array.from(chunkData),
            })
          );
        }
      }
    } catch (err) {
      console.error('[WebSocket] Invalid JSON message received', err);
    }
  });

  // Disconnect Handler
  ws.on('close', () => {
    connectedPlayers.delete(ws);
    broadcast({
      type: 'player_left',
      id: playerId,
    });
    console.log(`[WebSocket] Player disconnected: ${playerId}`);
  });
});

// 20 TPS Server Tick Broadcast Loop
setInterval(() => {
  if (connectedPlayers.size === 0 && mobAI.mobs.size === 0) return;

  const playerUpdates = Array.from(connectedPlayers.values()).map((p) => ({
    id: p.id,
    x: p.x,
    y: p.y,
    z: p.z,
    yaw: p.yaw,
    pitch: p.pitch,
    color: p.color,
  }));

  const playerTargets: PlayerTarget[] = Array.from(connectedPlayers.values()).map((p) => ({
    id: p.id,
    x: p.x,
    y: p.y,
    z: p.z,
  }));

  // Update Server Mob AI (FSM, pathfinding, obstacle jumps, Creeper fuse, darkness spawner)
  mobAI.update(TICK_RATE_MS / 1000, playerTargets);

  broadcast({
    type: 'tick',
    players: playerUpdates,
    mobs: mobAI.serializeMobs(),
  });
}, TICK_RATE_MS);

// Express Server Setup
app.use(express.json());

// Dev Mode Integration with Vite Middleware
if (process.env.NODE_ENV !== 'production') {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom',
  });
  app.use(vite.middlewares);
  app.use('*', async (req, res, next) => {
    try {
      const url = req.originalUrl;
      const fs = await import('fs');
      let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
      template = await vite.transformIndexHtml(url, template);
      res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
} else {
  // Production Static Serving
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Voxel Multiplayer Server running on http://0.0.0.0:${PORT}`);
});
