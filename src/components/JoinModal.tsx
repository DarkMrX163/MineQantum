import React, { useState, useEffect } from 'react';
import { User, Sparkles, Dices, Shield, Check, Globe, Share2, Copy } from 'lucide-react';
import { sound } from '../engine/AudioEngine';

interface JoinModalProps {
  isOpen: boolean;
  currentNickname: string;
  onJoin: (nickname: string) => void;
  onClose?: () => void;
  isInitialJoin?: boolean;
}

const RANDOM_NICKNAMES = [
  'Steve_Pro',
  'Alex_Craft',
  'DiamondMiner',
  'EnderKnight',
  'RedstoneWiz',
  'CreeperHunter',
  'BlockMaster',
  'ShadowCrafter',
  'IronGolem',
  'SkyWalker',
  'VoxelHero',
  'NetherKing',
  'FrostBite',
  'GoldenPick',
  'EmeraldHunter',
  'DragonSlayer',
];

export const JoinModal: React.FC<JoinModalProps> = ({
  isOpen,
  currentNickname,
  onJoin,
  onClose,
  isInitialJoin = false,
}) => {
  const [nickname, setNickname] = useState(currentNickname || '');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setNickname(currentNickname || '');
      setError(null);
      setCopied(false);
    }
  }, [isOpen, currentNickname]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    sound.playItemPickup();
    const cleanNick = nickname.trim() || 'Player';
    const url = new URL(window.location.href);
    url.searchParams.set('nick', cleanNick);
    navigator.clipboard.writeText(url.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleRandomize = () => {
    sound.playItemPickup();
    const rand = RANDOM_NICKNAMES[Math.floor(Math.random() * RANDOM_NICKNAMES.length)];
    setNickname(rand);
    setError(null);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = nickname.trim();

    if (clean.length < 2) {
      setError('Никнейм должен содержать минимум 2 символа');
      sound.playHurt();
      return;
    }
    if (clean.length > 16) {
      setError('Никнейм не может быть длиннее 16 символов');
      sound.playHurt();
      return;
    }

    sound.playLevelUp();
    onJoin(clean);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md select-none font-sans animate-fade-in">
      {/* Minecraft Dialog Frame */}
      <div className="relative w-full max-w-md bg-slate-900 border-4 border-amber-600/90 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col">
        {/* Top Gold Corner Accents */}
        <div className="absolute top-2 left-2 w-2.5 h-2.5 bg-amber-400 rounded-sm shadow" />
        <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-amber-400 rounded-sm shadow" />
        <div className="absolute bottom-2 left-2 w-2.5 h-2.5 bg-amber-400 rounded-sm shadow" />
        <div className="absolute bottom-2 right-2 w-2.5 h-2.5 bg-amber-400 rounded-sm shadow" />

        {/* Header Banner */}
        <div className="bg-gradient-to-b from-amber-600 to-amber-700 px-6 py-4 border-b-2 border-amber-800 flex items-center justify-between text-white shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-950/60 flex items-center justify-center border border-amber-400/50">
              <User className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-mono tracking-wide text-amber-100 drop-shadow">
                {isInitialJoin ? 'ВХОД В МИР' : 'СМЕНА НИКНЕЙМА'}
              </h2>
              <p className="text-[11px] text-amber-200/90 font-medium">
                Minecraft Survival Multiplayer
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 text-xs font-mono font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>ОНЛАЙН</span>
          </div>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4 bg-slate-950/90">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-mono text-slate-300 font-semibold flex items-center justify-between">
              <span>Ваш игровой никнейм:</span>
              <span className="text-[10px] text-slate-500 font-normal">от 2 до 16 символов</span>
            </label>

            {/* Input with Dice Generator */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => {
                    setNickname(e.target.value);
                    if (error) setError(null);
                  }}
                  maxLength={16}
                  autoFocus
                  placeholder="Например, Steve_99"
                  className="w-full bg-slate-900 border-2 border-slate-700 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-white font-mono text-sm placeholder:text-slate-600 outline-none transition-colors shadow-inner"
                />
              </div>

              {/* Randomize button */}
              <button
                type="button"
                onClick={handleRandomize}
                className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 active:scale-95 border-2 border-slate-600 rounded-xl text-amber-400 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow"
                title="Случайный крутой никнейм"
              >
                <Dices className="w-4 h-4" />
                <span className="hidden sm:inline">Случайный</span>
              </button>
            </div>

            {error && (
              <p className="text-xs text-rose-400 font-mono mt-0.5 animate-pulse">
                ⚠️ {error}
              </p>
            )}
          </div>

          {/* 3D Nametag Live Preview Card */}
          <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 flex flex-col items-center gap-2 shadow-inner">
            <span className="text-[11px] font-mono text-slate-400 font-medium">
              Так ваш никнейм будет отображаться над персонажем:
            </span>

            {/* 3D Nametag Visual Simulation */}
            <div className="relative flex flex-col items-center gap-1.5 py-1">
              {/* Floating Nametag Pill */}
              <div className="bg-black/75 px-3 py-1 rounded-md border border-white/20 shadow-lg text-white font-mono text-sm font-bold tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] animate-bounce" style={{ animationDuration: '3s' }}>
                {nickname.trim() || 'Player'}
              </div>

              {/* Steve Head Mockup Icon */}
              <div className="w-10 h-10 rounded bg-[#c68958] border-2 border-slate-950 flex flex-col items-center justify-center overflow-hidden shadow">
                {/* Hair */}
                <div className="w-full h-2.5 bg-[#4a2e18]" />
                {/* Eyes */}
                <div className="flex items-center justify-between w-6 mt-1">
                  <div className="w-1.5 h-1.5 bg-[#2563eb]" />
                  <div className="w-1.5 h-1.5 bg-[#2563eb]" />
                </div>
                {/* Mouth/Beard */}
                <div className="w-3 h-1 bg-[#78350f] mt-1" />
              </div>
            </div>
          </div>

          {/* Features note */}
          <div className="flex items-start gap-2 text-[11px] text-slate-400 font-sans leading-relaxed">
            <Globe className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Другие игроки, перешедшие по вашей ссылке в этот же мир, будут видеть ваш ник над головой персонажа и на карте!
            </span>
          </div>

          {/* Share Link Button */}
          <button
            type="button"
            onClick={handleCopyLink}
            className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-500/40 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-300">Ссылка скопирована в буфер!</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                <span>Скопировать ссылку для друзей</span>
              </>
            )}
          </button>

          {/* Buttons */}
          <div className="flex items-center gap-2 mt-2">
            {!isInitialJoin && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono font-bold text-sm rounded-xl border border-slate-700 transition-colors cursor-pointer"
              >
                Отмена
              </button>
            )}

            <button
              type="submit"
              className="flex-1 py-3 px-4 bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 active:scale-[0.98] text-slate-950 font-mono font-extrabold text-sm rounded-xl border-2 border-emerald-300 shadow-[0_4px_16px_rgba(16,185,129,0.4)] flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Check className="w-5 h-5 stroke-[3]" />
              <span>{isInitialJoin ? 'ВОЙТИ В ИГРУ' : 'СОХРАНИТЬ НИК'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
