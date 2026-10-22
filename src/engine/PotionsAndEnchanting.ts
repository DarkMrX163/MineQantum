import { SlotItem, ITEM_REGISTRY } from "./InventorySystem";

export type PotionEffectId =
  | "speed"
  | "night_vision"
  | "regeneration"
  | "strength"
  | "healing";

export interface ActivePotionEffect {
  id: PotionEffectId;
  name: string;
  durationLeft: number; // in seconds
  icon: string;
  color: string;
}

export class PotionsAndEnchanting {
  public activeEffects: ActivePotionEffect[] = [];

  public applyPotion(potionId: PotionEffectId, onHeal?: (hp: number) => void): void {
    if (potionId === "healing") {
      onHeal?.(8);
      return;
    }

    const existing = this.activeEffects.find((e) => e.id === potionId);
    if (existing) {
      existing.durationLeft = 120; // Reset to 2 minutes
    } else {
      let name = "Potion of Swiftness";
      let icon = "⚡";
      let color = "#38bdf8";

      if (potionId === "night_vision") {
        name = "Potion of Night Vision";
        icon = "👁️";
        color = "#10b981";
      } else if (potionId === "regeneration") {
        name = "Potion of Regeneration";
        icon = "💖";
        color = "#ec4899";
      } else if (potionId === "strength") {
        name = "Potion of Strength";
        icon = "🗡️";
        color = "#a855f7";
      }

      this.activeEffects.push({
        id: potionId,
        name,
        durationLeft: 120,
        icon,
        color,
      });
    }
  }

  public update(
    dt: number,
    onHealPlayer?: (hp: number) => void,
  ): {
    hasSpeed: boolean;
    hasNightVision: boolean;
    hasStrength: boolean;
    hasRegen: boolean;
  } {
    let hasSpeed = false;
    let hasNightVision = false;
    let hasStrength = false;
    let hasRegen = false;

    for (let i = this.activeEffects.length - 1; i >= 0; i--) {
      const effect = this.activeEffects[i];
      effect.durationLeft -= dt;

      if (effect.id === "speed") hasSpeed = true;
      if (effect.id === "night_vision") hasNightVision = true;
      if (effect.id === "strength") hasStrength = true;
      if (effect.id === "regeneration") {
        hasRegen = true;
        if (Math.random() < dt * 0.4) {
          onHealPlayer?.(1);
        }
      }

      if (effect.durationLeft <= 0) {
        this.activeEffects.splice(i, 1);
      }
    }

    return { hasSpeed, hasNightVision, hasStrength, hasRegen };
  }

  public enchantItem(
    item: SlotItem,
    enchantmentType: "sharpness" | "efficiency" | "unbreaking" | "protection",
  ): SlotItem {
    const newItem = { ...item };
    
    // Attach enchantment name tag
    const enchName =
      enchantmentType === "sharpness"
        ? "✨ Sharpness III"
        : enchantmentType === "efficiency"
          ? "⚡ Efficiency IV"
          : enchantmentType === "protection"
            ? "🛡️ Protection IV"
            : "💎 Unbreaking III";

    if (enchantmentType === "unbreaking") {
      const maxD = newItem.maxDurability || ITEM_REGISTRY[newItem.id]?.maxDurability || 100;
      newItem.maxDurability = Math.floor(maxD * 2.2);
      newItem.durability = newItem.maxDurability;
    }

    return newItem;
  }
}
