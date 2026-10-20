import * as THREE from "three";

/**
 * UV Box Mapping helper for standard Minecraft skin layouts (64x32 or 64x64).
 *
 * Standard Minecraft skin box layout:
 * For a box of dimensions (dx, dy, dz):
 * The texture rectangle width = 2 * (dz + dx), height = dz + dy.
 * At texture position (u, v):
 * - Top face:    [u + dz, v, dx, dz]
 * - Bottom face: [u + dz + dx, v, dx, dz]
 * - Right face (+X): [u, v + dz, dz, dy]
 * - Front face (+Z): [u + dz, v + dz, dx, dy]
 * - Left face (-X):  [u + dz + dx, v + dz, dz, dy]
 * - Back face (-Z):  [u + 2*dz + dx, v + dz, dx, dy]
 */

export interface SkinBoxUV {
  u: number;
  v: number;
  w: number; // dx (X dimension)
  h: number; // dy (Y dimension)
  d: number; // dz (Z dimension)
}

export type EntityType =
  | "player"
  | "alex"
  | "miner"
  | "knight"
  | "engineer"
  | "zombie"
  | "creeper"
  | "skeleton"
  | "enderman"
  | "cow"
  | "sheep"
  | "pig"
  | "bird";

export interface HumanoidParts {
  group: THREE.Group;
  head: THREE.Group;
  torso: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  headMesh: THREE.Mesh;
  torsoMesh: THREE.Mesh;
  leftArmMesh: THREE.Mesh;
  rightArmMesh: THREE.Mesh;
  leftLegMesh: THREE.Mesh;
  rightLegMesh: THREE.Mesh;
  type: "player" | "zombie" | "skeleton" | "enderman";
  bowMesh?: THREE.Mesh;
}

export interface CreeperParts {
  group: THREE.Group;
  head: THREE.Group;
  torso: THREE.Group;
  legFrontLeft: THREE.Group;
  legFrontRight: THREE.Group;
  legBackLeft: THREE.Group;
  legBackRight: THREE.Group;
  headMesh: THREE.Mesh;
  torsoMesh: THREE.Mesh;
  legMeshes: THREE.Mesh[];
  type: "creeper";
}

export interface QuadrupedParts {
  group: THREE.Group;
  head: THREE.Group;
  torso: THREE.Group;
  legFrontLeft: THREE.Group;
  legFrontRight: THREE.Group;
  legBackLeft: THREE.Group;
  legBackRight: THREE.Group;
  type: "cow" | "sheep" | "pig";
}

export interface BirdParts {
  group: THREE.Group;
  leftWing: THREE.Group;
  rightWing: THREE.Group;
  type: "bird";
}

export class EntityModelBuilder {
  /**
   * Generates UV coordinates for a THREE.BoxGeometry matching standard Minecraft skin mapping.
   * Three.js BoxGeometry face order:
   * 0: +X (Right side of model)
   * 1: -X (Left side of model)
   * 2: +Y (Top face)
   * 3: -Y (Bottom face)
   * 4: +Z (Front face)
   * 5: -Z (Back face)
   *
   * Each face has 4 vertices with indices [0, 1, 2, 3] forming two triangles (0, 2, 1) and (2, 3, 1).
   */
  public static applyBoxSkinUVs(
    geometry: THREE.BoxGeometry,
    u: number,
    v: number,
    dx: number,
    dy: number,
    dz: number,
    textureW: number = 64,
    textureH: number = 64,
  ): void {
    const uvAttr = geometry.attributes.uv;
    if (!uvAttr) return;

    // Helper to map pixel coordinates to 0..1 UVs
    // Skin texture v=0 is at TOP of texture in canvas, Three.js V=0 is at BOTTOM.
    const uvCoords = (px: number, py: number, pw: number, ph: number) => {
      const u0 = px / textureW;
      const u1 = (px + pw) / textureW;
      const v0 = 1.0 - (py + ph) / textureH;
      const v1 = 1.0 - py / textureH;
      return { u0, u1, v0, v1 };
    };

    // Calculate sub-rectangles for all 6 faces
    // Standard layout:
    // Top (+Y):
    const top = uvCoords(u + dz, v, dx, dz);
    // Bottom (-Y):
    const bottom = uvCoords(u + dz + dx, v, dx, dz);
    // Right (+X):
    const right = uvCoords(u, v + dz, dz, dy);
    // Front (+Z):
    const front = uvCoords(u + dz, v + dz, dx, dy);
    // Left (-X):
    const left = uvCoords(u + dz + dx, v + dz, dz, dy);
    // Back (-Z):
    const back = uvCoords(u + dz + dx + dz, v + dz, dx, dy);

    // Apply to Three.js vertex positions for each face
    // Face 0 (+X: Right)
    uvAttr.setXY(0, right.u0, right.v1);
    uvAttr.setXY(1, right.u0, right.v0);
    uvAttr.setXY(2, right.u1, right.v1);
    uvAttr.setXY(3, right.u1, right.v0);

    // Face 1 (-X: Left)
    uvAttr.setXY(4, left.u0, left.v1);
    uvAttr.setXY(5, left.u0, left.v0);
    uvAttr.setXY(6, left.u1, left.v1);
    uvAttr.setXY(7, left.u1, left.v0);

    // Face 2 (+Y: Top)
    uvAttr.setXY(8, top.u0, top.v0);
    uvAttr.setXY(9, top.u0, top.v1);
    uvAttr.setXY(10, top.u1, top.v0);
    uvAttr.setXY(11, top.u1, top.v1);

    // Face 3 (-Y: Bottom)
    uvAttr.setXY(12, bottom.u0, bottom.v1);
    uvAttr.setXY(13, bottom.u0, bottom.v0);
    uvAttr.setXY(14, bottom.u1, bottom.v1);
    uvAttr.setXY(15, bottom.u1, bottom.v0);

    // Face 4 (+Z: Front)
    uvAttr.setXY(16, front.u0, front.v1);
    uvAttr.setXY(17, front.u0, front.v0);
    uvAttr.setXY(18, front.u1, front.v1);
    uvAttr.setXY(19, front.u1, front.v0);

    // Face 5 (-Z: Back)
    uvAttr.setXY(20, back.u0, back.v1);
    uvAttr.setXY(21, back.u0, back.v0);
    uvAttr.setXY(22, back.u1, back.v1);
    uvAttr.setXY(23, back.u1, back.v0);

    uvAttr.needsUpdate = true;
  }

