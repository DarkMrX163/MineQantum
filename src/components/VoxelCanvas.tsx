import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ChunkManager } from '../engine/ChunkManager';
import { FirstPersonController } from '../engine/FirstPersonController';
import { createTextureAtlas } from '../engine/TextureAtlas';
import { createWaterShaderMaterial } from '../engine/WaterShader';
import { BlockId, ChunkStats } from '../engine/types';
import { NetworkManager } from '../engine/NetworkManager';
import { MobManager } from '../engine/MobManager';
import { sound } from '../engine/AudioEngine';
import { TouchControls } from './TouchControls';
import { MousePointer } from 'lucide-react';
import { DroppedItemManager, SlotItem, ITEM_REGISTRY } from '../engine/InventorySystem';

interface VoxelCanvasProps {
  selectedBlock: BlockId;
  heldItem: SlotItem | null;
  onBlockPlaced?: () => void;
  onToolUsed?: () => void;
  onCollectDrop?: (item: SlotItem) => boolean;
  onTakeDamage?: (amount: number, reason: string) => void;
  onSprintChange?: (isSprinting: boolean) => void;
  canSprint?: boolean;
  onEatFood?: (item: SlotItem) => void;
  onOpenCraftingTable?: () => void;
  respawnTrigger?: number;
  deathScatterTrigger?: { items: (SlotItem | null)[]; timestamp: number } | null;
  isFlyMode: boolean;
  renderDistance: number;
  naiveMode: boolean;
  onStatsUpdate: (stats: ChunkStats) => void;
  onFpsUpdate: (fps: number) => void;
  onPointerLockChange: (isLocked: boolean) => void;
  pointerLockRequested: boolean;
  onResetPointerLockRequest: () => void;
  regenerateTrigger: number;
  onAtlasCanvasReady: (canvas: HTMLCanvasElement) => void;
  onMultiplayerStatsUpdate?: (onlinePlayers: number) => void;
  isNight?: boolean;
  enableAO?: boolean;
  spawnMobTrigger?: { type: 'steve' | 'zombie' | 'creeper'; timestamp: number } | null;
  clearMobsTrigger?: number;
  onMobCountUpdate?: (count: number) => void;
}

