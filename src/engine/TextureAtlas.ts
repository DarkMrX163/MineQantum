import * as THREE from "three";
import { ATLAS_GRID_SIZE } from "./types";

/**
 * Procedurally generates authentic Minecraft-style 16x16 pixel-art texture atlas.
 * Output atlas size: 128x128 pixels (8x8 grid of 16x16 pixel tiles).
 */
export function createTextureAtlas(): {
  texture: THREE.CanvasTexture;
  canvas: HTMLCanvasElement;
} {
  const tileSize = 16;
  const canvasSize = tileSize * ATLAS_GRID_SIZE; // 128x128 px
  const canvas = document.createElement("canvas");
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Failed to create 2D context for texture atlas");
  }

  // Helper to get pixel offset for a tile index
  const getTileRect = (tileIndex: number) => {
    const col = tileIndex % ATLAS_GRID_SIZE;
    const row = Math.floor(tileIndex / ATLAS_GRID_SIZE);
    return { x: col * tileSize, y: row * tileSize };
  };

  // Helper to paint a 16x16 tile using a palette array or noise
  const paintPaletteNoise = (
    tileIndex: number,
    baseRGB: [number, number, number],
    paletteVariations: [number, number, number][],
  ) => {
    const { x, y } = getTileRect(tileIndex);
    const imgData = ctx.createImageData(tileSize, tileSize);
    for (let py = 0; py < tileSize; py++) {
      for (let px = 0; px < tileSize; px++) {
        const idx = (py * tileSize + px) * 4;
        const offset =
          paletteVariations[
            Math.floor(Math.random() * paletteVariations.length)
          ];
        imgData.data[idx] = Math.min(255, Math.max(0, baseRGB[0] + offset[0]));
        imgData.data[idx + 1] = Math.min(
          255,
          Math.max(0, baseRGB[1] + offset[1]),
        );
        imgData.data[idx + 2] = Math.min(
          255,
          Math.max(0, baseRGB[2] + offset[2]),
        );
        imgData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, x, y);
  };

  // Noise variations palette
  const stdNoise: [number, number, number][] = [
    [-18, -18, -18],
    [-10, -10, -10],
    [-4, -4, -4],
    [0, 0, 0],
    [6, 6, 6],
    [14, 14, 14],
    [22, 22, 22],
  ];

  // 0: Empty / Air
  const rect0 = getTileRect(0);
  ctx.clearRect(rect0.x, rect0.y, tileSize, tileSize);

  // 1: Stone (Classic Minecraft Gray Stone)
  paintPaletteNoise(1, [121, 121, 121], stdNoise);
  const stoneRect = getTileRect(1);
  ctx.fillStyle = "#525252";
  for (let i = 0; i < 18; i++) {
    const sx = Math.floor(Math.random() * tileSize);
    const sy = Math.floor(Math.random() * tileSize);
    ctx.fillRect(stoneRect.x + sx, stoneRect.y + sy, 1, 1);
  }

  // 2: Dirt (Rich Soil Brown)
  paintPaletteNoise(2, [134, 96, 67], stdNoise);
  const dirtRect = getTileRect(2);
  ctx.fillStyle = "#5c3e26";
  for (let i = 0; i < 20; i++) {
    const dx = Math.floor(Math.random() * tileSize);
    const dy = Math.floor(Math.random() * tileSize);
    ctx.fillRect(dirtRect.x + dx, dirtRect.y + dy, 1, 1);
  }

  // 3: Grass Top (Vibrant Minecraft Green)
  paintPaletteNoise(
    3,
    [92, 183, 50],
    [
      [-20, -20, -10],
      [-10, -10, -5],
      [0, 0, 0],
      [12, 18, 8],
      [24, 30, 15],
    ],
  );

  // 4: Grass Side (Dirt block with drooping green top fringe)
  paintPaletteNoise(4, [134, 96, 67], stdNoise); // Dirt base
  const grassSideRect = getTileRect(4);
  for (let py = 0; py < 5; py++) {
    for (let px = 0; px < tileSize; px++) {
      let drawGreen = false;
      if (py < 2) drawGreen = true;
      else if (py === 2 && Math.random() > 0.15) drawGreen = true;
      else if (py === 3 && Math.random() > 0.55) drawGreen = true;
      else if (py === 4 && Math.random() > 0.85) drawGreen = true;

      if (drawGreen) {
        ctx.fillStyle =
          Math.random() > 0.5
            ? "#5cb732"
            : Math.random() > 0.5
              ? "#439221"
              : "#75d345";
        ctx.fillRect(grassSideRect.x + px, grassSideRect.y + py, 1, 1);
      }
    }
  }

  // 5: Wood Log Side / Bark (Dark Oak Bark with vertical grain)
  paintPaletteNoise(5, [103, 77, 50], stdNoise);
  const woodSideRect = getTileRect(5);
  ctx.fillStyle = "#42301f";
  // Vertical dark grooves
  for (let px = 1; px < tileSize; px += 3) {
    ctx.fillRect(woodSideRect.x + px, woodSideRect.y, 1, tileSize);
  }
  ctx.fillStyle = "#7f6040";
  for (let px = 0; px < tileSize; px += 4) {
    ctx.fillRect(woodSideRect.x + px, woodSideRect.y + 2, 1, 4);
    ctx.fillRect(woodSideRect.x + px + 1, woodSideRect.y + 9, 1, 5);
  }

  // 6: Wood Log Top (Inner Wood with Rings & Bark Border)
  paintPaletteNoise(6, [168, 132, 84], stdNoise);
  const woodTopRect = getTileRect(6);
  // Outer bark border
  ctx.fillStyle = "#42301f";
  ctx.fillRect(woodTopRect.x, woodTopRect.y, tileSize, 1);
  ctx.fillRect(woodTopRect.x, woodTopRect.y + tileSize - 1, tileSize, 1);
  ctx.fillRect(woodTopRect.x, woodTopRect.y, 1, tileSize);
  ctx.fillRect(woodTopRect.x + tileSize - 1, woodTopRect.y, 1, tileSize);
  // Concentric dark rings
  ctx.fillStyle = "#8c683f";
  ctx.fillRect(woodTopRect.x + 3, woodTopRect.y + 3, 10, 10);
  ctx.fillStyle = "#a88454";
  ctx.fillRect(woodTopRect.x + 5, woodTopRect.y + 5, 6, 6);
  ctx.fillStyle = "#674d32";
  ctx.fillRect(woodTopRect.x + 7, woodTopRect.y + 7, 2, 2);

  // 7: Oak Leaves (Dense green foliage)
  paintPaletteNoise(
    7,
    [56, 142, 40],
    [
      [-30, -30, -20],
      [-15, -15, -10],
      [0, 0, 0],
      [15, 20, 10],
      [30, 40, 20],
    ],
  );
  const leavesRect = getTileRect(7);
  ctx.fillStyle = "#1f5716";
  for (let i = 0; i < 30; i++) {
    const lx = Math.floor(Math.random() * tileSize);
    const ly = Math.floor(Math.random() * tileSize);
    ctx.fillRect(leavesRect.x + lx, leavesRect.y + ly, 1, 1);
  }

  // 8: Sand (Golden Warm Sand)
  paintPaletteNoise(
    8,
    [219, 203, 150],
    [
      [-12, -12, -10],
      [-6, -6, -4],
      [0, 0, 0],
      [8, 8, 5],
      [15, 15, 10],
    ],
  );

  // 9: Water (Clear Blue Water Tile)
  paintPaletteNoise(9, [58, 136, 233], stdNoise);
  const waterRect = getTileRect(9);
  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  ctx.fillRect(waterRect.x + 2, waterRect.y + 3, 5, 1);
  ctx.fillRect(waterRect.x + 9, waterRect.y + 6, 4, 1);
  ctx.fillRect(waterRect.x + 4, waterRect.y + 11, 6, 1);

  // 10: Red Brick (Terracotta Bricks with Mortar Lines)
  paintPaletteNoise(10, [156, 65, 46], stdNoise);
  const brickRect = getTileRect(10);
  ctx.fillStyle = "#d6ccc2";
  // Horizontal mortar
  ctx.fillRect(brickRect.x, brickRect.y + 3, tileSize, 1);
  ctx.fillRect(brickRect.x, brickRect.y + 7, tileSize, 1);
  ctx.fillRect(brickRect.x, brickRect.y + 11, tileSize, 1);
  ctx.fillRect(brickRect.x, brickRect.y + 15, tileSize, 1);
  // Vertical mortar
  ctx.fillRect(brickRect.x + 4, brickRect.y, 1, 3);
  ctx.fillRect(brickRect.x + 12, brickRect.y + 4, 1, 3);
  ctx.fillRect(brickRect.x + 4, brickRect.y + 8, 1, 3);
  ctx.fillRect(brickRect.x + 12, brickRect.y + 12, 1, 3);

  // 11: Glass (Semi-Transparent Glass Pane)
  const glassRect = getTileRect(11);
  ctx.fillStyle = "rgba(215, 240, 255, 0.2)";
  ctx.fillRect(glassRect.x, glassRect.y, tileSize, tileSize);
  ctx.fillStyle = "#ffffff";
  // Border frame
  ctx.fillRect(glassRect.x, glassRect.y, tileSize, 1);
  ctx.fillRect(glassRect.x, glassRect.y + tileSize - 1, tileSize, 1);
  ctx.fillRect(glassRect.x, glassRect.y, 1, tileSize);
  ctx.fillRect(glassRect.x + tileSize - 1, glassRect.y, 1, tileSize);
  // Diagonals
  ctx.fillRect(glassRect.x + 3, glassRect.y + 3, 2, 2);
  ctx.fillRect(glassRect.x + 10, glassRect.y + 10, 3, 3);

  // 12: Oak Planks (Golden Wooden Boards)
  paintPaletteNoise(12, [188, 152, 98], stdNoise);
  const plankRect = getTileRect(12);
  ctx.fillStyle = "#73522f";
  ctx.fillRect(plankRect.x, plankRect.y + 3, tileSize, 1);
  ctx.fillRect(plankRect.x, plankRect.y + 7, tileSize, 1);
  ctx.fillRect(plankRect.x, plankRect.y + 11, tileSize, 1);
  ctx.fillRect(plankRect.x, plankRect.y + 15, tileSize, 1);
  // Nails
  ctx.fillStyle = "#50371d";
  ctx.fillRect(plankRect.x + 1, plankRect.y + 2, 1, 1);
  ctx.fillRect(plankRect.x + 14, plankRect.y + 6, 1, 1);
  ctx.fillRect(plankRect.x + 1, plankRect.y + 10, 1, 1);
  ctx.fillRect(plankRect.x + 14, plankRect.y + 14, 1, 1);

  // 13: Torch
  const torchRect = getTileRect(13);
  ctx.clearRect(torchRect.x, torchRect.y, tileSize, tileSize);
  // Stick
  ctx.fillStyle = "#5c3818";
  ctx.fillRect(torchRect.x + 6, torchRect.y + 5, 4, 10);
  ctx.fillStyle = "#3a2211";
  ctx.fillRect(torchRect.x + 5, torchRect.y + 4, 6, 2);
  // Flame
  ctx.fillStyle = "#e85d04";
  ctx.fillRect(torchRect.x + 5, torchRect.y + 1, 6, 3);
  ctx.fillStyle = "#ffb703";
  ctx.fillRect(torchRect.x + 6, torchRect.y + 1, 4, 2);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(torchRect.x + 7, torchRect.y + 2, 2, 1);

  // 14: Lava (Glowing Magma)
  paintPaletteNoise(
    14,
    [232, 93, 4],
    [
      [-30, -10, 0],
      [0, 0, 0],
      [30, 40, 0],
      [40, 80, 0],
    ],
  );
  const lavaRect = getTileRect(14);
  ctx.fillStyle = "#ffb703";
  ctx.fillRect(lavaRect.x + 3, lavaRect.y + 2, 4, 2);
  ctx.fillRect(lavaRect.x + 9, lavaRect.y + 8, 5, 2);
  ctx.fillRect(lavaRect.x + 2, lavaRect.y + 12, 6, 2);

  // Helper for ore textures (stone base + mineral flecks)
  const paintOre = (tileIdx: number, mineralColor: string) => {
    paintPaletteNoise(tileIdx, [121, 121, 121], stdNoise);
    const rect = getTileRect(tileIdx);
    ctx.fillStyle = mineralColor;
    for (let i = 0; i < 7; i++) {
      const ox = Math.floor(Math.random() * (tileSize - 2)) + 1;
      const oy = Math.floor(Math.random() * (tileSize - 2)) + 1;
      ctx.fillRect(rect.x + ox, rect.y + oy, 2, 2);
      ctx.fillRect(rect.x + ox + 1, rect.y + oy, 1, 1);
    }
  };

  // 16: Coal Ore
  paintOre(16, "#212121");
  // 17: Iron Ore
  paintOre(17, "#d4a373");
  // 18: Gold Ore
  paintOre(18, "#ffb703");
  // 19: Diamond Ore
  paintOre(19, "#48cae4");
  // 20: Redstone Ore
  paintOre(20, "#e63946");

  // 21: Oak Door (Closed) - authentic wood plank frame, panel recessed detailing, window slits & brass handle
  paintPaletteNoise(21, [180, 115, 55], [
    [-12, -12, -12],
    [0, 0, 0],
    [12, 12, 12],
  ]);
  const doorRect = getTileRect(21);
  // Outer frame & panel divides
  ctx.fillStyle = "#5c2c06";
  ctx.fillRect(doorRect.x, doorRect.y, 16, 1);
  ctx.fillRect(doorRect.x, doorRect.y + 15, 16, 1);
  ctx.fillRect(doorRect.x, doorRect.y, 1, 16);
  ctx.fillRect(doorRect.x + 15, doorRect.y, 1, 16);
  ctx.fillRect(doorRect.x, doorRect.y + 8, 16, 1); // Horizontal divider
  // Recessed panels
  ctx.fillStyle = "#a16207";
  ctx.fillRect(doorRect.x + 2, doorRect.y + 2, 5, 5);
  ctx.fillRect(doorRect.x + 9, doorRect.y + 2, 5, 5);
  ctx.fillRect(doorRect.x + 2, doorRect.y + 10, 5, 4);
  ctx.fillRect(doorRect.x + 9, doorRect.y + 10, 5, 4);
  // Upper window slits
  ctx.fillStyle = "#262626";
  ctx.fillRect(doorRect.x + 3, doorRect.y + 3, 3, 3);
  ctx.fillRect(doorRect.x + 10, doorRect.y + 3, 3, 3);
  // Brass / iron door handle
  ctx.fillStyle = "#fbbf24";
  ctx.fillRect(doorRect.x + 13, doorRect.y + 7, 2, 2);
  ctx.fillStyle = "#78350f";
  ctx.fillRect(doorRect.x + 13, doorRect.y + 9, 1, 2);

  // 22: Oak Door (Open) - thin door frame perspective, open passable opening
  const openDoorRect = getTileRect(22);
  ctx.clearRect(openDoorRect.x, openDoorRect.y, 16, 16);
  // Outer doorway frame
  ctx.fillStyle = "#5c2c06";
  ctx.fillRect(openDoorRect.x, openDoorRect.y, 3, 16); // Left jamb / open door edge
  ctx.fillStyle = "#92400e";
  ctx.fillRect(openDoorRect.x + 1, openDoorRect.y + 1, 2, 14);
  ctx.fillStyle = "#fbbf24";
  ctx.fillRect(openDoorRect.x + 2, openDoorRect.y + 8, 1, 2); // Handle on side
  // Top/bottom jambs
  ctx.fillStyle = "#78350f";
  ctx.fillRect(openDoorRect.x, openDoorRect.y, 16, 1);
  ctx.fillRect(openDoorRect.x, openDoorRect.y + 15, 16, 1);

  // 23: Village Path (Dirt / Gravel pathway)
  paintPaletteNoise(23, [160, 110, 50], [
    [-15, -15, -15],
    [-6, -6, -6],
    [0, 0, 0],
    [8, 8, 8],
    [18, 18, 18],
  ]);
  const pathRect = getTileRect(23);
  ctx.fillStyle = "#78350f";
  for (let i = 0; i < 15; i++) {
    const px = Math.floor(Math.random() * 16);
    const py = Math.floor(Math.random() * 16);
    ctx.fillRect(pathRect.x + px, pathRect.y + py, 1, 1);
  }
  ctx.fillStyle = "#ca8a04";
  for (let i = 0; i < 10; i++) {
    const px = Math.floor(Math.random() * 16);
    const py = Math.floor(Math.random() * 16);
    ctx.fillRect(pathRect.x + px, pathRect.y + py, 1, 1);
  }

  // Create Three.js CanvasTexture with NearestFilter for pixel perfection
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  return { texture, canvas };
}

/**
 * Returns exact UV coordinates [uMin, vMin, uMax, vMax] for a tile index on an 8x8 grid.
 */
export function getTileUVs(tileIndex: number): {
  uMin: number;
  vMin: number;
  uMax: number;
  vMax: number;
} {
  const col = tileIndex % ATLAS_GRID_SIZE;
  const row = Math.floor(tileIndex / ATLAS_GRID_SIZE);
  const tileSizeUV = 1 / ATLAS_GRID_SIZE; // 0.125

  // In WebGL, V=0 is at bottom, V=1 is at top
  const uMin = col * tileSizeUV;
  const uMax = uMin + tileSizeUV;
  const vMax = 1 - row * tileSizeUV;
  const vMin = vMax - tileSizeUV;

  // Inset padding (0.0005) prevents tile bleeding artifacts at shallow camera angles
  const padding = 0.0005;
  return {
    uMin: uMin + padding,
    vMin: vMin + padding,
    uMax: uMax - padding,
    vMax: vMax - padding,
  };
}
