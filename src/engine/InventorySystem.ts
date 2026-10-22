import * as THREE from 'three';
import { BLOCK, BlockId } from './types';
import { ChunkManager } from './ChunkManager';
import { sound } from './AudioEngine';

/**
 * Slot Data Structure conforming to specification:
 * { id: 'diamond_pickaxe', count: 1, durability: 1561, maxStack: 64 }
 */
export interface SlotItem {
  id: string;
  count: number;
  durability?: number;
  maxDurability?: number;
  maxStack: number;
}

export interface ArmorSlotsState {
  helmet: SlotItem | null;
  chestplate: SlotItem | null;
  leggings: SlotItem | null;
  boots: SlotItem | null;
}

export function calculateTotalArmorPoints(armorSlots: ArmorSlotsState): number {
  let total = 0;
  if (armorSlots.helmet) {
    const def = ITEM_REGISTRY[armorSlots.helmet.id];
    if (def && def.armorPoints) total += def.armorPoints;
  }
  if (armorSlots.chestplate) {
    const def = ITEM_REGISTRY[armorSlots.chestplate.id];
    if (def && def.armorPoints) total += def.armorPoints;
  }
  if (armorSlots.leggings) {
    const def = ITEM_REGISTRY[armorSlots.leggings.id];
    if (def && def.armorPoints) total += def.armorPoints;
  }
  if (armorSlots.boots) {
    const def = ITEM_REGISTRY[armorSlots.boots.id];
    if (def && def.armorPoints) total += def.armorPoints;
  }
  return Math.min(20, total);
}

export interface ItemDefinition {
  id: string;
  name: string;
  type: 'block' | 'tool' | 'weapon' | 'material' | 'food' | 'armor';
  blockId?: BlockId;
  toolType?: 'pickaxe' | 'axe' | 'shovel' | 'sword' | 'none';
  toolTier?: 'none' | 'wood' | 'stone' | 'iron' | 'diamond';
  armorSlot?: 'helmet' | 'chestplate' | 'leggings' | 'boots';
  armorPoints?: number;
  miningSpeedMultiplier: number;
  attackDamage?: number;
  foodValue?: number;
  maxStack: number;
  maxDurability?: number;
  color: string;
  description: string;
}

