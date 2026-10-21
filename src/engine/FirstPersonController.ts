import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import { ChunkManager } from "./ChunkManager";
import { BLOCK, BLOCK_DEFS } from "./types";
import { sound } from "./AudioEngine";
import { NetworkManager } from "./NetworkManager";
import { HumanoidModel } from "./EntityModelBuilder";
import {
  SlotItem,
  ITEM_REGISTRY,
  calculateBlockBreaking,
} from "./InventorySystem";

export interface FirstPersonControllerOptions {
  moveSpeed?: number; // Default: 6.0 m/s
  flySpeed?: number; // Default: 14.0 m/s
  jumpForce?: number; // Default: 8.5 m/s
  gravity?: number; // Default: 26.0 m/s^2
  playerWidth?: number; // Default: 0.6 m
  playerHeight?: number; // Default: 1.8 m
  eyeHeight?: number; // Default: 1.62 m
}

export class FirstPersonController {
  public camera: THREE.PerspectiveCamera;
  public controls: PointerLockControls;
  public chunkManager: ChunkManager;
  public scene: THREE.Scene;
  public netManager?: NetworkManager;

  // Camera perspective & 3D Local Player Nametag
  public cameraMode: "first" | "third-back" | "third-front" = "first";
  public localPlayerModel?: HumanoidModel;
  public localNametagSprite?: THREE.Sprite;
  public localPlayerName: string = "Player";
  private localWalkTime: number = 0;
  public onCameraModeChange?: (mode: "first" | "third-back" | "third-front") => void;

  // Player physics state
  public position: THREE.Vector3 = new THREE.Vector3(8, 30, 8); // Feet position
  public velocity: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public isGrounded: boolean = false;
  public isFlying: boolean = false;

  // Config options
  public moveSpeed: number;
  public flySpeed: number;
  public jumpForce: number;
  public gravity: number;
  public playerWidth: number;
  public playerHeight: number;
  public eyeHeight: number;

  // Key & Mouse state
  private keys: { [key: string]: boolean } = {};
  public isLMBDown: boolean = false;

  // Sprinting State (Double-tap W or Shift)
  public isSprinting: boolean = false;
  public canSprint: boolean = true;
  private lastWPressTime: number = 0;

  // Fall Damage Tracking
  public fallPeakY: number = 0;
  private wasInAir: boolean = false;

  // Environmental Hazards (Lava contact)
  private lavaDamageTimer: number = 0;

  // Breaking state & Tool speed calculation
  public breakingBlockPos: THREE.Vector3 | null = null;
  public breakingProgress: number = 0; // 0.0 to 1.0
  public breakingDuration: number = 1.0;
  public activeHeldItem: SlotItem | null = null;
  private lastCrunchSoundTime: number = 0;

  // Callbacks
  public onBlockBroken?: (
    blockId: number,
    pos: THREE.Vector3,
    canHarvest: boolean,
    dropItemId: string | null,
    dropCount: number,
  ) => void;
  public onBlockPlaced?: (blockId: number, pos: THREE.Vector3) => void;
  public onToolUsed?: () => void;
  public onBreakingProgressChange?: (
    progress: number,
    pos: THREE.Vector3 | null,
  ) => void;
  public onTakeDamage?: (
    amount: number,
    reason: "fall" | "lava" | "mob" | "starvation",
  ) => void;
  public onSprintStateChange?: (isSprinting: boolean) => void;
  public onAttackMobRequest?: () => boolean;
  public onEatFood?: (item: SlotItem) => void;
  public onOpenCraftingTable?: () => void;
  public onInteractMobRequest?: () => boolean;

  constructor(
    camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    chunkManager: ChunkManager,
    scene: THREE.Scene,
    options: FirstPersonControllerOptions = {},
  ) {
    this.camera = camera;
    this.chunkManager = chunkManager;
    this.scene = scene;

    this.moveSpeed = options.moveSpeed ?? 6.5;
    this.flySpeed = options.flySpeed ?? 14.0;
    this.jumpForce = options.jumpForce ?? 8.5;
    this.gravity = options.gravity ?? 26.0;
    this.playerWidth = options.playerWidth ?? 0.6;
    this.playerHeight = options.playerHeight ?? 1.8;
    this.eyeHeight = options.eyeHeight ?? 1.62;

    this.controls = new PointerLockControls(this.camera, domElement);

    this.initListeners(domElement);
  }

