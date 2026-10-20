import React from 'react';
import { RotateCcw, Skull, Sparkles } from 'lucide-react';
import { sound } from '../engine/AudioEngine';

interface DeathScreenProps {
  isOpen: boolean;
  deathReason?: string;
  onRespawn: () => void;
}

export const DeathScreen: React.FC<DeathScreenProps> = ({
  isOpen,
  deathReason = 'Вы погибли!',
  onRespawn,
}) => {
  if (!isOpen) return null;

  const handleRespawnClick = () => {
    sound.playClick();
    onRespawn();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-rose-950/85 backdrop-blur-md select-none animate-fade-in pointer-events-auto">
      <div className="max-w-md w-full mx-4 flex flex-col items-center text-center p-8 bg-slate-950/90 border-2 border-rose-600/70 rounded-3xl shadow-[0_0_50px_rgba(225,29,72,0.5)]">
        {/* Skull Icon */}
        <div className="w-20 h-20 rounded-full bg-rose-500/20 border-2 border-rose-500/50 flex items-center justify-center text-rose-500 mb-4 animate-pulse">
          <Skull className="w-10 h-10" />
        </div>

        {/* You Died Banner */}
        <h1 className="text-4xl font-extrabold text-rose-500 tracking-wider mb-2 font-mono drop-shadow-[0_2px_10px_rgba(244,63,94,0.8)]">
          Вы погибли!
        </h1>

        {/* Death Cause */}
        <p className="text-sm font-medium text-slate-300 mb-6 bg-slate-900/80 px-4 py-2 rounded-xl border border-slate-800">
          {deathReason}
        </p>

        {/* Info */}
        <p className="text-xs text-slate-400 mb-8 max-w-xs">
          Все ваши предметы выпали на месте гибели. Вы можете вернуться и забрать их!
        </p>

        {/* Respawn Button */}
        <button
          onClick={handleRespawnClick}
          className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-base shadow-xl flex items-center justify-center gap-2 border border-rose-400/50 active:scale-95 transition cursor-pointer"
        >
          <RotateCcw className="w-5 h-5" />
          <span>Возродиться (Respawn)</span>
        </button>
      </div>
    </div>
  );
};
