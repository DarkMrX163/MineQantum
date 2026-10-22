import React, { useEffect, useRef, useState } from 'react';
import { FirstPersonController } from '../engine/FirstPersonController';
import { BlockId } from '../engine/types';
import { sound } from '../engine/AudioEngine';
import { HapticManager } from '../engine/HapticManager';
import {
  Maximize2,
  Minimize2,
  Pickaxe,
  Hammer,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Zap,
  Camera,
  Sliders,
  X,
  Compass,
  Sparkles,
} from 'lucide-react';

interface TouchControlsProps {
  controller: FirstPersonController | null;
  selectedBlock: BlockId;
  onRequestPointerLock: () => void;
  onOpenInventory?: () => void;
  onToggleCamera?: () => void;
}

type ControlMode = 'joystick' | 'dpad';
type ControlSize = 'small' | 'medium' | 'large';

export const TouchControls: React.FC<TouchControlsProps> = ({
  controller,
  selectedBlock,
  onRequestPointerLock,
  onOpenInventory,
  onToggleCamera,
}) => {
  const joystickContainerRef = useRef<HTMLDivElement>(null);
  const swipeAreaRef = useRef<HTMLDivElement>(null);

  // Settings with persistent localStorage
  const [controlMode, setControlMode] = useState<ControlMode>(() => {
    return (localStorage.getItem('mc_touch_mode') as ControlMode) || 'joystick';
  });
  const [controlSize, setControlSize] = useState<ControlSize>(() => {
    return (localStorage.getItem('mc_touch_size') as ControlSize) || 'medium';
  });
  const [opacityPercent, setOpacityPercent] = useState<number>(() => {
    const saved = localStorage.getItem('mc_touch_opacity');
    return saved ? parseInt(saved, 10) : 75;
  });
  const [sensitivity, setSensitivity] = useState<number>(() => {
    const saved = localStorage.getItem('mc_touch_sens');
    return saved ? parseFloat(saved) : 1.0;
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Joystick state
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const [isJoystickActive, setIsJoystickActive] = useState(false);
  const [isSprintLocked, setIsSprintLocked] = useState(false);
  const [isDigging, setIsDigging] = useState(false);

  // Touch tracking refs
  const joystickTouchId = useRef<number | null>(null);
  const joystickCenter = useRef<{ x: number; y: number } | null>(null);
  const swipeTouchId = useRef<number | null>(null);
  const lastSwipePos = useRef<{ x: number; y: number } | null>(null);

  // Save preferences
  useEffect(() => {
    localStorage.setItem('mc_touch_mode', controlMode);
  }, [controlMode]);

  useEffect(() => {
    localStorage.setItem('mc_touch_size', controlSize);
  }, [controlSize]);

  useEffect(() => {
    localStorage.setItem('mc_touch_opacity', opacityPercent.toString());
  }, [opacityPercent]);

  useEffect(() => {
    localStorage.setItem('mc_touch_sens', sensitivity.toString());
  }, [sensitivity]);

  // Fullscreen state listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleToggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (e) {
      console.warn('Fullscreen error:', e);
    }
    onRequestPointerLock();
  };

  // Sizing scaling factors
  const sizeScales = {
    small: {
      stickBase: 105,
      stickKnob: 44,
      btnPrimary: 'w-15 h-15',
      btnSecondary: 'w-12 h-12',
      btnText: 'text-[10px]',
      iconPrimary: 'w-5 h-5',
      iconSecondary: 'w-4 h-4',
    },
    medium: {
      stickBase: 125,
      stickKnob: 52,
      btnPrimary: 'w-18 h-18',
      btnSecondary: 'w-14 h-14',
      btnText: 'text-xs',
      iconPrimary: 'w-6 h-6',
      iconSecondary: 'w-5 h-5',
    },
    large: {
      stickBase: 145,
      stickKnob: 60,
      btnPrimary: 'w-20 h-20',
      btnSecondary: 'w-16 h-16',
      btnText: 'text-sm',
      iconPrimary: 'w-7 h-7',
      iconSecondary: 'w-6 h-6',
    },
  }[controlSize];

  // Dynamic / Ergonomic Touch Joystick Handlers
  useEffect(() => {
    if (controlMode !== 'joystick') return;
    const container = joystickContainerRef.current;
    if (!container) return;

    const maxRadius = sizeScales.stickBase / 2;

    const handleTouchStart = (e: TouchEvent) => {
      if (joystickTouchId.current !== null) return;
      const touch = e.changedTouches[0];
      joystickTouchId.current = touch.identifier;
      setIsJoystickActive(true);

      const rect = container.getBoundingClientRect();
      // Center joystick under initial touch or use element center
      joystickCenter.current = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };

      updateJoystick(touch.clientX, touch.clientY, maxRadius);
      HapticManager.tap();
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (joystickTouchId.current === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === joystickTouchId.current) {
          updateJoystick(touch.clientX, touch.clientY, maxRadius);
          break;
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (joystickTouchId.current === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === joystickTouchId.current) {
          joystickTouchId.current = null;
          setIsJoystickActive(false);
          setKnobPos({ x: 0, y: 0 });
          if (controller) {
            controller.touchMoveVector = { x: 0, y: 0 };
            if (!isSprintLocked) {
              controller.isSprinting = false;
              controller.onSprintStateChange?.(false);
            }
          }
          break;
        }
      }
    };

    const updateJoystick = (clientX: number, clientY: number, radius: number) => {
      if (!joystickCenter.current) return;
      const dx = clientX - joystickCenter.current.x;
      const dy = clientY - joystickCenter.current.y;

      const dist = Math.sqrt(dx * dx + dy * dy);
      const clampedDist = Math.min(dist, radius);
      const angle = Math.atan2(dy, dx);

      const knobX = clampedDist * Math.cos(angle);
      const knobY = clampedDist * Math.sin(angle);
      setKnobPos({ x: knobX, y: knobY });

      // Normalized coordinates (-1 to 1)
      const normX = knobX / radius;
      const normY = -knobY / radius; // Invert so up is +1 (forward)

      if (controller) {
        controller.touchMoveVector = { x: normX, y: normY };

        // Sprint detection: pushing hard forward (>85% forward) automatically triggers sprint
        if (normY > 0.85 || isSprintLocked) {
          if (controller.canSprint) {
            controller.isSprinting = true;
            controller.onSprintStateChange?.(true);
          }
        } else if (!isSprintLocked) {
          controller.isSprinting = false;
          controller.onSprintStateChange?.(false);
        }
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [controller, controlMode, sizeScales, isSprintLocked]);

  // Smooth Camera Swipe Rotation (Right 55% of Screen)
  useEffect(() => {
    const swipeEl = swipeAreaRef.current;
    if (!swipeEl) return;

    const handleSwipeStart = (e: TouchEvent) => {
      if (swipeTouchId.current !== null) return;
      const touch = e.changedTouches[0];
      swipeTouchId.current = touch.identifier;
      lastSwipePos.current = { x: touch.clientX, y: touch.clientY };
    };

    const handleSwipeMove = (e: TouchEvent) => {
      if (swipeTouchId.current === null || !lastSwipePos.current) return;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === swipeTouchId.current) {
          const deltaX = touch.clientX - lastSwipePos.current.x;
          const deltaY = touch.clientY - lastSwipePos.current.y;
          lastSwipePos.current = { x: touch.clientX, y: touch.clientY };

          if (controller) {
            const baseSens = 0.0042 * sensitivity;
            controller.rotateCamera(deltaX * baseSens, deltaY * baseSens);
          }
          break;
        }
      }
    };

    const handleSwipeEnd = (e: TouchEvent) => {
      if (swipeTouchId.current === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === swipeTouchId.current) {
          swipeTouchId.current = null;
          lastSwipePos.current = null;
          break;
        }
      }
    };

    swipeEl.addEventListener('touchstart', handleSwipeStart, { passive: true });
    window.addEventListener('touchmove', handleSwipeMove, { passive: true });
    window.addEventListener('touchend', handleSwipeEnd);
    window.addEventListener('touchcancel', handleSwipeEnd);

    return () => {
      swipeEl.removeEventListener('touchstart', handleSwipeStart);
      window.removeEventListener('touchmove', handleSwipeMove);
      window.removeEventListener('touchend', handleSwipeEnd);
      window.removeEventListener('touchcancel', handleSwipeEnd);
    };
  }, [controller, sensitivity]);

  // Action Button Handlers
  const handleJump = () => {
    if (controller) {
      controller.touchJumpRequested = true;
      HapticManager.tap();
      sound.playFootstep();
    }
  };

  const handlePlaceBlock = () => {
    if (controller) {
      controller.handleMouseInteraction(2, selectedBlock);
      HapticManager.tap();
    }
  };

  const handleToggleSprint = () => {
    setIsSprintLocked((prev) => {
      const next = !prev;
      if (controller) {
        controller.isSprinting = next;
        controller.onSprintStateChange?.(next);
      }
      HapticManager.tap();
      sound.playClick();
      return next;
    });
  };

  // D-Pad Directional button press helpers
  const handleDpadPress = (dx: number, dy: number) => {
    if (controller) {
      controller.touchMoveVector = { x: dx, y: dy };
      HapticManager.tap();
    }
  };

  const handleDpadRelease = () => {
    if (controller) {
      controller.touchMoveVector = { x: 0, y: 0 };
    }
  };

  const opacityStyle = { opacity: opacityPercent / 100 };

  return (
    <div className="fixed inset-0 pointer-events-none z-35 select-none touch-none">
      {/* Top Mobile Bar: Fullscreen, Camera F5, Controls Settings, Inventory */}
      <div className="absolute top-3 right-3 pointer-events-auto flex items-center gap-2 z-40">
        {/* Camera F5 Perspective Switcher */}
        <button
          onClick={() => {
            if (controller) {
              controller.toggleCameraMode();
              HapticManager.tap();
            } else if (onToggleCamera) {
              onToggleCamera();
            }
          }}
          className="p-2.5 rounded-2xl bg-slate-900/85 hover:bg-slate-800 border border-slate-700/80 text-cyan-300 shadow-xl backdrop-blur-md active:scale-90 transition cursor-pointer"
          title="Сменить вид камеры (1-е / 3-е лицо)"
        >
          <Camera className="w-5 h-5" />
        </button>

        {/* Fullscreen Button */}
        <button
          onClick={handleToggleFullscreen}
          className="p-2.5 rounded-2xl bg-slate-900/85 hover:bg-slate-800 border border-slate-700/80 text-emerald-400 shadow-xl backdrop-blur-md active:scale-90 transition cursor-pointer"
          title="Полноэкранный режим"
        >
          {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
        </button>

        {/* Controls Settings Button */}
        <button
          onClick={() => {
            setIsSettingsOpen((prev) => !prev);
            HapticManager.tap();
          }}
          className="p-2.5 rounded-2xl bg-slate-900/85 hover:bg-slate-800 border border-slate-700/80 text-amber-400 shadow-xl backdrop-blur-md active:scale-90 transition cursor-pointer"
          title="Настройка сенсорного управления"
        >
          <Sliders className="w-5 h-5" />
        </button>
      </div>

      {/* Swipe Camera Rotation Area (Covers right 55% of screen, under buttons) */}
      <div
        ref={swipeAreaRef}
        className="absolute top-0 right-0 w-[60vw] h-full pointer-events-auto"
        style={{ touchAction: 'none' }}
      />

      {/* LEFT ZONE: Virtual Joystick OR D-Pad */}
      <div
        className="absolute bottom-4 left-4 sm:bottom-8 sm:left-8 pointer-events-auto flex flex-col items-center gap-2"
        style={opacityStyle}
      >
        {controlMode === 'joystick' ? (
          /* Ergonomic Analog Stick */
          <div className="relative flex items-center justify-center">
            {/* Sprint Lock Indicator Notch at the top */}
            <div
              onClick={handleToggleSprint}
              className={`absolute -top-7 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono border backdrop-blur-md transition-all cursor-pointer ${
                isSprintLocked
                  ? 'bg-amber-500/90 text-slate-950 border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.5)] scale-105'
                  : 'bg-slate-900/70 text-slate-400 border-slate-700/60'
              }`}
            >
              ⚡ LOCK SPRINT
            </div>

            {/* Outer Stick Base Plate */}
            <div
              ref={joystickContainerRef}
              className={`rounded-full border-2 backdrop-blur-md transition-colors flex items-center justify-center relative touch-none shadow-2xl ${
                isJoystickActive
                  ? 'bg-slate-900/70 border-emerald-400/90 shadow-[0_0_20px_rgba(52,211,153,0.3)]'
                  : 'bg-slate-950/60 border-slate-700/80'
              }`}
              style={{
                width: `${sizeScales.stickBase}px`,
                height: `${sizeScales.stickBase}px`,
              }}
            >
              {/* Directional Guides */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
                <div className="w-full h-0.5 bg-slate-500" />
                <div className="h-full w-0.5 bg-slate-500 absolute" />
              </div>

              {/* Inner Thumb Knob */}
              <div
                className={`rounded-full border-2 shadow-xl absolute transition-transform flex items-center justify-center ${
                  isJoystickActive
                    ? 'bg-emerald-500 border-emerald-200 scale-95 shadow-[0_0_15px_rgba(16,185,129,0.8)]'
                    : 'bg-slate-800/90 border-slate-500'
                }`}
                style={{
                  width: `${sizeScales.stickKnob}px`,
                  height: `${sizeScales.stickKnob}px`,
                  transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
                }}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-white/70" />
              </div>
            </div>
          </div>
        ) : (
          /* Classic Minecraft Pocket Edition D-Pad */
          <div
            className="relative grid grid-cols-3 grid-rows-3 gap-1 p-2 bg-slate-950/70 border-2 border-slate-700/80 rounded-2xl backdrop-blur-md shadow-2xl"
            style={{ width: `${sizeScales.stickBase * 1.1}px`, height: `${sizeScales.stickBase * 1.1}px` }}
          >
            {/* Top / Forward */}
            <button
              onTouchStart={() => handleDpadPress(0, 1)}
              onTouchEnd={handleDpadRelease}
              className="col-start-2 row-start-1 rounded-xl bg-slate-800 active:bg-emerald-600 border border-slate-600 text-white flex items-center justify-center shadow transition active:scale-90"
            >
              <ArrowUp className="w-6 h-6" />
            </button>
            {/* Left */}
            <button
              onTouchStart={() => handleDpadPress(-1, 0)}
              onTouchEnd={handleDpadRelease}
              className="col-start-1 row-start-2 rounded-xl bg-slate-800 active:bg-emerald-600 border border-slate-600 text-white flex items-center justify-center shadow transition active:scale-90"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            {/* Center: Jump / Sneak */}
            <button
              onClick={handleJump}
              className="col-start-2 row-start-2 rounded-xl bg-slate-900 active:bg-indigo-600 border border-slate-700 text-indigo-300 flex items-center justify-center shadow font-bold text-xs"
            >
              <div className="w-3 h-3 rounded-full bg-indigo-400" />
            </button>
            {/* Right */}
            <button
              onTouchStart={() => handleDpadPress(1, 0)}
              onTouchEnd={handleDpadRelease}
              className="col-start-3 row-start-2 rounded-xl bg-slate-800 active:bg-emerald-600 border border-slate-600 text-white flex items-center justify-center shadow transition active:scale-90"
            >
              <ArrowRight className="w-6 h-6" />
            </button>
            {/* Down / Backward */}
            <button
              onTouchStart={() => handleDpadPress(0, -1)}
              onTouchEnd={handleDpadRelease}
              className="col-start-2 row-start-3 rounded-xl bg-slate-800 active:bg-emerald-600 border border-slate-600 text-white flex items-center justify-center shadow transition active:scale-90"
            >
              <ArrowDown className="w-6 h-6" />
            </button>
          </div>
        )}
      </div>

      {/* RIGHT ZONE: Ergonomic Thumb Radial Action Cluster */}
      <div
        className="absolute bottom-4 right-4 sm:bottom-8 sm:right-8 pointer-events-auto flex items-end justify-end"
        style={opacityStyle}
      >
        <div className="relative w-48 h-48 sm:w-56 sm:h-56">
          {/* 1. JUMP (Bottom Right Corner - Natural Thumb Rest Position) */}
          <button
            onClick={handleJump}
            className={`absolute bottom-0 right-0 ${sizeScales.btnPrimary} rounded-3xl bg-gradient-to-br from-indigo-600 to-indigo-700 active:from-indigo-500 active:to-indigo-600 border-2 border-indigo-300/80 text-white font-bold flex flex-col items-center justify-center shadow-[0_8px_25px_rgba(99,102,241,0.4)] backdrop-blur-md active:scale-90 transition cursor-pointer select-none`}
            title="Прыжок"
          >
            <ArrowUp className={`${sizeScales.iconPrimary} stroke-[3] mb-0.5`} />
            <span className={`${sizeScales.btnText} font-mono tracking-tight`}>Прыжок</span>
          </button>

          {/* 2. MINE / ATTACK (Above Jump - Reachable with Thumb Upward Swipe) */}
          <button
            onTouchStart={(e) => {
              e.stopPropagation();
              setIsDigging(true);
              if (controller) {
                controller.touchDigRequested = true;
                controller.handleMouseInteraction(0, selectedBlock);
              }
              HapticManager.tap();
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              setIsDigging(false);
              if (controller) {
                controller.touchDigRequested = false;
                controller.resetBreaking();
              }
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (controller) {
                controller.handleMouseInteraction(0, selectedBlock);
              }
            }}
            className={`absolute top-2 right-0 ${sizeScales.btnSecondary} rounded-2xl border-2 text-white font-bold flex flex-col items-center justify-center shadow-xl backdrop-blur-md active:scale-90 transition cursor-pointer select-none ${
              isDigging
                ? 'bg-rose-500 border-white shadow-[0_0_20px_rgba(244,63,94,0.8)] scale-95'
                : 'bg-rose-600/90 active:bg-rose-500 border-rose-400/90 shadow-[0_6px_20px_rgba(244,63,94,0.35)]'
            }`}
            title="Копать / Атаковать"
          >
            <Pickaxe className={`${sizeScales.iconSecondary} mb-0.5`} />
            <span className={`${sizeScales.btnText} font-mono leading-none`}>Удар</span>
          </button>

          {/* 3. PLACE / BUILD / INTERACT (To the Left of Jump - Reachable with Inward Thumb Pivot) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePlaceBlock();
            }}
            className={`absolute bottom-0 left-2 ${sizeScales.btnSecondary} rounded-2xl bg-emerald-600/90 active:bg-emerald-500 border-2 border-emerald-400/90 text-white font-bold flex flex-col items-center justify-center shadow-[0_6px_20px_rgba(16,185,129,0.35)] backdrop-blur-md active:scale-90 transition cursor-pointer select-none`}
            title="Строить / Действие / Использовать"
          >
            <Hammer className={`${sizeScales.iconSecondary} mb-0.5`} />
            <span className={`${sizeScales.btnText} font-mono leading-none`}>Строить</span>
          </button>

          {/* 4. SPRINT TOGGLE (Diagonal Top-Left of Jump) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleToggleSprint();
            }}
            className={`absolute top-10 left-8 w-11 h-11 sm:w-13 sm:h-13 rounded-2xl border-2 text-white font-bold flex flex-col items-center justify-center shadow-lg backdrop-blur-md active:scale-90 transition cursor-pointer select-none ${
              isSprintLocked || controller?.isSprinting
                ? 'bg-amber-500 border-amber-200 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.6)]'
                : 'bg-slate-900/80 active:bg-slate-800 border-amber-500/50 text-amber-300'
            }`}
            title="Включить / Выключить Спринт"
          >
            <Zap className="w-5 h-5 fill-current" />
          </button>
        </div>
      </div>

      {/* Touch Settings Modal Overlay */}
      {isSettingsOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsSettingsOpen(false);
          }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto"
        >
          <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl p-5 max-w-sm w-full text-slate-100 flex flex-col gap-4 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm text-slate-100">Настройки управления</h3>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode: Joystick vs D-Pad */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-slate-400 font-medium">Тип движения слева</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setControlMode('joystick')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    controlMode === 'joystick'
                      ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750'
                  }`}
                >
                  <Compass className="w-4 h-4" />
                  Стик (Joystick)
                </button>
                <button
                  onClick={() => setControlMode('dpad')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    controlMode === 'dpad'
                      ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750'
                  }`}
                >
                  <ArrowUp className="w-4 h-4" />
                  Крестовина (D-Pad)
                </button>
              </div>
            </div>

            {/* Button Size Preset */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-slate-400 font-medium">Размер кнопок</span>
              <div className="grid grid-cols-3 gap-2">
                {(['small', 'medium', 'large'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setControlSize(s)}
                    className={`py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                      controlSize === s
                        ? 'bg-indigo-600 border-indigo-400 text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750'
                    }`}
                  >
                    {s === 'small' ? 'Малый' : s === 'medium' ? 'Обычный' : 'Большой'}
                  </button>
                ))}
              </div>
            </div>

            {/* Opacity Slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Прозрачность кнопок</span>
                <span className="font-mono font-bold text-amber-300">{opacityPercent}%</span>
              </div>
              <input
                type="range"
                min="25"
                max="100"
                step="5"
                value={opacityPercent}
                onChange={(e) => setOpacityPercent(parseInt(e.target.value, 10))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            {/* Camera Sensitivity Slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Чувствительность обзора</span>
                <span className="font-mono font-bold text-cyan-300">{sensitivity.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.5"
                step="0.1"
                value={sensitivity}
                onChange={(e) => setSensitivity(parseFloat(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            <button
              onClick={() => setIsSettingsOpen(false)}
              className="mt-1 w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition cursor-pointer"
            >
              Сохранить и продолжить
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
