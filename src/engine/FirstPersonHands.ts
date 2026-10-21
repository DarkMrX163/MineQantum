import * as THREE from "three";
import { SlotItem, ITEM_REGISTRY } from "./InventorySystem";
import { BLOCK, BlockId } from "./types";

export class FirstPersonHands {
  public group: THREE.Group;
  private sleeveMesh: THREE.Mesh;
  private handMesh: THREE.Mesh;
  private itemMeshGroup: THREE.Group;
  private currentItemId: string | null = null;

  constructor(camera: THREE.PerspectiveCamera) {
    this.group = new THREE.Group();
    // Position in front of camera (lower right corner, Minecraft style)
    this.group.position.set(0.35, -0.32, -0.52);
    this.group.rotation.set(0.12, -0.22, 0.08);

    // 1. Steve's Cyan Shirt Sleeve
    const sleeveGeo = new THREE.BoxGeometry(0.12, 0.12, 0.28);
    const sleeveMat = new THREE.MeshLambertMaterial({ color: 0x00a8a8 }); // Steve cyan shirt
    this.sleeveMesh = new THREE.Mesh(sleeveGeo, sleeveMat);
    this.sleeveMesh.position.set(0, 0, 0.18);
    this.sleeveMesh.castShadow = true;
    this.group.add(this.sleeveMesh);

    // 2. Skin Fist / Hand
    const handGeo = new THREE.BoxGeometry(0.11, 0.11, 0.15);
    const handMat = new THREE.MeshLambertMaterial({ color: 0xcdad85 }); // Skin tone
    this.handMesh = new THREE.Mesh(handGeo, handMat);
    this.handMesh.position.set(0, 0, -0.02);
    this.handMesh.castShadow = true;
    this.group.add(this.handMesh);

    // 3. Held item container attached to the fist
    this.itemMeshGroup = new THREE.Group();
    this.itemMeshGroup.position.set(0, 0.01, -0.15);
    this.group.add(this.itemMeshGroup);

    camera.add(this.group);
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  public updateHeldItem(
    heldItem: SlotItem | null,
    effectiveBlockToPlace: BlockId,
  ): void {
    const itemId = heldItem
      ? heldItem.id
      : effectiveBlockToPlace > 0
        ? `block_${effectiveBlockToPlace}`
        : null;

    if (this.currentItemId === itemId) return;
    this.currentItemId = itemId;

    // Clear previous item meshes safely
    while (this.itemMeshGroup.children.length > 0) {
      const child = this.itemMeshGroup.children[0];
      this.itemMeshGroup.remove(child);
    }

    if (!heldItem && effectiveBlockToPlace === 0) return;

    if (heldItem) {
      const id = heldItem.id;

      // --- 1. Swords ---
      if (id.includes("sword")) {
        const swordGroup = new THREE.Group();
        const bladeColor = id.includes("diamond")
          ? 0x38bdf8
          : id.includes("iron")
            ? 0xe2e8f0
            : 0xb45309;

        // Long blade
        const blade = new THREE.Mesh(
          new THREE.BoxGeometry(0.04, 0.42, 0.02),
          new THREE.MeshLambertMaterial({ color: bladeColor }),
        );
        blade.position.set(0, 0.18, 0);
        swordGroup.add(blade);

        // Crossguard
        const guard = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, 0.03, 0.04),
          new THREE.MeshLambertMaterial({ color: 0x78350f }),
        );
        guard.position.set(0, 0.0, 0);
        swordGroup.add(guard);

        // Hilt
        const hilt = new THREE.Mesh(
          new THREE.BoxGeometry(0.03, 0.12, 0.03),
          new THREE.MeshLambertMaterial({ color: 0x451a03 }),
        );
        hilt.position.set(0, -0.07, 0);
        swordGroup.add(hilt);

        swordGroup.rotation.set(-0.2, 0.3, -0.3);
        this.itemMeshGroup.add(swordGroup);
        return;
      }

      // --- 2. Pickaxes ---
      if (id.includes("pickaxe")) {
        const pickGroup = new THREE.Group();
        const headColor = id.includes("diamond")
          ? 0x38bdf8
          : id.includes("stone")
            ? 0x94a3b8
            : 0xb45309;

        // Wooden Handle
        const handle = new THREE.Mesh(
          new THREE.BoxGeometry(0.035, 0.38, 0.035),
          new THREE.MeshLambertMaterial({ color: 0x78350f }),
        );
        handle.position.set(0, 0.08, 0);
        pickGroup.add(handle);

        // Pickaxe T-Head
        const head = new THREE.Mesh(
          new THREE.BoxGeometry(0.26, 0.05, 0.05),
          new THREE.MeshLambertMaterial({ color: headColor }),
        );
        head.position.set(0, 0.22, 0);
        pickGroup.add(head);

        pickGroup.rotation.set(-0.3, 0.4, -0.2);
        this.itemMeshGroup.add(pickGroup);
        return;
      }

      // --- 3. Axes ---
      if (id.includes("axe")) {
        const axeGroup = new THREE.Group();
        const bladeColor = id.includes("diamond")
          ? 0x38bdf8
          : id.includes("stone")
            ? 0x94a3b8
            : 0xb45309;

        // Handle
        const handle = new THREE.Mesh(
          new THREE.BoxGeometry(0.035, 0.36, 0.035),
          new THREE.MeshLambertMaterial({ color: 0x78350f }),
        );
        handle.position.set(0, 0.08, 0);
        axeGroup.add(handle);

        // Axe Head
        const blade = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.14, 0.04),
          new THREE.MeshLambertMaterial({ color: bladeColor }),
        );
        blade.position.set(0.05, 0.2, 0);
        axeGroup.add(blade);

