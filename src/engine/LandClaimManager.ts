export interface ClaimedChunk {
  chunkKey: string; // "cx,cz"
  cx: number;
  cz: number;
  ownerId: string;
  ownerName: string;
  claimedAt: number;
}

export class LandClaimManager {
  public claims: Map<string, ClaimedChunk> = new Map();
  public localPlayerId: string = "";

  constructor(localPlayerId: string = "") {
    this.localPlayerId = localPlayerId;
  }

  public setLocalPlayerId(id: string): void {
    this.localPlayerId = id;
  }

  public getChunkKey(gx: number, gz: number): string {
    const cx = Math.floor(gx / 16);
    const cz = Math.floor(gz / 16);
    return `${cx},${cz}`;
  }

  public isChunkClaimed(gx: number, gz: number): ClaimedChunk | undefined {
    const key = this.getChunkKey(gx, gz);
    return this.claims.get(key);
  }

  /**
   * Returns true if local player is allowed to modify block at (gx, gy, gz)
   */
  public canPlayerEditBlock(
    gx: number,
    gz: number,
  ): { allowed: boolean; ownerName?: string } {
    const claim = this.isChunkClaimed(gx, gz);
    if (!claim) return { allowed: true };
    if (claim.ownerId === this.localPlayerId) return { allowed: true };

    return { allowed: false, ownerName: claim.ownerName };
  }

  public claimChunk(
    cx: number,
    cz: number,
    ownerId: string,
    ownerName: string,
  ): boolean {
    const key = `${cx},${cz}`;
    if (this.claims.has(key)) return false;

    this.claims.set(key, {
      chunkKey: key,
      cx,
      cz,
      ownerId,
      ownerName,
      claimedAt: Date.now(),
    });
    return true;
  }

  public unclaimChunk(cx: number, cz: number, ownerId: string): boolean {
    const key = `${cx},${cz}`;
    const claim = this.claims.get(key);
    if (!claim) return false;
    if (claim.ownerId !== ownerId) return false;

    this.claims.delete(key);
    return true;
  }
}
