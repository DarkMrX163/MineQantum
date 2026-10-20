import React, { useEffect, useRef, useState } from 'react';
import { BLOCK_DEFS, ATLAS_GRID_SIZE } from '../engine/types';
import { getTileUVs } from '../engine/TextureAtlas';
import { Grid, Image as ImageIcon } from 'lucide-react';

interface AtlasViewerProps {
  atlasCanvas: HTMLCanvasElement | null;
}

export const AtlasViewer: React.FC<AtlasViewerProps> = ({ atlasCanvas }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedTile, setSelectedTile] = useState<number | null>(3); // Grass top by default

  useEffect(() => {
    if (!atlasCanvas || !containerRef.current) return;
    containerRef.current.innerHTML = '';

    const cloneCanvas = document.createElement('canvas');
    cloneCanvas.width = atlasCanvas.width * 2; // Scale up for preview
    cloneCanvas.height = atlasCanvas.height * 2;
    const ctx = cloneCanvas.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(atlasCanvas, 0, 0, cloneCanvas.width, cloneCanvas.height);
    }
    cloneCanvas.className = 'w-full max-w-[320px] aspect-square rounded-lg border border-slate-700 shadow-lg';
    containerRef.current.appendChild(cloneCanvas);
  }, [atlasCanvas]);

  const tiles = Array.from({ length: ATLAS_GRID_SIZE * ATLAS_GRID_SIZE }, (_, i) => i);

  const selectedUV = selectedTile !== null ? getTileUVs(selectedTile) : null;

  // Find block associated with selected tile
  const blockName = Object.values(BLOCK_DEFS).find((b) =>
    b.tiles.top === selectedTile || b.tiles.bottom === selectedTile || b.tiles.sides === selectedTile
  )?.name || 'Texture Tile';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-2xl flex flex-col gap-4 text-slate-200">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-emerald-400" />
          <h3 className="font-semibold text-sm text-slate-100">Texture Atlas & UV Inspector</h3>
        </div>
        <span className="text-xs bg-slate-800 text-slate-400 px-2.5 py-1 rounded-md font-mono">
          8x8 Grid (128x128 px)
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
        {/* Canvas Display */}
        <div className="flex flex-col items-center gap-3">
          <div ref={containerRef} className="flex justify-center" />
          <span className="text-xs text-slate-400 font-mono">Crisp NearestFilter Pixel Sampling</span>
        </div>

        {/* Tile Grid Selector */}
        <div className="flex flex-col gap-3">
          <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
            <Grid className="w-4 h-4 text-slate-400" /> Select Tile to Inspect UV Coordinates
          </span>

          <div className="grid grid-cols-8 gap-1 bg-slate-950 p-2 rounded-lg border border-slate-800">
            {tiles.map((tileIdx) => (
              <button
                key={tileIdx}
                onClick={() => setSelectedTile(tileIdx)}
                className={`w-7 h-7 rounded text-[10px] font-mono font-bold flex items-center justify-center transition ${
                  selectedTile === tileIdx
                    ? 'bg-emerald-500 text-slate-950 ring-2 ring-emerald-300'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
              >
                {tileIdx}
              </button>
            ))}
          </div>

          {/* Selected Tile Stats */}
          {selectedTile !== null && selectedUV && (
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs space-y-2 font-mono">
              <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                <span className="text-slate-400">Tile Index:</span>
                <span className="text-emerald-400 font-bold">{selectedTile} ({blockName})</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-500">uMin: </span>
                  <span className="text-amber-300">{selectedUV.uMin.toFixed(4)}</span>
                </div>
                <div>
                  <span className="text-slate-500">uMax: </span>
                  <span className="text-amber-300">{selectedUV.uMax.toFixed(4)}</span>
                </div>
                <div>
                  <span className="text-slate-500">vMin: </span>
                  <span className="text-indigo-300">{selectedUV.vMin.toFixed(4)}</span>
                </div>
                <div>
                  <span className="text-slate-500">vMax: </span>
                  <span className="text-indigo-300">{selectedUV.vMax.toFixed(4)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