        axeGroup.rotation.set(-0.3, 0.4, -0.2);
        this.itemMeshGroup.add(axeGroup);
        return;
      }

      // --- 4. Authentic Handheld Torch ---
      if (id === "torch") {
        const torchGroup = new THREE.Group();

        // Wooden Stick
        const stick = new THREE.Mesh(
          new THREE.BoxGeometry(0.045, 0.3, 0.045),
          new THREE.MeshLambertMaterial({ color: 0x6d4c1b }),
        );
        stick.position.set(0, 0.08, 0);
        torchGroup.add(stick);

        // Charcoal Rim
        const coal = new THREE.Mesh(
          new THREE.BoxGeometry(0.048, 0.04, 0.048),
          new THREE.MeshLambertMaterial({ color: 0x262626 }),
        );
        coal.position.set(0, 0.22, 0);
        torchGroup.add(coal);

        // Glowing Torch Flame
        const flame = new THREE.Mesh(
          new THREE.BoxGeometry(0.054, 0.07, 0.054),
          new THREE.MeshLambertMaterial({
            color: 0xf59e0b,
            emissive: 0xf59e0b,
            emissiveIntensity: 0.95,
          }),
        );
        flame.position.set(0, 0.26, 0);
        torchGroup.add(flame);

        // Hot Inner Core
        const core = new THREE.Mesh(
          new THREE.BoxGeometry(0.026, 0.04, 0.026),
          new THREE.MeshLambertMaterial({
            color: 0xfffbeb,
            emissive: 0xffffff,
            emissiveIntensity: 1.2,
          }),
        );
        core.position.set(0, 0.27, 0);
        torchGroup.add(core);

        torchGroup.rotation.set(-0.25, 0.2, -0.15);
        this.itemMeshGroup.add(torchGroup);
        return;
      }

      // --- 5. Food & Valuable Items ---
      if (id === "apple" || id === "golden_apple") {
        const appleGroup = new THREE.Group();
        const isGolden = id === "golden_apple";
        const appleMat = new THREE.MeshLambertMaterial({
          color: isGolden ? 0xf59e0b : 0xef4444,
          emissive: isGolden ? 0xd97706 : 0x000000,
          emissiveIntensity: isGolden ? 0.4 : 0,
        });

        const body = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, 0.14, 0.14),
          appleMat,
        );
        appleGroup.add(body);

        const stem = new THREE.Mesh(
          new THREE.BoxGeometry(0.02, 0.05, 0.02),
          new THREE.MeshLambertMaterial({ color: 0x15803d }),
        );
        stem.position.set(0, 0.09, 0);
        appleGroup.add(stem);

        this.itemMeshGroup.add(appleGroup);
        return;
      }

      if (id === "diamond" || id === "emerald") {
        const gemGeo = new THREE.OctahedronGeometry(0.1, 0);
        const gemMat = new THREE.MeshLambertMaterial({
          color: id === "diamond" ? 0x38bdf8 : 0x10b981,
          emissive: id === "diamond" ? 0x0284c7 : 0x047857,
          emissiveIntensity: 0.3,
        });
        const gem = new THREE.Mesh(gemGeo, gemMat);
        gem.rotation.set(0.4, 0.4, 0);
        this.itemMeshGroup.add(gem);
        return;
      }
    }

    // --- 6. 3D Voxel Block in Hand (Minecraft Style 45-degree angle block) ---
    let blockColor = 0x8b5a2b; // Default Dirt

    if (effectiveBlockToPlace === BLOCK.GRASS) blockColor = 0x22c55e;
    else if (effectiveBlockToPlace === BLOCK.DIRT) blockColor = 0x8b5a2b;
    else if (effectiveBlockToPlace === BLOCK.STONE) blockColor = 0x64748b;
    else if (effectiveBlockToPlace === BLOCK.WOOD) blockColor = 0x78350f;
    else if (effectiveBlockToPlace === BLOCK.LEAVES) blockColor = 0x15803d;
    else if (effectiveBlockToPlace === BLOCK.SAND) blockColor = 0xfde047;
    else if (effectiveBlockToPlace === BLOCK.BRICK) blockColor = 0xb91c1c;
    else if (effectiveBlockToPlace === BLOCK.GLASS) blockColor = 0x38bdf8;
    else if (effectiveBlockToPlace === BLOCK.PLANKS) blockColor = 0xd97706;
    else if (effectiveBlockToPlace === BLOCK.LAVA) blockColor = 0xf97316;

    const blockGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    const blockMat = new THREE.MeshLambertMaterial({
      color: blockColor,
      transparent: effectiveBlockToPlace === BLOCK.GLASS,
      opacity: effectiveBlockToPlace === BLOCK.GLASS ? 0.7 : 1.0,
    });

    const blockMesh = new THREE.Mesh(blockGeo, blockMat);
    blockMesh.rotation.set(0.3, 0.5, 0.1);
    this.itemMeshGroup.add(blockMesh);
  }

  public animate(
    time: number,
    isMoving: boolean,
    isMining: boolean,
    isSwinging: boolean,
  ): void {
    if (!this.group.visible) return;

    if (isSwinging || isMining) {
      // Striking / mining / placing chop swing animation
      const swing = Math.sin(time * 26) * 0.55;
      this.group.rotation.x = 0.12 + swing;
      this.group.rotation.y = -0.22 + Math.cos(time * 26) * 0.28;
      this.group.position.y = -0.32 + Math.abs(swing) * 0.09;
      this.group.position.z = -0.52 + Math.sin(time * 26) * 0.08;
    } else if (isMoving) {
      // Walking / Sprinting arm sway and bobbing
      this.group.position.y = -0.32 + Math.sin(time * 12) * 0.032;
      this.group.position.x = 0.35 + Math.cos(time * 6) * 0.02;
      this.group.rotation.x = 0.12 + Math.sin(time * 6) * 0.06;
      this.group.rotation.y = -0.22;
    } else {
      // Idle breathing
      this.group.position.y = -0.32 + Math.sin(time * 2.5) * 0.008;
      this.group.rotation.x = 0.12;
      this.group.rotation.y = -0.22;
    }
  }

  public dispose(camera: THREE.PerspectiveCamera): void {
    camera.remove(this.group);
  }
}
