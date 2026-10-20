import React, { useState } from 'react';
import { BLOCK_DEFS, BLOCK, BlockId, ChunkStats } from '../engine/types';
import { sound } from '../engine/AudioEngine';
import {
  Eye,
  EyeOff,
  Navigation,
  Box,
  Layers,
  Sparkles,
  Volume2,
  VolumeX,
  RotateCcw,
  Code,
  Grid,
  Zap,
  Sliders,
  ChevronDown,
  ChevronUp,
  Sun,
  Moon,
} from 'lucide-react';

interface WorldControlsProps {
  stats: ChunkStats;
  selectedBlock: BlockId;
  onSelectBlock: (id: BlockId) => void;
  isPointerLocked: boolean;
  onRequestPointerLock: () => void;
  isFlyMode: boolean;
  onToggleFlyMode: () => void;
  renderDistance: number;
  onChangeRenderDistance: (val: number) => void;
  naiveMode: boolean;
  onToggleNaiveMode: () => void;
  onRegenerateWorld: () => void;
  activeTab: 'game' | 'code' | 'atlas';
  onChangeTab: (tab: 'game' | 'code' | 'atlas') => void;
  fps: number;
  onlinePlayers?: number;
  isNight?: boolean;
  onToggleDayNight?: () => void;
  enableAO?: boolean;
  onToggleAO?: () => void;
  mobCount?: number;
  onSpawnMob?: (type: 'steve' | 'zombie' | 'creeper') => void;
  onClearMobs?: () => void;
}

