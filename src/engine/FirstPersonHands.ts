import * as THREE from "three";
import { SlotItem, ITEM_REGISTRY } from "./InventorySystem";
import { BLOCK, BlockId } from "./types";

export class FirstPersonHands {
  public group: THREE.Group;
  private armMesh: THREE.Mesh;
  private itemMeshGroup: THREE.Group;
  private currentItemId: string | null = null;

  constructor(camera: THREE.PerspectiveCamera) {
    this.group = new THREE.Group();
    // Position in front of camera (lower right)
    this.group.position.set(0.38, -0.32, -0.55);
    this.group.rotation.set(0.1, -0.2, 0.1);

    // Arm mesh (skin tone)
    const armGeo = new THREE.BoxGeometry(0.12, 0.12, 0.4);
    const armMat = new THREE.MeshLambertMaterial({ color: 0xcdad85 }); // Skin tone
    this.armMesh = new THREE.Mesh(armGeo, armMat);
    this.armMesh.position.set(0, 0, 0.15);
    this.armMesh.castShadow = true;
    this.group.add(this.armMesh);

    // Held item container
    this.itemMeshGroup = new THREE.Group();
    this.itemMeshGroup.position.set(0, -0.02, -0.25);
    this.group.add(this.itemMeshGroup);

    camera.add(this.group);
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

    // Clear previous item meshes
    while (this.itemMeshGroup.children.length > 0) {
      this.itemMeshGroup.remove(this.itemMeshGroup.children[0]);
    }

    if (!heldItem && effectiveBlockToPlace === 0) return;

    // Build 3D representation of held item/tool/block
    const itemGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
    let itemMat = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });

    if (heldItem) {
      if (heldItem.id.includes("sword")) {
        // Sword model
        const swordGroup = new THREE.Group();
        const blade = new THREE.Mesh(
          new THREE.BoxGeometry(0.04, 0.35, 0.02),
          new THREE.MeshLambertMaterial({ color: 0x94a3b8 }),
        );
        blade.position.set(0, 0.15, 0);
        swordGroup.add(blade);
        const hilt = new THREE.Mesh(
          new THREE.BoxGeometry(0.06, 0.1, 0.04),
          new THREE.MeshLambertMaterial({ color: 0x5c4033 }),
        );
        hilt.position.set(0, -0.05, 0);
        swordGroup.add(hilt);
        this.itemMeshGroup.add(swordGroup);
        return;
      } else if (heldItem.id.includes("pickaxe")) {
        // Pickaxe model
        const pickGroup = new THREE.Group();
        const handle = new THREE.Mesh(
          new THREE.BoxGeometry(0.04, 0.3, 0.04),
          new THREE.MeshLambertMaterial({ color: 0x8b5a2b }),
        );
        pickGroup.add(handle);
        const head = new THREE.Mesh(
          new THREE.BoxGeometry(0.2, 0.06, 0.06),
          new THREE.MeshLambertMaterial({ color: 0x94a3b8 }),
        );
        head.position.set(0, 0.15, 0);
        pickGroup.add(head);
        this.itemMeshGroup.add(pickGroup);
        return;
      } else if (heldItem.id === "apple") {
        itemMat = new THREE.MeshLambertMaterial({ color: 0xef4444 });
      } else if (heldItem.id === "bread" || heldItem.id === "cooked_beef") {
        itemMat = new THREE.MeshLambertMaterial({ color: 0xb45309 });
      } else if (heldItem.id === "torch") {
        // Authentic Minecraft handheld torch model
        const torchGroup = new THREE.Group();

        // Wooden stick
        const stickGeo = new THREE.BoxGeometry(0.045, 0.3, 0.045);
        const stickMat = new THREE.MeshLambertMaterial({ color: 0x6d4c1b });
        const stick = new THREE.Mesh(stickGeo, stickMat);
        stick.position.set(0, 0.08, 0);
        torchGroup.add(stick);

        // Charcoal / coal band
        const coalGeo = new THREE.BoxGeometry(0.048, 0.04, 0.048);
        const coalMat = new THREE.MeshLambertMaterial({ color: 0x262626 });
        const coal = new THREE.Mesh(coalGeo, coalMat);
        coal.position.set(0, 0.22, 0);
        torchGroup.add(coal);

        // Glowing flame head
        const flameGeo = new THREE.BoxGeometry(0.054, 0.07, 0.054);
        const flameMat = new THREE.MeshLambertMaterial({
          color: 0xf59e0b,
          emissive: 0xf59e0b,
          emissiveIntensity: 0.95,
        });
        const flame = new THREE.Mesh(flameGeo, flameMat);
        flame.position.set(0, 0.26, 0);
        torchGroup.add(flame);

        // Bright hot inner core
        const coreGeo = new THREE.BoxGeometry(0.026, 0.04, 0.026);
        const coreMat = new THREE.MeshLambertMaterial({
          color: 0xfffbeb,
          emissive: 0xffffff,
          emissiveIntensity: 1.2,
        });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.set(0, 0.27, 0);
        torchGroup.add(core);

        torchGroup.rotation.x = -0.15;
        torchGroup.rotation.z = -0.1;
        this.itemMeshGroup.add(torchGroup);
        return;
      } else if (heldItem.id === "campfire") {
        itemMat = new THREE.MeshLambertMaterial({
          color: 0xea580c,
          emissive: 0xc2410c,
          emissiveIntensity: 0.6,
        });
      }
    } else if (effectiveBlockToPlace > 0) {
      // Block model
      itemMat = new THREE.MeshLambertMaterial({
        color:
          effectiveBlockToPlace === BLOCK.DIRT
            ? 0x8b5a2b
            : effectiveBlockToPlace === BLOCK.STONE
              ? 0x7f8c8d
              : effectiveBlockToPlace === BLOCK.CAMPFIRE
                ? 0xea580c
                : 0x27ae60,
      });
    }

    const mesh = new THREE.Mesh(itemGeo, itemMat);
    this.itemMeshGroup.add(mesh);
  }

  public animate(
    time: number,
    isMoving: boolean,
    isMining: boolean,
    isSwinging: boolean,
  ): void {
    if (isSwinging || isMining) {
      // Striking / placing swing animation
      const swing = Math.sin(time * 32) * 0.45;
      this.group.rotation.x = 0.1 + swing;
      this.group.rotation.y = -0.2 + Math.cos(time * 32) * 0.2;
      this.group.position.y = -0.32 + Math.abs(swing) * 0.08;
    } else if (isMoving) {
      // Walking bobbing
      this.group.position.y = -0.32 + Math.sin(time * 12) * 0.03;
      this.group.rotation.x = 0.1 + Math.sin(time * 6) * 0.05;
      this.group.rotation.y = -0.2;
    } else {
      // Idle breathing
      this.group.position.y = -0.32 + Math.sin(time * 3) * 0.01;
      this.group.rotation.x = 0.1;
      this.group.rotation.y = -0.2;
    }
  }

  public dispose(camera: THREE.PerspectiveCamera): void {
    camera.remove(this.group);
  }
}