export const ITEM_REGISTRY: Record<string, ItemDefinition> = {
  // Tools & Weapons
  diamond_pickaxe: {
    id: 'diamond_pickaxe',
    name: 'Diamond Pickaxe',
    type: 'tool',
    toolType: 'pickaxe',
    toolTier: 'diamond',
    miningSpeedMultiplier: 12.0,
    attackDamage: 5,
    maxStack: 1,
    maxDurability: 1561,
    color: '#38bdf8',
    description: 'Instantly shatters stone and ores. Extreme durability.',
  },
  stone_pickaxe: {
    id: 'stone_pickaxe',
    name: 'Stone Pickaxe',
    type: 'tool',
    toolType: 'pickaxe',
    toolTier: 'stone',
    miningSpeedMultiplier: 4.0,
    attackDamage: 3,
    maxStack: 1,
    maxDurability: 131,
    color: '#94a3b8',
    description: 'Sturdy stone pickaxe for mining stone and minerals.',
  },
  wooden_pickaxe: {
    id: 'wooden_pickaxe',
    name: 'Wooden Pickaxe',
    type: 'tool',
    toolType: 'pickaxe',
    toolTier: 'wood',
    miningSpeedMultiplier: 2.0,
    attackDamage: 2,
    maxStack: 1,
    maxDurability: 59,
    color: '#b45309',
    description: 'Basic wooden pickaxe. Allows collecting stone.',
  },
  diamond_axe: {
    id: 'diamond_axe',
    name: 'Diamond Axe',
    type: 'tool',
    toolType: 'axe',
    toolTier: 'diamond',
    miningSpeedMultiplier: 12.0,
    attackDamage: 9,
    maxStack: 1,
    maxDurability: 1561,
    color: '#38bdf8',
    description: 'Chops trees and wooden blocks in an instant.',
  },
  wooden_axe: {
    id: 'wooden_axe',
    name: 'Wooden Axe',
    type: 'tool',
    toolType: 'axe',
    toolTier: 'wood',
    miningSpeedMultiplier: 2.5,
    attackDamage: 3,
    maxStack: 1,
    maxDurability: 59,
    color: '#b45309',
    description: 'Helpful for cutting wood logs.',
  },
  diamond_sword: {
    id: 'diamond_sword',
    name: 'Diamond Sword',
    type: 'weapon',
    toolType: 'sword',
    toolTier: 'diamond',
    miningSpeedMultiplier: 1.5,
    attackDamage: 7,
    maxStack: 1,
    maxDurability: 1561,
    color: '#38bdf8',
    description: '+7 Attack Damage. Defends against hostile mobs.',
  },
  diamond_shovel: {
    id: 'diamond_shovel',
    name: 'Diamond Shovel',
    type: 'tool',
    toolType: 'shovel',
    toolTier: 'diamond',
    miningSpeedMultiplier: 12.0,
    attackDamage: 4,
    maxStack: 1,
    maxDurability: 1561,
    color: '#38bdf8',
    description: 'Instantly digs dirt, grass, and sand.',
  },

  // Armor Sets (Diamond, Iron, Leather)
  diamond_helmet: {
    id: 'diamond_helmet',
    name: 'Diamond Helmet',
    type: 'armor',
    armorSlot: 'helmet',
    armorPoints: 3,
    miningSpeedMultiplier: 1.0,
    maxStack: 1,
    maxDurability: 363,
    color: '#38bdf8',
    description: '+3 Armor Points. Extreme durability head protection.',
  },
  diamond_chestplate: {
    id: 'diamond_chestplate',
    name: 'Diamond Chestplate',
    type: 'armor',
    armorSlot: 'chestplate',
    armorPoints: 8,
    miningSpeedMultiplier: 1.0,
    maxStack: 1,
    maxDurability: 528,
    color: '#38bdf8',
    description: '+8 Armor Points. Legendary chest armor.',
  },
  diamond_leggings: {
    id: 'diamond_leggings',
    name: 'Diamond Leggings',
    type: 'armor',
    armorSlot: 'leggings',
    armorPoints: 6,
    miningSpeedMultiplier: 1.0,
    maxStack: 1,
    maxDurability: 495,
    color: '#38bdf8',
    description: '+6 Armor Points. Sturdy diamond leg guards.',
  },
  diamond_boots: {
    id: 'diamond_boots',
    name: 'Diamond Boots',
    type: 'armor',
    armorSlot: 'boots',
    armorPoints: 3,
    miningSpeedMultiplier: 1.0,
    maxStack: 1,
    maxDurability: 429,
    color: '#38bdf8',
    description: '+3 Armor Points. Reinforced diamond boots.',
  },

  iron_helmet: {
    id: 'iron_helmet',
    name: 'Iron Helmet',
    type: 'armor',
    armorSlot: 'helmet',
    armorPoints: 2,
    miningSpeedMultiplier: 1.0,
    maxStack: 1,
    maxDurability: 165,
    color: '#e2e8f0',
    description: '+2 Armor Points. Sturdy iron helmet.',
  },
  iron_chestplate: {
    id: 'iron_chestplate',
    name: 'Iron Chestplate',
    type: 'armor',
    armorSlot: 'chestplate',
    armorPoints: 6,
    miningSpeedMultiplier: 1.0,
    maxStack: 1,
    maxDurability: 240,
    color: '#e2e8f0',
    description: '+6 Armor Points. Heavy iron plate mail.',
  },
  iron_leggings: {
    id: 'iron_leggings',
    name: 'Iron Leggings',
    type: 'armor',
    armorSlot: 'leggings',
    armorPoints: 5,
    miningSpeedMultiplier: 1.0,
    maxStack: 1,
    maxDurability: 225,
    color: '#e2e8f0',
    description: '+5 Armor Points. Reliable iron leggings.',
  },
  iron_boots: {
    id: 'iron_boots',
    name: 'Iron Boots',
    type: 'armor',
    armorSlot: 'boots',
    armorPoints: 2,
    miningSpeedMultiplier: 1.0,
    maxStack: 1,
    maxDurability: 195,
    color: '#e2e8f0',
    description: '+2 Armor Points. Iron plated boots.',
  },

  leather_helmet: {
    id: 'leather_helmet',
    name: 'Leather Cap',
    type: 'armor',
    armorSlot: 'helmet',
    armorPoints: 1,
    miningSpeedMultiplier: 1.0,
    maxStack: 1,
    maxDurability: 55,
    color: '#9a3412',
    description: '+1 Armor Point. Light leather headwear.',
  },
  leather_chestplate: {
    id: 'leather_chestplate',
    name: 'Leather Tunic',
    type: 'armor',
    armorSlot: 'chestplate',
    armorPoints: 3,
    miningSpeedMultiplier: 1.0,
    maxStack: 1,
    maxDurability: 80,
    color: '#9a3412',
    description: '+3 Armor Points. Basic leather tunic.',
  },
  leather_leggings: {
    id: 'leather_leggings',
    name: 'Leather Pants',
    type: 'armor',
    armorSlot: 'leggings',
    armorPoints: 2,
    miningSpeedMultiplier: 1.0,
    maxStack: 1,
    maxDurability: 75,
    color: '#9a3412',
    description: '+2 Armor Points. Flexible leather pants.',
  },
  leather_boots: {
    id: 'leather_boots',
    name: 'Leather Boots',
    type: 'armor',
    armorSlot: 'boots',
    armorPoints: 1,
    miningSpeedMultiplier: 1.0,
    maxStack: 1,
    maxDurability: 65,
    color: '#9a3412',
    description: '+1 Armor Point. Light leather footwear.',
  },

  // Interactive Blocks
  chest: {
    id: 'chest',
    name: 'Wooden Chest',
    type: 'block',
    blockId: BLOCK.CHEST,
    miningSpeedMultiplier: 1.0,
    maxStack: 64,
    color: '#b45309',
    description: 'Storage container for 27 items.',
  },
  enchanting_table: {
    id: 'enchanting_table',
    name: 'Enchanting Table',
    type: 'block',
    blockId: BLOCK.ENCHANTING_TABLE,
    miningSpeedMultiplier: 1.0,
    maxStack: 64,
    color: '#3b82f6',
    description: 'Enchants tools, weapons, and armor with magic.',
  },
  brewing_stand: {
    id: 'brewing_stand',
    name: 'Brewing Stand',
    type: 'block',
    blockId: BLOCK.BREWING_STAND,
    miningSpeedMultiplier: 1.0,
    maxStack: 64,
    color: '#f59e0b',
    description: 'Brews powerful alchemy potions.',
  },

  // Alchemy & Potions
  potion_speed: {
    id: 'potion_speed',
    name: 'Potion of Swiftness',
    type: 'food',
    miningSpeedMultiplier: 1.0,
    foodValue: 2,
    maxStack: 16,
    color: '#38bdf8',
    description: 'Boosts movement speed by +100% for 2 minutes.',
  },
  potion_healing: {
    id: 'potion_healing',
    name: 'Potion of Healing',
    type: 'food',
    miningSpeedMultiplier: 1.0,
    foodValue: 8,
    maxStack: 16,
    color: '#f43f5e',
    description: 'Instantly restores +8 Health.',
  },
  potion_night_vision: {
    id: 'potion_night_vision',
    name: 'Potion of Night Vision',
    type: 'food',
    miningSpeedMultiplier: 1.0,
    foodValue: 2,
    maxStack: 16,
    color: '#10b981',
    description: 'Grants clear vision in pitch black caves for 2 minutes.',
  },
  potion_strength: {
    id: 'potion_strength',
    name: 'Potion of Strength',
    type: 'food',
    miningSpeedMultiplier: 1.0,
    foodValue: 2,
    maxStack: 16,
    color: '#a855f7',
    description: '+5 Attack Damage for 2 minutes.',
  },
  potion_regeneration: {
    id: 'potion_regeneration',
    name: 'Potion of Regeneration',
    type: 'food',
    miningSpeedMultiplier: 1.0,
    foodValue: 4,
    maxStack: 16,
    color: '#ec4899',
    description: 'Slowly regenerates health for 2 minutes.',
  },

  lapis_lazuli: {
    id: 'lapis_lazuli',
    name: 'Lapis Lazuli',
    type: 'material',
    miningSpeedMultiplier: 1.0,
    maxStack: 64,
    color: '#2563eb',
    description: 'Deep blue mineral used for enchanting.',
  },
  blaze_powder: {
    id: 'blaze_powder',
    name: 'Blaze Powder',
    type: 'material',
    miningSpeedMultiplier: 1.0,
    maxStack: 64,
    color: '#f97316',
    description: 'Fiery alchemy fuel for brewing stands.',
  },

  // Food Items
  apple: {
    id: 'apple',
    name: 'Red Apple',
    type: 'food',
    miningSpeedMultiplier: 1.0,
    foodValue: 4,
    maxStack: 64,
    color: '#ef4444',
    description: 'Crisp sweet apple. Restores 4 hunger units.',
  },
  bread: {
    id: 'bread',
    name: 'Bread',
    type: 'food',
    miningSpeedMultiplier: 1.0,
    foodValue: 5,
    maxStack: 64,
    color: '#f59e0b',
    description: 'Baked wheat bread loaf. Restores 5 hunger units.',
  },
  cooked_beef: {
    id: 'cooked_beef',
    name: 'Steak',
    type: 'food',
    miningSpeedMultiplier: 1.0,
    foodValue: 8,
    maxStack: 64,
    color: '#831843',
    description: 'Hearty cooked steak. Restores 8 hunger units.',
  },
  campfire: {
    id: 'campfire',
    name: 'Campfire',
    type: 'block',
    blockId: BLOCK.CAMPFIRE,
    miningSpeedMultiplier: 1.0,
    maxStack: 64,
    color: '#ea580c',
    description: 'Cozy campfire providing light, warmth, and cooking.',
  },

  // Materials
  stick: {
    id: 'stick',
    name: 'Stick',
    type: 'material',
    miningSpeedMultiplier: 1.0,
    maxStack: 64,
    color: '#92400e',
    description: 'Crafting component for tool handles and torches.',
  },
  diamond: {
    id: 'diamond',
    name: 'Diamond',
    type: 'material',
    miningSpeedMultiplier: 1.0,
    maxStack: 64,
    color: '#38bdf8',
    description: 'Precious gemstone used to forge high-tier gear.',
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald',
    type: 'material',
    miningSpeedMultiplier: 1.0,
    maxStack: 64,
    color: '#10b981',
    description: 'Sparkling green gemstone used for trading with villagers.',
  },
  wheat: {
    id: 'wheat',
    name: 'Wheat',
    type: 'material',
    miningSpeedMultiplier: 1.0,
    maxStack: 64,
    color: '#eab308',
    description: 'Golden wheat harvested from village farms.',
  },
  coal: {
    id: 'coal',
    name: 'Coal',
    type: 'material',
    miningSpeedMultiplier: 1.0,
    maxStack: 64,
    color: '#334155',
    description: 'Fuel for torches and smelting.',
  },
  feather: {
    id: 'feather',
    name: 'Feather',
    type: 'material',
    miningSpeedMultiplier: 1.0,
    maxStack: 64,
    color: '#f8fafc',
    description: 'Light soft feather dropped by birds.',
  },
  leather: {
    id: 'leather',
    name: 'Leather',
    type: 'material',
    miningSpeedMultiplier: 1.0,
    maxStack: 64,
    color: '#9a3412',
    description: 'Tough animal hide dropped by cows and cattle.',
  },
  bone: {
    id: 'bone',
    name: 'Bone',
    type: 'material',
    miningSpeedMultiplier: 1.0,
    maxStack: 64,
    color: '#e2e8f0',
    description: 'Sturdy white bone dropped by skeletons.',
  },
  gunpowder: {
    id: 'gunpowder',
    name: 'Gunpowder',
    type: 'material',
    miningSpeedMultiplier: 1.0,
    maxStack: 64,
    color: '#475569',
    description: 'Volatile explosive powder dropped by creepers.',
  },
  rotten_flesh: {
    id: 'rotten_flesh',
    name: 'Rotten Flesh',
    type: 'food',
    miningSpeedMultiplier: 1.0,
    foodValue: 2,
    maxStack: 64,
    color: '#854d0e',
    description: 'Decayed mob flesh dropped by zombies.',
  },
  ender_pearl: {
    id: 'ender_pearl',
    name: 'Ender Pearl',
    type: 'material',
    miningSpeedMultiplier: 1.0,
    maxStack: 16,
    color: '#0d9488',
    description: 'Mystical turquoise sphere dropped by an Enderman.',
  },
  wool: {
    id: 'wool',
    name: 'White Wool',
    type: 'block',
    blockId: BLOCK.DIRT,
    miningSpeedMultiplier: 1.0,
    maxStack: 64,
    color: '#f1f5f9',
    description: 'Fluffy white wool gathered from sheep.',
  },
  raw_porkchop: {
    id: 'raw_porkchop',
    name: 'Raw Porkchop',
    type: 'food',
    miningSpeedMultiplier: 1.0,
    foodValue: 3,
    maxStack: 64,
    color: '#f472b6',
    description: 'Fresh raw meat dropped by pigs.',
  },

  // Blocks
  cobblestone: {
    id: 'cobblestone',
    name: 'Cobblestone',
    type: 'block',
    blockId: BLOCK.STONE,
    miningSpeedMultiplier: 1.0,
    maxStack: 64,
    color: '#64748b',
    description: 'Rough stone dropped when mining stone with a pickaxe.',
  },
  stone: {
    id: 'stone',
    name: 'Stone',
    type: 'block',
    blockId: BLOCK.STONE,
    miningSpeedMultiplier: 1.0,
    maxStack: 64,
    color: '#78716c',
    description: 'Natural stone from caves and mountains.',
  },
  dirt: {
    id: 'dirt',
    name: 'Dirt',
    type: 'block',
    blockId: BLOCK.DIRT,
    miningSpeedMultiplier: 1.0,
    maxStack: 64,
    color: '#78350f',
    description: 'Common soil block.',
  },
  grass_block: {
    id: 'grass_block',
    name: 'Grass Block',
    type: 'block',
    blockId: BLOCK.GRASS,
    miningSpeedMultiplier: 1.0,
    maxStack: 64,
    color: '#22c55e',
    description: 'Surface terrain block topped with luscious grass.',
  },
  wood: {
    id: 'wood',
    name: 'Wood Log',
    type: 'block',
    blockId: BLOCK.WOOD,
    miningSpeedMultiplier: 1.0,
    maxStack: 64,
    color: '#854d0e',
    description: 'Oak tree trunk log. Crafts into 4 wooden planks.',
  },
  planks: {
    id: 'planks',
    name: 'Wooden Planks',
    type: 'block',
    blockId: BLOCK.PLANKS,
    miningSpeedMultiplier: 1.0,
    maxStack: 64,
    color: '#d97706',
    description: 'Versatile construction and crafting material.',
  },
  leaves: {
    id: 'leaves',
    name: 'Leaves',
    type: 'block',
    blockId: BLOCK.LEAVES,
    miningSpeedMultiplier: 1.0,
    maxStack: 64,
    color: '#15803d',
    description: 'Tree foliage.',
  },
  sand: {
    id: 'sand',
    name: 'Sand',
    type: 'block',
    blockId: BLOCK.SAND,
    miningSpeedMultiplier: 1.0,
    maxStack: 64,
    color: '#facc15',
    description: 'Granular shoreline and desert block.',
  },
  brick: {
    id: 'brick',
    name: 'Red Brick',
    type: 'block',
    blockId: BLOCK.BRICK,
    miningSpeedMultiplier: 1.0,
    maxStack: 64,
    color: '#b91c1c',
    description: 'Fired clay brick block.',
  },
  glass: {
    id: 'glass',
    name: 'Glass',
    type: 'block',
    blockId: BLOCK.GLASS,
    miningSpeedMultiplier: 1.0,
    maxStack: 64,
    color: '#a5f3fc',
    description: 'Transparent silica block.',
  },
  torch: {
    id: 'torch',
    name: 'Torch',
    type: 'block',
    blockId: BLOCK.TORCH,
    miningSpeedMultiplier: 1.0,
    maxStack: 64,
    color: '#f59e0b',
    description: 'Emits warm block light (level 14).',
  },
  crafting_table: {
    id: 'crafting_table',
    name: 'Crafting Table',
    type: 'block',
    blockId: BLOCK.CRAFTING_TABLE,
    miningSpeedMultiplier: 1.0,
    maxStack: 64,
    color: '#b45309',
    description: 'Unlocks advanced 3×3 crafting recipes.',
  },
  furnace: {
    id: 'furnace',
    name: 'Furnace',
    type: 'block',
    blockId: BLOCK.STONE,
    miningSpeedMultiplier: 1.0,
    maxStack: 64,
    color: '#475569',
    description: 'Smelting workstation.',
  },
  coal_ore: {
    id: 'coal_ore',
    name: 'Coal Ore',
    type: 'block',
    blockId: BLOCK.COAL_ORE,
    miningSpeedMultiplier: 1.0,
    maxStack: 64,
    color: '#212121',
    description: 'Found in stone underground.',
  },
  iron_ore: {
    id: 'iron_ore',
    name: 'Iron Ore',
    type: 'block',
    blockId: BLOCK.IRON_ORE,
    miningSpeedMultiplier: 1.0,
    maxStack: 64,
    color: '#d4a373',
    description: 'Valuable metal ore.',
  },
  gold_ore: {
    id: 'gold_ore',
    name: 'Gold Ore',
    type: 'block',
    blockId: BLOCK.GOLD_ORE,
    miningSpeedMultiplier: 1.0,
    maxStack: 64,
    color: '#ffb703',
    description: 'Shiny precious gold ore.',
  },
  diamond_ore: {
    id: 'diamond_ore',
    name: 'Diamond Ore',
    type: 'block',
    blockId: BLOCK.DIAMOND_ORE,
    miningSpeedMultiplier: 1.0,
    maxStack: 64,
    color: '#48cae4',
    description: 'Extremely rare gemstone ore.',
  },
  redstone_ore: {
    id: 'redstone_ore',
    name: 'Redstone Ore',
    type: 'block',
    blockId: BLOCK.REDSTONE_ORE,
    miningSpeedMultiplier: 1.0,
    maxStack: 64,
    color: '#e63946',
    description: 'Glowing magical ore.',
  },
};

