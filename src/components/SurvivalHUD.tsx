import React, { useEffect, useState } from 'react';
import { Heart, Flame, Zap, User, Edit3, Share2, Camera, Shield } from 'lucide-react';

import { ActiveWorldEvent } from '../engine/WorldEventManager';
import { ActivePotionEffect } from '../engine/PotionsAndEnchanting';
import { MiniMap, PlayerTransform } from './MiniMap';

interface SurvivalHUDProps {
  health: number; // 0 to 20 (10 hearts)
  maxHealth?: number;
  hunger: number; // 0 to 20 (10 drumsticks)
  maxHunger?: number;
  armorPoints?: number; // 0 to 20 (10 armor shields)
  isSprinting: boolean;
  damageFlashTrigger: number; // timestamp to trigger 200ms red flash
  activeEvent?: ActiveWorldEvent | null;
  eventNotification?: string | null;
  playerTransform?: PlayerTransform;
  nickname?: string;
  onOpenNicknameModal?: () => void;
  remotePlayers?: { id: string; name: string; x: number; y: number; z: number; color: string }[];
  onShareLink?: () => void;
  onToggleCamera?: () => void;
  cameraMode?: 'first' | 'third-back' | 'third-front';
  activePotionEffects?: ActivePotionEffect[];
  bossHp?: { name: string; current: number; max: number } | null;
}

