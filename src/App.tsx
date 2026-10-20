/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { VoxelCanvas } from './components/VoxelCanvas';
import { WorldControls } from './components/WorldControls';
import { CodeViewer } from './components/CodeViewer';
import { AtlasViewer } from './components/AtlasViewer';
import { Hotbar } from './components/Hotbar';
import { InventoryModal } from './components/InventoryModal';
import { SurvivalHUD } from './components/SurvivalHUD';
import { DeathScreen } from './components/DeathScreen';
import { BLOCK, BlockId, ChunkStats } from './engine/types';
import { SlotItem, ITEM_REGISTRY } from './engine/InventorySystem';
import { sound } from './engine/AudioEngine';

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
    type: 'steve' | 'zombie' | 'creeper' | 'skeleton' | 'enderman' | 'cow' | 'sheep' | 'pig';
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
  const [isDead, setIsDead] = useState(false);
  const [deathReason, setDeathReason] = useState('Вы погибли!');
  const [respawnTrigger, setRespawnTrigger] = useState(0);
  const [deathScatterTrigger, setDeathScatterTrigger] = useState<{
    items: (SlotItem | null)[];
    timestamp: number;
  } | null>(null);

  // Sprinting requires hunger > 6 (Minecraft mechanic)
  const canSprint = hunger > 6;

  // --- Inventory & Crafting State ---
  const [hotbar, setHotbar] = useState<(SlotItem | null)[]>([
    { id: 'diamond_sword', count: 1, durability: 1561, maxDurability: 1561, maxStack: 1 },
    { id: 'diamond_pickaxe', count: 1, durability: 1561, maxDurability: 1561, maxStack: 1 },
    { id: 'cooked_beef', count: 16, maxStack: 64 },
    { id: 'bread', count: 12, maxStack: 64 },
    { id: 'dirt', count: 32, maxStack: 64 },
    { id: 'stone', count: 16, maxStack: 64 },
    { id: 'wood', count: 8, maxStack: 64 },
    { id: 'torch', count: 16, maxStack: 64 },
    { id: 'crafting_table', count: 1, maxStack: 64 },
  ]);

  const [inventory, setInventory] = useState<(SlotItem | null)[]>([
    { id: 'wooden_pickaxe', count: 1, durability: 59, maxDurability: 59, maxStack: 1 },
    { id: 'apple', count: 12, maxStack: 64 },
    { id: 'sand', count: 20, maxStack: 64 },
    { id: 'brick', count: 16, maxStack: 64 },
    { id: 'coal', count: 12, maxStack: 64 },
    { id: 'glass', count: 8, maxStack: 64 },
    ...Array(21).fill(null),
  ]);

  const [selectedHotbarIndex, setSelectedHotbarIndex] = useState(0);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);

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

  const handleSpawnMob = useCallback((type: 'steve' | 'zombie' | 'creeper' | 'skeleton' | 'enderman' | 'cow' | 'sheep' | 'pig') => {
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

  // 3D Item Drop collection: add to hotbar or main inventory
  const handleCollectDrop = useCallback((dropItem: SlotItem): boolean => {
    let remainder = dropItem.count;

    // 1. Try stacking into matching hotbar slots
    setHotbar((prevHotbar) => {
      const newHotbar = [...prevHotbar];
      for (let i = 0; i < 9 && remainder > 0; i++) {
        const slot = newHotbar[i];
        if (slot && slot.id === dropItem.id && slot.count < slot.maxStack) {
          const addable = Math.min(remainder, slot.maxStack - slot.count);
          newHotbar[i] = { ...slot, count: slot.count + addable };
          remainder -= addable;
        }
      }
      return newHotbar;
    });

    if (remainder <= 0) return true;

    // 2. Try stacking into main inventory slots
    setInventory((prevInv) => {
      const newInv = [...prevInv];
      for (let i = 0; i < 27 && remainder > 0; i++) {
        const slot = newInv[i];
        if (slot && slot.id === dropItem.id && slot.count < slot.maxStack) {
          const addable = Math.min(remainder, slot.maxStack - slot.count);
          newInv[i] = { ...slot, count: slot.count + addable };
          remainder -= addable;
        }
      }
      return newInv;
    });

    if (remainder <= 0) return true;

    // 3. Place into first empty hotbar slot
    let placedInHotbar = false;
    setHotbar((prevHotbar) => {
      const newHotbar = [...prevHotbar];
      for (let i = 0; i < 9 && remainder > 0; i++) {
        if (!newHotbar[i]) {
          newHotbar[i] = { ...dropItem, count: remainder };
          remainder = 0;
          placedInHotbar = true;
          break;
        }
      }
      return newHotbar;
    });

    if (placedInHotbar || remainder <= 0) return true;

    // 4. Place into first empty inventory slot
    let placedInInv = false;
    setInventory((prevInv) => {
      const newInv = [...prevInv];
      for (let i = 0; i < 27 && remainder > 0; i++) {
        if (!newInv[i]) {
          newInv[i] = { ...dropItem, count: remainder };
          remainder = 0;
          placedInInv = true;
          break;
        }
      }
      return newInv;
    });

    return placedInInv || remainder <= 0;
  }, []);

  const handleToggleInventory = () => {
    setIsInventoryOpen((prev) => !prev);
  };

  // --- Survival Combat & Damage Handlers ---
  const handleTakeDamage = useCallback((amount: number, reason: string) => {
    if (isDead) return;

    sound.playHurt();
    setDamageFlashTrigger(Date.now());

    setHealth((prevHealth) => {
      const nextHealth = Math.max(0, prevHealth - amount);
      if (nextHealth <= 0) {
        setIsDead(true);
        let reasonText = 'Вы погибли!';
        if (reason === 'fall') reasonText = 'Разбился при падении с большой высоты';
        else if (reason === 'lava') reasonText = 'Сгорел в раскалённой лаве';
        else if (reason === 'mob') reasonText = 'Убит враждебным монстром';
        else if (reason === 'starvation') reasonText = 'Погиб от голода и истощения';
        setDeathReason(reasonText);

        // Scatter all hotbar and inventory items at death coordinates in 3D
        setHotbar((currHotbar) => {
          setInventory((currInv) => {
            const allItems = [...currHotbar, ...currInv].filter(Boolean);
            setDeathScatterTrigger({
              items: allItems,
              timestamp: Date.now(),
            });
            return Array(27).fill(null);
          });
          return Array(9).fill(null);
        });
      }
      return nextHealth;
    });
  }, [isDead]);

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

    // Provide good starter equipment on respawn
    setHotbar([
      { id: 'diamond_sword', count: 1, durability: 1561, maxDurability: 1561, maxStack: 1 },
      { id: 'wooden_pickaxe', count: 1, durability: 59, maxDurability: 59, maxStack: 1 },
      { id: 'cooked_beef', count: 8, maxStack: 64 },
      { id: 'bread', count: 8, maxStack: 64 },
      ...Array(5).fill(null),
    ]);

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
          onOpenCraftingTable={() => setIsInventoryOpen(true)}
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

      {/* 20 HP (10 Hearts) & 20 Hunger (10 Drumsticks) Survival HUD */}
      {activeTab === 'game' && !isDead && (
        <SurvivalHUD
          health={health}
          hunger={hunger}
          isSprinting={isSprinting}
          damageFlashTrigger={damageFlashTrigger}
          activeEvent={activeEvent}
          eventNotification={eventNotification}
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
        onClose={() => setIsInventoryOpen(false)}
        inventory={inventory}
        hotbar={hotbar}
        onUpdateInventory={setInventory}
        onUpdateHotbar={setHotbar}
        selectedHotbarIndex={selectedHotbarIndex}
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
    </div>
  );
}