/**
 * Block Hardness & Tool Compatibility Rules
 */
export interface BlockBreakRule {
  blockId: number;
  baseHardness: number; // in seconds
  preferredTool?: 'pickaxe' | 'axe' | 'shovel' | 'sword';
  requiresTool: boolean; // if true and wrong tool, drops nothing!
  minToolTier?: 'wood' | 'stone' | 'iron' | 'diamond';
  dropItemId: string | null;
  dropCount: number;
}

export const BLOCK_BREAK_RULES: Record<number, BlockBreakRule> = {
  [BLOCK.STONE]: {
    blockId: BLOCK.STONE,
    baseHardness: 1.5,
    preferredTool: 'pickaxe',
    requiresTool: false,
    dropItemId: 'cobblestone',
    dropCount: 1,
  },
  [BLOCK.DIRT]: {
    blockId: BLOCK.DIRT,
    baseHardness: 0.5,
    preferredTool: 'shovel',
    requiresTool: false,
    dropItemId: 'dirt',
    dropCount: 1,
  },
  [BLOCK.GRASS]: {
    blockId: BLOCK.GRASS,
    baseHardness: 0.6,
    preferredTool: 'shovel',
    requiresTool: false,
    dropItemId: 'dirt',
    dropCount: 1,
  },
  [BLOCK.WOOD]: {
    blockId: BLOCK.WOOD,
    baseHardness: 2.0,
    preferredTool: 'axe',
    requiresTool: false,
    dropItemId: 'wood',
    dropCount: 1,
  },
  [BLOCK.PLANKS]: {
    blockId: BLOCK.PLANKS,
    baseHardness: 1.5,
    preferredTool: 'axe',
    requiresTool: false,
    dropItemId: 'planks',
    dropCount: 1,
  },
  [BLOCK.LEAVES]: {
    blockId: BLOCK.LEAVES,
    baseHardness: 0.2,
    requiresTool: false,
    dropItemId: 'leaves',
    dropCount: 1,
  },
  [BLOCK.SAND]: {
    blockId: BLOCK.SAND,
    baseHardness: 0.5,
    preferredTool: 'shovel',
    requiresTool: false,
    dropItemId: 'sand',
    dropCount: 1,
  },
  [BLOCK.BRICK]: {
    blockId: BLOCK.BRICK,
    baseHardness: 2.0,
    preferredTool: 'pickaxe',
    requiresTool: false,
    dropItemId: 'brick',
    dropCount: 1,
  },
  [BLOCK.GLASS]: {
    blockId: BLOCK.GLASS,
    baseHardness: 0.3,
    requiresTool: false,
    dropItemId: 'glass',
    dropCount: 1,
  },
  [BLOCK.TORCH]: {
    blockId: BLOCK.TORCH,
    baseHardness: 0.05,
    requiresTool: false,
    dropItemId: 'torch',
    dropCount: 1,
  },
  [BLOCK.CRAFTING_TABLE]: {
    blockId: BLOCK.CRAFTING_TABLE,
    baseHardness: 1.5,
    preferredTool: 'axe',
    requiresTool: false,
    dropItemId: 'crafting_table',
    dropCount: 1,
  },
  [BLOCK.COAL_ORE]: {
    blockId: BLOCK.COAL_ORE,
    baseHardness: 2.0,
    preferredTool: 'pickaxe',
    requiresTool: false,
    dropItemId: 'coal',
    dropCount: 1,
  },
  [BLOCK.IRON_ORE]: {
    blockId: BLOCK.IRON_ORE,
    baseHardness: 2.5,
    preferredTool: 'pickaxe',
    requiresTool: false,
    dropItemId: 'iron_ore',
    dropCount: 1,
  },
  [BLOCK.GOLD_ORE]: {
    blockId: BLOCK.GOLD_ORE,
    baseHardness: 3.0,
    preferredTool: 'pickaxe',
    requiresTool: false,
    dropItemId: 'gold_ore',
    dropCount: 1,
  },
  [BLOCK.DIAMOND_ORE]: {
    blockId: BLOCK.DIAMOND_ORE,
    baseHardness: 3.5,
    preferredTool: 'pickaxe',
    requiresTool: false,
    dropItemId: 'diamond',
    dropCount: 1,
  },
  [BLOCK.REDSTONE_ORE]: {
    blockId: BLOCK.REDSTONE_ORE,
    baseHardness: 2.5,
    preferredTool: 'pickaxe',
    requiresTool: false,
    dropItemId: 'redstone_ore',
    dropCount: 1,
  },
  [BLOCK.CAMPFIRE]: {
    blockId: BLOCK.CAMPFIRE,
    baseHardness: 0.5,
    preferredTool: 'axe',
    requiresTool: false,
    dropItemId: 'campfire',
    dropCount: 1,
  },
};

