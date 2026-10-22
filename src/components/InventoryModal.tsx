import React, { useState, useEffect } from 'react';
import {
  SlotItem,
  ArmorSlotsState,
  calculateTotalArmorPoints,
  ITEM_REGISTRY,
  CRAFTING_RECIPES,
  validateCraftingGrid,
  consumeCraftingIngredients,
  CraftingRecipe,
} from '../engine/InventorySystem';
import { PotionsAndEnchanting } from '../engine/PotionsAndEnchanting';
import { ItemIcon } from './ItemIcon';
import { sound } from '../engine/AudioEngine';
import { X, Sparkles, BookOpen, Hammer, ChevronRight, Trash2, Shield, Box, Wand2, FlaskConical } from 'lucide-react';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: (SlotItem | null)[]; // 27 slots
  hotbar: (SlotItem | null)[]; // 9 slots
  armorSlots: ArmorSlotsState;
  onUpdateInventory: (newInv: (SlotItem | null)[]) => void;
  onUpdateHotbar: (newHotbar: (SlotItem | null)[]) => void;
  onUpdateArmorSlots: (newArmor: ArmorSlotsState) => void;
  selectedHotbarIndex: number;
  chestState?: {
    x: number;
    y: number;
    z: number;
    items: (SlotItem | null)[];
    onUpdateChest: (items: (SlotItem | null)[]) => void;
  } | null;
  initialTab?: 'crafting' | 'enchanting' | 'brewing';
}

const potionsAndEnchanting = new PotionsAndEnchanting();