  /**
   * Helper to build a box part with a specific pivot point.
   * By default Three.js BoxGeometry center is (0,0,0).
   * For joints (shoulders, hips, neck): we offset the mesh inside an outer Group
   * so rotating the Group rotates around the joint pivot point!
   */
  public static createPivotPart(
    width: number,
    height: number,
    depth: number,
    pivotOffset: { x: number; y: number; z: number },
    material: THREE.Material,
    uvInfo?: {
      u: number;
      v: number;
      dx: number;
      dy: number;
      dz: number;
      tw?: number;
      th?: number;
    },
  ): {
    pivotGroup: THREE.Group;
    mesh: THREE.Mesh;
    geometry: THREE.BoxGeometry;
  } {
    const geometry = new THREE.BoxGeometry(width, height, depth);

    if (uvInfo) {
      this.applyBoxSkinUVs(
        geometry,
        uvInfo.u,
        uvInfo.v,
        uvInfo.dx,
        uvInfo.dy,
        uvInfo.dz,
        uvInfo.tw || 64,
        uvInfo.th || 64,
      );
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Offset the mesh within the group to place the desired pivot at group (0,0,0)
    mesh.position.set(pivotOffset.x, pivotOffset.y, pivotOffset.z);

    const pivotGroup = new THREE.Group();
    pivotGroup.add(mesh);

    return { pivotGroup, mesh, geometry };
  }

  /**
   * Builds a classic Parametric Humanoid model (Player / Zombie).
   * Proportions (Minecraft pixels scaled by scaleFactor, default 1/16 = 0.0625 m per pixel):
   * - Head: 8 x 8 x 8 (pivot at neck / base of skull)
   * - Torso: 8 x 12 x 4 (pivot at center or pelvis)
   * - Left/Right Arm: 4 x 12 x 4 (pivot at shoulder: top of arm)
   * - Left/Right Leg: 4 x 12 x 4 (pivot at hip: top of leg)
   */
  public static buildHumanoid(
    material: THREE.Material,
    type: "player" | "zombie" | "skeleton" | "enderman" = "player",
    scale: number = 1 / 16,
  ): HumanoidParts {
    const root = new THREE.Group();

    // 1. Torso: 8 x 12 x 4
    // Positioned from y = 12 to 24 in pixel space (height 12)
    const torsoW = 8 * scale;
    const torsoH = 12 * scale;
    const torsoD = 4 * scale;
    const { pivotGroup: torsoGroup, mesh: torsoMesh } = this.createPivotPart(
      torsoW,
      torsoH,
      torsoD,
      { x: 0, y: torsoH / 2, z: 0 },
      material,
      { u: 16, v: 16, dx: 8, dy: 12, dz: 4 },
    );
    // Torso base is at hip level y = 12 * scale
    torsoGroup.position.set(0, 12 * scale, 0);
    root.add(torsoGroup);

    // 2. Head: 8 x 8 x 8
    // Pivot at neck: bottom-center of head (y = 24 * scale)
    const headSize = 8 * scale;
    const { pivotGroup: headGroup, mesh: headMesh } = this.createPivotPart(
      headSize,
      headSize,
      headSize,
      { x: 0, y: headSize / 2, z: 0 },
      material,
      { u: 0, v: 0, dx: 8, dy: 8, dz: 8 },
    );
    headGroup.position.set(0, 24 * scale, 0);
    root.add(headGroup);

    // 3. Right Arm: 4 x 12 x 4
    // Shoulder joint is at top of arm (offset y = -6 * scale from shoulder pivot)
    const armW = 4 * scale;
    const armH = 12 * scale;
    const armD = 4 * scale;

    const { pivotGroup: rightArmGroup, mesh: rightArmMesh } =
      this.createPivotPart(
        armW,
        armH,
        armD,
        { x: 0, y: -armH / 2, z: 0 }, // Pivot at top
        material,
        { u: 40, v: 16, dx: 4, dy: 12, dz: 4 },
      );
    // Right shoulder position: -6 units X (4 torso + 2 half arm), 22 units Y
    rightArmGroup.position.set(-6 * scale, 22 * scale, 0);
    root.add(rightArmGroup);

    // 4. Left Arm: 4 x 12 x 4
    // Standard 64x64 skin: Left arm has UV at (32, 48), or mirroring (40, 16)
    const { pivotGroup: leftArmGroup, mesh: leftArmMesh } =
      this.createPivotPart(
        armW,
        armH,
        armD,
        { x: 0, y: -armH / 2, z: 0 },
        material,
        { u: 32, v: 48, dx: 4, dy: 12, dz: 4 },
      );
    leftArmGroup.position.set(6 * scale, 22 * scale, 0);
    root.add(leftArmGroup);

    // 5. Right Leg: 4 x 12 x 4
    // Hip joint at top of leg (y = 12 * scale), mesh offset down by half height
    const legW = 4 * scale;
    const legH = 12 * scale;
    const legD = 4 * scale;

    const { pivotGroup: rightLegGroup, mesh: rightLegMesh } =
      this.createPivotPart(
        legW,
        legH,
        legD,
        { x: 0, y: -legH / 2, z: 0 },
        material,
        { u: 0, v: 16, dx: 4, dy: 12, dz: 4 },
      );
    rightLegGroup.position.set(-2 * scale, 12 * scale, 0);
    root.add(rightLegGroup);

    // 6. Left Leg: 4 x 12 x 4
    // Standard 64x64 skin: Left leg at (16, 48)
    const { pivotGroup: leftLegGroup, mesh: leftLegMesh } =
      this.createPivotPart(
        legW,
        legH,
        legD,
        { x: 0, y: -legH / 2, z: 0 },
        material,
        { u: 16, v: 48, dx: 4, dy: 12, dz: 4 },
      );
    leftLegGroup.position.set(2 * scale, 12 * scale, 0);
    root.add(leftLegGroup);

    // If Zombie: raise arms straight ahead in classic menacing posture
    if (type === "zombie") {
      rightArmGroup.rotation.x = -Math.PI / 2;
      leftArmGroup.rotation.x = -Math.PI / 2;
    }

    return {
      group: root,
      head: headGroup,
      torso: torsoGroup,
      leftArm: leftArmGroup,
      rightArm: rightArmGroup,
      leftLeg: leftLegGroup,
      rightLeg: rightLegGroup,
      headMesh,
      torsoMesh,
      leftArmMesh,
      rightArmMesh,
      leftLegMesh,
      rightLegMesh,
      type,
    };
  }

  /**
   * Builds a classic Creeper model.
   * Proportions:
   * - Head: 8 x 8 x 8 (pivot at neck y = 18 * scale)
   * - Torso: 4 x 12 x 8 (dx=8, dy=12, dz=4 in Minecraft: width 8, height 12, depth 4)
   * - 4 Separate Legs: 4 x 6 x 4 each:
   *   Front-Left, Front-Right, Back-Left, Back-Right (pivot at hips y = 6 * scale)
   */
  public static buildCreeper(
    material: THREE.Material,
    scale: number = 1 / 16,
  ): CreeperParts {
    const root = new THREE.Group();

    // 1. Torso: width 8, height 12, depth 4
    const torsoW = 8 * scale;
    const torsoH = 12 * scale;
    const torsoD = 4 * scale;

    const { pivotGroup: torsoGroup, mesh: torsoMesh } = this.createPivotPart(
      torsoW,
      torsoH,
      torsoD,
      { x: 0, y: torsoH / 2, z: 0 },
      material,
      { u: 16, v: 16, dx: 8, dy: 12, dz: 4 },
    );
    // Base of torso sits atop legs at y = 6 * scale
    torsoGroup.position.set(0, 6 * scale, 0);
    root.add(torsoGroup);

    // 2. Head: 8 x 8 x 8
    const headSize = 8 * scale;
    const { pivotGroup: headGroup, mesh: headMesh } = this.createPivotPart(
      headSize,
      headSize,
      headSize,
      { x: 0, y: headSize / 2, z: 0 },
      material,
      { u: 0, v: 0, dx: 8, dy: 8, dz: 8 },
    );
    // Neck sits on top of torso at y = 18 * scale
    headGroup.position.set(0, 18 * scale, 0);
    root.add(headGroup);

    // 3. Four Separate Legs: 4 x 6 x 4 each
    // Creeper skin leg texture is at (0, 16) with dx=4, dy=6, dz=4
    const legW = 4 * scale;
    const legH = 6 * scale;
    const legD = 4 * scale;
    const legMeshes: THREE.Mesh[] = [];

    const createLeg = (xPos: number, zPos: number) => {
      const { pivotGroup, mesh } = this.createPivotPart(
        legW,
        legH,
        legD,
        { x: 0, y: -legH / 2, z: 0 }, // Pivot at top hip
        material,
        { u: 0, v: 16, dx: 4, dy: 6, dz: 4 },
      );
      pivotGroup.position.set(xPos, 6 * scale, zPos);
      root.add(pivotGroup);
      legMeshes.push(mesh);
      return pivotGroup;
    };

    // Hip positions relative to center:
    // Front legs (+Z): +5 in pixel space
    // Back legs (-Z): -5 in pixel space
    // Left (+X) / Right (-X): +/- 2 in pixel space
    const legFrontRight = createLeg(-2 * scale, 5 * scale);
    const legFrontLeft = createLeg(2 * scale, 5 * scale);
    const legBackRight = createLeg(-2 * scale, -5 * scale);
    const legBackLeft = createLeg(2 * scale, -5 * scale);

    return {
      group: root,
      head: headGroup,
      torso: torsoGroup,
      legFrontLeft,
      legFrontRight,
      legBackLeft,
      legBackRight,
      headMesh,
      torsoMesh,
      legMeshes,
      type: "creeper",
    };
  }

  /**
   * Procedural Walking Animation:
   * Applies sinusoidal limb swing in opposite phases: Math.sin(time * speed)
   * Amplified or damped by walking speed.
   */
  public static animateHumanoidWalk(
    parts: HumanoidParts,
    time: number,
    walkSpeed: number = 1.0,
    maxAngle: number = 0.65,
  ): void {
    if (walkSpeed < 0.01) {
      // Return smoothly to idle
      parts.leftLeg.rotation.x *= 0.85;
      parts.rightLeg.rotation.x *= 0.85;
      if (parts.type === "player") {
        parts.leftArm.rotation.x *= 0.85;
        parts.rightArm.rotation.x *= 0.85;
        parts.leftArm.rotation.z *= 0.85;
        parts.rightArm.rotation.z *= 0.85;
      }
      return;
    }

    const swing = Math.sin(time * 8.0) * maxAngle * Math.min(walkSpeed, 1.2);

    // Legs swing in exact counter-phase
    parts.rightLeg.rotation.x = swing;
    parts.leftLeg.rotation.x = -swing;

    if (parts.type === "player") {
      // Opposite arm swings with opposite leg (like real walking biomechanics)
      parts.leftArm.rotation.x = swing;
      parts.rightArm.rotation.x = -swing;
      // Slight natural arm swing outwards
      parts.leftArm.rotation.z = 0.05;
      parts.rightArm.rotation.z = -0.05;
    } else if (parts.type === "zombie") {
      // Zombie keeps arms raised forward (~ -PI/2) with eerie up-and-down twitching
      const twitch = Math.sin(time * 3.5) * 0.08 + Math.cos(time * 7.0) * 0.04;
      parts.leftArm.rotation.x = -Math.PI / 2 + twitch;
      parts.rightArm.rotation.x = -Math.PI / 2 - twitch;
    }

    // Gentle torso and head bounce
    parts.torso.position.y =
      (12 + Math.abs(Math.sin(time * 8.0)) * 0.6) * (1 / 16);
  }

  /**
   * Procedural Creeper Walking & Fuse Animation:
   * Creeper has 4 legs:
   * - Front-Right & Back-Left swing together
   * - Front-Left & Back-Right swing together in opposite phase
   * When exploding / fuse active: swells (scale increases) and flashes white!
   */
  public static animateCreeperWalk(
    parts: CreeperParts,
    time: number,
    walkSpeed: number = 1.0,
    fuseProgress: number = 0.0, // 0.0 = normal, 1.0 = about to explode
  ): void {
    if (walkSpeed > 0.01) {
      const swing = Math.sin(time * 7.0) * 0.55 * Math.min(walkSpeed, 1.2);
      parts.legFrontRight.rotation.x = swing;
      parts.legBackLeft.rotation.x = swing;

      parts.legFrontLeft.rotation.x = -swing;
      parts.legBackRight.rotation.x = -swing;
    } else {
      parts.legFrontRight.rotation.x *= 0.85;
      parts.legBackLeft.rotation.x *= 0.85;
      parts.legFrontLeft.rotation.x *= 0.85;
      parts.legBackRight.rotation.x *= 0.85;
    }

    // Creeper Swelling effect during fuse ignition
    if (fuseProgress > 0) {
      const swellScale =
        1.0 +
        fuseProgress * 0.28 +
        Math.sin(time * 24.0) * (fuseProgress * 0.08);
      parts.group.scale.set(swellScale, swellScale * 1.1, swellScale);
    } else {
      parts.group.scale.set(1.0, 1.0, 1.0);
    }
  }

  /**
   * Builds Quadruped Animals (Cow, Sheep, Pig)
   */
  public static buildQuadruped(
    material: THREE.Material,
    type: "cow" | "sheep" | "pig" = "cow",
    scale: number = 1 / 16,
  ): QuadrupedParts {
    const root = new THREE.Group();

    // Dimensions in pixel units
    const bodyW = 12 * scale;
    const bodyH = 10 * scale;
    const bodyD = 16 * scale;

    const { pivotGroup: torsoGroup } = this.createPivotPart(
      bodyW,
      bodyH,
      bodyD,
      { x: 0, y: bodyH / 2, z: 0 },
      material,
      { u: 18, v: 4, dx: 12, dy: 10, dz: 16 },
    );
    torsoGroup.position.set(0, 8 * scale, 0);
    root.add(torsoGroup);

    // Head
    const headW = 8 * scale;
    const headH = 8 * scale;
    const headD = 8 * scale;
    const { pivotGroup: headGroup } = this.createPivotPart(
      headW,
      headH,
      headD,
      { x: 0, y: headH / 2, z: 0 },
      material,
      { u: 0, v: 0, dx: 8, dy: 8, dz: 8 },
    );
    headGroup.position.set(0, 12 * scale, 8 * scale);
    root.add(headGroup);

    // 4 Legs (4x8x4 each)
    const legW = 4 * scale;
    const legH = 8 * scale;
    const legD = 4 * scale;

    const createLeg = (x: number, z: number) => {
      const { pivotGroup } = this.createPivotPart(
        legW,
        legH,
        legD,
        { x: 0, y: -legH / 2, z: 0 },
        material,
        { u: 0, v: 16, dx: 4, dy: 8, dz: 4 },
      );
      pivotGroup.position.set(x, 8 * scale, z);
      root.add(pivotGroup);
      return pivotGroup;
    };

    const legFL = createLeg(-4 * scale, 6 * scale);
    const legFR = createLeg(4 * scale, 6 * scale);
    const legBL = createLeg(-4 * scale, -6 * scale);
    const legBR = createLeg(4 * scale, -6 * scale);

    return {
      group: root,
      head: headGroup,
      torso: torsoGroup,
      legFrontLeft: legFL,
      legFrontRight: legFR,
      legBackLeft: legBL,
      legBackRight: legBR,
      type,
    };
  }

  public static animateQuadrupedWalk(
    parts: QuadrupedParts,
    time: number,
    walkSpeed: number = 1.0,
  ): void {
    if (walkSpeed > 0.01) {
      const swing = Math.sin(time * 7.0) * 0.5 * Math.min(walkSpeed, 1.2);
      parts.legFrontRight.rotation.x = swing;
      parts.legBackLeft.rotation.x = swing;
      parts.legFrontLeft.rotation.x = -swing;
      parts.legBackRight.rotation.x = -swing;
    } else {
      parts.legFrontRight.rotation.x *= 0.85;
      parts.legBackLeft.rotation.x *= 0.85;
      parts.legFrontLeft.rotation.x *= 0.85;
      parts.legBackRight.rotation.x *= 0.85;
    }
  }

  /**
   * Generates a procedural 64x64 skin canvas for Player, Zombie, or Creeper
   * with authentic pixel textures for standard UV unwrap!
   */
  public static createSkinCanvas(type: EntityType): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;

    // Clear background
    ctx.clearRect(0, 0, 64, 64);

    // Pixel noise helper
    const fillPixelRect = (
      x: number,
      y: number,
      w: number,
      h: number,
      baseR: number,
      baseG: number,
      baseB: number,
      noise: number = 10,
    ) => {
      for (let px = x; px < x + w; px++) {
        for (let py = y; py < y + h; py++) {
          const n = (Math.random() - 0.5) * noise * 2;
          const r = Math.max(0, Math.min(255, Math.round(baseR + n)));
          const g = Math.max(0, Math.min(255, Math.round(baseG + n)));
          const b = Math.max(0, Math.min(255, Math.round(baseB + n)));
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fillRect(px, py, 1, 1);
        }
      }
    };

    if (type === "player") {
      // Classic Steve style
      // Head: Skin tone (205, 150, 115)
      fillPixelRect(0, 0, 32, 16, 205, 150, 115, 12);
      // Steve Brown Hair on Top/Sides
      fillPixelRect(8, 0, 8, 8, 70, 45, 25, 8); // Top of head
      fillPixelRect(0, 8, 32, 3, 70, 45, 25, 8); // Hair fringe
      // Face details at Front face: x=8, y=8, w=8, h=8
      // Eyes at (10, 10) and (13, 10)
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(10, 10, 2, 1);
      ctx.fillRect(13, 10, 2, 1);
      ctx.fillStyle = "#2c4391"; // Blue iris
      ctx.fillRect(11, 10, 1, 1);
      ctx.fillRect(13, 10, 1, 1);
      // Nose / mouth
      ctx.fillStyle = "#8f4f34";
      ctx.fillRect(11, 12, 2, 1); // mouth/beard
      ctx.fillStyle = "#b87556";
      ctx.fillRect(11, 11, 2, 1); // nose

      // Torso: Cyan Shirt (0, 160, 175)
      fillPixelRect(16, 16, 24, 16, 25, 165, 175, 12);
      // Neck opening on chest
      fillPixelRect(20, 20, 4, 3, 205, 150, 115, 6);

      // Arms: Shoulder cyan shirt (0..4) and skin tone hands (4..12)
      fillPixelRect(40, 16, 16, 4, 25, 165, 175, 10);
      fillPixelRect(40, 20, 16, 12, 205, 150, 115, 10);
      fillPixelRect(32, 48, 16, 4, 25, 165, 175, 10);
      fillPixelRect(32, 52, 16, 12, 205, 150, 115, 10);

      // Legs: Blue Jeans (40, 60, 120) and gray shoes at bottom
      fillPixelRect(0, 16, 16, 12, 45, 65, 135, 12);
      fillPixelRect(0, 28, 16, 4, 80, 80, 85, 8); // shoes
      fillPixelRect(16, 48, 16, 12, 45, 65, 135, 12);
      fillPixelRect(16, 60, 16, 4, 80, 80, 85, 8); // shoes
    } else if (type === "zombie") {
      // Zombie style: Rotten Green Skin (85, 140, 65), Tattered Cyan Shirt, Purple/Dark Blue Pants
      fillPixelRect(0, 0, 32, 16, 85, 140, 65, 14);
      // Dark green/mossy hair
      fillPixelRect(8, 0, 8, 8, 40, 75, 30, 8);
      fillPixelRect(0, 8, 32, 3, 40, 75, 30, 8);
      // Zombie hollow black eyes at (10, 10) and (13, 10)
      ctx.fillStyle = "#0a1005";
      ctx.fillRect(10, 10, 2, 1);
      ctx.fillRect(13, 10, 2, 1);
      // Nose
      ctx.fillStyle = "#487d33";
      ctx.fillRect(11, 11, 2, 1);

      // Torso: Cyan Shirt (tattered)
      fillPixelRect(16, 16, 24, 16, 22, 135, 145, 12);

      // Zombie Arms: Green hands
      fillPixelRect(40, 16, 16, 4, 22, 135, 145, 10);
      fillPixelRect(40, 20, 16, 12, 85, 140, 65, 12);
      fillPixelRect(32, 48, 16, 4, 22, 135, 145, 10);
      fillPixelRect(32, 52, 16, 12, 85, 140, 65, 12);

      // Legs: Dark Purple/Indigo pants (55, 45, 85)
      fillPixelRect(0, 16, 16, 16, 55, 45, 85, 10);
      fillPixelRect(16, 48, 16, 16, 55, 45, 85, 10);
    } else if (type === "creeper") {
      // Creeper: Mottled pixelated camouflage green texture everywhere!
      fillPixelRect(0, 0, 64, 64, 75, 165, 60, 25);

      // Iconic Creeper Face on Front of Head: x=8, y=8, w=8, h=8
      ctx.fillStyle = "#000000";
      ctx.fillRect(9, 10, 2, 2);
      ctx.fillRect(13, 10, 2, 2);
      ctx.fillRect(11, 12, 2, 3);
      ctx.fillRect(10, 13, 1, 3);
      ctx.fillRect(13, 13, 1, 3);
      ctx.fillRect(9, 14, 1, 2);
      ctx.fillRect(14, 14, 1, 2);
    } else if (type === "skeleton") {
      // Skeleton: Bone white texture with dark eye sockets
      fillPixelRect(0, 0, 64, 64, 215, 218, 222, 12);
      // Dark eye sockets & nasal cavity
      ctx.fillStyle = "#262626";
      ctx.fillRect(9, 9, 3, 3);
      ctx.fillRect(14, 9, 3, 3);
      ctx.fillRect(12, 12, 2, 2);
      // Teeth line
      ctx.fillRect(10, 14, 6, 1);
      // Ribcage on torso
      ctx.fillRect(20, 18, 8, 1);
      ctx.fillRect(20, 20, 8, 1);
      ctx.fillRect(20, 22, 8, 1);
      ctx.fillRect(23, 23, 2, 5);
    } else if (type === "enderman") {
      // Enderman: Pitch dark violet/charcoal texture with glowing purple eyes
      fillPixelRect(0, 0, 64, 64, 16, 14, 22, 8);
      // Glowing Magenta/Purple eyes: x=8, y=8, w=8, h=8
      ctx.fillStyle = "#c084fc"; // Purple glow
      ctx.fillRect(8, 10, 4, 1);
      ctx.fillRect(14, 10, 4, 1);
      ctx.fillStyle = "#e9d5ff"; // Bright white/pink core
      ctx.fillRect(9, 10, 2, 1);
      ctx.fillRect(15, 10, 2, 1);
    } else if (type === "cow") {
      // Cow: Dark brown with white spots
      fillPixelRect(0, 0, 64, 64, 90, 65, 45, 15);
      // White patches
      fillPixelRect(16, 16, 12, 10, 240, 240, 240, 5);
      fillPixelRect(32, 20, 10, 8, 240, 240, 240, 5);
      fillPixelRect(0, 8, 8, 6, 240, 240, 240, 5);
      // Eyes & Snout
      ctx.fillStyle = "#000000";
      ctx.fillRect(9, 10, 2, 1);
      ctx.fillRect(14, 10, 2, 1);
      ctx.fillStyle = "#f43f5e"; // Pink snout
      ctx.fillRect(10, 12, 5, 2);
    } else if (type === "sheep") {
      // Sheep: Cream white fluffy wool
      fillPixelRect(0, 0, 64, 64, 235, 235, 230, 10);
      // Pink face
      fillPixelRect(0, 8, 16, 8, 240, 180, 170, 8);
      ctx.fillStyle = "#000000";
      ctx.fillRect(3, 11, 2, 1);
      ctx.fillRect(10, 11, 2, 1);
    } else if (type === "pig") {
      // Pig: Pink skin
      fillPixelRect(0, 0, 64, 64, 245, 165, 165, 12);
      // Snout
      fillPixelRect(10, 12, 6, 3, 220, 120, 130, 8);
      ctx.fillStyle = "#000000";
      ctx.fillRect(11, 13, 1, 1);
      ctx.fillRect(14, 13, 1, 1);
      // Eyes
      ctx.fillRect(8, 10, 2, 1);
      ctx.fillRect(15, 10, 2, 1);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(7, 10, 1, 1);
      ctx.fillRect(14, 10, 1, 1);
    } else if (type === "alex") {
      // Alex: Orange hair, green tunic, beige trousers
      fillPixelRect(0, 0, 32, 16, 215, 160, 125, 10);
      fillPixelRect(8, 0, 8, 8, 210, 110, 30, 8); // Orange hair
      fillPixelRect(16, 16, 24, 16, 45, 155, 85, 10); // Green tunic
      fillPixelRect(40, 16, 16, 16, 215, 160, 125, 10);
      fillPixelRect(0, 16, 16, 16, 130, 110, 85, 10); // Brown pants
    } else if (type === "miner") {
      // Miner: Yellow hard hat with lamp, grey work shirt, utility belt
      fillPixelRect(0, 0, 32, 16, 195, 140, 105, 10);
      fillPixelRect(6, 0, 12, 5, 235, 195, 45, 6); // Hard hat
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(11, 1, 2, 2); // Lamp glow
      fillPixelRect(16, 16, 24, 16, 110, 115, 125, 12); // Grey shirt
      fillPixelRect(40, 16, 16, 16, 195, 140, 105, 10);
      fillPixelRect(0, 16, 16, 16, 50, 60, 75, 10); // Dark pants
    } else if (type === "knight") {
      // Knight: Steel armor plate, helmet with visor
      fillPixelRect(0, 0, 32, 16, 150, 160, 175, 10);
      fillPixelRect(8, 0, 8, 8, 110, 120, 135, 8); // Steel helmet
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(10, 10, 4, 1); // Visor slit
      fillPixelRect(16, 16, 24, 16, 130, 140, 155, 12); // Armor plate
      fillPixelRect(40, 16, 16, 16, 110, 120, 135, 10); // Armored sleeves
      fillPixelRect(0, 16, 16, 16, 70, 80, 95, 10); // Steel greaves
    } else if (type === "engineer") {
      // Engineer: Goggles, orange jumpsuit, tool pouch
      fillPixelRect(0, 0, 32, 16, 210, 150, 120, 10);
      ctx.fillStyle = "#222222";
      ctx.fillRect(9, 9, 6, 2); // Goggles band
      ctx.fillStyle = "#67e8f9"; // Goggle lenses
      ctx.fillRect(10, 9, 2, 2);
      ctx.fillRect(13, 9, 2, 2);
      fillPixelRect(16, 16, 24, 16, 225, 115, 35, 12); // Orange jumpsuit
      fillPixelRect(40, 16, 16, 16, 210, 150, 120, 10);
      fillPixelRect(0, 16, 16, 16, 180, 90, 20, 10); // Brown pants
    }

    return canvas;
  }