/**
 * Calculates breaking duration (seconds) and whether a valid drop is yielded.
 */
export function calculateBlockBreaking(
  blockId: number,
  heldItem: SlotItem | null
): { breakDuration: number; canHarvest: boolean; dropItemId: string | null; dropCount: number } {
  const rule = BLOCK_BREAK_RULES[blockId];
  if (!rule) {
    // Unbreakable or non-interactive block (e.g. Bedrock, Water, Lava)
    return { breakDuration: 999999, canHarvest: false, dropItemId: null, dropCount: 0 };
  }

  const itemDef = heldItem ? ITEM_REGISTRY[heldItem.id] : null;
  const isPreferred = rule.preferredTool && itemDef?.toolType === rule.preferredTool;

  // Tool speed multiplier
  let speedMultiplier = 1.0;
  if (isPreferred && itemDef) {
    speedMultiplier = itemDef.miningSpeedMultiplier;
  }

  // Tier check
  const tierRanks: Record<string, number> = { none: 0, wood: 1, stone: 2, iron: 3, diamond: 4 };
  const requiredRank = rule.minToolTier ? tierRanks[rule.minToolTier] : 0;
  const currentRank = itemDef?.toolTier ? tierRanks[itemDef.toolTier] : 0;

  const canHarvest: boolean = !rule.requiresTool || Boolean(isPreferred && currentRank >= requiredRank);

  // In Minecraft:
  // If can harvest with tool: time = (baseHardness * 1.5) / speed
  // If cannot harvest (e.g. hand on stone): time = (baseHardness * 5.0) / 1.0
  let breakDuration = 0;
  if (rule.baseHardness <= 0.05) {
    breakDuration = 0.05; // Instantaneous torch break
  } else if (canHarvest) {
    breakDuration = (rule.baseHardness * 1.5) / speedMultiplier;
  } else {
    breakDuration = rule.baseHardness * 3.33; // Hand breaks stone slowly (~5.0 seconds)
  }

  // Diamond Pickaxe breaks stone almost instantaneously (~0.18s)
  if (itemDef?.id === 'diamond_pickaxe' && blockId === BLOCK.STONE) {
    breakDuration = 0.12;
  }

  return {
    breakDuration,
    canHarvest,
    dropItemId: canHarvest ? rule.dropItemId : null,
    dropCount: canHarvest ? rule.dropCount : 0,
  };
}

