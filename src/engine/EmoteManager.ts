export type EmoteType = "wave" | "dance" | "sit" | "swim" | "none";

export interface ActiveEmote {
  playerId: string;
  emote: EmoteType;
  startTime: number;
}

export class EmoteManager {
  public activeEmotes: Map<string, ActiveEmote> = new Map();

  public playEmote(playerId: string, emote: EmoteType): void {
    if (emote === "none") {
      this.activeEmotes.delete(playerId);
    } else {
      this.activeEmotes.set(playerId, {
        playerId,
        emote,
        startTime: performance.now(),
      });
    }
  }

  public getPlayerEmote(playerId: string): EmoteType {
    const active = this.activeEmotes.get(playerId);
    if (!active) return "none";
    const elapsed = (performance.now() - active.startTime) / 1000;
    if (elapsed > 6.0) {
      // Emote auto-stops after 6 seconds
      this.activeEmotes.delete(playerId);
      return "none";
    }
    return active.emote;
  }
}