  /**
   * Creates a Three.js CanvasTexture with pixel-perfect NearestFilter
   */
  public static createSkinTexture(type: EntityType): THREE.CanvasTexture {
    const canvas = this.createSkinCanvas(type);
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
  }

  public static createMobMaterial(type: EntityType): THREE.MeshLambertMaterial {
    const texture = this.createSkinTexture(type);
    return new THREE.MeshLambertMaterial({ map: texture });
  }

  /**
   * Builds a Bird model
   */
  public static buildBird(
    material: THREE.Material,
    scale: number = 1 / 16,
  ): BirdParts {
    const group = new THREE.Group();
    // Body: 4 x 3 x 6 pixels
    const bodyGeo = new THREE.BoxGeometry(4 * scale, 3 * scale, 6 * scale);
    const bodyMesh = new THREE.Mesh(bodyGeo, material);
    bodyMesh.position.set(0, 1.5 * scale, 0);
    group.add(bodyMesh);

    // Head: 3 x 3 x 3 pixels
    const headGeo = new THREE.BoxGeometry(3 * scale, 3 * scale, 3 * scale);
    const headMesh = new THREE.Mesh(headGeo, material);
    headMesh.position.set(0, 3 * scale, 3.5 * scale);
    group.add(headMesh);

    // Left Wing pivot
    const lwGroup = new THREE.Group();
    lwGroup.position.set(2 * scale, 2 * scale, 0);
    const lwGeo = new THREE.BoxGeometry(6 * scale, 0.5 * scale, 4 * scale);
    const lwMesh = new THREE.Mesh(lwGeo, material);
    lwMesh.position.set(3 * scale, 0, 0);
    lwGroup.add(lwMesh);
    group.add(lwGroup);

    // Right Wing pivot
    const rwGroup = new THREE.Group();
    rwGroup.position.set(-2 * scale, 2 * scale, 0);
    const rwGeo = new THREE.BoxGeometry(6 * scale, 0.5 * scale, 4 * scale);
    const rwMesh = new THREE.Mesh(rwGeo, material);
    rwMesh.position.set(-3 * scale, 0, 0);
    rwGroup.add(rwMesh);
    group.add(rwGroup);

    return { group, leftWing: lwGroup, rightWing: rwGroup, type: "bird" };
  }