export const VoxelCanvas: React.FC<VoxelCanvasProps> = ({
  selectedBlock,
  heldItem,
  onBlockPlaced,
  onToolUsed,
  onCollectDrop,
  onTakeDamage,
  onSprintChange,
  canSprint = true,
  onEatFood,
  onOpenCraftingTable,
  respawnTrigger = 0,
  deathScatterTrigger,
  isFlyMode,
  renderDistance,
  naiveMode,
  onStatsUpdate,
  onFpsUpdate,
  onPointerLockChange,
  pointerLockRequested,
  onResetPointerLockRequest,
  regenerateTrigger,
  onAtlasCanvasReady,
  onMultiplayerStatsUpdate,
  isNight = false,
  enableAO = true,
  spawnMobTrigger,
  clearMobsTrigger,
  onMobCountUpdate,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  const controllerRef = useRef<FirstPersonController | null>(null);
  const chunkManagerRef = useRef<ChunkManager | null>(null);
  const mobManagerRef = useRef<MobManager | null>(null);
  const dropManagerRef = useRef<DroppedItemManager | null>(null);
  const highlightMeshRef = useRef<THREE.Mesh | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const dirLightRef = useRef<THREE.DirectionalLight | null>(null);
  const ambientLightRef = useRef<THREE.HemisphereLight | null>(null);
  const [breakingProgress, setBreakingProgress] = useState<number>(0);
  const [isLocked, setIsLocked] = useState<boolean>(false);

  const selectedBlockRef = useRef<BlockId>(selectedBlock);
  useEffect(() => {
    selectedBlockRef.current = selectedBlock;
  }, [selectedBlock]);

  useEffect(() => {
    if (!mountRef.current) return;

    // 1. Initialize Scene & Fog
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const initialBgColor = isNight ? '#0b0e1a' : '#78a7ff';
    scene.background = new THREE.Color(initialBgColor);
    scene.fog = new THREE.FogExp2(initialBgColor, 0.007);

    // 2. Initialize Camera
    const camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      500
    );

    // 3. Initialize WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    mountRef.current.appendChild(renderer.domElement);

    // 4. Studio Lighting
    const ambientLight = new THREE.HemisphereLight('#87ceeb', '#3d2817', isNight ? 0.2 : 0.65);
    ambientLightRef.current = ambientLight;
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight('#fff4e0', isNight ? 0.2 : 1.25);
    dirLightRef.current = dirLight;
    dirLight.position.set(60, 100, 40);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 250;
    const shadowD = 60;
    dirLight.shadow.camera.left = -shadowD;
    dirLight.shadow.camera.right = shadowD;
    dirLight.shadow.camera.top = shadowD;
    dirLight.shadow.camera.bottom = -shadowD;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    // 5. Texture Atlas & MeshLambertMaterial (NearestFilter)
    const { texture: atlasTexture, canvas: atlasCanvas } = createTextureAtlas();
    atlasTexture.magFilter = THREE.NearestFilter;
    atlasTexture.minFilter = THREE.NearestFilter;
    onAtlasCanvasReady(atlasCanvas);

    const chunkMaterial = new THREE.MeshLambertMaterial({
      map: atlasTexture,
      side: THREE.FrontSide,
      vertexColors: true,
      transparent: true,
      alphaTest: 0.1,
    });

    const waterMaterial = createWaterShaderMaterial(atlasTexture);

    // 6. ChunkManager
    const chunkManager = new ChunkManager(chunkMaterial);
    chunkManagerRef.current = chunkManager;

    // 7. FirstPersonController
    const controller = new FirstPersonController(
      camera,
      renderer.domElement,
      chunkManager,
      scene
    );
    controller.position.set(8, 28, 8);
    controllerRef.current = controller;

    // Initialize NetworkManager for WebSockets, position throttling & remote player lerping
    const netManager = new NetworkManager(scene, chunkManager);
    controller.netManager = netManager;

    // React to mob attacks and explosion knockback
    netManager.onLocalPlayerDamaged = (damage, knockback) => {
      sound.playHurt();
      controller.applyKnockback(knockback.x, knockback.y, knockback.z);
      onTakeDamage?.(damage, 'mob');
    };

    netManager.onExplosionEffect = (x, y, z, radius) => {
      sound.playBlockBreak();
      const dist = controller.position.distanceTo(new THREE.Vector3(x, y, z));
      if (dist < 15) {
        controller.velocity.y += 3.5 * (1.0 - dist / 15);
      }
    };

    controller.controls.addEventListener('lock', () => {
      setIsLocked(true);
      onPointerLockChange(true);
    });
    controller.controls.addEventListener('unlock', () => {
      setIsLocked(false);
      onPointerLockChange(false);
    });

    // Build initial world around player
    chunkManager.updateWorldAroundPlayer(
      controller.position.x,
      controller.position.z,
      renderDistance,
      scene,
      naiveMode
    );

    // Position player safely on the top surface block at spawn (x: 8, z: 8) without fall damage
    let groundY = 20;
    for (let y = 62; y >= 1; y--) {
      if (chunkManager.getBlockGlobal(8, y, 8) !== 0) {
        groundY = y + 1;
        break;
      }
    }
    controller.position.set(8, groundY, 8);
    controller.fallPeakY = groundY;

    // 8. Initialize MobManager with classic Minecraft mobs (Zombie, Creeper, Steve)
    const mobManager = new MobManager(scene, chunkManager);
    mobManagerRef.current = mobManager;

    // 8.5 Initialize DroppedItemManager for 3D item drops
    const dropManager = new DroppedItemManager(scene, chunkManager);
    dropManagerRef.current = dropManager;

    // Wire controller block breaking, durability, combat, and 3D drops
    controller.onBlockBroken = (blockId, pos, canHarvest, dropItemId, dropCount) => {
      if (canHarvest && dropItemId) {
        dropManager.spawnDrop(
          { id: dropItemId, count: dropCount, maxStack: 64 },
          pos
        );
      }
    };
    controller.onToolUsed = () => {
      onToolUsed?.();
    };
    controller.onBlockPlaced = () => {
      onBlockPlaced?.();
    };
    controller.onBreakingProgressChange = (prog) => {
      setBreakingProgress(prog);
    };

    // Damage from environmental hazards (fall, lava)
    controller.onTakeDamage = (amount, reason) => {
      sound.playHurt();
      onTakeDamage?.(amount, reason);
    };

    // Sprint state callback (for hunger consumption)
    controller.onSprintStateChange = (isSprinting) => {
      onSprintChange?.(isSprinting);
    };

    // Food eating callback
    controller.onEatFood = (item) => {
      onEatFood?.(item);
    };

    // Open Crafting Table callback
    controller.onOpenCraftingTable = () => {
      onOpenCraftingTable?.();
    };

    // Player melee attack against mobs in front of crosshair
    controller.onAttackMobRequest = () => {
      const heldDef = heldItem ? ITEM_REGISTRY[heldItem.id] : null;
      const dmg = heldDef?.attackDamage || 1;
      const res = mobManager.hitMobAtRay(camera, dmg);
      if (res.hit) {
        sound.playHurt();
        onToolUsed?.();
        return true;
      }
      return false;
    };

    // Mob attacking player (Zombie melee & Creeper explosion)
    mobManager.onPlayerAttackedByMob = (damage, knockback) => {
      sound.playHurt();
      controller.applyKnockback(knockback.x, knockback.y, knockback.z);
      onTakeDamage?.(damage, 'mob');
    };

    // Mob loot drop on death
    mobManager.onMobKilled = (type, pos) => {
      if (type === 'zombie') {
        dropManager.spawnDrop({ id: 'cooked_beef', count: 1, maxStack: 64 }, pos);
      } else if (type === 'creeper') {
        dropManager.spawnDrop({ id: 'coal', count: 2, maxStack: 64 }, pos);
      }
    };

    // Spawn friendly Steve nearby and hostile mobs at a safe distance (~25 blocks)
    mobManager.spawnMob('steve', new THREE.Vector3(12, groundY, 12));
    mobManager.spawnMob('zombie', new THREE.Vector3(30, groundY, 30));
    mobManager.spawnMob('creeper', new THREE.Vector3(-18, groundY, 22));
    if (onMobCountUpdate) {
      onMobCountUpdate(mobManager.mobs.size);
    }

    // 9. Targeted Voxel Wireframe Highlight
    const boxGeo = new THREE.BoxGeometry(1.01, 1.01, 1.01);
    const boxMat = new THREE.MeshBasicMaterial({
      color: 0x00ffcc,
      wireframe: true,
      transparent: true,
      opacity: 0.85,
    });
    const highlightMesh = new THREE.Mesh(boxGeo, boxMat);
    highlightMesh.visible = false;
    scene.add(highlightMesh);
    highlightMeshRef.current = highlightMesh;

    // Mouse Interaction
    const handleMouseDown = (e: MouseEvent) => {
      if (controller.isLocked()) {
        controller.handleMouseInteraction(e.button, selectedBlockRef.current);
      }
    };
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();

    renderer.domElement.addEventListener('mousedown', handleMouseDown);
    renderer.domElement.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('contextmenu', handleContextMenu);

    // Resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // Animation Tick Loop
    let animId: number;
    let frameCount = 0;
    let fpsTimer = performance.now();
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const elapsedTime = clock.getElapsedTime();
      waterMaterial.uniforms.u_time.value = elapsedTime;
      const now = performance.now();

      // FPS
      frameCount++;
      if (now - fpsTimer >= 1000) {
        onFpsUpdate(frameCount);
        frameCount = 0;
        fpsTimer = now;
      }

      // Update controller physics
      controller.update(delta);

      // Interpolate remote players smooth movement
      netManager.update(delta);

      // Update active mobs (Steve, Zombie, Creeper) wandering AI & walk animations
      mobManager.update(delta, controller.position);

      // Update 3D Dropped Items (physics, rotation, magnetic attraction & collection)
      dropManager.update(delta, controller.position, (item) => {
        return onCollectDrop ? onCollectDrop(item) : true;
      });

      // Dynamic Chunk Loading
      chunkManager.updateWorldAroundPlayer(
        controller.position.x,
        controller.position.z,
        renderDistance,
        scene,
        naiveMode
      );

      onStatsUpdate(chunkManager.getStats());
      if (onMultiplayerStatsUpdate) {
        onMultiplayerStatsUpdate(netManager.connectedPlayerCount);
      }

      // Update Highlight wireframe box & Breaking Crack visual
      if (controller.isLocked()) {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

        const hit = chunkManager.raycast(
          raycaster.ray.origin,
          raycaster.ray.direction,
          7
        );

        if (hit) {
          highlightMesh.position.set(
            hit.blockPos.x + 0.5,
            hit.blockPos.y + 0.5,
            hit.blockPos.z + 0.5
          );

          // Visual crack effect: scale and color transition while breaking
          if (controller.breakingProgress > 0) {
            const scale = 1.01 + controller.breakingProgress * 0.02;
            highlightMesh.scale.set(scale, scale, scale);
            (highlightMesh.material as THREE.MeshBasicMaterial).color.setHex(
              controller.breakingProgress > 0.6 ? 0xef4444 : 0xf97316
            );
          } else {
            highlightMesh.scale.set(1.0, 1.0, 1.0);
            (highlightMesh.material as THREE.MeshBasicMaterial).color.setHex(0x00ffcc);
          }

          highlightMesh.visible = true;
        } else {
          highlightMesh.visible = false;
        }
      } else {
        highlightMesh.visible = false;
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousedown', handleMouseDown);
      renderer.domElement.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('contextmenu', handleContextMenu);
      if (mountRef.current) {
        mountRef.current.innerHTML = '';
      }
      renderer.dispose();
    };
  }, [regenerateTrigger]);

  // Request PointerLock effect
  useEffect(() => {
    if (pointerLockRequested && controllerRef.current) {
      controllerRef.current.lock();
      onResetPointerLockRequest();
    }
  }, [pointerLockRequested]);

  // Sync Fly Mode state
  useEffect(() => {
    if (controllerRef.current) {
      controllerRef.current.isFlying = isFlyMode;
    }
  }, [isFlyMode]);

  // Dynamic Day / Night Lighting Transition
  useEffect(() => {
    if (sceneRef.current && chunkManagerRef.current) {
      const bgColor = isNight ? '#0b0e1a' : '#78a7ff';
      sceneRef.current.background = new THREE.Color(bgColor);
      if (sceneRef.current.fog) {
        sceneRef.current.fog.color.set(bgColor);
      }
      if (dirLightRef.current) {
        dirLightRef.current.intensity = isNight ? 0.2 : 1.25;
      }
      if (ambientLightRef.current) {
        ambientLightRef.current.intensity = isNight ? 0.2 : 0.65;
      }
      chunkManagerRef.current.setSkyIntensity(isNight ? 0.15 : 1.0, sceneRef.current);
      controllerRef.current?.netManager?.sendSetNight(isNight);
    }
  }, [isNight]);

  // Sync active held item into controller for breaking speeds & tools
  useEffect(() => {
    if (controllerRef.current) {
      controllerRef.current.activeHeldItem = heldItem;
    }
  }, [heldItem]);

  // Dynamic AO Shading Toggle
  useEffect(() => {
    if (sceneRef.current && chunkManagerRef.current) {
      chunkManagerRef.current.setEnableAO(enableAO, sceneRef.current);
    }
  }, [enableAO]);

  // Spawn Mob Event
  useEffect(() => {
    if (spawnMobTrigger && mobManagerRef.current && controllerRef.current) {
      const dir = new THREE.Vector3();
      controllerRef.current.camera.getWorldDirection(dir);
      dir.y = 0;
      dir.normalize();
      const spawnPos = controllerRef.current.position.clone().add(dir.multiplyScalar(3.5));
      mobManagerRef.current.spawnMob(spawnMobTrigger.type, spawnPos);
      controllerRef.current.netManager?.sendSpawnMob(spawnMobTrigger.type, spawnPos.x, spawnPos.y, spawnPos.z);
      if (onMobCountUpdate) {
        onMobCountUpdate(mobManagerRef.current.mobs.size);
      }
    }
  }, [spawnMobTrigger]);

  // Clear Mobs Event
  useEffect(() => {
    if (clearMobsTrigger && mobManagerRef.current) {
      mobManagerRef.current.clearAllMobs();
      controllerRef.current?.netManager?.sendClearMobs();
      if (onMobCountUpdate) {
        onMobCountUpdate(0);
      }
    }
  }, [clearMobsTrigger]);

  // Handle Respawn: teleport player to spawn position (8, 28, 8) and zero velocities
  useEffect(() => {
    if (respawnTrigger > 0 && controllerRef.current) {
      controllerRef.current.position.set(8, 28, 8);
      controllerRef.current.velocity.set(0, 0, 0);
      controllerRef.current.fallPeakY = 28;
      controllerRef.current.resetBreaking();
      controllerRef.current.lock();
    }
  }, [respawnTrigger]);

  // Handle Death: scatter dropped items at the player's death position
  useEffect(() => {
    if (deathScatterTrigger && dropManagerRef.current && controllerRef.current) {
      const deathPos = controllerRef.current.position.clone();
      for (const item of deathScatterTrigger.items) {
        if (item && item.count > 0) {
          dropManagerRef.current.spawnDrop(
            { ...item },
            deathPos.clone().add(
              new THREE.Vector3(
                (Math.random() - 0.5) * 2.0,
                0.5 + Math.random() * 0.8,
                (Math.random() - 0.5) * 2.0
              )
            )
          );
        }
      }
    }
  }, [deathScatterTrigger]);

  // Sync canSprint status (disabled when starving <= 6 hunger)
  useEffect(() => {
    if (controllerRef.current) {
      controllerRef.current.canSprint = canSprint;
    }
  }, [canSprint]);

  return (
    <div className="w-full h-full relative">
      <div ref={mountRef} className="w-full h-full cursor-crosshair" />

      {/* Crosshair & Breaking Radial Progress HUD */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30 flex items-center justify-center">
        {/* Minimalist White Crosshair */}
        <div className="relative flex items-center justify-center">
          <div className="w-4 h-0.5 bg-white/80 rounded-full shadow-[0_0_2px_rgba(0,0,0,0.8)]" />
          <div className="h-4 w-0.5 bg-white/80 rounded-full shadow-[0_0_2px_rgba(0,0,0,0.8)] absolute" />

          {/* Radial Breaking Progress Ring (shows when breaking block) */}
          {breakingProgress > 0 && (
            <svg
              className="absolute w-12 h-12 -rotate-90 pointer-events-none drop-shadow-md"
              viewBox="0 0 40 40"
            >
              {/* Background circle track */}
              <circle
                cx="20"
                cy="20"
                r="16"
                stroke="rgba(0,0,0,0.4)"
                strokeWidth="3.5"
                fill="none"
              />
              {/* Progress active circle */}
              <circle
                cx="20"
                cy="20"
                r="16"
                stroke={breakingProgress > 0.7 ? '#ef4444' : '#f59e0b'}
                strokeWidth="3.5"
                fill="none"
                strokeDasharray={100}
                strokeDashoffset={100 - Math.min(100, breakingProgress * 100)}
                strokeLinecap="round"
                className="transition-all duration-75"
              />
            </svg>
          )}
        </div>
      </div>

      {/* Interactive Click-to-Play Mouse Capture Banner */}
      {!isLocked && (
        <div
          onClick={() => controllerRef.current?.lock()}
          className="absolute top-20 left-1/2 -translate-x-1/2 z-35 cursor-pointer bg-slate-950/85 hover:bg-slate-900/90 border-2 border-emerald-500/80 text-white px-6 py-3 rounded-2xl shadow-[0_0_30px_rgba(16,185,129,0.3)] backdrop-blur-md flex items-center gap-3 animate-pulse transition select-none"
        >
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-400 shrink-0">
            <MousePointer className="w-5 h-5" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-sm font-bold text-emerald-300">Кликните по экрану</span>
            <span className="text-xs text-slate-300">Включить обзор мышью & управление (ESC — выключить)</span>
          </div>
        </div>
      )}

      <TouchControls
        controller={controllerRef.current}
        selectedBlock={selectedBlock}
        onRequestPointerLock={() => {
          if (controllerRef.current) {
            controllerRef.current.lock();
          }
        }}
      />
    </div>
  );
};