/**
 * 2D Crafting Recipe Pattern
 */
export interface CraftingRecipe {
  id: string;
  name: string;
  width: number;
  height: number;
  pattern: (string | null)[][]; // 2D array of item IDs
  result: SlotItem;
}

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  // 1 Wood Log -> 4 Wooden Planks (1x1)
  {
    id: 'wood_to_planks',
    name: 'Wooden Planks',
    width: 1,
    height: 1,
    pattern: [['wood']],
    result: { id: 'planks', count: 4, maxStack: 64 },
  },
  // 2 Planks vertically -> 4 Sticks (1x2)
  {
    id: 'planks_to_sticks',
    name: 'Sticks',
    width: 1,
    height: 2,
    pattern: [['planks'], ['planks']],
    result: { id: 'stick', count: 4, maxStack: 64 },
  },
  // 4 Planks (2x2) -> 1 Crafting Table
  {
    id: 'crafting_table',
    name: 'Crafting Table',
    width: 2,
    height: 2,
    pattern: [
      ['planks', 'planks'],
      ['planks', 'planks'],
    ],
    result: { id: 'crafting_table', count: 1, maxStack: 64 },
  },
  // Campfire (3x3): 3 Wood Logs + 1 Coal
  {
    id: 'campfire',
    name: 'Campfire',
    width: 3,
    height: 3,
    pattern: [
      ['wood', 'wood', 'wood'],
      [null, 'coal', null],
      [null, null, null],
    ],
    result: { id: 'campfire', count: 1, maxStack: 64 },
  },
  // Diamond Pickaxe (3x3): 3 Diamonds + 2 Sticks
  {
    id: 'diamond_pickaxe',
    name: 'Diamond Pickaxe',
    width: 3,
    height: 3,
    pattern: [
      ['diamond', 'diamond', 'diamond'],
      [null, 'stick', null],
      [null, 'stick', null],
    ],
    result: {
      id: 'diamond_pickaxe',
      count: 1,
      durability: 1561,
      maxDurability: 1561,
      maxStack: 1,
    },
  },
  // Stone Pickaxe (3x3): 3 Cobblestone + 2 Sticks
  {
    id: 'stone_pickaxe',
    name: 'Stone Pickaxe',
    width: 3,
    height: 3,
    pattern: [
      ['cobblestone', 'cobblestone', 'cobblestone'],
      [null, 'stick', null],
      [null, 'stick', null],
    ],
    result: {
      id: 'stone_pickaxe',
      count: 1,
      durability: 131,
      maxDurability: 131,
      maxStack: 1,
    },
  },
  // Wooden Pickaxe (3x3): 3 Planks + 2 Sticks
  {
    id: 'wooden_pickaxe',
    name: 'Wooden Pickaxe',
    width: 3,
    height: 3,
    pattern: [
      ['planks', 'planks', 'planks'],
      [null, 'stick', null],
      [null, 'stick', null],
    ],
    result: {
      id: 'wooden_pickaxe',
      count: 1,
      durability: 59,
      maxDurability: 59,
      maxStack: 1,
    },
  },
  // Diamond Axe (2x3)
  {
    id: 'diamond_axe',
    name: 'Diamond Axe',
    width: 2,
    height: 3,
    pattern: [
      ['diamond', 'diamond'],
      ['diamond', 'stick'],
      [null, 'stick'],
    ],
    result: {
      id: 'diamond_axe',
      count: 1,
      durability: 1561,
      maxDurability: 1561,
      maxStack: 1,
    },
  },
  // Wooden Axe (2x3)
  {
    id: 'wooden_axe',
    name: 'Wooden Axe',
    width: 2,
    height: 3,
    pattern: [
      ['planks', 'planks'],
      ['planks', 'stick'],
      [null, 'stick'],
    ],
    result: {
      id: 'wooden_axe',
      count: 1,
      durability: 59,
      maxDurability: 59,
      maxStack: 1,
    },
  },
  // Diamond Sword (1x3)
  {
    id: 'diamond_sword',
    name: 'Diamond Sword',
    width: 1,
    height: 3,
    pattern: [['diamond'], ['diamond'], ['stick']],
    result: {
      id: 'diamond_sword',
      count: 1,
      durability: 1561,
      maxDurability: 1561,
      maxStack: 1,
    },
  },
  // Diamond Shovel (1x3)
  {
    id: 'diamond_shovel',
    name: 'Diamond Shovel',
    width: 1,
    height: 3,
    pattern: [['diamond'], ['stick'], ['stick']],
    result: {
      id: 'diamond_shovel',
      count: 1,
      durability: 1561,
      maxDurability: 1561,
      maxStack: 1,
    },
  },
  // Torch (1x2): Coal or Wood + Stick -> 4 Torches
  {
    id: 'torch_coal',
    name: 'Torches',
    width: 1,
    height: 2,
    pattern: [['coal'], ['stick']],
    result: { id: 'torch', count: 4, maxStack: 64 },
  },
  {
    id: 'torch_wood',
    name: 'Torches',
    width: 1,
    height: 2,
    pattern: [['wood'], ['stick']],
    result: { id: 'torch', count: 4, maxStack: 64 },
  },
  // Furnace (3x3): 8 Cobblestone around center
  {
    id: 'furnace',
    name: 'Furnace',
    width: 3,
    height: 3,
    pattern: [
      ['cobblestone', 'cobblestone', 'cobblestone'],
      ['cobblestone', null, 'cobblestone'],
      ['cobblestone', 'cobblestone', 'cobblestone'],
    ],
    result: { id: 'furnace', count: 1, maxStack: 64 },
  },
  // 4 Sand -> 4 Glass (in recipe preview for ease)
  {
    id: 'sand_to_glass',
    name: 'Glass Block',
    width: 2,
    height: 2,
    pattern: [
      ['sand', 'sand'],
      ['sand', 'sand'],
    ],
    result: { id: 'glass', count: 4, maxStack: 64 },
  },
];