  public static animateBirdFlight(parts: BirdParts, time: number): void {
    const flap = Math.sin(time * 18) * 0.9;
    parts.leftWing.rotation.z = flap;
    parts.rightWing.rotation.z = -flap;
  }

  /**
   * Builds a detailed Steve companion model with backpack and handheld pickaxe/torch
   */
  public static buildSteveCompanion(
    material: THREE.Material,
    scale: number = 1 / 16,
  ): HumanoidParts {
    const parts = this.buildHumanoid(material, "player", scale);

    // Add backpack to torso back
    const backpackGeo = new THREE.BoxGeometry(6 * scale, 8 * scale, 3 * scale);
    const backpackMat = new THREE.MeshLambertMaterial({ color: 0x5c4033 }); // Leather brown
    const backpackMesh = new THREE.Mesh(backpackGeo, backpackMat);
    backpackMesh.position.set(0, 6 * scale, -3.5 * scale);
    backpackMesh.castShadow = true;
    parts.torso.add(backpackMesh);

    // Add mining pickaxe in right hand
    const toolGroup = new THREE.Group();
    const handleGeo = new THREE.BoxGeometry(1 * scale, 10 * scale, 1 * scale);
    const handleMat = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
    const handleMesh = new THREE.Mesh(handleGeo, handleMat);
    handleMesh.position.set(0, -5 * scale, 0);
    toolGroup.add(handleMesh);

    const headGeo = new THREE.BoxGeometry(4 * scale, 3 * scale, 2 * scale);
    const headMat = new THREE.MeshLambertMaterial({ color: 0x94a3b8 }); // Iron head
    const pickHeadMesh = new THREE.Mesh(headGeo, headMat);
    pickHeadMesh.position.set(0, -1 * scale, 1.5 * scale);
    toolGroup.add(pickHeadMesh);

    toolGroup.position.set(0, -10 * scale, 2 * scale);
    toolGroup.rotation.x = Math.PI / 6;
    parts.rightArm.add(toolGroup);

    return parts;
  }
}

