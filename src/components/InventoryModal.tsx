import React, { useState, useEffect, useRef } from 'react';
import {
  SlotItem,
  ITEM_REGISTRY,
  CRAFTING_RECIPES,
  validateCraftingGrid,
  consumeCraftingIngredients,
  CraftingRecipe,
} from '../engine/InventorySystem';
import { ItemIcon } from './ItemIcon';
import { sound } from '../engine/AudioEngine';
import { X, Sparkles, BookOpen, Hammer, ChevronRight } from 'lucide-react';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: (SlotItem | null)[]; // 27 slots
  hotbar: (SlotItem | null)[]; // 9 slots
  onUpdateInventory: (newInv: (SlotItem | null)[]) => void;
  onUpdateHotbar: (newHotbar: (SlotItem | null)[]) => void;
  selectedHotbarIndex: number;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({
  isOpen,
  onClose,
  inventory,
  hotbar,
  onUpdateInventory,
  onUpdateHotbar,
  selectedHotbarIndex,
}) => {
  // Crafting Grid state
  const [craftingMode, setCraftingMode] = useState<'2x2' | '3x3'>('3x3');
  // 3x3 array for max size
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
        // Return held item to inventory before closing if any
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

    // Try hotbar first
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
        // Pick up entire stack
        setHeldItem(currentSlot);
        setSlot(null);
        sound.playClick();
      } else if (heldItem && !currentSlot) {
        // Drop entire held item
        setSlot(heldItem);
        setHeldItem(null);
        sound.playClick();
      } else if (heldItem && currentSlot) {
        if (heldItem.id === currentSlot.id && currentSlot.count < currentSlot.maxStack) {
          // Stack items together
          const space = currentSlot.maxStack - currentSlot.count;
          const transfer = Math.min(space, heldItem.count);
          setSlot({ ...currentSlot, count: currentSlot.count + transfer });
          const remaining = heldItem.count - transfer;
          setHeldItem(remaining > 0 ? { ...heldItem, count: remaining } : null);
          sound.playClick();
        } else {
          // Swap held item with slot item
          setSlot(heldItem);
          setHeldItem(currentSlot);
          sound.playClick();
        }
      }
    } else {
      // --- RIGHT CLICK (ПКМ) ---
      if (!heldItem && currentSlot) {
        // Split stack in half!
        const half = Math.ceil(currentSlot.count / 2);
        const remainder = currentSlot.count - half;
        setHeldItem({ ...currentSlot, count: half });
        setSlot(remainder > 0 ? { ...currentSlot, count: remainder } : null);
        sound.playClick();
      } else if (heldItem && (!currentSlot || currentSlot.id === heldItem.id)) {
        // Place 1 item from held stack
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
  const handleCraftResultClick = (e: React.MouseEvent) => {
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

  /**
   * Auto-fill recipe helper
   */
  const handleQuickCraftRecipe = (recipe: CraftingRecipe) => {
    // Check if player has required items
    const availableItems = [...hotbar, ...inventory];
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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm select-none"
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        // Click outside container to close
        if (e.target === e.currentTarget) {
          returnHeldItemToInventory();
          onClose();
        }
      }}
    >
      {/* Main Inventory Window */}
      <div className="bg-slate-900 border-2 border-slate-700 rounded-2xl shadow-2xl p-5 max-w-2xl w-full text-slate-100 flex flex-col gap-4 relative animate-scale-up">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Hammer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Crafting & Inventory
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                  Pure JS / HTML5
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                LMB: Take/Place • RMB (ПКМ): Split Stack / Place 1 • Drag & Drop
              </p>
            </div>
          </div>

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

        {/* Top Section: Crafting Bench & Quick Recipes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
          {/* Crafting Grid */}
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

            {/* Grid & Output Arrow */}
            <div className="flex items-center gap-4 py-2">
              {/* Input Slots */}
              <div
                className="grid gap-1.5 p-2 bg-slate-900 rounded-xl border border-slate-700/80"
                style={{
                  gridTemplateColumns: `repeat(${gridDim}, minmax(0, 1fr))`,
                }}
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

              {/* Arrow */}
              <div className="flex items-center text-slate-500">
                <ChevronRight className="w-6 h-6 stroke-[3]" />
              </div>

              {/* Output Result Slot */}
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

          {/* Quick Recipe Book Sidebar */}
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

        {/* 27 Main Inventory Slots */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-slate-400">Inventory Storage (27 slots)</span>
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

        {/* 9 Hotbar Slots */}
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

      {/* Floating Dragged Item (Following Cursor) */}
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

      {/* Hover Item Tooltip */}
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
                {def?.toolType === 'pickaxe' && def.id === 'diamond_pickaxe' && (
                  <span className="text-[10px] text-cyan-400 font-mono">
                    ⚡ Mining Speed: 12x (Instant Stone Break)
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