/**
 * Validates a crafting grid (2x2 or 3x3) and returns matching recipe & result
 */
export function validateCraftingGrid(
  grid: (SlotItem | null)[][],
  gridWidth: number,
  gridHeight: number
): { recipe: CraftingRecipe; result: SlotItem } | null {
  // Find bounding box of non-empty items
  let minR = gridHeight,
    maxR = -1;
  let minC = gridWidth,
    maxC = -1;
  let hasItems = false;

  for (let r = 0; r < gridHeight; r++) {
    for (let c = 0; c < gridWidth; c++) {
      if (grid[r] && grid[r][c] && grid[r][c]!.count > 0) {
        hasItems = true;
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
      }
    }
  }

  if (!hasItems) return null;

  const subH = maxR - minR + 1;
  const subW = maxC - minC + 1;

  for (const recipe of CRAFTING_RECIPES) {
    if (recipe.width === subW && recipe.height === subH) {
      let matches = true;
      for (let r = 0; r < subH; r++) {
        for (let c = 0; c < subW; c++) {
          const expected = recipe.pattern[r][c];
          const actualItem = grid[minR + r][minC + c];
          const actual = actualItem ? actualItem.id : null;

          if (expected !== actual) {
            matches = false;
            break;
          }
        }
        if (!matches) break;
      }

      if (matches) {
        return {
          recipe,
          result: { ...recipe.result },
        };
      }
    }
  }

  return null;
}