/**
 * High-level HumanoidModel wrapper extending THREE.Group for seamless scene integration
 */
export class HumanoidModel extends THREE.Group {
  public parts: HumanoidParts;
  public head: THREE.Group;
  public torso: THREE.Group;
  public leftArm: THREE.Group;
  public rightArm: THREE.Group;
  public leftLeg: THREE.Group;
  public rightLeg: THREE.Group;
  public isZombie: boolean;

  constructor(options: { isZombie?: boolean; material?: THREE.Material } = {}) {
    super();
    this.isZombie = !!options.isZombie;
    const mat =
      options.material ||
      EntityModelBuilder.createMobMaterial(this.isZombie ? "zombie" : "player");
    this.parts = EntityModelBuilder.buildHumanoid(
      mat,
      this.isZombie ? "zombie" : "player",
    );
    this.head = this.parts.head;
    this.torso = this.parts.torso;
    this.leftArm = this.parts.leftArm;
    this.rightArm = this.parts.rightArm;
    this.leftLeg = this.parts.leftLeg;
    this.rightLeg = this.parts.rightLeg;
    this.add(this.parts.group);
  }

  public animateWalk(
    time: number,
    speed: number = 1.0,
    isMoving: boolean = true,
  ): void {
    EntityModelBuilder.animateHumanoidWalk(
      this.parts,
      time,
      isMoving ? speed : 0.0,
    );
  }

