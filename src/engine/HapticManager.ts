export class HapticManager {
  public static isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      "navigator" in window &&
      "vibrate" in navigator
    );
  }

  public static tap(): void {
    if (this.isSupported()) {
      try {
        navigator.vibrate(12);
      } catch (_) {}
    }
  }

  public static blockBreak(): void {
    if (this.isSupported()) {
      try {
        navigator.vibrate([20, 15, 25]);
      } catch (_) {}
    }
  }

  public static takeDamage(): void {
    if (this.isSupported()) {
      try {
        navigator.vibrate([50, 30, 60]);
      } catch (_) {}
    }
  }

  public static eatFood(): void {
    if (this.isSupported()) {
      try {
        navigator.vibrate([15, 10, 15, 10, 20]);
      } catch (_) {}
    }
  }
}