/**
 * Deducts 1 item from each ingredient slot in the active bounding box
 */
export function consumeCraftingIngredients(
  grid: (SlotItem | null)[][],
  gridWidth: number,
  gridHeight: number,
  recipe: CraftingRecipe
): void {
  // Locate top-left of pattern
  let minR = gridHeight,
    minC = gridWidth;
  for (let r = 0; r < gridHeight; r++) {
    for (let c = 0; c < gridWidth; c++) {
      if (grid[r] && grid[r][c] && grid[r][c]!.count > 0) {
        if (r < minR) minR = r;
        if (c < minC) minC = c;
      }
    }
  }

  for (let r = 0; r < recipe.height; r++) {
    for (let c = 0; c < recipe.width; c++) {
      const item = grid[minR + r][minC + c];
      if (item && item.count > 0) {
        item.count -= 1;
        if (item.count <= 0) {
          grid[minR + r][minC + c] = null;
        }
      }
    }
  }
}

/**
 * 3D Item Drops in Three.js
 * When a block is broken, spawns a miniature rotating voxel block with falling physics
 * and magnetic attraction towards player when distance < 1.5 blocks!
 */
export interface DroppedItem3D {
  id: string;
  item: SlotItem;
  mesh: THREE.Group;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  age: number;
  isGrounded: boolean;
  isMagnetized: boolean;
}

export class DroppedItemManager {
  public items: DroppedItem3D[] = [];
  private scene: THREE.Scene;
  private chunkManager: ChunkManager;
  private dropCounter: number = 0;

  constructor(scene: THREE.Scene, chunkManager: ChunkManager) {
    this.scene = scene;
    this.chunkManager = chunkManager;
  }

  /**
   * Spawns a 3D miniature item drop at world position
   */
  public spawnDrop(
    item: SlotItem,
    position: THREE.Vector3,
    initialVelocity?: THREE.Vector3
  ): DroppedItem3D {
    const id = `drop_${++this.dropCounter}_${Date.now().toString(36)}`;
    const group = new THREE.Group();

    const def = ITEM_REGISTRY[item.id];
    const colorHex = def ? parseInt(def.color.replace('#', '0x'), 16) : 0x888888;

    // Mini 3D Box or tool shape
    if (item.id === 'torch') {
      const stick = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.32, 0.06),
        new THREE.MeshLambertMaterial({ color: 0x6d4c1b })
      );
      stick.position.set(0, 0.1, 0);
      group.add(stick);