  private initListeners(domElement: HTMLElement): void {
    window.addEventListener("keydown", (e) => {
      this.keys[e.code] = true;

      // Sprinting: Double-tap 'KeyW' within 280ms or holding Control
      if (e.code === "KeyW") {
        const now = performance.now();
        if (now - this.lastWPressTime < 280 && this.canSprint) {
          this.isSprinting = true;
          this.onSprintStateChange?.(true);
        }
        this.lastWPressTime = now;
      }
      if (e.code === "ControlLeft" && this.canSprint) {
        this.isSprinting = true;
        this.onSprintStateChange?.(true);
      }

      // Toggle fly mode with 'F' key
      if (e.code === "KeyF") {
        this.isFlying = !this.isFlying;
        this.velocity.set(0, 0, 0);
      }

      // Toggle camera perspective (1st person -> 3rd person back -> 3rd person front)
      if (e.code === "F5") {
        e.preventDefault();
        this.toggleCameraMode();
      }
    });

    window.addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
      if (e.code === "KeyW") {
        this.isSprinting = false;
        this.onSprintStateChange?.(false);
      }
      if (e.code === "ControlLeft") {
        this.isSprinting = false;
        this.onSprintStateChange?.(false);
      }
    });

    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;

    domElement.addEventListener("mousedown", (e) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
      if (!this.controls.isLocked) {
        this.controls.lock();
      }
      if (e.button === 0) {
        this.isLMBDown = true;
      }
    });

    window.addEventListener("mouseup", (e) => {
      isDragging = false;
      if (e.button === 0) {
        this.isLMBDown = false;
        this.resetBreaking();
      }
    });

    window.addEventListener("mousemove", (e) => {
      if (!this.controls.isLocked && isDragging) {
        const dx = e.clientX - prevMouseX;
        const dy = e.clientY - prevMouseY;
        this.rotateCamera(dx * 0.0035, dy * 0.0035);
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
      }
    });
  }

  public lock(): void {
    this.controls.lock();
  }

  public unlock(): void {
    this.controls.unlock();
  }

  public isLocked(): boolean {
    return this.controls.isLocked;
  }

  // Touch Controls State
  public touchMoveVector = { x: 0, y: 0 }; // x: left(-1)..right(1), y: back(-1)..forward(1)
  public touchJumpRequested: boolean = false;

  /**
   * Toggles camera view mode between first person and third person
   */
  public toggleCameraMode(): void {
    if (this.cameraMode === "first") {
      this.cameraMode = "third-back";
    } else if (this.cameraMode === "third-back") {
      this.cameraMode = "third-front";
    } else {
      this.cameraMode = "first";
    }
    if (this.localPlayerModel) {
      this.localPlayerModel.visible = this.cameraMode !== "first";
    }
    sound.playPop();
    this.onCameraModeChange?.(this.cameraMode);
  }

  public setLocalPlayerNickname(name: string): void {
    const clean = (name || "Player").trim().slice(0, 16);
    this.localPlayerName = clean;
    if (this.localPlayerModel) {
      if (this.localNametagSprite) {
        this.localPlayerModel.remove(this.localNametagSprite);
        if (this.localNametagSprite.material.map) {
          this.localNametagSprite.material.map.dispose();
        }
        this.localNametagSprite.material.dispose();
      }
      this.localNametagSprite = this.createNametagSprite(clean);
      this.localPlayerModel.add(this.localNametagSprite);
    }
  }

  public initLocalPlayerModel(nickname: string): void {
    this.localPlayerName = (nickname || "Player").trim().slice(0, 16);
    if (!this.localPlayerModel) {
      this.localPlayerModel = new HumanoidModel({ isZombie: false });
      this.localPlayerModel.visible = this.cameraMode !== "first";
      this.localNametagSprite = this.createNametagSprite(this.localPlayerName);
      this.localPlayerModel.add(this.localNametagSprite);
      this.scene.add(this.localPlayerModel);
    }
  }

  public createNametagSprite(name: string, color: string = "#38bdf8"): THREE.Sprite {
    const canvas = document.createElement("canvas");
    canvas.width = 384;
    canvas.height = 96;
    const ctx = canvas.getContext("2d");

    if (ctx) {
      const displayName = (name || "Player").trim().slice(0, 16);
      ctx.font = 'bold 34px "Segoe UI", Roboto, "Minecraft", sans-serif';
      const metrics = ctx.measureText(displayName);
      const boxW = Math.min(360, Math.max(130, metrics.width + 44));
      const boxH = 54;
      const boxX = (384 - boxW) / 2;
      const boxY = (96 - boxH) / 2;

      // Dark translucent Minecraft nametag plate with rounded corners
      ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 10);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Shadowed text
      ctx.shadowColor = "#000000";
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(displayName, 192, 48);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;

    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.renderOrder = 999;
    sprite.scale.set(2.4, 0.6, 1);
    sprite.position.set(0, 2.35, 0); // Position above head
    return sprite;
  }

  /**
   * Rotates camera via touch swipe (deltaYaw horizontal, deltaPitch vertical)
   */
  public rotateCamera(deltaYaw: number, deltaPitch: number): void {
    const euler = new THREE.Euler(0, 0, 0, "YXZ");
    euler.setFromQuaternion(this.camera.quaternion);

    euler.y -= deltaYaw;
    euler.x -= deltaPitch;

    // Clamp vertical pitch to prevent camera flipping (-89 to +89 degrees)
    const maxPitch = Math.PI / 2 - 0.02;
    euler.x = Math.max(-maxPitch, Math.min(maxPitch, euler.x));

    this.camera.quaternion.setFromEuler(euler);
  }

  /**
   * Main physics & position tick called every frame
   */
  public update(delta: number): void {
    // Process when pointer locked OR when touch controls are active
    const dt = Math.min(delta, 0.05);

    // Compute input direction relative to camera angle
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();

    this.camera.getWorldDirection(forward);
    if (!this.isFlying) forward.y = 0; // Lock forward vector to horizontal plane in walking mode
    forward.normalize();

    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    const inputDir = new THREE.Vector3(0, 0, 0);

    // Keyboard WASD
    if (this.keys["KeyW"]) inputDir.add(forward);
    if (this.keys["KeyS"]) inputDir.sub(forward);
    if (this.keys["KeyD"]) inputDir.add(right);
    if (this.keys["KeyA"]) inputDir.sub(right);

    // Touch Virtual Joystick input
    if (this.touchMoveVector.y !== 0) {
      inputDir.addScaledVector(forward, this.touchMoveVector.y);
    }
    if (this.touchMoveVector.x !== 0) {
      inputDir.addScaledVector(right, this.touchMoveVector.x);
    }

    if (inputDir.lengthSq() > 0) {
      inputDir.normalize();
    }

    // Check if player is in water or lava
    const feetBlock = this.chunkManager.getBlockGlobal(
      Math.floor(this.position.x),
      Math.floor(this.position.y),
      Math.floor(this.position.z),
    );
    const waistBlock = this.chunkManager.getBlockGlobal(
      Math.floor(this.position.x),
      Math.floor(this.position.y + 0.8),
      Math.floor(this.position.z),
    );
    const isInWater = waistBlock === BLOCK.WATER || feetBlock === BLOCK.WATER;
    const isInLava = waistBlock === BLOCK.LAVA || feetBlock === BLOCK.LAVA;

    // Lava Damage Tick (2 damage every 0.8s)
    if (isInLava && !this.isFlying) {
      this.lavaDamageTimer += dt;
      if (this.lavaDamageTimer >= 0.8) {
        this.lavaDamageTimer = 0;
        this.onTakeDamage?.(2, "lava");
      }
    } else {
      this.lavaDamageTimer = 0.6;
    }

    // Fall tracking while in air (water negates fall damage)
    if (!this.isGrounded && !this.isFlying && !isInWater) {
      if (!this.wasInAir) {
        this.wasInAir = true;
        this.fallPeakY = this.position.y;
      } else {
        this.fallPeakY = Math.max(this.fallPeakY, this.position.y);
      }
    } else if (isInWater) {
      this.wasInAir = false;
      this.fallPeakY = this.position.y;
    }

    // Sprinting speed boost (1.35x when double-tapping W and moving)
    const isMovingHoriz = inputDir.lengthSq() > 0;
    const isActuallySprinting =
      this.isSprinting && this.canSprint && isMovingHoriz && !isInWater;
    const sprintMult = isActuallySprinting ? 1.35 : 1.0;

    const currentSpeed = this.isFlying
      ? this.flySpeed
      : isInWater
        ? this.moveSpeed * 0.75
        : this.moveSpeed * sprintMult;

    if (this.isFlying) {
      // Free flying movement
      this.velocity.x = inputDir.x * currentSpeed;
      this.velocity.z = inputDir.z * currentSpeed;

      if (this.keys["Space"]) this.velocity.y = currentSpeed;
      else if (this.keys["ShiftLeft"]) this.velocity.y = -currentSpeed;
      else this.velocity.y = 0;

      this.position.x += this.velocity.x * dt;
      this.position.y += this.velocity.y * dt;
      this.position.z += this.velocity.z * dt;
    } else if (isInWater) {
      // Water Swimming physics (no solid collision for water blocks, float/swim up with Space, down with Shift)
      this.velocity.x = inputDir.x * currentSpeed;
      this.velocity.z = inputDir.z * currentSpeed;

      if (this.keys["Space"] || this.touchJumpRequested) {
        this.velocity.y = 4.5;
        this.touchJumpRequested = false;
      } else if (this.keys["ShiftLeft"]) {
        this.velocity.y = -4.5;
      } else {
        // Subtle buoyancy float
        this.velocity.y = Math.max(-2.0, this.velocity.y - 6.0 * dt);
      }

      this.resolveCollisions(dt);
    } else {
      // Walking & Gravity physics with AABB Collision Resolution
      this.velocity.x = inputDir.x * currentSpeed;
      this.velocity.z = inputDir.z * currentSpeed;

      // Apply Gravity
      this.velocity.y -= this.gravity * dt;

      // Jump
      if ((this.keys["Space"] || this.touchJumpRequested) && this.isGrounded) {
        this.velocity.y = this.jumpForce;
        this.isGrounded = false;
        this.touchJumpRequested = false;
        sound.playFootstep();
      }

      // Footstep audio
      if (
        this.isGrounded &&
        (this.velocity.x !== 0 || this.velocity.z !== 0) &&
        Math.random() < 0.04
      ) {
        sound.playFootstep();
      }

      // SEPARATE AXIS COLLISION RESOLUTION (Y -> X -> Z)
      this.resolveCollisions(dt);
    }

    // Sync camera position and local player model
    const eyeY = this.position.y + this.eyeHeight;
    const euler = new THREE.Euler(0, 0, 0, "YXZ");
    euler.setFromQuaternion(this.camera.quaternion);

    if (this.cameraMode === "first") {
      if (this.localPlayerModel) {
        this.localPlayerModel.visible = false;
      }
      this.camera.position.set(this.position.x, eyeY, this.position.z);
    } else {
      if (this.localPlayerModel) {
        this.localPlayerModel.visible = true;
        this.localPlayerModel.position.set(this.position.x, this.position.y, this.position.z);
        this.localPlayerModel.rotation.y = euler.y;
        this.localWalkTime += dt;
        const isMoving = this.velocity.x !== 0 || this.velocity.z !== 0;
        this.localPlayerModel.animateWalk(this.localWalkTime, isMoving ? 1.0 : 0.0, isMoving);
        this.localPlayerModel.setLookDirection(0, euler.x);
      }

      const forwardVec = new THREE.Vector3();
      this.camera.getWorldDirection(forwardVec);
      forwardVec.y = 0;
      forwardVec.normalize();

      if (this.cameraMode === "third-back") {
        this.camera.position.set(
          this.position.x - forwardVec.x * 3.4,
          eyeY + 0.35,
          this.position.z - forwardVec.z * 3.4,
        );
        this.camera.lookAt(this.position.x, eyeY, this.position.z);
      } else if (this.cameraMode === "third-front") {
        this.camera.position.set(
          this.position.x + forwardVec.x * 3.0,
          eyeY + 0.3,
          this.position.z + forwardVec.z * 3.0,
        );
        this.camera.lookAt(this.position.x, eyeY, this.position.z);
      }
    }

    // Send networked position to server (throttled inside NetworkManager)
    if (this.netManager) {
      this.netManager.sendPosition(
        this.position.x,
        this.position.y,
        this.position.z,
        euler.y,
        euler.x,
      );
    }

    // Process continuous block breaking tick (if LMB held or touch dig)
    this.updateBreaking(dt);
  }

  /**
   * Separate Axis AABB Voxel Collision Resolution algorithm
   * Ensures smooth wall sliding and ground collision.
   */
  private resolveCollisions(dt: number): void {
    const halfW = this.playerWidth / 2;
    const eps = 0.001;

    // --- 1. Y Axis Movement & Collision ---
    this.position.y += this.velocity.y * dt;
    this.isGrounded = false;

    let minX = Math.floor(this.position.x - halfW);
    let maxX = Math.floor(this.position.x + halfW);
    let minZ = Math.floor(this.position.z - halfW);
    let maxZ = Math.floor(this.position.z + halfW);

    if (this.velocity.y < 0) {
      // Moving down: check feet collision
      const feetY = Math.floor(this.position.y);
      if (this.hasSolidInArea(minX, maxX, feetY, feetY, minZ, maxZ)) {
        this.position.y = feetY + 1;
        this.velocity.y = 0;
        this.isGrounded = true;

        // Fall Damage calculation: (fall height - 3 blocks = damage in HP)
        if (this.wasInAir && !this.isFlying) {
          const fallDistance = this.fallPeakY - this.position.y;
          if (fallDistance > 3.0) {
            const fallDamage = Math.floor(fallDistance - 3.0);
            if (fallDamage > 0 && this.onTakeDamage) {
              this.onTakeDamage(fallDamage, "fall");
            }
          }
        }
        this.wasInAir = false;
        this.fallPeakY = this.position.y;
      }
    } else if (this.velocity.y > 0) {
      // Moving up: check head collision
      const headY = Math.floor(this.position.y + this.playerHeight);
      if (this.hasSolidInArea(minX, maxX, headY, headY, minZ, maxZ)) {
        this.position.y = headY - this.playerHeight - eps;
        this.velocity.y = 0;
      }
    }

    // Recalculate Y bounds for horizontal checks
    const minY = Math.floor(this.position.y);
    const maxY = Math.floor(this.position.y + this.playerHeight - eps);

    // --- 2. X Axis Movement & Collision ---
    this.position.x += this.velocity.x * dt;

    if (this.velocity.x > 0) {
      const checkX = Math.floor(this.position.x + halfW);
      if (this.hasSolidInArea(checkX, checkX, minY, maxY, minZ, maxZ)) {
        this.position.x = checkX - halfW - eps;
        this.velocity.x = 0;
      }
    } else if (this.velocity.x < 0) {
      const checkX = Math.floor(this.position.x - halfW);
      if (this.hasSolidInArea(checkX, checkX, minY, maxY, minZ, maxZ)) {
        this.position.x = checkX + 1 + halfW + eps;
        this.velocity.x = 0;
      }
    }

    // Recalculate X bounds for Z check
    minX = Math.floor(this.position.x - halfW);
    maxX = Math.floor(this.position.x + halfW);

    // --- 3. Z Axis Movement & Collision ---
    this.position.z += this.velocity.z * dt;

    if (this.velocity.z > 0) {
      const checkZ = Math.floor(this.position.z + halfW);
      if (this.hasSolidInArea(minX, maxX, minY, maxY, checkZ, checkZ)) {
        this.position.z = checkZ - halfW - eps;
        this.velocity.z = 0;
      }
    } else if (this.velocity.z < 0) {
      const checkZ = Math.floor(this.position.z - halfW);
      if (this.hasSolidInArea(minX, maxX, minY, maxY, checkZ, checkZ)) {
        this.position.z = checkZ + 1 + halfW + eps;
        this.velocity.z = 0;
      }
    }
  }

  /**
   * Checks if a block ID is solid for player physics collisions.
   * Leaves, Glass, Wood, Dirt, Stone, Planks, Bricks are solid.
   * Air, Water, Torch, Lava are non-solid (walk-through/passable).
   */
  public isSolidBlock(blockId: number): boolean {
    if (
      blockId === BLOCK.AIR ||
      blockId === BLOCK.WATER ||
      blockId === BLOCK.TORCH ||
      blockId === BLOCK.LAVA
    ) {
      return false;
    }
    const def = BLOCK_DEFS[blockId];
    if (def && def.solid === false) {
      return false;
    }
    return true;
  }

  /**
   * Returns true if any solid voxel exists in specified bounding box area
   */
  private hasSolidInArea(
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    minZ: number,
    maxZ: number,
  ): boolean {
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const blockId = this.chunkManager.getBlockGlobal(x, y, z);
          if (this.isSolidBlock(blockId)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Continuous breaking update called during update(delta)
   */
  public updateBreaking(dt: number): void {
    if (!this.controls.isLocked && !this.touchDigRequested) {
      if (this.breakingProgress > 0) this.resetBreaking();
      return;
    }

    if (!this.isLMBDown && !this.touchDigRequested) {
      if (this.breakingProgress > 0) this.resetBreaking();
      return;
    }

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const hit = this.chunkManager.raycast(
      raycaster.ray.origin,
      raycaster.ray.direction,
      7,
    );

    if (!hit) {
      this.resetBreaking();
      return;
    }

    const bx = hit.blockPos.x;
    const by = hit.blockPos.y;
    const bz = hit.blockPos.z;

    const blockId = this.chunkManager.getBlockGlobal(bx, by, bz);
    if (blockId === BLOCK.AIR) {
      this.resetBreaking();
      return;
    }

    // Check if targeting same block or new block
    if (
      !this.breakingBlockPos ||
      this.breakingBlockPos.x !== bx ||
      this.breakingBlockPos.y !== by ||
      this.breakingBlockPos.z !== bz
    ) {
      this.breakingBlockPos = new THREE.Vector3(bx, by, bz);
      this.breakingProgress = 0;

      const { breakDuration } = calculateBlockBreaking(
        blockId,
        this.activeHeldItem,
      );
      this.breakingDuration = Math.max(0.08, breakDuration);
    }

    // Progress breaking
    this.breakingProgress += dt / this.breakingDuration;

    // Periodic crack tick sound
    const now = performance.now();
    if (now - this.lastCrunchSoundTime > 240) {
      sound.playFootstep(); // Small crunch sound
      this.lastCrunchSoundTime = now;
    }

    if (this.onBreakingProgressChange) {
      this.onBreakingProgressChange(
        Math.min(1.0, this.breakingProgress),
        this.breakingBlockPos,
      );
    }

    // Completed breaking!
    if (this.breakingProgress >= 1.0) {
      this.completeBlockBreak(bx, by, bz, blockId);
    }
  }

  public touchDigRequested: boolean = false;

  private completeBlockBreak(
    x: number,
    y: number,
    z: number,
    blockId: number,
  ): void {
    const { canHarvest, dropItemId, dropCount } = calculateBlockBreaking(
      blockId,
      this.activeHeldItem,
    );

    // Destroy block
    this.chunkManager.setBlockGlobal(x, y, z, BLOCK.AIR, this.scene);
    sound.playBlockBreak();
    this.netManager?.sendBlockEdit(x, y, z, BLOCK.AIR);

    // Trigger tool durability degradation
    if (this.activeHeldItem && this.onToolUsed) {
      this.onToolUsed();
    }

    // Trigger 3D drop if harvestable
    if (this.onBlockBroken) {
      this.onBlockBroken(
        blockId,
        new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5),
        canHarvest,
        dropItemId,
        dropCount,
      );
    }

    this.resetBreaking();
  }

  public resetBreaking(): void {
    this.breakingBlockPos = null;
    this.breakingProgress = 0;
    if (this.onBreakingProgressChange) {
      this.onBreakingProgressChange(0, null);
    }
  }

  /**
   * Raycasting interaction for Mouse Click:
   * LMB (0): Start break or instant break with high-tier tool (e.g. diamond pickaxe)
   * RMB (2): Place selected voxel block in front of targeted face
   */
  public handleMouseInteraction(button: number, selectedBlock: number): void {
    if (!this.controls.isLocked) return;

    if (button === 0) {
      // First check if player attacks a mob within melee reach!
      if (this.onAttackMobRequest && this.onAttackMobRequest()) {
        return; // Hit a mob, don't mine block behind it!
      }
    } else if (button === 2) {
      // First check if player right-clicks a friendly Villager
      if (this.onInteractMobRequest && this.onInteractMobRequest()) {
        return;
      }

      // Check if player is holding food and wants to eat
      if (this.activeHeldItem) {
        const itemDef = ITEM_REGISTRY[this.activeHeldItem.id];
        if (itemDef && itemDef.type === "food") {
          if (this.onEatFood) {
            this.onEatFood(this.activeHeldItem);
            return;
          }
        }
      }
    }

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);

    const hit = this.chunkManager.raycast(
      raycaster.ray.origin,
      raycaster.ray.direction,
      7,
    );

    if (hit) {
      if (button === 0) {
        // Left-click:
        const blockId = this.chunkManager.getBlockGlobal(
          hit.blockPos.x,
          hit.blockPos.y,
          hit.blockPos.z,
        );
        if (blockId !== BLOCK.AIR) {
          const { breakDuration } = calculateBlockBreaking(
            blockId,
            this.activeHeldItem,
          );
          // If breakDuration is very low (diamond pickaxe or instant block), break immediately!
          if (breakDuration <= 0.15) {
            this.completeBlockBreak(
              hit.blockPos.x,
              hit.blockPos.y,
              hit.blockPos.z,
              blockId,
            );
          } else {
            this.isLMBDown = true;
            this.breakingBlockPos = new THREE.Vector3(
              hit.blockPos.x,
              hit.blockPos.y,
              hit.blockPos.z,
            );
            this.breakingDuration = breakDuration;
            this.breakingProgress = 0.05;
          }
        }
      } else if (button === 2) {
        // Check if target block is an Oak Door (toggle Open/Closed)
        const targetBlockId = this.chunkManager.getBlockGlobal(
          hit.blockPos.x,
          hit.blockPos.y,
          hit.blockPos.z,
        );

        if (targetBlockId === BLOCK.DOOR || targetBlockId === BLOCK.DOOR_OPEN) {
          const newBlockId =
            targetBlockId === BLOCK.DOOR ? BLOCK.DOOR_OPEN : BLOCK.DOOR;
          const hx = hit.blockPos.x;
          const hy = hit.blockPos.y;
          const hz = hit.blockPos.z;

          // Toggle the targeted door block
          this.chunkManager.setBlockGlobal(hx, hy, hz, newBlockId, this.scene);
          this.netManager?.sendBlockEdit(hx, hy, hz, newBlockId);

          // Synchronously toggle connected upper or lower door block
          const aboveBlock = this.chunkManager.getBlockGlobal(hx, hy + 1, hz);
          if (aboveBlock === BLOCK.DOOR || aboveBlock === BLOCK.DOOR_OPEN) {
            this.chunkManager.setBlockGlobal(
              hx,
              hy + 1,
              hz,
              newBlockId,
              this.scene,
            );
            this.netManager?.sendBlockEdit(hx, hy + 1, hz, newBlockId);
          }
          const belowBlock = this.chunkManager.getBlockGlobal(hx, hy - 1, hz);
          if (belowBlock === BLOCK.DOOR || belowBlock === BLOCK.DOOR_OPEN) {
            this.chunkManager.setBlockGlobal(
              hx,
              hy - 1,
              hz,
              newBlockId,
              this.scene,
            );
            this.netManager?.sendBlockEdit(hx, hy - 1, hz, newBlockId);
          }

          sound.playDoor(newBlockId === BLOCK.DOOR_OPEN);
          return;
        }

        // Check if target block is a Crafting Table block
        if (
          targetBlockId === BLOCK.CRAFTING_TABLE &&
          this.onOpenCraftingTable
        ) {
          this.onOpenCraftingTable();
          return;
        }

        // Right-click: Place block (ensure not clipping inside player AABB)
        const px = hit.placePos.x;
        const py = hit.placePos.y;
        const pz = hit.placePos.z;

        const halfW = this.playerWidth / 2;
        const playerMinX = this.position.x - halfW;
        const playerMaxX = this.position.x + halfW;
        const playerMinY = this.position.y;
        const playerMaxY = this.position.y + this.playerHeight;
        const playerMinZ = this.position.z - halfW;
        const playerMaxZ = this.position.z + halfW;

        // Check if placed block collides with player box
        const intersectsPlayer =
          px + 1 > playerMinX &&
          px < playerMaxX &&
          py + 1 > playerMinY &&
          py < playerMaxY &&
          pz + 1 > playerMinZ &&
          pz < playerMaxZ;

        if (!intersectsPlayer && selectedBlock !== BLOCK.AIR) {
          this.chunkManager.setBlockGlobal(
            px,
            py,
            pz,
            selectedBlock,
            this.scene,
          );
          sound.playBlockPlace();
          this.netManager?.sendBlockEdit(px, py, pz, selectedBlock);

          if (this.onBlockPlaced) {
            this.onBlockPlaced(selectedBlock, new THREE.Vector3(px, py, pz));
          }
        }
      }
    }
  }

  /**
   * Applies horizontal and vertical knockback to player from damage source
   */
  public applyKnockback(kx: number, ky: number, kz: number): void {
    this.velocity.x += kx;
    this.velocity.y = Math.max(this.velocity.y, 0) + ky;
    this.velocity.z += kz;
  }
}
