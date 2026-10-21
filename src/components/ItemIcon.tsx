import React from 'react';
import { ITEM_REGISTRY } from '../engine/InventorySystem';

interface ItemIconProps {
  itemId: string;
  className?: string;
}

export const ItemIcon: React.FC<ItemIconProps> = ({ itemId, className = 'w-8 h-8' }) => {
  const itemDef = ITEM_REGISTRY[itemId];

  if (!itemDef) {
    return <div className={`${className} bg-slate-700/50 rounded flex items-center justify-center text-[10px]`}>?</div>;
  }

  switch (itemId) {
    case 'diamond_pickaxe':
      return (
        <svg viewBox="0 0 32 32" className={`${className} drop-shadow-md`} style={{ imageRendering: 'pixelated' }}>
          {/* Handle (diagonal brown wood) */}
          <line x1="7" y1="25" x2="21" y2="11" stroke="#5c2c06" strokeWidth="3" strokeLinecap="square" />
          <line x1="9" y1="23" x2="20" y2="12" stroke="#92400e" strokeWidth="2" strokeLinecap="square" />
          {/* Pickaxe Head (curved diamond) */}
          <path
            d="M 12 7 C 16 5, 23 5, 27 9 C 27 13, 23 16, 21 16 L 19 14 C 20 12, 23 10, 22 8 C 20 7, 18 10, 16 11 Z"
            fill="#38bdf8"
            stroke="#0284c7"
            strokeWidth="1.2"
          />
          {/* Diamond Shimmer highlight */}
          <circle cx="23" cy="8" r="1.2" fill="#e0f2fe" />
          <circle cx="16" cy="7" r="1" fill="#bae6fd" />
        </svg>
      );

    case 'stone_pickaxe':
      return (
        <svg viewBox="0 0 32 32" className={`${className} drop-shadow-md`} style={{ imageRendering: 'pixelated' }}>
          <line x1="7" y1="25" x2="21" y2="11" stroke="#5c2c06" strokeWidth="3" strokeLinecap="square" />
          <line x1="9" y1="23" x2="20" y2="12" stroke="#92400e" strokeWidth="2" strokeLinecap="square" />
          <path
            d="M 12 7 C 16 5, 23 5, 27 9 C 27 13, 23 16, 21 16 L 19 14 C 20 12, 23 10, 22 8 C 20 7, 18 10, 16 11 Z"
            fill="#94a3b8"
            stroke="#475569"
            strokeWidth="1.2"
          />
        </svg>
      );

    case 'wooden_pickaxe':
      return (
        <svg viewBox="0 0 32 32" className={`${className} drop-shadow-md`} style={{ imageRendering: 'pixelated' }}>
          <line x1="7" y1="25" x2="21" y2="11" stroke="#451a03" strokeWidth="3" strokeLinecap="square" />
          <line x1="9" y1="23" x2="20" y2="12" stroke="#78350f" strokeWidth="2" strokeLinecap="square" />
          <path
            d="M 12 7 C 16 5, 23 5, 27 9 C 27 13, 23 16, 21 16 L 19 14 C 20 12, 23 10, 22 8 C 20 7, 18 10, 16 11 Z"
            fill="#b45309"
            stroke="#78350f"
            strokeWidth="1.2"
          />
        </svg>
      );

    case 'diamond_axe':
      return (
        <svg viewBox="0 0 32 32" className={`${className} drop-shadow-md`} style={{ imageRendering: 'pixelated' }}>
          <line x1="8" y1="24" x2="22" y2="10" stroke="#5c2c06" strokeWidth="3" strokeLinecap="square" />
          <rect x="18" y="7" width="8" height="9" rx="1" fill="#38bdf8" stroke="#0284c7" strokeWidth="1.2" />
          <circle cx="21" cy="10" r="1.2" fill="#e0f2fe" />
        </svg>
      );

    case 'wooden_axe':
      return (
        <svg viewBox="0 0 32 32" className={`${className} drop-shadow-md`} style={{ imageRendering: 'pixelated' }}>
          <line x1="8" y1="24" x2="22" y2="10" stroke="#5c2c06" strokeWidth="3" strokeLinecap="square" />
          <rect x="18" y="7" width="8" height="9" rx="1" fill="#b45309" stroke="#78350f" strokeWidth="1.2" />
        </svg>
      );

    case 'diamond_sword':
      return (
        <svg viewBox="0 0 32 32" className={`${className} drop-shadow-md`} style={{ imageRendering: 'pixelated' }}>
          <line x1="6" y1="26" x2="11" y2="21" stroke="#5c2c06" strokeWidth="2.5" />
          <line x1="9" y1="24" x2="13" y2="20" stroke="#0284c7" strokeWidth="4" />
          <polygon points="12,19 24,7 26,9 14,21" fill="#38bdf8" stroke="#0284c7" strokeWidth="1" />
          <polygon points="24,7 26,9 27,6" fill="#e0f2fe" />
        </svg>
      );

    case 'diamond_shovel':
      return (
        <svg viewBox="0 0 32 32" className={`${className} drop-shadow-md`} style={{ imageRendering: 'pixelated' }}>
          <line x1="8" y1="24" x2="20" y2="12" stroke="#5c2c06" strokeWidth="3" strokeLinecap="square" />
          <rect x="19" y="7" width="6" height="6" transform="rotate(-45 22 10)" fill="#38bdf8" stroke="#0284c7" strokeWidth="1.2" />
        </svg>
      );

    case 'stick':
      return (
        <svg viewBox="0 0 32 32" className={className} style={{ imageRendering: 'pixelated' }}>
          <line x1="8" y1="24" x2="24" y2="8" stroke="#5c2c06" strokeWidth="4" strokeLinecap="square" />
          <line x1="9" y1="23" x2="23" y2="9" stroke="#92400e" strokeWidth="2" strokeLinecap="square" />
        </svg>
      );

    case 'diamond':
      return (
        <svg viewBox="0 0 32 32" className={`${className} drop-shadow-md`} style={{ imageRendering: 'pixelated' }}>
          <polygon points="16,6 25,13 16,26 7,13" fill="#38bdf8" stroke="#0284c7" strokeWidth="1.5" />
          <polygon points="16,6 20,13 16,26 12,13" fill="#7dd3fc" />
          <polygon points="16,6 20,13 16,16 12,13" fill="#bae6fd" />
        </svg>
      );

    case 'coal':
      return (
        <svg viewBox="0 0 32 32" className={className}>
          <polygon points="10,10 18,7 24,12 22,22 13,24 8,18" fill="#1e293b" stroke="#0f172a" strokeWidth="1.5" />
          <polygon points="12,12 18,9 20,15 15,18" fill="#334155" />
        </svg>
      );

    case 'apple':
      return (
        <svg viewBox="0 0 32 32" className={`${className} drop-shadow-md`}>
          <line x1="16" y1="8" x2="19" y2="4" stroke="#78350f" strokeWidth="2" strokeLinecap="round" />
          <circle cx="16" cy="18" r="9" fill="#ef4444" stroke="#b91c1c" strokeWidth="1.2" />
          <circle cx="13" cy="14" r="2.5" fill="#fca5a5" />
        </svg>
      );

    case 'bread':
      return (
        <svg viewBox="0 0 32 32" className={`${className} drop-shadow-md`}>
          <ellipse cx="16" cy="16" rx="11" ry="6" fill="#d97706" stroke="#92400e" strokeWidth="1.2" />
          <line x1="11" y1="13" x2="13" y2="19" stroke="#78350f" strokeWidth="1" />
          <line x1="16" y1="13" x2="18" y2="19" stroke="#78350f" strokeWidth="1" />
          <line x1="21" y1="13" x2="23" y2="19" stroke="#78350f" strokeWidth="1" />
        </svg>
      );

    case 'cooked_beef':
      return (
        <svg viewBox="0 0 32 32" className={`${className} drop-shadow-md`}>
          <path
            d="M 8 18 C 6 14, 10 9, 16 9 C 23 9, 26 14, 24 20 C 21 24, 11 24, 8 18 Z"
            fill="#831843"
            stroke="#500724"
            strokeWidth="1.2"
          />
          <circle cx="12" cy="14" r="2" fill="#be185d" />
          <line x1="15" y1="13" x2="20" y2="17" stroke="#fb7185" strokeWidth="1" />
        </svg>
      );

    case 'torch':
      return (
        <svg viewBox="0 0 32 32" className={className}>
          <rect x="14" y="14" width="4" height="12" fill="#78350f" stroke="#451a03" strokeWidth="1" />
          {/* Flame */}
          <circle cx="16" cy="11" r="5" fill="#f59e0b" opacity="0.4" />
          <polygon points="16,6 19,12 13,12" fill="#ef4444" />
          <polygon points="16,7 18,12 14,12" fill="#fbbf24" />
        </svg>
      );

    case 'crafting_table':
      return (
        <svg viewBox="0 0 32 32" className={className}>
          {/* Isometric Cube */}
          <polygon points="16,6 26,11 16,16 6,11" fill="#b45309" stroke="#78350f" strokeWidth="1" />
          <polygon points="6,11 16,16 16,26 6,21" fill="#92400e" stroke="#78350f" strokeWidth="1" />
          <polygon points="16,16 26,11 26,21 16,26" fill="#78350f" stroke="#451a03" strokeWidth="1" />
          {/* Grid pattern on top face */}
          <line x1="16" y1="11" x2="21" y2="13.5" stroke="#451a03" strokeWidth="0.8" />
          <line x1="11" y1="13.5" x2="16" y2="11" stroke="#451a03" strokeWidth="0.8" />
        </svg>
      );

    case 'furnace':
      return (
        <svg viewBox="0 0 32 32" className={className}>
          <polygon points="16,6 26,11 16,16 6,11" fill="#64748b" stroke="#334155" strokeWidth="1" />
          <polygon points="6,11 16,16 16,26 6,21" fill="#475569" stroke="#334155" strokeWidth="1" />
          <polygon points="16,16 26,11 26,21 16,26" fill="#334155" stroke="#1e293b" strokeWidth="1" />
          {/* Furnace door */}
          <rect x="8" y="16" width="5" height="5" fill="#0f172a" />
          <rect x="9" y="18" width="3" height="3" fill="#f97316" />
        </svg>
      );

    case 'feather':
      return (
        <svg viewBox="0 0 32 32" className={`${className} drop-shadow-sm`}>
          <line x1="8" y1="24" x2="24" y2="8" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
          <path
            d="M 12 18 C 10 14, 15 10, 24 8 C 22 17, 18 22, 14 20 Z"
            fill="#f8fafc"
            stroke="#cbd5e1"
            strokeWidth="1"
          />
          <path d="M 14 16 L 22 10" stroke="#cbd5e1" strokeWidth="0.8" />
        </svg>
      );

    case 'leather':
      return (
        <svg viewBox="0 0 32 32" className={`${className} drop-shadow-sm`}>
          <path
            d="M 10 8 C 13 9, 19 9, 22 8 C 24 12, 23 20, 21 24 C 18 23, 14 23, 11 24 C 9 20, 8 12, 10 8 Z"
            fill="#9a3412"
            stroke="#7c2d12"
            strokeWidth="1.2"
          />
          <path d="M 13 12 C 16 13, 16 19, 19 20" stroke="#c2410c" strokeWidth="1" strokeLinecap="round" />
        </svg>
      );

    case 'bone':
      return (
        <svg viewBox="0 0 32 32" className={`${className} drop-shadow-sm`}>
          <line x1="10" y1="22" x2="22" y2="10" stroke="#e2e8f0" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="8" cy="21" r="2.2" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="0.8" />
          <circle cx="11" cy="24" r="2.2" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="0.8" />
          <circle cx="21" cy="8" r="2.2" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="0.8" />
          <circle cx="24" cy="11" r="2.2" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="0.8" />
        </svg>
      );

    case 'gunpowder':
      return (
        <svg viewBox="0 0 32 32" className={className}>
          <polygon points="10,24 22,24 25,18 20,13 12,13 7,18" fill="#475569" stroke="#334155" strokeWidth="1" />
          <circle cx="16" cy="18" r="4" fill="#64748b" />
          <circle cx="14" cy="17" r="1.5" fill="#94a3b8" />
        </svg>
      );

    case 'rotten_flesh':
      return (
        <svg viewBox="0 0 32 32" className={`${className} drop-shadow-sm`}>
          <path
            d="M 9 18 C 7 13, 11 10, 16 10 C 22 10, 25 15, 23 21 C 20 25, 12 24, 9 18 Z"
            fill="#854d0e"
            stroke="#58310c"
            strokeWidth="1.2"
          />
          <circle cx="13" cy="14" r="2" fill="#4d7c0f" />
          <circle cx="18" cy="18" r="1.5" fill="#3f6212" />
        </svg>
      );

    case 'ender_pearl':
      return (
        <svg viewBox="0 0 32 32" className={`${className} drop-shadow-md`}>
          <circle cx="16" cy="16" r="9" fill="#0d9488" stroke="#115e59" strokeWidth="1.2" />
          <circle cx="16" cy="16" r="6" fill="#14b8a6" />
          <circle cx="14" cy="14" r="2.5" fill="#99f6e4" />
        </svg>
      );

    case 'wool':
      return (
        <svg viewBox="0 0 32 32" className={className}>
          <polygon points="16,6 26,11 16,16 6,11" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" />
          <polygon points="6,11 16,16 16,26 6,21" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1" />
          <polygon points="16,16 26,11 26,21 16,26" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />
        </svg>
      );

    case 'raw_porkchop':
      return (
        <svg viewBox="0 0 32 32" className={`${className} drop-shadow-sm`}>
          <path
            d="M 9 18 C 7 13, 11 9, 17 9 C 23 9, 26 14, 24 21 C 21 25, 12 24, 9 18 Z"
            fill="#f472b6"
            stroke="#db2777"
            strokeWidth="1.2"
          />
          <circle cx="13" cy="14" r="2" fill="#fbcfe8" />
          <line x1="16" y1="13" x2="20" y2="18" stroke="#fdf2f8" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );

    default: {
      // General Isometric Block representation
      const color = itemDef.color || '#64748b';
      return (
        <svg viewBox="0 0 32 32" className={className}>
          {/* Top face */}
          <polygon points="16,6 26,11 16,16 6,11" fill={color} stroke="#00000033" strokeWidth="1" />
          {/* Left face (shadowed) */}
          <polygon points="6,11 16,16 16,26 6,21" fill={color} filter="brightness(0.85)" stroke="#00000033" strokeWidth="1" />
          {/* Right face (darker shadow) */}
          <polygon points="16,16 26,11 26,21 16,26" fill={color} filter="brightness(0.7)" stroke="#00000033" strokeWidth="1" />
          {itemId === 'grass_block' && (
            <polygon points="16,6 26,11 16,16 6,11" fill="#22c55e" stroke="#15803d" strokeWidth="1" />
          )}
        </svg>
      );
    }
  }
};