      const flame = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.09, 0.08),
        new THREE.MeshLambertMaterial({
          color: 0xf59e0b,
          emissive: 0xf59e0b,
          emissiveIntensity: 0.9,
        })
      );
      flame.position.set(0, 0.26, 0);
      group.add(flame);
      group.scale.set(0.85, 0.85, 0.85);
    } else if (item.id === 'feather') {
      const quill = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.3, 0.02),
        new THREE.MeshLambertMaterial({ color: 0xd1d5db })
      );
      const vane = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.22, 0.02),
        new THREE.MeshLambertMaterial({ color: 0xf8fafc })
      );
      vane.position.set(0.03, 0.04, 0);
      group.add(quill);
      group.add(vane);
      group.rotation.z = Math.PI / 6;
      group.scale.set(0.9, 0.9, 0.9);
    } else if (item.id === 'bone') {
      const shaft = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.28, 0.06),
        new THREE.MeshLambertMaterial({ color: 0xe2e8f0 })
      );
      const end1 = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.06, 0.09),
        new THREE.MeshLambertMaterial({ color: 0xf1f5f9 })
      );
      end1.position.set(0, 0.13, 0);
      const end2 = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.06, 0.09),
        new THREE.MeshLambertMaterial({ color: 0xf1f5f9 })
      );
      end2.position.set(0, -0.13, 0);
      group.add(shaft);
      group.add(end1);
      group.add(end2);
      group.rotation.z = Math.PI / 4;
      group.scale.set(0.85, 0.85, 0.85);
    } else if (item.id === 'leather') {
      const hide = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.2, 0.04),
        new THREE.MeshLambertMaterial({ color: 0x9a3412 })
      );
      group.add(hide);
      group.scale.set(0.85, 0.85, 0.85);
    } else if (item.id === 'ender_pearl') {
      const pearl = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 8, 8),
        new THREE.MeshLambertMaterial({
          color: 0x0d9488,
          emissive: 0x115e59,
          emissiveIntensity: 0.6,
        })
      );
      group.add(pearl);
    } else if (item.id === 'gunpowder') {
      const pouch = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.18, 0.18),
        new THREE.MeshLambertMaterial({ color: 0x475569 })
      );
      group.add(pouch);
    } else if (item.id === 'rotten_flesh' || item.id === 'raw_porkchop' || item.id === 'cooked_beef') {
      const meat = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.14, 0.16),
        new THREE.MeshLambertMaterial({ color: colorHex })
      );
      group.add(meat);
      group.scale.set(0.85, 0.85, 0.85);
    } else if (def?.type === 'block') {
      const geo = new THREE.BoxGeometry(0.26, 0.26, 0.26);
      const mat = new THREE.MeshLambertMaterial({
        color: colorHex,
        roughness: 0.8,
      } as any);
      const cube = new THREE.Mesh(geo, mat);
      cube.castShadow = true;
      group.add(cube);
    } else {
      // Tool / Item flat representation
      const headGeo = new THREE.BoxGeometry(0.24, 0.24, 0.05);
      const handleGeo = new THREE.BoxGeometry(0.06, 0.32, 0.04);
      const headMat = new THREE.MeshLambertMaterial({ color: colorHex });
      const handleMat = new THREE.MeshLambertMaterial({ color: 0x854d0e });

      const head = new THREE.Mesh(headGeo, headMat);
      head.position.set(0.08, 0.08, 0);
      const handle = new THREE.Mesh(handleGeo, handleMat);
      handle.rotation.z = Math.PI / 4;

      group.add(head);
      group.add(handle);
      group.scale.set(0.8, 0.8, 0.8);
    }

    // Initial upward pop + slight random lateral drift
    const vel =
      initialVelocity ||
      new THREE.Vector3(
        (Math.random() - 0.5) * 1.8,
        3.2 + Math.random() * 1.0,
        (Math.random() - 0.5) * 1.8
      );

    group.position.copy(position);
    this.scene.add(group);

    const dropped: DroppedItem3D = {
      id,
      item: { ...item },
      mesh: group,
      position: position.clone(),
      velocity: vel,
      age: 0,
      isGrounded: false,
      isMagnetized: false,
    };

    this.items.push(dropped);
    return dropped;
  }

  /**
   * Physics, Rotation & Magnet Attraction Tick
   */
  public update(
    deltaTime: number,
    playerPosition: THREE.Vector3,
    onCollect: (item: SlotItem) => boolean
  ): void {
    const dt = Math.min(deltaTime, 0.05);
    const gravity = -18.0;
    const toRemove: number[] = [];

    // Player pickup chest target position
    const playerTarget = playerPosition.clone().add(new THREE.Vector3(0, 0.8, 0));

    for (let i = 0; i < this.items.length; i++) {
      const drop = this.items[i];
      drop.age += dt;

      // Distance to player
      const distToPlayer = drop.position.distanceTo(playerTarget);

      // Magnet check (< 4.5 blocks so items fly into player inventory)
      if (distToPlayer < 4.5 && drop.age > 0.15) {
        drop.isMagnetized = true;
      }

      if (drop.isMagnetized) {
        // Accelerate smoothly towards player like a magnet
        const pullDir = new THREE.Vector3()
          .subVectors(playerTarget, drop.position)
          .normalize();
        const pullSpeed = Math.min(18.0, 8.0 + 12.0 * (1.0 / Math.max(0.1, distToPlayer)));

        drop.velocity.lerp(pullDir.multiplyScalar(pullSpeed), dt * 16.0);
        drop.position.addScaledVector(drop.velocity, dt);

        // Picked up into inventory!
        if (distToPlayer < 1.2) {
          const collected = onCollect(drop.item);
          if (collected) {
            sound.playItemPickup();
            this.scene.remove(drop.mesh);
            toRemove.push(i);
            continue;
          }
        }
      } else {
        // Natural physics: gravity & terrain floor collision
        drop.velocity.y += gravity * dt;
        drop.position.x += drop.velocity.x * dt;
        drop.position.z += drop.velocity.z * dt;
        drop.position.y += drop.velocity.y * dt;

        // Voxel collision check below item
        const checkX = Math.floor(drop.position.x);
        const checkY = Math.floor(drop.position.y);
        const checkZ = Math.floor(drop.position.z);
        const blockBelow = this.chunkManager.getBlockGlobal(checkX, checkY, checkZ);

        if (blockBelow !== BLOCK.AIR) {
          // Hit solid floor
          drop.position.y = checkY + 1.0;
          if (drop.velocity.y < -1.0) {
            drop.velocity.y = -drop.velocity.y * 0.25; // bounce
          } else {
            drop.velocity.y = 0;
            drop.isGrounded = true;
          }
          drop.velocity.x *= 0.85;
          drop.velocity.z *= 0.85;
        } else {
          drop.isGrounded = false;
        }
      }

      // Continuous 3D rotation & bobbing
      drop.mesh.rotation.y += 2.5 * dt;
      const bobbing = Math.sin(drop.age * 4.0) * 0.04;
      drop.mesh.position.set(
        drop.position.x,
        drop.position.y + bobbing,
        drop.position.z
      );
    }

    // Clean up collected items
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.items.splice(toRemove[i], 1);
    }
  }

  public clearAll(): void {
    for (const drop of this.items) {
      this.scene.remove(drop.mesh);
    }
    this.items = [];
  }
}
