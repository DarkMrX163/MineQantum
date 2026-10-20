import React, { useEffect, useRef, useState } from 'react';
import { FirstPersonController } from '../engine/FirstPersonController';
import { BlockId } from '../engine/types';
import { Maximize2, Pickaxe, Hammer, ArrowUp, Play } from 'lucide-react';

interface TouchControlsProps {
  controller: FirstPersonController | null;
  selectedBlock: BlockId;
  onRequestPointerLock: () => void;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  controller,
  selectedBlock,
  onRequestPointerLock,
}) => {
  const joystickRef = useRef<HTMLDivElement>(null);
  const swipeAreaRef = useRef<HTMLDivElement>(null);

  // Joystick visual position state
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const [isJoystickActive, setIsJoystickActive] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Touch state refs
  const joystickTouchId = useRef<number | null>(null);
  const swipeTouchId = useRef<number | null>(null);
  const lastSwipePos = useRef<{ x: number; y: number } | null>(null);

  // Fullscreen state listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleRequestFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch (e) {
      console.warn('Fullscreen request denied or not supported', e);
    }
    onRequestPointerLock();
  };

  // Joystick Touch Handlers (Bottom Left)
  useEffect(() => {
    const joystickEl = joystickRef.current;
    if (!joystickEl) return;

    const handleJoystickStart = (e: TouchEvent) => {
      e.preventDefault();
      if (joystickTouchId.current !== null) return;

      const touch = e.changedTouches[0];
      joystickTouchId.current = touch.identifier;
      setIsJoystickActive(true);
      updateJoystick(touch.clientX, touch.clientY);
    };

    const handleJoystickMove = (e: TouchEvent) => {
      e.preventDefault();
      if (joystickTouchId.current === null) return;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === joystickTouchId.current) {
          updateJoystick(touch.clientX, touch.clientY);
          break;
        }
      }
    };

    const handleJoystickEnd = (e: TouchEvent) => {
      if (joystickTouchId.current === null) return;

      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === joystickTouchId.current) {
          joystickTouchId.current = null;
          setIsJoystickActive(false);
          setKnobPos({ x: 0, y: 0 });
          if (controller) {
            controller.touchMoveVector = { x: 0, y: 0 };
          }
          break;
        }
      }
    };

    const updateJoystick = (clientX: number, clientY: number) => {
      if (!joystickEl) return;
      const rect = joystickEl.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const dx = clientX - centerX;
      const dy = clientY - centerY;
      const maxRadius = rect.width / 2;

      const distance = Math.sqrt(dx * dx + dy * dy);
      const clampedDist = Math.min(distance, maxRadius);
      const angle = Math.atan2(dy, dx);

      const knobX = clampedDist * Math.cos(angle);
      const knobY = clampedDist * Math.sin(angle);

      setKnobPos({ x: knobX, y: knobY });

      // Normalized move vector (-1 to 1)
      const normX = knobX / maxRadius;
      const normY = -knobY / maxRadius; // Invert Y so up is positive forward

      if (controller) {
        controller.touchMoveVector = { x: normX, y: normY };
      }
    };

    joystickEl.addEventListener('touchstart', handleJoystickStart, { passive: false });
    window.addEventListener('touchmove', handleJoystickMove, { passive: false });
    window.addEventListener('touchend', handleJoystickEnd);
    window.addEventListener('touchcancel', handleJoystickEnd);

    return () => {
      joystickEl.removeEventListener('touchstart', handleJoystickStart);
      window.removeEventListener('touchmove', handleJoystickMove);
      window.removeEventListener('touchend', handleJoystickEnd);
      window.removeEventListener('touchcancel', handleJoystickEnd);
    };
  }, [controller]);

  // Swipe Camera Rotation Handlers (Right 50% Screen)
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
            // Apply camera rotation sensitivity
            const sensitivity = 0.004;
            controller.rotateCamera(deltaX * sensitivity, deltaY * sensitivity);
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
  }, [controller]);

  // Action Button Handlers
  const handleBreakBlock = () => {
    if (controller) {
      controller.handleMouseInteraction(0, selectedBlock);
    }
  };

  const handlePlaceBlock = () => {
    if (controller) {
      controller.handleMouseInteraction(2, selectedBlock);
    }
  };

  const handleJump = () => {
    if (controller) {
      controller.touchJumpRequested = true;
    }
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-40 select-none touch-none">
      {/* Play / Fullscreen Trigger Banner (Top Center) */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 pointer-events-auto">
        <button
          onClick={handleRequestFullscreen}
          className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-full text-xs font-bold shadow-xl flex items-center gap-2 border border-emerald-400/40 active:scale-95 transition cursor-pointer backdrop-blur-md"
        >
          <Play className="w-4 h-4 fill-white" />
          <span>{isFullscreen ? 'Играть' : 'Play / Полноэкранный режим'}</span>
          <Maximize2 className="w-3.5 h-3.5 opacity-80" />
        </button>
      </div>

      {/* Swipe Camera Rotation Area (Right Half Screen) */}
      <div
        ref={swipeAreaRef}
        className="absolute top-0 right-0 w-1/2 h-full pointer-events-auto"
      />

      {/* Virtual Joystick (Bottom Left) */}
      <div className="absolute bottom-8 left-8 pointer-events-auto flex items-center justify-center">
        <div
          ref={joystickRef}
          className={`w-32 h-32 rounded-full border-2 backdrop-blur-md transition-colors flex items-center justify-center relative ${
            isJoystickActive
              ? 'bg-slate-900/60 border-emerald-500 shadow-emerald-500/20 shadow-2xl'
              : 'bg-slate-900/40 border-slate-600/60'
          }`}
        >
          {/* Inner Thumb Knob */}
          <div
            className="w-12 h-12 rounded-full bg-emerald-500/80 border-2 border-emerald-300 shadow-lg absolute transition-transform"
            style={{
              transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
            }}
          />
        </div>
      </div>

      {/* Action Touch Buttons (Bottom Right) */}
      <div className="absolute bottom-8 right-8 pointer-events-auto flex items-end gap-3">
        {/* Break Block ("Копать") */}
        <button
          onClick={handleBreakBlock}
          onTouchStart={() => {
            if (controller) {
              controller.touchDigRequested = true;
              controller.handleMouseInteraction(0, selectedBlock);
            }
          }}
          onTouchEnd={() => {
            if (controller) {
              controller.touchDigRequested = false;
              controller.resetBreaking();
            }
          }}
          className="w-14 h-14 rounded-full bg-rose-600/80 active:bg-rose-500 border-2 border-rose-400 text-white font-bold text-xs flex flex-col items-center justify-center shadow-xl backdrop-blur-md active:scale-90 transition cursor-pointer"
        >
          <Pickaxe className="w-5 h-5 mb-0.5" />
          <span>Копать</span>
        </button>

        {/* Place Block ("Строить") */}
        <button
          onClick={handlePlaceBlock}
          className="w-14 h-14 rounded-full bg-emerald-600/80 active:bg-emerald-500 border-2 border-emerald-400 text-white font-bold text-xs flex flex-col items-center justify-center shadow-xl backdrop-blur-md active:scale-90 transition cursor-pointer"
        >
          <Hammer className="w-5 h-5 mb-0.5" />
          <span>Строить</span>
        </button>

        {/* Jump ("Прыжок") */}
        <button
          onClick={handleJump}
          className="w-16 h-16 rounded-full bg-indigo-600/85 active:bg-indigo-500 border-2 border-indigo-400 text-white font-bold text-xs flex flex-col items-center justify-center shadow-2xl backdrop-blur-md active:scale-90 transition cursor-pointer ml-1"
        >
          <ArrowUp className="w-6 h-6 mb-0.5" />
          <span>Прыжок</span>
        </button>
      </div>
    </div>
  );
};