export const WorldControls: React.FC<WorldControlsProps> = ({
  stats,
  selectedBlock,
  onSelectBlock,
  isPointerLocked,
  onRequestPointerLock,
  isFlyMode,
  onToggleFlyMode,
  renderDistance,
  onChangeRenderDistance,
  naiveMode,
  onToggleNaiveMode,
  onRegenerateWorld,
  activeTab,
  onChangeTab,
  fps,
  onlinePlayers,
  isNight = false,
  onToggleDayNight,
  enableAO = true,
  onToggleAO,
  mobCount = 0,
  onSpawnMob,
  onClearMobs,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const handleToggleMute = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
  };

  const selectableBlocks: BlockId[] = [
    BLOCK.TORCH,
    BLOCK.LAVA,
    BLOCK.GRASS,
    BLOCK.DIRT,
    BLOCK.STONE,
    BLOCK.WOOD,
    BLOCK.LEAVES,
    BLOCK.SAND,
    BLOCK.BRICK,
    BLOCK.GLASS,
    BLOCK.PLANKS,
  ];

  return (
    <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-30 flex flex-col justify-between p-4">
      {/* Top Header & Navigation Bar */}
      <div className="flex items-start justify-between w-full pointer-events-auto">
        {/* Title & Badge */}
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl px-4 py-2.5 shadow-xl flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold font-mono text-sm">
            3D
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              Voxel Engine & ChunkManager
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                16×16×64
              </span>
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Online: {onlinePlayers ?? 1}
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">
              Open-Face Culling • Texture Atlas UVs • Three.js
            </p>
          </div>
        </div>

        {/* Top Tab Switches */}
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-1.5 shadow-xl flex items-center gap-1">
          <button
            onClick={() => onChangeTab('game')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'game'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Box className="w-3.5 h-3.5" /> 3D Viewport
          </button>
          <button
            onClick={() => onChangeTab('code')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'code'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Code className="w-3.5 h-3.5" /> Source Code
          </button>
          <button
            onClick={() => onChangeTab('atlas')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'atlas'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Grid className="w-3.5 h-3.5" /> Atlas UVs
          </button>
          <button
            onClick={handleToggleMute}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
        </div>
      </div>

      {/* Floating Center Crosshair when pointer locked */}
      {isPointerLocked && activeTab === 'game' && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-white/80 rounded-full flex items-center justify-center">
            <div className="w-1 h-1 bg-white rounded-full" />
          </div>
        </div>
      )}

      {/* Unified Bottom Control Dock (Zero Viewport Occlusion) */}
      <div className="w-full max-w-[920px] mx-auto pointer-events-auto flex flex-col items-center">
        {/* Collapse / Expand Toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-300 text-xs font-semibold px-4 py-1 rounded-t-xl backdrop-blur-md shadow-lg flex items-center gap-1.5 transition cursor-pointer -mb-px"
        >
          {isCollapsed ? <ChevronUp className="w-3.5 h-3.5 text-emerald-400" /> : <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />}
          {isCollapsed ? 'Show Controls & Profiler' : 'Hide Controls'}
        </button>

        {!isCollapsed && (
          <div className="w-full bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-2xl p-4 shadow-2xl flex flex-col gap-3">
            {/* Live Performance Profiler & Face Culling Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80 text-xs font-mono">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase">FPS Rate</span>
                <span className="text-emerald-400 font-bold">{fps} FPS</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase">Loaded Chunks</span>
                <span className="text-slate-200 font-bold">{stats.loadedChunks} ({stats.totalBlocks.toLocaleString()} blocks)</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase">Rendered Faces</span>
                <span className="text-indigo-400 font-bold">{stats.renderedFaces.toLocaleString()}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase">Without Culling</span>
                <span className="text-slate-400 line-through">{stats.naiveFaceCount.toLocaleString()}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase font-semibold text-amber-400">Culled Faces Saved</span>
                <span className="text-amber-300 font-bold">{stats.cullingEfficiency}%</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase">Total Vertices</span>
                <span className="text-cyan-400 font-bold">{stats.totalVertices.toLocaleString()}</span>
              </div>
            </div>

            {/* Middle Row: Hotbar & Interactive Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Block Selection Hotbar */}
              <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 overflow-x-auto">
                <span className="text-[10px] font-semibold text-slate-400 px-1 font-mono uppercase">Block:</span>
                {selectableBlocks.map((blockId) => {
                  const def = BLOCK_DEFS[blockId];
                  const isSelected = selectedBlock === blockId;
                  return (
                    <button
                      key={blockId}
                      onClick={() => {
                        onSelectBlock(blockId);
                        sound.playClick();
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-500 text-slate-950 ring-2 ring-emerald-300 font-bold'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <span>{def.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Mob Spawner Toolbar */}
              <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-xs">
                <span className="text-[10px] font-semibold text-emerald-400 px-1 font-mono uppercase">
                  Mobs ({mobCount}):
                </span>
                <button
                  onClick={() => onSpawnMob?.('zombie')}
                  className="px-2 py-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/60 font-semibold transition cursor-pointer flex items-center gap-1"
                  title="Spawn Zombie (arms extended forward, rotting green skin)"
                >
                  <Box className="w-3 h-3 text-emerald-400" /> + Zombie
                </button>
                <button
                  onClick={() => onSpawnMob?.('creeper')}
                  className="px-2 py-1 rounded-lg bg-green-950/80 hover:bg-green-900 text-green-300 border border-green-800/60 font-semibold transition cursor-pointer flex items-center gap-1"
                  title="Spawn Creeper (4 legs quadruped trot, mossy camouflage)"
                >
                  <Box className="w-3 h-3 text-green-400" /> + Creeper
                </button>
                <button
                  onClick={() => onSpawnMob?.('steve')}
                  className="px-2 py-1 rounded-lg bg-sky-950/80 hover:bg-sky-900 text-sky-300 border border-sky-800/60 font-semibold transition cursor-pointer flex items-center gap-1"
                  title="Spawn Steve (Player humanoid, antiphase arm/leg swing)"
                >
                  <Box className="w-3 h-3 text-sky-400" /> + Steve
                </button>
                {mobCount > 0 && onClearMobs && (
                  <button
                    onClick={onClearMobs}
                    className="px-2 py-1 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-950/40 transition cursor-pointer text-[10px]"
                    title="Clear all spawned mobs"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={onRequestPointerLock}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-md cursor-pointer"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  {isPointerLocked ? 'Locked (Esc to exit)' : 'Walk / FPS Mode'}
                </button>

                <button
                  onClick={onToggleFlyMode}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    isFlyMode
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  {isFlyMode ? 'Fly Mode ON' : 'Walk Mode'}
                </button>

                <button
                  onClick={onToggleNaiveMode}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    naiveMode
                      ? 'bg-rose-600 text-white font-bold animate-pulse'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                  title="Toggle Naive Non-Culled Mode to compare polygon count"
                >
                  {naiveMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {naiveMode ? 'Culling OFF (Naive)' : 'Culling ON'}
                </button>

                <button
                  onClick={onRegenerateWorld}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  title="Regenerate Procedural Terrain"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                  Regenerate
                </button>

                {onToggleAO && (
                  <button
                    onClick={onToggleAO}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                      enableAO
                        ? 'bg-emerald-600/90 text-white hover:bg-emerald-500'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                    title="Toggle 4-level Ambient Occlusion (0%, 20%, 40%, 60%)"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    {enableAO ? 'AO: ON (4 Levels)' : 'AO: OFF'}
                  </button>
                )}

                {onToggleDayNight && (
                  <button
                    onClick={onToggleDayNight}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                      isNight
                        ? 'bg-indigo-950 text-indigo-200 border border-indigo-700'
                        : 'bg-amber-600/90 text-white hover:bg-amber-500'
                    }`}
                    title="Toggle Daytime / Nighttime Sky Light"
                  >
                    {isNight ? <Moon className="w-3.5 h-3.5 text-indigo-300" /> : <Sun className="w-3.5 h-3.5 text-amber-200" />}
                    {isNight ? 'Night (Torch Light)' : 'Day (Sun 100%)'}
                  </button>
                )}
              </div>
            </div>

            {/* Bottom Row: Settings Slider & Hints */}
            <div className="flex flex-wrap items-center justify-between border-t border-slate-800/80 pt-2 text-xs text-slate-400">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-mono text-[11px]">Render Distance:</span>
                  <input
                    type="range"
                    min="1"
                    max="6"
                    value={renderDistance}
                    onChange={(e) => onChangeRenderDistance(Number(e.target.value))}
                    className="w-24 accent-emerald-500 cursor-pointer"
                  />
                  <span className="font-mono font-bold text-emerald-400">{renderDistance} chunks</span>
                </div>
              </div>

              <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
                <span>Left Click: Break Block</span>
                <span>•</span>
                <span>Right Click: Place Block</span>
                <span>•</span>
                <span>WASD: Move</span>
                <span>•</span>
                <span>Space / Shift: Up / Down</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
