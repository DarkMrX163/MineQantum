import React, { useEffect } from 'react';
import { SlotItem, ITEM_REGISTRY } from '../engine/InventorySystem';
import { ItemIcon } from './ItemIcon';
import { sound } from '../engine/AudioEngine';

interface HotbarProps {
  hotbar: (SlotItem | null)[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  onOpenInventory: () => void;
  isInventoryOpen: boolean;
  onSlotClick?: (index: number, e: React.MouseEvent) => void;
}

export const Hotbar: React.FC<HotbarProps> = ({
  hotbar,
  selectedIndex,
  onSelectIndex,
  onOpenInventory,
  isInventoryOpen,
  onSlotClick,
}) => {
  // Number keys 1–9 and mouse wheel scrolling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'KeyE') {
        e.preventDefault();
        onOpenInventory();
        return;
      }

      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1 && num <= 9) {
        onSelectIndex(num - 1);
        sound.playClick();
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (isInventoryOpen) return;
      if (e.deltaY > 0) {
        onSelectIndex((selectedIndex + 1) % 9);
      } else if (e.deltaY < 0) {
        onSelectIndex((selectedIndex - 1 + 9) % 9);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wheel', handleWheel, { passive: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [selectedIndex, isInventoryOpen, onSelectIndex, onOpenInventory]);

  const activeItem = hotbar[selectedIndex];
  const activeDef = activeItem ? ITEM_REGISTRY[activeItem.id] : null;

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-1.5 pointer-events-auto select-none">
      {/* Active Item Title Banner */}
      {activeDef && (
        <div className="px-3 py-0.5 rounded-full bg-slate-950/85 border border-slate-700/80 text-xs font-medium text-slate-200 shadow-lg backdrop-blur-md flex items-center gap-2 animate-fade-in">
          <span className="font-bold text-emerald-400">{activeDef.name}</span>
          {activeItem?.durability !== undefined && activeItem.maxDurability && (
            <span className="text-[10px] text-slate-400 font-mono">
              ({activeItem.durability}/{activeItem.maxDurability})
            </span>
          )}
          {activeDef.toolType === 'pickaxe' && activeDef.id === 'diamond_pickaxe' && (
            <span className="text-[10px] text-amber-300 font-mono">⚡ Instant Mine</span>
          )}
        </div>
      )}

      {/* 9 Hotbar Slots Container */}
      <div className="bg-slate-900/90 backdrop-blur-md p-1.5 rounded-2xl border-2 border-slate-700/90 shadow-2xl flex items-center gap-1.5">
        {Array.from({ length: 9 }).map((_, idx) => {
          const item = hotbar[idx];
          const isSelected = selectedIndex === idx;
          const def = item ? ITEM_REGISTRY[item.id] : null;

          // Durability percent calculation
          const durPercent =
            item?.durability !== undefined && item.maxDurability
              ? Math.max(0, Math.min(100, (item.durability / item.maxDurability) * 100))
              : null;

          return (
            <div
              key={idx}
              onClick={(e) => {
                if (onSlotClick) {
                  onSlotClick(idx, e);
                } else {
                  onSelectIndex(idx);
                  sound.playClick();
                }
              }}
              className={`relative w-12 h-12 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                isSelected
                  ? 'bg-slate-700/90 border-2 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.5)] -translate-y-1'
                  : 'bg-slate-800/80 hover:bg-slate-700/60 border border-slate-700/60'
              }`}
            >
              {/* Slot Number Hint */}
              <span className="absolute top-0.5 left-1 text-[9px] font-mono text-slate-400/80">
                {idx + 1}
              </span>

              {/* Item Icon */}
              {item && (
                <div className="w-8 h-8 flex items-center justify-center pointer-events-none">
                  <ItemIcon itemId={item.id} className="w-8 h-8" />
                </div>
              )}

              {/* Stack Count Badge */}
              {item && item.count > 1 && (
                <span className="absolute bottom-0.5 right-1 text-[11px] font-mono font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">
                  {item.count}
                </span>
              )}

              {/* Durability Bar */}
              {durPercent !== null && (
                <div className="absolute bottom-1 left-1.5 right-1.5 h-1 bg-slate-950/90 rounded-full overflow-hidden border border-black/40">
                  <div
                    className={`h-full rounded-full transition-all ${
                      durPercent > 50
                        ? 'bg-emerald-400'
                        : durPercent > 20
                        ? 'bg-amber-400'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${durPercent}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* E Button to open full Inventory */}
        <button
          onClick={onOpenInventory}
          className="ml-1 px-2.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold shadow-md transition flex items-center gap-1 cursor-pointer"
          title="Press E to open Inventory & Crafting"
        >
          <span className="px-1 py-0.2 bg-emerald-800 rounded text-[10px]">E</span>
          <span>Craft</span>
        </button>
      </div>
    </div>
  );
};
