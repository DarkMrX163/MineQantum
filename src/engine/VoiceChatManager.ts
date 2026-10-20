export interface PeerAudioStream {
  playerId: string;
  peerConnection: RTCPeerConnection;
  audioElement: HTMLAudioElement;
  gainNode?: GainNode;
  isSpeaking: boolean;
}

export class VoiceChatManager {
  public localStream: MediaStream | null = null;
  public isMuted: boolean = false;
  public isSupported: boolean = false;
  public activePeers: Map<string, PeerAudioStream> = new Map();
  private audioContext?: AudioContext;

  public onMicStateChange?: (isMuted: boolean, isSpeaking: boolean) => void;
  public onRemoteSpeakingChange?: (
    playerId: string,
    isSpeaking: boolean,
  ) => void;

  constructor() {
    this.isSupported = !!(
      navigator.mediaDevices && navigator.mediaDevices.getUserMedia
    );
  }

  public async enableMicrophone(): Promise<boolean> {
    if (!this.isSupported) return false;
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      this.audioContext = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();
      this.isMuted = false;
      this.onMicStateChange?.(false, true);
      return true;
    } catch (e) {
      console.warn("[VoiceChat] Microphone access denied or unavailable", e);
      return false;
    }
  }

  public toggleMute(): boolean {
    if (!this.localStream) return false;
    this.isMuted = !this.isMuted;
    this.localStream.getAudioTracks().forEach((track) => {
      track.enabled = !this.isMuted;
    });
    this.onMicStateChange?.(this.isMuted, !this.isMuted);
    return this.isMuted;
  }

  /**
   * Adjusts volume/gain of remote players based on 3D distance (Proximity Audio)
   * Max hearing distance: 25 blocks
   */
  public updateProximityAudio(
    localPos: { x: number; y: number; z: number },
    remotePlayers: Array<{ id: string; x: number; y: number; z: number }>,
  ): void {
    const MAX_DIST = 25.0;

    remotePlayers.forEach((rp) => {
      const peer = this.activePeers.get(rp.id);
      if (!peer || !peer.audioElement) return;

      const dist = Math.hypot(
        localPos.x - rp.x,
        localPos.y - rp.y,
        localPos.z - rp.z,
      );
      if (dist >= MAX_DIST) {
        peer.audioElement.volume = 0;
      } else {
        // Logarithmic volume decay for realistic voice attenuation
        const vol = Math.max(0, Math.min(1.0, 1.0 - dist / MAX_DIST));
        peer.audioElement.volume = Math.pow(vol, 1.5);
      }
    });
  }

  public cleanup(): void {
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.activePeers.forEach((p) => {
      p.peerConnection.close();
      p.audioElement.remove();
    });
    this.activePeers.clear();
  }
}
