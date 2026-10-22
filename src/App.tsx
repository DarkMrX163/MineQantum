/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { VoxelCanvas } from './components/VoxelCanvas';
import { WorldControls } from './components/WorldControls';
import { CodeViewer } from './components/CodeViewer';
import { AtlasViewer } from './components/AtlasViewer';
import { Hotbar } from './components/Hotbar';
import { InventoryModal } from './components/InventoryModal';
import { SurvivalHUD } from './components/SurvivalHUD';
import { DeathScreen } from './components/DeathScreen';
import { JoinModal } from './components/JoinModal';
import { BLOCK, BlockId, ChunkStats } from './engine/types';
import { SlotItem, ITEM_REGISTRY, ArmorSlotsState, calculateTotalArmorPoints } from './engine/InventorySystem';
import { PotionsAndEnchanting, ActivePotionEffect } from './engine/PotionsAndEnchanting';
import { sound } from './engine/AudioEngine';
import { PlayerTransform } from './components/MiniMap';

export default function App() {
  const [selectedBlock, setSelectedBlock] = useState<BlockId>(BLOCK.GRASS);
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [pointerLockRequested, setPointerLockRequested] = useState(false);
  const [isFlyMode, setIsFlyMode] = useState(false);
  const [renderDistance, setRenderDistance] = useState(3);
  const [naiveMode, setNaiveMode] = useState(false);
  const [regenerateTrigger, setRegenerateTrigger] = useState(0);
  const [activeTab, setActiveTab] = useState<'game' | 'code' | 'atlas'>('game');
  const [fps, setFps] = useState(60);
  const [onlinePlayers, setOnlinePlayers] = useState(1);
  const [isNight, setIsNight] = useState(false);
  const [enableAO, setEnableAO] = useState(true);
  const [atlasCanvas, setAtlasCanvas] = useState<HTMLCanvasElement | null>(null);
  const [mobCount, setMobCount] = useState(3);
  const [weather, setWeather] = useState<'sunny' | 'rain' | 'thunderstorm' | 'snow'>('sunny');
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [claimStatus, setClaimStatus] = useState<string | null>(null);
  const [activeEmote, setActiveEmote] = useState<'wave' | 'dance' | 'sit' | 'swim' | 'none'>('none');
  const [spawnMobTrigger, setSpawnMobTrigger] = useState<{
    type: 'steve' | 'zombie' | 'creeper' | 'skeleton' | 'enderman' | 'cow' | 'sheep' | 'pig' | 'villager';
    timestamp: number;
  } | null>(null);
  const [clearMobsTrigger, setClearMobsTrigger] = useState(0);

  // --- Mini-game Events State ---
  const [activeEvent, setActiveEvent] = useState<any>(null);
  const [eventNotification, setEventNotification] = useState<string | null>(null);
  const [triggerEvent, setTriggerEvent] = useState<any>(null);

  const handleTriggerEvent = (type: any) => {
    setTriggerEvent(type);
    setTimeout(() => setTriggerEvent(null), 100);
  };

  const handleEventNotification = (msg: string) => {
    setEventNotification(msg);
    setTimeout(() => setEventNotification(null), 4000);
  };

  // --- Survival Metrics (20 HP / 10 Hearts, 20 Hunger / 10 Drumsticks) ---
  const [health, setHealth] = useState(20);
  const [hunger, setHunger] = useState(20);
  const [isSprinting, setIsSprinting] = useState(false);
  const [damageFlashTrigger, setDamageFlashTrigger] = useState(0);

  // --- Real-time Player Transform for Mini-Map ---
  const [playerTransform, setPlayerTransform] = useState<PlayerTransform>({
    x: 8,
    y: 20,
    z: 8,
    yaw: 0,
    dirX: 0,
    dirZ: -1,
  });
  const [isDead, setIsDead] = useState(false);
  const [deathReason, setDeathReason] = useState('Вы погибли!');
  const [respawnTrigger, setRespawnTrigger] = useState(0);
  const [deathScatterTrigger, setDeathScatterTrigger] = useState<{
    items: (SlotItem | null)[];
    timestamp: number;
  } | null>(null);

  // --- Player Nickname & Join Modal State ---
  const [nickname, setNickname] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const queryNick = params.get('nick') || params.get('name');
      if (queryNick && queryNick.trim().length >= 2) {
        return queryNick.trim().slice(0, 16);
      }
      const saved = localStorage.getItem('mc_nickname');
      if (saved && saved.trim().length >= 2) {
        return saved.trim().slice(0, 16);
      }
    }
    return '';
  });

  const [hasEnteredWorld, setHasEnteredWorld] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return !!sessionStorage.getItem('mc_nickname_confirmed');
    }
    return false;
  });

  const [isJoinModalOpen, setIsJoinModalOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return !sessionStorage.getItem('mc_nickname_confirmed');
    }
    return true;
  });

  const [remotePlayers, setRemotePlayers] = useState<
    { id: string; name: string; x: number; y: number; z: number; color: string }[]
  >([]);

  const [cameraMode, setCameraMode] = useState<'first' | 'third-back' | 'third-front'>('first');

  const handleJoinWorld = useCallback((chosenNick: string) => {
    const clean = chosenNick.trim().slice(0, 16) || 'Player';
    setNickname(clean);
    localStorage.setItem('mc_nickname', clean);
    sessionStorage.setItem('mc_nickname_confirmed', 'true');
    setIsJoinModalOpen(false);
    setHasEnteredWorld(true);
    handleEventNotification(`Добро пожаловать в мир, ${clean}!`);
    setPointerLockRequested(true);
  }, []);

  const handleShareLink = useCallback(() => {
    sound.playItemPickup();
    const cleanNick = nickname || 'Player';
    const url = new URL(window.location.href);
    url.searchParams.set('nick', cleanNick);
    navigator.clipboard.writeText(url.toString());
    handleEventNotification('Ссылка скопирована! Отправьте её другу, чтобы играть вместе.');
  }, [nickname]);

  // Sprinting requires hunger > 6 (Minecraft mechanic)
  const canSprint = hunger > 6;

  // --- Inventory & Crafting State ---
  const [hotbar, setHotbar] = useState<(SlotItem | null)[]>([
    { id: 'wooden_pickaxe', count: 1, durability: 59, maxDurability: 59, maxStack: 1 },
    { id: 'wooden_axe', count: 1, durability: 59, maxDurability: 59, maxStack: 1 },
    { id: 'torch', count: 4, maxStack: 64 },
    null,
    null,
    null,
    null,
    null,
    null,
  ]);

  const [inventory, setInventory] = useState<(SlotItem | null)[]>(
    Array(27).fill(null)
  );

  const [armorSlots, setArmorSlots] = useState<ArmorSlotsState>({
    helmet: { id: 'iron_helmet', count: 1, durability: 165, maxDurability: 165, maxStack: 1 },
    chestplate: { id: 'iron_chestplate', count: 1, durability: 240, maxDurability: 240, maxStack: 1 },
    leggings: null,
    boots: null,
  });

  const totalArmorPoints = calculateTotalArmorPoints(armorSlots);

  const [selectedHotbarIndex, setSelectedHotbarIndex] = useState(0);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [initialModalTab, setInitialModalTab] = useState<'crafting' | 'enchanting' | 'brewing'>('crafting');

  const [chestState, setChestState] = useState<{
    x: number;
    y: number;
    z: number;
    items: (SlotItem | null)[];
    onUpdateChest: (items: (SlotItem | null)[]) => void;
  } | null>(null);

  const [activePotionEffects, setActivePotionEffects] = useState<ActivePotionEffect[]>([]);
  const potionsAndEnchantingRef = useRef(new PotionsAndEnchanting());

  const handleOpenChest = useCallback(
    (chestData: {
      x: number;
      y: number;
      z: number;
      items: (SlotItem | null)[];
      onUpdateChest: (items: (SlotItem | null)[]) => void;
    }) => {
      setChestState(chestData);
      setIsInventoryOpen(true);
    },
    []
  );

  const handleOpenEnchantingTable = useCallback(() => {
    setChestState(null);
    setInitialModalTab('enchanting');
    setIsInventoryOpen(true);
  }, []);

  const handleOpenBrewingStand = useCallback(() => {
    setChestState(null);
    setInitialModalTab('brewing');
    setIsInventoryOpen(true);
  }, []);

  const handleOpenCraftingTable = useCallback(() => {
    setChestState(null);
    setInitialModalTab('crafting');
    setIsInventoryOpen(true);
  }, []);

  const handleDrinkPotion = useCallback(
    (potionId: string) => {
      const rawId = potionId.replace('potion_', '') as any;
      potionsAndEnchantingRef.current.applyPotion(rawId, (heal) => {
        setHealth((prev) => Math.min(20, prev + heal));
      });
      sound.playPop();
      handleEventNotification(`🧪 Вы выпили зелье!`);

      setHotbar((prev) => {
        const copy = [...prev];
        const slot = copy[selectedHotbarIndex];
        if (slot && slot.id === potionId) {
          const newCount = slot.count - 1;
          copy[selectedHotbarIndex] = newCount > 0 ? { ...slot, count: newCount } : null;
        }
        return copy;
      });
    },
    [selectedHotbarIndex]
  );

  // Active Potion tick loop
  useEffect(() => {
    const timer = setInterval(() => {
      const effects = potionsAndEnchantingRef.current.update(0.5, (heal) => {
        setHealth((prev) => Math.min(20, prev + heal));
      });
      setActivePotionEffects([...potionsAndEnchantingRef.current.activeEffects]);
    }, 500);

    return () => clearInterval(timer);
  }, []);

  // Synchronous refs for accurate, atomic item collection without duplicate race conditions
  const hotbarRef = useRef(hotbar);
  hotbarRef.current = hotbar;
  const inventoryRef = useRef(inventory);
  inventoryRef.current = inventory;

  // Computed held item and placing block
  const heldItem = hotbar[selectedHotbarIndex];
  const heldDef = heldItem ? ITEM_REGISTRY[heldItem.id] : null;
  const effectiveBlockToPlace: BlockId =
    heldDef?.type === 'block' && heldDef.blockId !== undefined
      ? heldDef.blockId
      : (heldItem === null ? selectedBlock : BLOCK.AIR);

  const [stats, setStats] = useState<ChunkStats>({
    loadedChunks: 0,
    totalBlocks: 0,
    renderedFaces: 0,
    totalVertices: 0,
    drawCalls: 0,
    naiveFaceCount: 0,
    cullingEfficiency: 0,
  });

  const handleStatsUpdate = useCallback((newStats: ChunkStats) => {
    setStats(newStats);
  }, []);

  const handleFpsUpdate = useCallback((newFps: number) => {
    setFps(newFps);
  }, []);

  const handleRequestPointerLock = () => {
    if (activeTab !== 'game') {
      setActiveTab('game');
    }
    setPointerLockRequested(true);
  };

  const handleSpawnMob = useCallback((type: 'steve' | 'zombie' | 'creeper' | 'skeleton' | 'enderman' | 'cow' | 'sheep' | 'pig' | 'villager') => {
    setSpawnMobTrigger({ type, timestamp: Date.now() });
  }, []);

  const handleClearMobs = useCallback(() => {
    setClearMobsTrigger((prev) => prev + 1);
  }, []);

  // Tool Durability Degradation handler
  const handleToolUsed = useCallback(() => {
    setHotbar((prev) => {
      const copy = [...prev];
      const item = copy[selectedHotbarIndex];
      if (item && item.durability !== undefined) {
        const newDurability = item.durability - 1;
        if (newDurability <= 0) {
          // Tool broke!
          sound.playBlockBreak();
          copy[selectedHotbarIndex] = null;
        } else {
          copy[selectedHotbarIndex] = { ...item, durability: newDurability };
        }
      }
      return copy;
    });
  }, [selectedHotbarIndex]);

  // Block Placed: deduct from hotbar count
  const handleBlockPlaced = useCallback(() => {
    setHotbar((prev) => {
      const copy = [...prev];
      const item = copy[selectedHotbarIndex];
      if (item) {
        const newCount = item.count - 1;
        if (newCount <= 0) {
          copy[selectedHotbarIndex] = null;
        } else {
          copy[selectedHotbarIndex] = { ...item, count: newCount };
        }
      }
      return copy;
    });
  }, [selectedHotbarIndex]);

  // 3D Item Drop collection: add to hotbar or main inventory (Minecraft style: 1 item = +1 count in stack)
  const handleCollectDrop = useCallback((dropItem: SlotItem): boolean => {
    let remainder = dropItem.count;
    if (remainder <= 0) return true;

    // Use current synchronous snapshot
    const currentHotbar = [...hotbarRef.current];
    const currentInv = [...inventoryRef.current];

    // 1. First attempt: Stack into existing matching slots in hotbar (0..8)
    for (let i = 0; i < 9 && remainder > 0; i++) {
      const slot = currentHotbar[i];
      if (slot && slot.id === dropItem.id && slot.count < slot.maxStack) {
        const addable = Math.min(remainder, slot.maxStack - slot.count);
        currentHotbar[i] = { ...slot, count: slot.count + addable };
        remainder -= addable;
      }
    }

    // 2. Second attempt: Stack into existing matching slots in main inventory (0..26)
    for (let i = 0; i < 27 && remainder > 0; i++) {
      const slot = currentInv[i];
      if (slot && slot.id === dropItem.id && slot.count < slot.maxStack) {
        const addable = Math.min(remainder, slot.maxStack - slot.count);
        currentInv[i] = { ...slot, count: slot.count + addable };
        remainder -= addable;
      }
    }

    // 3. Third attempt: If still remainder > 0, find first empty hotbar slot
    if (remainder > 0) {
      for (let i = 0; i < 9; i++) {
        if (!currentHotbar[i]) {
          currentHotbar[i] = { ...dropItem, count: remainder };
          remainder = 0;
          break;
        }
      }
    }

    // 4. Fourth attempt: If still remainder > 0, find first empty main inventory slot
    if (remainder > 0) {
      for (let i = 0; i < 27; i++) {
        if (!currentInv[i]) {
          currentInv[i] = { ...dropItem, count: remainder };
          remainder = 0;
          break;
        }
      }
    }

    // Check if any items were collected
    if (remainder < dropItem.count) {
      // Immediately update refs so subsequent collections on the same or next tick see the new state!
      hotbarRef.current = currentHotbar;
      inventoryRef.current = currentInv;
      setHotbar(currentHotbar);
      setInventory(currentInv);

      if (remainder <= 0) {
        return true; // Completely collected!
      } else {
        dropItem.count = remainder; // Partial pickup
        return false;
      }
    }

    return false; // Inventory is full
  }, []);

  const handleToggleInventory = () => {
    setIsInventoryOpen((prev) => !prev);
  };

  // --- Survival Combat & Damage Handlers ---
  const handleTakeDamage = useCallback((amount: number, reason: string) => {
    if (isDead) return;

    let effectiveDamage = amount;

    // Armor damage reduction & durability degradation for physical hits
    if (reason === 'mob' || reason === 'fall' || reason === 'explosion') {
      const currentArmorPoints = calculateTotalArmorPoints(armorSlots);
      if (currentArmorPoints > 0) {
        // Max 75% reduction at 20 armor points
        const reductionRatio = (currentArmorPoints / 20) * 0.75;
        effectiveDamage = Math.max(1, Math.round(amount * (1 - reductionRatio)));

        // Reduce durability of each equipped armor piece
        setArmorSlots((prevArmor) => {
          const nextArmor = { ...prevArmor };
          let anyBroken = false;

          (['helmet', 'chestplate', 'leggings', 'boots'] as const).forEach((slot) => {
            const item = nextArmor[slot];
            if (item) {
              const maxD = item.maxDurability || ITEM_REGISTRY[item.id]?.maxDurability || 100;
              const currentD = item.durability !== undefined ? item.durability : maxD;
              const newD = currentD - 1;

              if (newD <= 0) {
                nextArmor[slot] = null; // Armor piece broke!
                anyBroken = true;
              } else {
                nextArmor[slot] = { ...item, durability: newD, maxDurability: maxD };
              }
            }
          });

          if (anyBroken) {
            sound.playBlockBreak();
            handleEventNotification('🛡️ Ваша броня сломалась от удара!');
          }

          return nextArmor;
        });
      }
    }

    sound.playHurt();
    setDamageFlashTrigger(Date.now());

    setHealth((prevHealth) => {
      const nextHealth = Math.max(0, prevHealth - effectiveDamage);
      if (nextHealth <= 0) {
        setIsDead(true);
        let reasonText = 'Вы погибли!';
        if (reason === 'fall') reasonText = 'Разбился при падении с большой высоты';
        else if (reason === 'lava') reasonText = 'Сгорел в раскалённой лаве';
        else if (reason === 'mob') reasonText = 'Убит враждебным монстром';
        else if (reason === 'starvation') reasonText = 'Погиб от голода и истощения';
        setDeathReason(reasonText);

        // Scatter all hotbar, inventory, and armor items at death coordinates in 3D
        setHotbar((currHotbar) => {
          setInventory((currInv) => {
            setArmorSlots((currArmor) => {
              const armorItems = Object.values(currArmor).filter(Boolean);
              const allItems = [...currHotbar, ...currInv, ...armorItems].filter(Boolean);
              setDeathScatterTrigger({
                items: allItems,
                timestamp: Date.now(),
              });
              return { helmet: null, chestplate: null, leggings: null, boots: null };
            });
            return Array(27).fill(null);
          });
          return Array(9).fill(null);
        });
      }
      return nextHealth;
    });
  }, [isDead, armorSlots]);

  // Food Eating Handler: Restores hunger and removes food item
  const handleEatFood = useCallback((item: SlotItem) => {
    const itemDef = ITEM_REGISTRY[item.id];
    if (!itemDef || itemDef.type !== 'food') return;

    if (hunger >= 20 && health >= 20) return;

    const restore = itemDef.foodValue || 4;
    setHunger((prev) => Math.min(20, prev + restore));
    sound.playPop();

    setHotbar((prev) => {
      const copy = [...prev];
      const slot = copy[selectedHotbarIndex];
      if (slot && slot.id === item.id) {
        const newCount = slot.count - 1;
        if (newCount <= 0) {
          copy[selectedHotbarIndex] = null;
        } else {
          copy[selectedHotbarIndex] = { ...slot, count: newCount };
        }
      }
      return copy;
    });
  }, [hunger, health, selectedHotbarIndex]);

  // Respawn Handler: resets health, hunger, gives starter gear, and teleports player to world spawn
  const handleRespawn = useCallback(() => {
    setIsDead(false);
    setHealth(20);
    setHunger(20);
    setDeathScatterTrigger(null);

    // Provide basic starter tools on respawn, no free food
    setHotbar([
      { id: 'wooden_pickaxe', count: 1, durability: 59, maxDurability: 59, maxStack: 1 },
      { id: 'wooden_axe', count: 1, durability: 59, maxDurability: 59, maxStack: 1 },
      { id: 'torch', count: 4, maxStack: 64 },
      ...Array(6).fill(null),
    ]);
    setInventory(Array(27).fill(null));

    setRespawnTrigger((prev) => prev + 1);
    setPointerLockRequested(true);
  }, []);

  // Survival Tick Loop: Sprint hunger drain, Slow HP regen when hunger > 18, Starvation when hunger = 0
  useEffect(() => {
    const timer = setInterval(() => {
      if (isFlyMode || isDead) return;

      // Sprinting drains hunger gradually
      if (isSprinting && canSprint) {
        setHunger((prev) => Math.max(0, prev - 1));
      }

      // High hunger (> 18): regenerate health slowly (+1 HP every 5.0s)
      setHunger((currHunger) => {
        if (currHunger > 18) {
          setHealth((currHealth) => {
            if (currHealth < 20) {
              return Math.min(20, currHealth + 1);
            }
            return currHealth;
          });
        }
        return currHunger;
      });

      // Starvation: when hunger reaches 0, player takes periodic damage
      setHunger((currHunger) => {
        if (currHunger === 0) {
          handleTakeDamage(1, 'starvation');
        }
        return currHunger;
      });
    }, 5500);

    return () => clearInterval(timer);
  }, [isSprinting, canSprint, isFlyMode, isDead, handleTakeDamage]);

  return (
    <div className="w-screen h-screen bg-slate-950 text-slate-100 overflow-hidden relative select-none font-sans">
      {/* 3D WebGL Canvas Layer */}
      <div className={`w-full h-full absolute inset-0 ${activeTab === 'game' ? 'block' : 'hidden'}`}>
        <VoxelCanvas
          selectedBlock={effectiveBlockToPlace}
          heldItem={heldItem}
          onToolUsed={handleToolUsed}
          onBlockPlaced={handleBlockPlaced}
          onCollectDrop={handleCollectDrop}
          onTakeDamage={handleTakeDamage}
          onSprintChange={setIsSprinting}
          canSprint={canSprint}
          onEatFood={handleEatFood}
          onDrinkPotion={handleDrinkPotion}
          onOpenCraftingTable={handleOpenCraftingTable}
          onOpenChest={handleOpenChest}
          onOpenEnchantingTable={handleOpenEnchantingTable}
          onOpenBrewingStand={handleOpenBrewingStand}
          respawnTrigger={respawnTrigger}
          deathScatterTrigger={deathScatterTrigger}
          isFlyMode={isFlyMode}
          renderDistance={renderDistance}
          naiveMode={naiveMode}
          onStatsUpdate={handleStatsUpdate}
          onFpsUpdate={handleFpsUpdate}
          onPointerLockChange={setIsPointerLocked}
          pointerLockRequested={pointerLockRequested}
          onResetPointerLockRequest={() => setPointerLockRequested(false)}
          regenerateTrigger={regenerateTrigger}
          onAtlasCanvasReady={setAtlasCanvas}
          onMultiplayerStatsUpdate={setOnlinePlayers}
          isNight={isNight}
          enableAO={enableAO}
          spawnMobTrigger={spawnMobTrigger}
          clearMobsTrigger={clearMobsTrigger}
          onMobCountUpdate={setMobCount}
          weather={weather}
          onWeatherChange={setWeather}
          activeEmote={activeEmote}
          onClaimStatus={setClaimStatus}
          triggerEvent={triggerEvent}
          onActiveEventUpdate={setActiveEvent}
          onEventNotification={handleEventNotification}
          onPlayerTransformUpdate={setPlayerTransform}
          nickname={nickname || 'Player'}
          onRemotePlayersUpdate={setRemotePlayers}
          onCameraModeChange={setCameraMode}
        />
      </div>

      {/* Code Viewer View */}
      {activeTab === 'code' && (
        <div className="w-full h-full p-6 pt-20 max-w-6xl mx-auto overflow-auto relative z-20">
          <CodeViewer />
        </div>
      )}

      {/* Texture Atlas Inspector View */}
      {activeTab === 'atlas' && (
        <div className="w-full h-full p-6 pt-20 max-w-4xl mx-auto overflow-auto relative z-20">
          <AtlasViewer atlasCanvas={atlasCanvas} />
        </div>
      )}

      {/* 20 HP (10 Hearts) & 20 Hunger (10 Drumsticks) & 20 Armor (10 Shields) Survival HUD + MiniMap */}
      {activeTab === 'game' && !isDead && (
        <SurvivalHUD
          health={health}
          hunger={hunger}
          armorPoints={totalArmorPoints}
          isSprinting={isSprinting}
          damageFlashTrigger={damageFlashTrigger}
          activeEvent={activeEvent}
          eventNotification={eventNotification}
          playerTransform={playerTransform}
          nickname={nickname || 'Player'}
          onOpenNicknameModal={() => setIsJoinModalOpen(true)}
          remotePlayers={remotePlayers}
          onShareLink={handleShareLink}
          cameraMode={cameraMode}
          activePotionEffects={activePotionEffects}
        />
      )}

      {/* 9-Slot Hotbar (Bottom of Screen) */}
      {activeTab === 'game' && !isDead && (
        <Hotbar
          hotbar={hotbar}
          selectedIndex={selectedHotbarIndex}
          onSelectIndex={setSelectedHotbarIndex}
          onOpenInventory={handleToggleInventory}
          isInventoryOpen={isInventoryOpen}
        />
      )}

      {/* Full Minecraft-Style Death Screen (With Respawn Button & Item Scatter) */}
      <DeathScreen
        isOpen={isDead}
        deathReason={deathReason}
        onRespawn={handleRespawn}
      />

      {/* Full Minecraft-Style Inventory & Crafting Modal (Opened with Key E) */}
      <InventoryModal
        isOpen={isInventoryOpen}
        onClose={() => {
          setIsInventoryOpen(false);
          setChestState(null);
        }}
        inventory={inventory}
        hotbar={hotbar}
        armorSlots={armorSlots}
        onUpdateInventory={setInventory}
        onUpdateHotbar={setHotbar}
        onUpdateArmorSlots={setArmorSlots}
        selectedHotbarIndex={selectedHotbarIndex}
        chestState={chestState}
        initialTab={initialModalTab}
      />

      {/* Unified HUD / Control Dock */}
      <WorldControls
        stats={stats}
        selectedBlock={selectedBlock}
        onSelectBlock={setSelectedBlock}
        isPointerLocked={isPointerLocked}
        onRequestPointerLock={handleRequestPointerLock}
        isFlyMode={isFlyMode}
        onToggleFlyMode={() => setIsFlyMode(!isFlyMode)}
        onTriggerEvent={handleTriggerEvent}
        renderDistance={renderDistance}
        onChangeRenderDistance={setRenderDistance}
        naiveMode={naiveMode}
        onToggleNaiveMode={() => setNaiveMode(!naiveMode)}
        onRegenerateWorld={() => setRegenerateTrigger((prev) => prev + 1)}
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        fps={fps}
        onlinePlayers={onlinePlayers}
        isNight={isNight}
        onToggleDayNight={() => setIsNight((prev) => !prev)}
        enableAO={enableAO}
        onToggleAO={() => setEnableAO((prev) => !prev)}
        mobCount={mobCount}
        onSpawnMob={handleSpawnMob}
        onClearMobs={handleClearMobs}
        weather={weather}
        onChangeWeather={setWeather}
        activeEmote={activeEmote}
        onSelectEmote={setActiveEmote}
      />

      {/* Join / Change Nickname Modal */}
      <JoinModal
        isOpen={isJoinModalOpen}
        currentNickname={nickname}
        onJoin={handleJoinWorld}
        onClose={() => setIsJoinModalOpen(false)}
        isInitialJoin={!hasEnteredWorld}
      />
    </div>
  );
}