export const InventoryModal: React.FC<InventoryModalProps> = ({
  isOpen,
  onClose,
  inventory,
  hotbar,
  armorSlots,
  onUpdateInventory,
  onUpdateHotbar,
  onUpdateArmorSlots,
  selectedHotbarIndex,
  chestState,
  initialTab = 'crafting',
}) => {
  const [activeTab, setActiveTab] = useState<'crafting' | 'enchanting' | 'brewing'>(initialTab);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Enchanting State
  const [enchantItemSlot, setEnchantItemSlot] = useState<SlotItem | null>(null);
  const [lapisSlot, setLapisSlot] = useState<SlotItem | null>(null);

  // Brewing State
  const [brewingIngredient, setBrewingIngredient] = useState<SlotItem | null>(null);
  const [brewingPotions, setBrewingPotions] = useState<(SlotItem | null)[]>([null, null, null]);

  // Crafting Grid state
  const [craftingMode, setCraftingMode] = useState<'2x2' | '3x3'>('3x3');
  const [craftGrid, setCraftGrid] = useState<(SlotItem | null)[][]>([
    [null, null, null],
    [null, null, null],
    [null, null, null],
  ]);

  // Floating held item for Drag-and-Drop & RMB splitting
  const [heldItem, setHeldItem] = useState<SlotItem | null>(null);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  // Hovered item for tooltip
  const [hoveredItem, setHoveredItem] = useState<{ item: SlotItem; x: number; y: number } | null>(null);

  // Computed Crafted Result
  const gridDim = craftingMode === '2x2' ? 2 : 3;
  const craftResult = validateCraftingGrid(craftGrid, gridDim, gridDim);

  // Track cursor position for floating dragged item
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setCursorPos({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Listen for 'E' or 'Escape' to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyE' || e.code === 'Escape') {
        e.preventDefault();
        if (heldItem) {
          returnHeldItemToInventory();
        }
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, heldItem]);

  const returnHeldItemToInventory = () => {
    if (!heldItem) return;
    const newHotbar = [...hotbar];
    const newInv = [...inventory];
    let placed = false;

    for (let i = 0; i < 9; i++) {
      if (!newHotbar[i]) {
        newHotbar[i] = heldItem;
        placed = true;
        break;
      }
    }
    if (!placed) {
      for (let i = 0; i < 27; i++) {
        if (!newInv[i]) {
          newInv[i] = heldItem;
          placed = true;
          break;
        }
      }
    }
    setHeldItem(null);
    onUpdateHotbar(newHotbar);
    onUpdateInventory(newInv);
  };

  /**
   * Universal Slot Click Handler supporting Left Click & Right Click (ПКМ)
   */
  const handleSlotInteraction = (
    currentSlot: SlotItem | null,
    setSlot: (item: SlotItem | null) => void,
    e: React.MouseEvent
  ) => {
    e.preventDefault();
    const isRightClick = e.button === 2;

    if (!isRightClick) {
      // --- LEFT CLICK ---
      if (!heldItem && currentSlot) {
        setHeldItem(currentSlot);
        setSlot(null);
        sound.playClick();
      } else if (heldItem && !currentSlot) {
        setSlot(heldItem);
        setHeldItem(null);
        sound.playClick();
      } else if (heldItem && currentSlot) {
        if (heldItem.id === currentSlot.id && currentSlot.count < currentSlot.maxStack) {
          const space = currentSlot.maxStack - currentSlot.count;
          const transfer = Math.min(space, heldItem.count);
          setSlot({ ...currentSlot, count: currentSlot.count + transfer });
          const remaining = heldItem.count - transfer;
          setHeldItem(remaining > 0 ? { ...heldItem, count: remaining } : null);
          sound.playClick();
        } else {
          setSlot(heldItem);
          setHeldItem(currentSlot);
          sound.playClick();
        }
      }
    } else {
      // --- RIGHT CLICK (ПКМ) ---
      if (!heldItem && currentSlot) {
        const def = ITEM_REGISTRY[currentSlot.id];
        if (def && def.type === 'armor' && def.armorSlot) {
          const targetSlot = def.armorSlot;
          const oldArmor = armorSlots[targetSlot];
          onUpdateArmorSlots({ ...armorSlots, [targetSlot]: currentSlot });
          setSlot(oldArmor);
          sound.playClick();
          return;
        }

        const half = Math.ceil(currentSlot.count / 2);
        const remainder = currentSlot.count - half;
        setHeldItem({ ...currentSlot, count: half });
        setSlot(remainder > 0 ? { ...currentSlot, count: remainder } : null);
        sound.playClick();
      } else if (heldItem && (!currentSlot || currentSlot.id === heldItem.id)) {
        if (!currentSlot) {
          setSlot({ ...heldItem, count: 1 });
          const remaining = heldItem.count - 1;
          setHeldItem(remaining > 0 ? { ...heldItem, count: remaining } : null);
          sound.playClick();
        } else if (currentSlot.count < currentSlot.maxStack) {
          setSlot({ ...currentSlot, count: currentSlot.count + 1 });
          const remaining = heldItem.count - 1;
          setHeldItem(remaining > 0 ? { ...heldItem, count: remaining } : null);
          sound.playClick();
        }
      }
    }
  };

  /**
   * Craft Result Slot Click
   */
  const handleCraftResultClick = () => {
    if (!craftResult) return;
    const { recipe, result } = craftResult;

    if (!heldItem) {
      setHeldItem({ ...result });
      consumeIngredients(recipe);
      sound.playCraft();
    } else if (heldItem.id === result.id && heldItem.count + result.count <= heldItem.maxStack) {
      setHeldItem({ ...heldItem, count: heldItem.count + result.count });
      consumeIngredients(recipe);
      sound.playCraft();
    }
  };

  const consumeIngredients = (recipe: CraftingRecipe) => {
    const newGrid = craftGrid.map((row) => [...row]);
    consumeCraftingIngredients(newGrid, gridDim, gridDim, recipe);
    setCraftGrid(newGrid);
  };

  const totalArmorPoints = calculateTotalArmorPoints(armorSlots);

  const handleArmorSlotInteraction = (
    slotKey: 'helmet' | 'chestplate' | 'leggings' | 'boots',
    e: React.MouseEvent
  ) => {
    e.preventDefault();
    const currentSlot = armorSlots[slotKey];

    if (!heldItem && currentSlot) {
      setHeldItem(currentSlot);
      onUpdateArmorSlots({ ...armorSlots, [slotKey]: null });
      sound.playClick();
    } else if (heldItem) {
      const def = ITEM_REGISTRY[heldItem.id];
      if (def && def.type === 'armor' && def.armorSlot === slotKey) {
        onUpdateArmorSlots({ ...armorSlots, [slotKey]: heldItem });
        setHeldItem(currentSlot);
        sound.playClick();
      } else {
        sound.playHurt();
      }
    }
  };

  const handleQuickCraftRecipe = (recipe: CraftingRecipe) => {
    const newGrid: (SlotItem | null)[][] = [
      [null, null, null],
      [null, null, null],
      [null, null, null],
    ];

    for (let r = 0; r < recipe.height; r++) {
      for (let c = 0; c < recipe.width; c++) {
        const reqId = recipe.pattern[r][c];
        if (reqId) {
          newGrid[r][c] = {
            id: reqId,
            count: 1,
            maxStack: 64,
          };
        }
      }
    }

    setCraftGrid(newGrid);
    sound.playClick();
  };

  // Execute Enchantment
  const handleApplyEnchantment = (type: 'sharpness' | 'efficiency' | 'protection' | 'unbreaking') => {
    if (!enchantItemSlot) return;
    if (!lapisSlot || lapisSlot.count < 1) {
      sound.playHurt();
      return;
    }

    const enchanted = potionsAndEnchanting.enchantItem(enchantItemSlot, type);
    setEnchantItemSlot(enchanted);

    if (lapisSlot.count > 1) {
      setLapisSlot({ ...lapisSlot, count: lapisSlot.count - 1 });
    } else {
      setLapisSlot(null);
    }

    sound.playCraft();
  };

  // Execute Brewing
  const handleBrewPotion = (outputPotionId: 'speed' | 'healing' | 'night_vision' | 'strength' | 'regeneration') => {
    if (!brewingIngredient || brewingIngredient.count < 1) return;

    const newPotions = [...brewingPotions];
    let brewedCount = 0;
    for (let i = 0; i < 3; i++) {
      if (!newPotions[i]) {
        newPotions[i] = {
          id: `potion_${outputPotionId}`,
          count: 1,
          maxStack: 16,
        };
        brewedCount++;
      }
    }

    if (brewedCount > 0) {
      if (brewingIngredient.count > 1) {
        setBrewingIngredient({ ...brewingIngredient, count: brewingIngredient.count - 1 });
      } else {
        setBrewingIngredient(null);
      }
      setBrewingPotions(newPotions);
      sound.playCraft();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm select-none"
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          returnHeldItemToInventory();
          onClose();
        }
      }}
    >
      <div className="bg-slate-900 border-2 border-slate-700 rounded-2xl shadow-2xl p-5 max-w-2xl w-full text-slate-100 flex flex-col gap-4 relative animate-scale-up max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              {activeTab === 'crafting' ? <Hammer className="w-5 h-5" /> : activeTab === 'enchanting' ? <Wand2 className="w-5 h-5" /> : <FlaskConical className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                {chestState ? '📦 Storage Chest' : activeTab === 'crafting' ? 'Crafting & Inventory' : activeTab === 'enchanting' ? '✨ Enchanting Table' : '🧪 Brewing Stand'}
              </h2>
              <p className="text-xs text-slate-400">
                LMB: Take/Place • RMB (ПКМ): Quick Equip / Split • Drag & Drop
              </p>
            </div>
          </div>

          {!chestState && (
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setActiveTab('crafting')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition ${
                  activeTab === 'crafting' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Hammer className="w-3.5 h-3.5" />
                Crafting
              </button>
              <button
                onClick={() => setActiveTab('enchanting')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition ${
                  activeTab === 'enchanting' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Wand2 className="w-3.5 h-3.5" />
                Enchanting
              </button>
              <button
                onClick={() => setActiveTab('brewing')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition ${
                  activeTab === 'brewing' ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FlaskConical className="w-3.5 h-3.5" />
                Brewing
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                returnHeldItemToInventory();
                onClose();
              }}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {chestState && (
          <div className="flex flex-col gap-2 bg-amber-950/20 border-2 border-amber-800/60 p-3 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Box className="w-4 h-4 text-amber-400" />
                Storage Chest (27 slots)
              </span>
              <span className="text-[10px] text-amber-400 font-mono">
                Location: [{chestState.x}, {chestState.y}, {chestState.z}]
              </span>
            </div>
            <div className="grid grid-cols-9 gap-1.5 p-2 bg-slate-950/80 rounded-xl border border-amber-900/50">
              {chestState.items.map((item, idx) => (
                <div
                  key={idx}
                  onMouseDown={(e) =>
                    handleSlotInteraction(
                      item,
                      (newItem) => {
                        const newChest = [...chestState.items];
                        newChest[idx] = newItem;
                        chestState.onUpdateChest(newChest);
                      },
                      e
                    )
                  }
                  onMouseEnter={(e) => item && setHoveredItem({ item, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHoveredItem(null)}
                  className="w-12 h-12 bg-amber-950/40 hover:bg-amber-900/40 border border-amber-700/50 rounded-xl flex items-center justify-center relative cursor-pointer"
                >
                  {item && <ItemIcon itemId={item.id} className="w-7 h-7 pointer-events-none" />}
                  {item && item.count > 1 && (
                    <span className="absolute bottom-0.5 right-1 text-[11px] font-mono font-bold text-white">
                      {item.count}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/80 p-3 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-200">Armor Equipment</h3>
              <p className="text-[10px] text-slate-400">Click or drag armor piece into slot to equip</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {(
              [
                { key: 'helmet', label: 'Helmet', icon: '🪖' },
                { key: 'chestplate', label: 'Chestplate', icon: '👕' },
                { key: 'leggings', label: 'Leggings', icon: '👖' },
                { key: 'boots', label: 'Boots', icon: '🥾' },
              ] as const
            ).map((slotInfo) => {
              const item = armorSlots[slotInfo.key];
              const maxD = item ? (item.maxDurability || ITEM_REGISTRY[item.id]?.maxDurability || 100) : 100;
              const currD = item ? (item.durability !== undefined ? item.durability : maxD) : maxD;
              const durabilityRatio = item ? Math.max(0, Math.min(1, currD / maxD)) : 1;

              return (
                <div
                  key={slotInfo.key}
                  onMouseDown={(e) => handleArmorSlotInteraction(slotInfo.key, e)}
                  onMouseEnter={(e) => item && setHoveredItem({ item, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHoveredItem(null)}
                  className={`w-11 h-11 rounded-xl border flex flex-col items-center justify-center relative cursor-pointer transition-all ${
                    item
                      ? 'bg-sky-950/40 border-sky-400/80 shadow-[0_0_12px_rgba(56,189,248,0.3)] hover:scale-105'
                      : 'bg-slate-900 border-slate-700/80 hover:border-slate-500'
                  }`}
                  title={`${slotInfo.label} Equipment Slot`}
                >
                  {item ? (
                    <>
                      <ItemIcon itemId={item.id} className="w-6 h-6 pointer-events-none" />
                      <div className="absolute bottom-1 left-1 right-1 h-1 bg-slate-950 rounded-full overflow-hidden border border-black/40">
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${durabilityRatio * 100}%`,
                            backgroundColor:
                              durabilityRatio > 0.5 ? '#22c55e' : durabilityRatio > 0.25 ? '#eab308' : '#ef4444',
                          }}
                        />
                      </div>
                    </>
                  ) : (
                    <span className="text-sm opacity-40 select-none">{slotInfo.icon}</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-sky-500/30">
            <div className="flex flex-col text-right">
              <span className="text-xs font-mono font-bold text-sky-300">
                🛡️ {totalArmorPoints} / 20 Armor
              </span>
              <span className="text-[10px] text-emerald-400 font-mono font-semibold">
                -{((totalArmorPoints / 20) * 75).toFixed(0)}% Damage Taken
              </span>
            </div>
          </div>
        </div>

        {activeTab === 'crafting' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
            <div className="md:col-span-2 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Hammer className="w-3.5 h-3.5 text-amber-400" />
                  Crafting Table
                </span>
                <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-[11px]">
                  <button
                    onClick={() => setCraftingMode('2x2')}
                    className={`px-2 py-0.5 rounded font-mono cursor-pointer transition ${
                      craftingMode === '2x2' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400'
                    }`}
                  >
                    2×2
                  </button>
                  <button
                    onClick={() => setCraftingMode('3x3')}
                    className={`px-2 py-0.5 rounded font-mono cursor-pointer transition ${
                      craftingMode === '3x3' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400'
                    }`}
                  >
                    3×3
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4 py-2">
                <div
                  className="grid gap-1.5 p-2 bg-slate-900 rounded-xl border border-slate-700/80"
                  style={{ gridTemplateColumns: `repeat(${gridDim}, minmax(0, 1fr))` }}
                >
                  {Array.from({ length: gridDim }).map((_, r) =>
                    Array.from({ length: gridDim }).map((_, c) => {
                      const item = craftGrid[r][c];
                      return (
                        <div
                          key={`${r}-${c}`}
                          onMouseDown={(e) =>
                            handleSlotInteraction(
                              item,
                              (newItem) => {
                                const newGrid = craftGrid.map((row) => [...row]);
                                newGrid[r][c] = newItem;
                                setCraftGrid(newGrid);
                              },
                              e
                            )
                          }
                          onMouseEnter={(e) => item && setHoveredItem({ item, x: e.clientX, y: e.clientY })}
                          onMouseLeave={() => setHoveredItem(null)}
                          className="w-12 h-12 bg-slate-800/90 hover:bg-slate-750 border border-slate-700 rounded-lg flex items-center justify-center relative cursor-pointer"
                        >
                          {item && <ItemIcon itemId={item.id} className="w-7 h-7 pointer-events-none" />}
                          {item && item.count > 1 && (
                            <span className="absolute bottom-0.5 right-1 text-[10px] font-mono font-bold text-white">
                              {item.count}
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="flex items-center text-slate-500">
                  <ChevronRight className="w-6 h-6 stroke-[3]" />
                </div>

                <div className="flex flex-col items-center gap-1">
                  <div
                    onMouseDown={handleCraftResultClick}
                    onMouseEnter={(e) =>
                      craftResult && setHoveredItem({ item: craftResult.result, x: e.clientX, y: e.clientY })
                    }
                    onMouseLeave={() => setHoveredItem(null)}
                    className={`w-14 h-14 rounded-xl flex items-center justify-center relative cursor-pointer border-2 transition-all ${
                      craftResult
                        ? 'bg-emerald-950/40 border-emerald-400/80 shadow-[0_0_15px_rgba(52,211,153,0.3)]'
                        : 'bg-slate-900 border-slate-700/60'
                    }`}
                  >
                    {craftResult ? (
                      <>
                        <ItemIcon itemId={craftResult.result.id} className="w-9 h-9 pointer-events-none animate-pulse" />
                        {craftResult.result.count > 1 && (
                          <span className="absolute bottom-1 right-1.5 text-xs font-mono font-bold text-emerald-300">
                            {craftResult.result.count}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-[10px] text-slate-600 font-mono">Result</span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {craftResult ? craftResult.recipe.name : 'Empty'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 border-l border-slate-800/80 pl-3">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                Recipe Book
              </span>
              <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-1">
                {CRAFTING_RECIPES.map((rec) => (
                  <button
                    key={rec.id}
                    onClick={() => handleQuickCraftRecipe(rec)}
                    className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-left text-xs text-slate-300 flex items-center justify-between cursor-pointer transition"
                  >
                    <div className="flex items-center gap-1.5">
                      <ItemIcon itemId={rec.result.id} className="w-4 h-4" />
                      <span>{rec.name}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">{rec.width}×{rec.height}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'enchanting' && (
          <div className="bg-purple-950/30 border border-purple-800/50 p-4 rounded-xl flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-purple-800/40 pb-2">
              <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                <Wand2 className="w-4 h-4 text-purple-400" />
                Enchanting Table (Requires Lapis Lazuli)
              </span>
              <span className="text-[10px] text-purple-400 font-mono">Place item & Lapis Lazuli</span>
            </div>

            <div className="flex items-center justify-around py-2">
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-purple-300 font-semibold">Item to Enchant</span>
                <div
                  onMouseDown={(e) => handleSlotInteraction(enchantItemSlot, setEnchantItemSlot, e)}
                  className="w-14 h-14 bg-purple-900/40 border-2 border-purple-500/80 rounded-xl flex items-center justify-center relative cursor-pointer shadow-[0_0_15px_rgba(168,85,247,0.3)]"
                >
                  {enchantItemSlot ? (
                    <ItemIcon itemId={enchantItemSlot.id} className="w-8 h-8 pointer-events-none" />
                  ) : (
                    <span className="text-xs opacity-40">🗡️ / 🪓</span>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-blue-300 font-semibold">Lapis Lazuli</span>
                <div
                  onMouseDown={(e) => handleSlotInteraction(lapisSlot, setLapisSlot, e)}
                  className="w-14 h-14 bg-blue-900/40 border-2 border-blue-500/80 rounded-xl flex items-center justify-center relative cursor-pointer shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                >
                  {lapisSlot ? (
                    <>
                      <ItemIcon itemId={lapisSlot.id} className="w-8 h-8 pointer-events-none" />
                      <span className="absolute bottom-1 right-1 text-xs font-mono font-bold text-white">
                        {lapisSlot.count}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs opacity-40">💎 Lapis</span>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1.5 min-w-[200px]">
                <button
                  onClick={() => handleApplyEnchantment('sharpness')}
                  disabled={!enchantItemSlot || !lapisSlot}
                  className="px-3 py-1.5 bg-purple-900/80 hover:bg-purple-800 disabled:opacity-40 border border-purple-500/60 rounded-lg text-xs font-bold text-purple-200 flex items-center justify-between cursor-pointer transition"
                >
                  <span>✨ Sharpness III</span>
                  <span className="text-[10px] text-purple-400 font-mono">+Damage</span>
                </button>
                <button
                  onClick={() => handleApplyEnchantment('efficiency')}
                  disabled={!enchantItemSlot || !lapisSlot}
                  className="px-3 py-1.5 bg-purple-900/80 hover:bg-purple-800 disabled:opacity-40 border border-purple-500/60 rounded-lg text-xs font-bold text-purple-200 flex items-center justify-between cursor-pointer transition"
                >
                  <span>⚡ Efficiency IV</span>
                  <span className="text-[10px] text-purple-400 font-mono">+Speed</span>
                </button>
                <button
                  onClick={() => handleApplyEnchantment('protection')}
                  disabled={!enchantItemSlot || !lapisSlot}
                  className="px-3 py-1.5 bg-purple-900/80 hover:bg-purple-800 disabled:opacity-40 border border-purple-500/60 rounded-lg text-xs font-bold text-purple-200 flex items-center justify-between cursor-pointer transition"
                >
                  <span>🛡️ Protection IV</span>
                  <span className="text-[10px] text-purple-400 font-mono">+Armor</span>
                </button>
                <button
                  onClick={() => handleApplyEnchantment('unbreaking')}
                  disabled={!enchantItemSlot || !lapisSlot}
                  className="px-3 py-1.5 bg-purple-900/80 hover:bg-purple-800 disabled:opacity-40 border border-purple-500/60 rounded-lg text-xs font-bold text-purple-200 flex items-center justify-between cursor-pointer transition"
                >
                  <span>💎 Unbreaking III</span>
                  <span className="text-[10px] text-purple-400 font-mono">+Durability</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'brewing' && (
          <div className="bg-sky-950/30 border border-sky-800/50 p-4 rounded-xl flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-sky-800/40 pb-2">
              <span className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                <FlaskConical className="w-4 h-4 text-sky-400" />
                Brewing Stand (Potion Alchemic Station)
              </span>
              <span className="text-[10px] text-sky-400 font-mono">Place ingredient to brew</span>
            </div>

            <div className="flex items-center justify-around py-2">
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-amber-300 font-semibold">Ingredient</span>
                <div
                  onMouseDown={(e) => handleSlotInteraction(brewingIngredient, setBrewingIngredient, e)}
                  className="w-14 h-14 bg-amber-900/40 border-2 border-amber-500/80 rounded-xl flex items-center justify-center relative cursor-pointer shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                >
                  {brewingIngredient ? (
                    <>
                      <ItemIcon itemId={brewingIngredient.id} className="w-8 h-8 pointer-events-none" />
                      <span className="absolute bottom-1 right-1 text-xs font-mono font-bold text-white">
                        {brewingIngredient.count}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs opacity-40">🔥 Nether Wart</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleBrewPotion('speed')}
                  disabled={!brewingIngredient}
                  className="px-3 py-2 bg-sky-900/80 hover:bg-sky-800 disabled:opacity-40 border border-sky-500/60 rounded-xl text-xs font-bold text-sky-200 flex flex-col cursor-pointer transition"
                >
                  <span>⚡ Swiftness Potion</span>
                  <span className="text-[10px] text-sky-300 font-mono">+50% Speed</span>
                </button>
                <button
                  onClick={() => handleBrewPotion('healing')}
                  disabled={!brewingIngredient}
                  className="px-3 py-2 bg-rose-900/80 hover:bg-rose-800 disabled:opacity-40 border border-rose-500/60 rounded-xl text-xs font-bold text-rose-200 flex flex-col cursor-pointer transition"
                >
                  <span>💖 Instant Health</span>
                  <span className="text-[10px] text-rose-300 font-mono">+8 HP</span>
                </button>
                <button
                  onClick={() => handleBrewPotion('night_vision')}
                  disabled={!brewingIngredient}
                  className="px-3 py-2 bg-emerald-900/80 hover:bg-emerald-800 disabled:opacity-40 border border-emerald-500/60 rounded-xl text-xs font-bold text-emerald-200 flex flex-col cursor-pointer transition"
                >
                  <span>👁️ Night Vision</span>
                  <span className="text-[10px] text-emerald-300 font-mono">Full Darkness Light</span>
                </button>
                <button
                  onClick={() => handleBrewPotion('strength')}
                  disabled={!brewingIngredient}
                  className="px-3 py-2 bg-purple-900/80 hover:bg-purple-800 disabled:opacity-40 border border-purple-500/60 rounded-xl text-xs font-bold text-purple-200 flex flex-col cursor-pointer transition"
                >
                  <span>🗡️ Strength Potion</span>
                  <span className="text-[10px] text-purple-300 font-mono">+3 Attack Damage</span>
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Inventory Storage (27 slots)</span>
            <div
              onMouseUp={() => {
                if (heldItem) {
                  setHeldItem(null);
                  sound.playBlockBreak();
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border transition cursor-pointer ${
                heldItem
                  ? 'bg-red-500/30 border-red-500 text-red-200 animate-pulse scale-105 shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-red-400'
              }`}
              title="Перетащите сюда предмет, чтобы уничтожить его"
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-[11px] font-medium">
                {heldItem ? 'Отпустите чтобы удалить' : 'Уничтожить'}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-9 gap-1.5 p-2 bg-slate-950/50 rounded-xl border border-slate-800">
            {inventory.map((item, idx) => (
              <div
                key={idx}
                onMouseDown={(e) =>
                  handleSlotInteraction(
                    item,
                    (newItem) => {
                      const newInv = [...inventory];
                      newInv[idx] = newItem;
                      onUpdateInventory(newInv);
                    },
                    e
                  )
                }
                onMouseEnter={(e) => item && setHoveredItem({ item, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setHoveredItem(null)}
                className="w-12 h-12 bg-slate-800/80 hover:bg-slate-700/70 border border-slate-700/60 rounded-xl flex items-center justify-center relative cursor-pointer"
              >
                {item && <ItemIcon itemId={item.id} className="w-7 h-7 pointer-events-none" />}
                {item && item.count > 1 && (
                  <span className="absolute bottom-0.5 right-1 text-[11px] font-mono font-bold text-white">
                    {item.count}
                  </span>
                )}
                {item?.durability !== undefined && item.maxDurability && (
                  <div className="absolute bottom-1 left-1.5 right-1.5 h-1 bg-slate-950 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-400"
                      style={{ width: `${(item.durability / item.maxDurability) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-amber-400 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> Hotbar (9 slots - Keys 1–9)
          </span>
          <div className="grid grid-cols-9 gap-1.5 p-2 bg-slate-950/80 rounded-xl border-2 border-slate-700">
            {hotbar.map((item, idx) => {
              const isSelected = selectedHotbarIndex === idx;
              return (
                <div
                  key={idx}
                  onMouseDown={(e) =>
                    handleSlotInteraction(
                      item,
                      (newItem) => {
                        const newHotbar = [...hotbar];
                        newHotbar[idx] = newItem;
                        onUpdateHotbar(newHotbar);
                      },
                      e
                    )
                  }
                  onMouseEnter={(e) => item && setHoveredItem({ item, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHoveredItem(null)}
                  className={`w-12 h-12 rounded-xl flex items-center justify-center relative cursor-pointer transition ${
                    isSelected
                      ? 'bg-slate-700 border-2 border-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.4)]'
                      : 'bg-slate-800/90 hover:bg-slate-700/70 border border-slate-700/60'
                  }`}
                >
                  <span className="absolute top-0.5 left-1 text-[9px] font-mono text-slate-400/80">
                    {idx + 1}
                  </span>
                  {item && <ItemIcon itemId={item.id} className="w-7 h-7 pointer-events-none" />}
                  {item && item.count > 1 && (
                    <span className="absolute bottom-0.5 right-1 text-[11px] font-mono font-bold text-white">
                      {item.count}
                    </span>
                  )}
                  {item?.durability !== undefined && item.maxDurability && (
                    <div className="absolute bottom-1 left-1.5 right-1.5 h-1 bg-slate-950 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-400"
                        style={{ width: `${(item.durability / item.maxDurability) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {heldItem && (
        <div
          className="fixed pointer-events-none z-50 transform -translate-x-1/2 -translate-y-1/2 filter drop-shadow-xl"
          style={{ left: cursorPos.x, top: cursorPos.y }}
        >
          <div className="w-10 h-10 flex items-center justify-center relative">
            <ItemIcon itemId={heldItem.id} className="w-9 h-9" />
            {heldItem.count > 1 && (
              <span className="absolute -bottom-1 -right-1 bg-slate-900 border border-slate-600 px-1 rounded text-[11px] font-mono font-bold text-white shadow">
                {heldItem.count}
              </span>
            )}
          </div>
        </div>
      )}

      {hoveredItem && !heldItem && (
        <div
          className="fixed pointer-events-none z-50 bg-slate-950/95 border border-slate-700 px-3 py-2 rounded-xl shadow-2xl backdrop-blur-md text-xs max-w-xs"
          style={{ left: hoveredItem.x + 12, top: hoveredItem.y + 12 }}
        >
          {(() => {
            const def = ITEM_REGISTRY[hoveredItem.item.id];
            return (
              <div className="flex flex-col gap-1">
                <span className="font-bold text-amber-300 text-sm">
                  {def?.name || hoveredItem.item.id}
                </span>
                <span className="text-[11px] text-slate-300">{def?.description}</span>
                {hoveredItem.item.durability !== undefined && hoveredItem.item.maxDurability && (
                  <span className="text-[10px] text-emerald-400 font-mono">
                    Durability: {hoveredItem.item.durability} / {hoveredItem.item.maxDurability}
                  </span>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