export const SurvivalHUD: React.FC<SurvivalHUDProps> = ({
  health,
  maxHealth = 20,
  hunger,
  maxHunger = 20,
  armorPoints = 0,
  isSprinting,
  damageFlashTrigger,
  activeEvent,
  eventNotification,
  playerTransform,
  nickname = 'Player',
  onOpenNicknameModal,
  remotePlayers = [],
  onShareLink,
  onToggleCamera,
  cameraMode = 'first',
  activePotionEffects = [],
  bossHp,
}) => {
  const [isFlashing, setIsFlashing] = useState(false);

  useEffect(() => {
    if (damageFlashTrigger > 0) {
      setIsFlashing(true);
      const timer = setTimeout(() => setIsFlashing(false), 200);
      return () => clearTimeout(timer);
    }
  }, [damageFlashTrigger]);

  const renderHearts = () => {
    const hearts = [];
    for (let i = 0; i < 10; i++) {
      const heartValue = health - i * 2;
      const isFull = heartValue >= 2;
      const isHalf = heartValue === 1;
      const isLow = health <= 4;

      hearts.push(
        <div
          key={i}
          className={`relative w-4 h-4 flex items-center justify-center transition-transform ${
            isLow ? 'animate-bounce' : ''
          }`}
          style={{ animationDuration: `${600 + i * 40}ms` }}
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            <path
              d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
              fill="#1e293b"
              stroke="#0f172a"
              strokeWidth="2"
            />
            {isFull ? (
              <path
                d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                fill="#ef4444"
              />
            ) : isHalf ? (
              <g>
                <clipPath id={`half-heart-${i}`}>
                  <rect x="0" y="0" width="12" height="24" />
                </clipPath>
                <path
                  d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                  fill="#ef4444"
                  clipPath={`url(#half-heart-${i})`}
                />
              </g>
            ) : null}
            {(isFull || isHalf) && <circle cx="7" cy="7" r="1.5" fill="#fecaca" />}
          </svg>
        </div>
      );
    }
    return hearts;
  };

  const renderArmor = () => {
    if (armorPoints <= 0) return null;
    const shields = [];
    for (let i = 0; i < 10; i++) {
      const shieldVal = armorPoints - i * 2;
      const isFull = shieldVal >= 2;
      const isHalf = shieldVal === 1;

      shields.push(
        <div key={i} className="relative w-4 h-4 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-4 h-4 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            <path
              d="M12 2L4 5v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V5l-8-3z"
              fill="#0f172a"
              stroke="#334155"
              strokeWidth="2"
            />
            {isFull ? (
              <path
                d="M12 2L4 5v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V5l-8-3z"
                fill="#38bdf8"
              />
            ) : isHalf ? (
              <g>
                <clipPath id={`half-shield-${i}`}>
                  <rect x="0" y="0" width="12" height="24" />
                </clipPath>
                <path
                  d="M12 2L4 5v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V5l-8-3z"
                  fill="#38bdf8"
                  clipPath={`url(#half-shield-${i})`}
                />
              </g>
            ) : null}
          </svg>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-0.5 bg-slate-950/80 p-1.5 rounded-xl border border-sky-500/40 backdrop-blur-md shadow-lg mb-1 animate-scale-up">
        {shields}
      </div>
    );
  };

  const renderHunger = () => {
    const drumsticks = [];
    for (let i = 0; i < 10; i++) {
      const hungerValue = hunger - i * 2;
      const isFull = hungerValue >= 2;
      const isHalf = hungerValue === 1;
      const isHungry = hunger <= 6;

      drumsticks.push(
        <div
          key={i}
          className={`relative w-4 h-4 flex items-center justify-center ${
            isHungry ? 'animate-pulse' : ''
          }`}
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            <path
              d="M19 5 C 16 3, 11 6, 9 11 L 6 14 C 4 15, 4 17, 5 18 C 6 19, 8 19, 9 18 L 12 15 C 17 13, 21 8, 19 5 Z"
              fill="#1e293b"
              stroke="#0f172a"
              strokeWidth="2"
            />
            <circle cx="5" cy="19" r="1.5" fill="#e2e8f0" />
            <circle cx="7" cy="20" r="1.5" fill="#e2e8f0" />

            {isFull ? (
              <path
                d="M18 6 C 15 4, 11 7, 9.5 11.5 L 8 13 C 7 14, 7 15.5, 8 16.5 C 9 17.5, 10.5 17.5, 11.5 16.5 L 13 15 C 17.5 13.5, 20 9, 18 6 Z"
                fill="#d97706"
              />
            ) : isHalf ? (
              <g>
                <clipPath id={`half-hunger-${i}`}>
                  <rect x="0" y="0" width="14" height="24" />
                </clipPath>
                <path
                  d="M18 6 C 15 4, 11 7, 9.5 11.5 L 8 13 C 7 14, 7 15.5, 8 16.5 C 9 17.5, 10.5 17.5, 11.5 16.5 L 13 15 C 17.5 13.5, 20 9, 18 6 Z"
                  fill="#d97706"
                  clipPath={`url(#half-hunger-${i})`}
                />
              </g>
            ) : null}
          </svg>
        </div>
      );
    }
    return drumsticks;
  };

  return (
    <>
      <MiniMap playerTransform={playerTransform} activeEvent={activeEvent} remotePlayers={remotePlayers} />

      {/* Player Nickname Badge & Quick Actions (Top Left) */}
      <div className="fixed top-4 left-4 z-35 pointer-events-auto select-none flex items-center gap-2">
        <div className="bg-slate-900/90 border border-slate-700/80 backdrop-blur-md rounded-2xl px-3 py-1.5 shadow-xl flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-[#c68958] border border-amber-500/80 flex flex-col items-center justify-center overflow-hidden shrink-0 shadow">
            <div className="w-full h-1.5 bg-[#4a2e18]" />
            <div className="flex items-center justify-between w-4 mt-0.5">
              <div className="w-1 h-1 bg-[#2563eb]" />
              <div className="w-1 h-1 bg-[#2563eb]" />
            </div>
            <div className="w-2 h-0.5 bg-[#78350f] mt-0.5" />
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 font-mono font-medium leading-none">Никнейм</span>
            <span className="text-xs font-mono font-bold text-amber-300 truncate max-w-[120px] drop-shadow">
              {nickname || 'Player'}
            </span>
          </div>

          {onOpenNicknameModal && (
            <button
              onClick={onOpenNicknameModal}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 transition cursor-pointer"
              title="Сменить никнейм"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          )}

          {onShareLink && (
            <button
              onClick={onShareLink}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 transition cursor-pointer"
              title="Пригласить друга (Скопировать ссылку)"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          )}

          {onToggleCamera && (
            <button
              onClick={onToggleCamera}
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-[10px] font-mono font-bold flex items-center gap-1 transition cursor-pointer"
              title="Переключить вид камеры (F5)"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{cameraMode === 'first' ? '1-е лицо' : cameraMode === 'third-back' ? '3-е сзади' : '3-е спереди'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Potion Status Effects List (Top Right) */}
      {activePotionEffects.length > 0 && (
        <div className="fixed top-4 right-44 z-35 pointer-events-none select-none flex flex-col gap-1.5 items-end">
          {activePotionEffects.map((eff) => (
            <div
              key={eff.id}
              className="bg-slate-950/90 border border-slate-700 px-3 py-1 rounded-xl shadow-xl backdrop-blur-md flex items-center gap-2 text-xs font-mono font-bold"
              style={{ color: eff.color }}
            >
              <span>{eff.icon}</span>
              <span>{eff.name}</span>
              <span className="text-slate-300 font-mono text-[11px] bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                {Math.floor(eff.durationLeft / 60)}:
                {Math.floor(eff.durationLeft % 60)
                  .toString()
                  .padStart(2, '0')}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Boss Fight Health Bar (Top Center) */}
      {(bossHp || activeEvent?.type === 'boss_raid') && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40 pointer-events-none select-none flex flex-col items-center w-80 max-w-[90vw]">
          <div className="bg-slate-950/95 border-2 border-purple-500/80 rounded-2xl px-4 py-2 shadow-2xl backdrop-blur-xl w-full flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs font-bold font-mono text-purple-300">
              <span>👾 {bossHp?.name || 'Ancient Wither Boss'}</span>
              <span>{bossHp ? `${bossHp.current} / ${bossHp.max}` : '200 / 200 HP'}</span>
            </div>
            <div className="w-full h-3 bg-slate-900 rounded-full border border-purple-800/80 overflow-hidden relative">
              <div
                className="h-full bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 transition-all duration-300"
                style={{
                  width: `${
                    bossHp ? (bossHp.current / bossHp.max) * 100 : 100
                  }%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Mini-game Active Event Banner Overlay */}
      {activeEvent && activeEvent.type !== 'boss_raid' && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-35 pointer-events-none select-none flex flex-col items-center max-w-[90vw]">
          <div className="bg-slate-900/95 border-2 border-amber-500/80 rounded-2xl px-6 py-2.5 shadow-2xl backdrop-blur-xl flex flex-col items-center gap-1">
            <div className="text-amber-300 font-bold text-sm font-mono flex items-center gap-2 flex-wrap justify-center">
              <span>{activeEvent.title}</span>
              <span className="text-emerald-300 font-mono text-xs px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700">
                ⏱️ {Math.floor(activeEvent.durationLeft / 60)}:
                {Math.floor(activeEvent.durationLeft % 60)
                  .toString()
                  .padStart(2, '0')}
              </span>
            </div>
            <p className="text-xs text-slate-300 font-medium text-center">
              {activeEvent.description}
            </p>
            {activeEvent.currentKills !== undefined && (
              <span className="text-xs text-indigo-300 font-mono font-bold bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800">
                🎯 Уничтожено монстров: {activeEvent.currentKills} / {activeEvent.targetKillsNeeded}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Event Notification Toast Banner */}
      {eventNotification && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-40 pointer-events-none select-none flex flex-col items-center max-w-[90vw] animate-bounce">
          <div className="bg-amber-500 text-slate-950 font-bold px-6 py-2 rounded-xl shadow-2xl border-2 border-amber-300 text-sm font-mono text-center">
            {eventNotification}
          </div>
        </div>
      )}

      {/* 200ms Damage Red Flash Vignette on screen */}
      <div
        className={`fixed inset-0 pointer-events-none z-40 transition-opacity duration-75 ${
          isFlashing
            ? 'opacity-85 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(239,68,68,0.75)_100%)] shadow-[inset_0_0_100px_rgba(239,68,68,0.9)]'
            : 'opacity-0'
        }`}
      />

      {/* Survival HUD Bars */}
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-35 pointer-events-none select-none flex items-center justify-between w-[440px] max-w-[94vw] px-2">
        <div className="flex flex-col gap-0.5">
          {renderArmor()}
          <div className="flex items-center gap-0.5 bg-slate-950/70 p-1.5 rounded-xl border border-slate-800 backdrop-blur-md shadow-lg">
            {renderHearts()}
          </div>
          <div className="flex items-center gap-1.5 px-1 text-[10px] font-mono text-slate-400">
            <span className="font-bold text-rose-400">{health}/20 HP</span>
            {health < 20 && hunger > 18 && (
              <span className="text-emerald-400 font-semibold animate-pulse">+ Regen</span>
            )}
          </div>
        </div>

        {isSprinting && (
          <div className="px-2.5 py-0.5 rounded-full bg-amber-500/90 text-slate-950 font-bold text-[10px] font-mono shadow-md flex items-center gap-1 animate-pulse">
            <Zap className="w-3 h-3 fill-slate-950" />
            <span>SPRINT</span>
          </div>
        )}

        <div className="flex flex-col items-end gap-0.5">
          <div className="flex items-center gap-0.5 bg-slate-950/70 p-1.5 rounded-xl border border-slate-800 backdrop-blur-md shadow-lg">
            {renderHunger()}
          </div>
          <div className="flex items-center gap-1.5 px-1 text-[10px] font-mono text-slate-400">
            {hunger === 0 ? (
              <span className="text-rose-400 font-bold animate-pulse">☠ Starving!</span>
            ) : (
              <span className="font-bold text-amber-400">{hunger}/20 Food</span>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
