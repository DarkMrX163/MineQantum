import { SlotItem } from "./InventorySystem";

export interface ActivePotionEffect {
  id: "speed" | "night_vision" | "regeneration";
  name: string;
  durationLeft: number; // in seconds
  icon: string;
}

export class PotionsAndEnchanting {
  public activeEffects: ActivePotionEffect[] = [];

  public applyPotion(
    potionId: "speed" | "night_vision" | "regeneration",
  ): void {
    const existing = this.activeEffects.find((e) => e.id === potionId);
    if (existing) {
      existing.durationLeft = 120; // Reset to 2 minutes
    } else {
      let name = "Potion of Speed";
      let icon = "⚡";
      if (potionId === "night_vision") {
        name = "Potion of Night Vision";
        icon = "👁️";
      } else if (potionId === "regeneration") {
        name = "Potion of Regeneration";
        icon = "💖";
      }

      this.activeEffects.push({
        id: potionId,
        name,
        durationLeft: 120,
        icon,
      });
    }
  }

  public update(
    dt: number,
    onHealPlayer?: (hp: number) => void,
  ): { hasSpeed: boolean; hasNightVision: boolean } {
    let hasSpeed = false;
    let hasNightVision = false;

    for (let i = this.activeEffects.length - 1; i >= 0; i--) {
      const effect = this.activeEffects[i];
      effect.durationLeft -= dt;

      if (effect.id === "speed") hasSpeed = true;
      if (effect.id === "night_vision") hasNightVision = true;
      if (effect.id === "regeneration" && Math.random() < dt * 0.5) {
        onHealPlayer?.(1);
      }

      if (effect.durationLeft <= 0) {
        this.activeEffects.splice(i, 1);
      }
    }

    return { hasSpeed, hasNightVision };
  }

  public enchantItem(
    item: SlotItem,
    enchantmentType: "sharpness" | "efficiency" | "unbreaking",
  ): SlotItem {
    const newItem = { ...item };
    if (!newItem.id.includes("_enchanted")) {
      newItem.id = `${newItem.id}_enchanted`;
    }
    // Boost durability or mining speed
    if (enchantmentType === "unbreaking" && newItem.maxDurability) {
      newItem.maxDurability = Math.floor(newItem.maxDurability * 2.0);
      newItem.durability = newItem.maxDurability;
    }
    return newItem;
  }
}