  public setLookDirection(yaw: number, pitch: number): void {
    this.head.rotation.y = yaw;
    this.head.rotation.x = pitch;
  }
}

/**
 * High-level CreeperModel wrapper extending THREE.Group
 */
export class CreeperModel extends THREE.Group {
  public parts: CreeperParts;
  public head: THREE.Group;
  public torso: THREE.Group;

  constructor(options: { material?: THREE.Material } = {}) {
    super();
    const mat =
      options.material || EntityModelBuilder.createMobMaterial("creeper");
    this.parts = EntityModelBuilder.buildCreeper(mat);
    this.head = this.parts.head;
    this.torso = this.parts.torso;
    this.add(this.parts.group);
  }

  public animateWalk(
    time: number,
    speed: number = 1.0,
    isMoving: boolean = true,
  ): void {
    EntityModelBuilder.animateCreeperWalk(
      this.parts,
      time,
      isMoving ? speed : 0.0,
    );
  }
}

// Enhance EntityModelBuilder with overload helpers returning HumanoidModel/CreeperModel directly
(EntityModelBuilder as any).buildHumanoidModel = function (options?: {
  isZombie?: boolean;
}) {
  return new HumanoidModel(options);
};
(EntityModelBuilder as any).buildCreeperModel = function () {
  return new CreeperModel();
};
