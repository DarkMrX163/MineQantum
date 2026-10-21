import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Compass,
  MapPin,
  Home,
  Navigation,
  ZoomIn,
  ZoomOut,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Maximize2,
  Minimize2,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';
import { ActiveWorldEvent } from '../engine/WorldEventManager';
import { VILLAGE_CENTER_X, VILLAGE_CENTER_Z, VILLAGE_RADIUS } from '../engine/VillageGenerator';

export interface PlayerTransform {
  x: number;
  y: number;
  z: number;
  yaw: number;
  dirX: number;
  dirZ: number;
}

export interface Landmark {
  id: string;
  name: string;
  nameRu: string;
  x: number;
  z: number;
  type: 'spawn' | 'village' | 'blacksmith' | 'farm' | 'library' | 'cottage' | 'event';
  icon: string;
  color: string;
  description: string;
}

const WORLD_SPAWN_X = 8;
const WORLD_SPAWN_Z = 8;

const DEFAULT_LANDMARKS: Landmark[] = [
  {
    id: 'spawn',
    name: 'World Spawn',
    nameRu: 'Точка спавна',
    x: WORLD_SPAWN_X,
    z: WORLD_SPAWN_Z,
    type: 'spawn',
    icon: '🧭',
    color: '#10b981',
    description: 'Начальная точка появления в мире',
  },
  {
    id: 'village',
    name: 'Plains Village',
    nameRu: 'Деревня жителей',
    x: VILLAGE_CENTER_X,
    z: VILLAGE_CENTER_Z,
    type: 'village',
    icon: '🏘️',
    color: '#f59e0b',
    description: 'Центр поселения жителей с колодцем и дорогами',
  },
  {
    id: 'blacksmith',
    name: 'Blacksmith',
    nameRu: 'Кузница',
    x: 57,
    z: 46,
    type: 'blacksmith',
    icon: '⚒️',
    color: '#ef4444',
    description: 'Мастерская кузнеца с лавой и сундуком',
  },
  {
    id: 'farm',
    name: 'Village Crops',
    nameRu: 'Ферма жителей',
    x: 44,
    z: 54,
    type: 'farm',
    icon: '🌾',
    color: '#eab308',
    description: 'Пшеничные поля с орошением',
  },
  {
    id: 'library',
    name: 'Library',
    nameRu: 'Библиотека',
    x: 56,
    z: 54,
    type: 'library',
    icon: '📖',
    color: '#818cf8',
    description: 'Дом священника и библиотекаря',
  },
  {
    id: 'cottage',
    name: 'Cozy Cottage',
    nameRu: 'Дом жителя',
    x: 41,
    z: 41,
    type: 'cottage',
    icon: '🏡',
    color: '#38bdf8',
    description: 'Уютный жилой коттедж',
  },
];

interface MiniMapProps {
  playerTransform?: PlayerTransform;
  activeEvent?: ActiveWorldEvent | null;
  remotePlayers?: { id: string; name: string; x: number; y: number; z: number; color: string }[];
}

export const MiniMap: React.FC<MiniMapProps> = ({
  playerTransform = { x: 8, y: 22, z: 8, yaw: 0, dirX: 0, dirZ: -1 },
  activeEvent,
  remotePlayers = [],
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Map state
  const [zoomLevel, setZoomLevel] = useState<number>(1); // 0.5x (120m), 1x (65m), 2x (35m)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [selectedTargetId, setSelectedTargetId] = useState<string>('village');
  const [rotateWithPlayer, setRotateWithPlayer] = useState<boolean>(false);

  // Determine current biome/location based on player coordinates
  const currentLocationName = useMemo(() => {
    const distToVillage = Math.hypot(
      playerTransform.x - VILLAGE_CENTER_X,
      playerTransform.z - VILLAGE_CENTER_Z
    );
    const distToSpawn = Math.hypot(
      playerTransform.x - WORLD_SPAWN_X,
      playerTransform.z - WORLD_SPAWN_Z
    );

    if (distToSpawn <= 6) return 'Точка спавна';
    if (distToVillage <= VILLAGE_RADIUS) return 'Деревня жителей';
    if (distToVillage <= VILLAGE_RADIUS + 10) return 'Окрестности деревни';
    if (playerTransform.y <= 19) return 'Водоем / Пляж';
    if (playerTransform.y > 28) return 'Холмы';
    return 'Цветущие Равнины';
  }, [playerTransform.x, playerTransform.y, playerTransform.z]);

  // Cardinal direction text
  const cardinalDirection = useMemo(() => {
    const dx = playerTransform.dirX;
    const dz = playerTransform.dirZ;

    // Angle in degrees where 0 is North (-Z)
    let deg = (Math.atan2(dx, -dz) * 180) / Math.PI;
    if (deg < 0) deg += 360;

    if (deg >= 337.5 || deg < 22.5) return { label: 'Север (N)', axis: '-Z', deg: Math.round(deg) };
    if (deg >= 22.5 && deg < 67.5) return { label: 'Северо-Восток (NE)', axis: '+X/-Z', deg: Math.round(deg) };
    if (deg >= 67.5 && deg < 112.5) return { label: 'Восток (E)', axis: '+X', deg: Math.round(deg) };
    if (deg >= 112.5 && deg < 157.5) return { label: 'Юго-Восток (SE)', axis: '+X/+Z', deg: Math.round(deg) };
    if (deg >= 157.5 && deg < 202.5) return { label: 'Юг (S)', axis: '+Z', deg: Math.round(deg) };
    if (deg >= 202.5 && deg < 247.5) return { label: 'Юго-Запад (SW)', axis: '-X/+Z', deg: Math.round(deg) };
    if (deg >= 247.5 && deg < 292.5) return { label: 'Запад (W)', axis: '-X', deg: Math.round(deg) };
    return { label: 'Северо-Запад (NW)', axis: '-X/-Z', deg: Math.round(deg) };
  }, [playerTransform.dirX, playerTransform.dirZ]);

  // Build landmarks including active world event if running
  const landmarks: Landmark[] = useMemo(() => {
    const list = [...DEFAULT_LANDMARKS];
    if (activeEvent?.targetPos) {
      list.push({
        id: 'event',
        name: activeEvent.title,
        nameRu: 'Цель события',
        x: Math.round(activeEvent.targetPos.x),
        z: Math.round(activeEvent.targetPos.z),
        type: 'event',
        icon: '⭐',
        color: '#c084fc',
        description: activeEvent.description,
      });
    }
    return list;
  }, [activeEvent]);

  // Distance to selected target
  const selectedTarget = useMemo(() => {
    return landmarks.find((l) => l.id === selectedTargetId) || landmarks[0];
  }, [landmarks, selectedTargetId]);

  const targetDist = useMemo(() => {
    if (!selectedTarget) return 0;
    return Math.round(
      Math.hypot(
        selectedTarget.x - playerTransform.x,
        selectedTarget.z - playerTransform.z
      )
    );
  }, [selectedTarget, playerTransform.x, playerTransform.z]);

  // Bearing to selected target relative to player
  const targetBearing = useMemo(() => {
    if (!selectedTarget) return { angle: 0, arrow: '⬆️' };
    const dx = selectedTarget.x - playerTransform.x;
    const dz = selectedTarget.z - playerTransform.z;
    // Map angle where North (-Z) is 0
    let targetAngle = Math.atan2(dx, -dz);
    let playerAngle = Math.atan2(playerTransform.dirX, -playerTransform.dirZ);
    let diff = targetAngle - playerAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    const degDiff = (diff * 180) / Math.PI;
    let arrow = '⬆️';
    if (degDiff > 25 && degDiff <= 65) arrow = '↗️';
    else if (degDiff > 65 && degDiff <= 115) arrow = '➡️';
    else if (degDiff > 115 && degDiff <= 155) arrow = '↘️';
    else if (degDiff > 155 || degDiff < -155) arrow = '⬇️';
    else if (degDiff < -25 && degDiff >= -65) arrow = '↖️';
    else if (degDiff < -65 && degDiff >= -115) arrow = '⬅️';
    else if (degDiff < -115 && degDiff >= -155) arrow = '↙️';

    return { angle: diff, arrow };
  }, [selectedTarget, playerTransform.x, playerTransform.z, playerTransform.dirX, playerTransform.dirZ]);

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || isCollapsed) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const cx = width / 2;
    const cy = height / 2;
    const mapRadius = width / 2 - 8;

    // View radius in world blocks
    const radiusInBlocks = zoomLevel === 0.5 ? 110 : zoomLevel === 1 ? 65 : 35;
    const scale = mapRadius / radiusInBlocks;

    // Rotation angle
    const playerHeadingAngle = Math.atan2(playerTransform.dirX, -playerTransform.dirZ);
    const viewRotation = rotateWithPlayer ? -playerHeadingAngle : 0;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Save initial state
    ctx.save();

    // 1. Clip to circular radar boundary
    ctx.beginPath();
    ctx.arc(cx, cy, mapRadius, 0, Math.PI * 2);
    ctx.clip();

    // 2. Base terrain backdrop
    ctx.fillStyle = '#0f172a'; // Deep slate
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(viewRotation);

    // Helper: world coords to local radar canvas coords
    const worldToCanvas = (wx: number, wz: number) => {
      const relX = (wx - playerTransform.x) * scale;
      const relY = (wz - playerTransform.z) * scale; // In 2D: +Z is Down, -Z is Up
      return { x: relX, y: relY };
    };

    // 3. Grid Lines (Chunk borders every 16 blocks)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);

    const minX = Math.floor((playerTransform.x - radiusInBlocks) / 16) * 16;
    const maxX = Math.ceil((playerTransform.x + radiusInBlocks) / 16) * 16;
    const minZ = Math.floor((playerTransform.z - radiusInBlocks) / 16) * 16;
    const maxZ = Math.ceil((playerTransform.z + radiusInBlocks) / 16) * 16;

    for (let gx = minX; gx <= maxX; gx += 16) {
      const pt1 = worldToCanvas(gx, playerTransform.z - radiusInBlocks);
      const pt2 = worldToCanvas(gx, playerTransform.z + radiusInBlocks);
      ctx.beginPath();
      ctx.moveTo(pt1.x, pt1.y);
      ctx.lineTo(pt2.x, pt2.y);
      ctx.stroke();
    }

    for (let gz = minZ; gz <= maxZ; gz += 16) {
      const pt1 = worldToCanvas(playerTransform.x - radiusInBlocks, gz);
      const pt2 = worldToCanvas(playerTransform.x + radiusInBlocks, gz);
      ctx.beginPath();
      ctx.moveTo(pt1.x, pt1.y);
      ctx.lineTo(pt2.x, pt2.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // 4. Village Plateau Overlay (radius 20 around 48, 48)
    const villagePt = worldToCanvas(VILLAGE_CENTER_X, VILLAGE_CENTER_Z);
    const villageCanvasRadius = VILLAGE_RADIUS * scale;

    // Village grass clearing
    ctx.beginPath();
    ctx.arc(villagePt.x, villagePt.y, villageCanvasRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(217, 119, 6, 0.14)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Village main streets (crossroads)
    ctx.strokeStyle = 'rgba(180, 83, 9, 0.6)';
    ctx.lineWidth = Math.max(2, 3 * scale);
    ctx.beginPath();
    // North-South street
    const ns1 = worldToCanvas(48, 35);
    const ns2 = worldToCanvas(48, 61);
    ctx.moveTo(ns1.x, ns1.y);
    ctx.lineTo(ns2.x, ns2.y);
    // East-West street
    const ew1 = worldToCanvas(35, 48);
    const ew2 = worldToCanvas(61, 48);
    ctx.moveTo(ew1.x, ew1.y);
    ctx.lineTo(ew2.x, ew2.y);
    ctx.stroke();

    // 5. Guideline to selected navigation target
    if (selectedTarget) {
      const targetPt = worldToCanvas(selectedTarget.x, selectedTarget.z);
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
      ctx.lineWidth = 2;
      ctx.moveTo(0, 0); // player center
      ctx.lineTo(targetPt.x, targetPt.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 6. Concentric distance rings from player
    const rings = zoomLevel === 0.5 ? [30, 60, 90] : zoomLevel === 1 ? [20, 40, 60] : [10, 20, 30];
    rings.forEach((r, idx) => {
      const ringRadius = r * scale;
      if (ringRadius < mapRadius) {
        ctx.beginPath();
        ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = idx === rings.length - 1 ? 'rgba(148, 163, 184, 0.25)' : 'rgba(148, 163, 184, 0.12)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Ring distance label
        ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`${r}m`, 0, -ringRadius + 2);
      }
    });

    // 7. Render Landmarks
    landmarks.forEach((landmark) => {
      const pt = worldToCanvas(landmark.x, landmark.z);
      const distFromPlayer = Math.hypot(pt.x, pt.y);
      const isSelected = landmark.id === selectedTargetId;

      if (distFromPlayer <= mapRadius - 10) {
        // Inside radar view
        ctx.save();
        ctx.translate(pt.x, pt.y);

        // Highlight ring if selected
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(0, 0, 11, 0, Math.PI * 2);
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Marker dot
        ctx.beginPath();
        ctx.arc(0, 0, landmark.type === 'spawn' || landmark.type === 'village' ? 6 : 4.5, 0, Math.PI * 2);
        ctx.fillStyle = landmark.color;
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Landmark Short Label
        ctx.font = 'bold 9px sans-serif';
        ctx.fillStyle = '#f8fafc';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 3;
        ctx.fillText(landmark.nameRu.split(' ')[0], 0, 7);
        ctx.shadowBlur = 0;

        ctx.restore();
      }
    });

    // 7.5 Render Remote Players with Nicknames
    if (remotePlayers && remotePlayers.length > 0) {
      remotePlayers.forEach((rp) => {
        const pt = worldToCanvas(rp.x, rp.z);
        const distFromPlayer = Math.hypot(pt.x, pt.y);

        if (distFromPlayer <= mapRadius - 8) {
          ctx.save();
          ctx.translate(pt.x, pt.y);

          // Glowing player dot
          ctx.beginPath();
          ctx.arc(0, 0, 5, 0, Math.PI * 2);
          ctx.fillStyle = rp.color || '#10b981';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Player Nickname Label
          ctx.font = 'bold 10px sans-serif';
          ctx.fillStyle = '#34d399';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.shadowColor = '#000000';
          ctx.shadowBlur = 4;
          ctx.fillText(rp.name || 'Player', 0, -6);
          ctx.shadowBlur = 0;

          ctx.restore();
        }
      });
    }

    // 8. Player Center Marker (Chevron + Field of View Cone)
    // Field of view cone
    ctx.beginPath();
    ctx.moveTo(0, 0);
    const fovAngle = (35 * Math.PI) / 180;
    const coneLen = 28;
    const lookAngle = rotateWithPlayer ? 0 : playerHeadingAngle;
    const leftAngle = -Math.PI / 2 + lookAngle - fovAngle;
    const rightAngle = -Math.PI / 2 + lookAngle + fovAngle;

    ctx.lineTo(Math.cos(leftAngle) * coneLen, Math.sin(leftAngle) * coneLen);
    ctx.arc(0, 0, coneLen, leftAngle, rightAngle);
    ctx.closePath();
    ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
    ctx.fill();

    // Player Directional Chevron
    ctx.save();
    if (!rotateWithPlayer) {
      ctx.rotate(playerHeadingAngle);
    }
    ctx.beginPath();
    ctx.moveTo(0, -9); // forward tip
    ctx.lineTo(6, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-6, 6);
    ctx.closePath();
    ctx.fillStyle = '#38bdf8';
    ctx.fill();
    ctx.strokeStyle = '#0369a1';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    ctx.restore(); // Restore world translation & rotation

    // 9. Off-Screen Landmark Beacon Pins (Pinned along circular radar perimeter)
    landmarks.forEach((landmark) => {
      const relX = (landmark.x - playerTransform.x) * scale;
      const relY = (landmark.z - playerTransform.z) * scale;
      const distFromCenter = Math.hypot(relX, relY);

      if (distFromCenter > mapRadius - 10) {
        // Compute angle from center
        let angle = Math.atan2(relY, relX) + viewRotation;
        const pinRadius = mapRadius - 8;
        const px = cx + Math.cos(angle) * pinRadius;
        const py = cy + Math.sin(angle) * pinRadius;

        const isSelected = landmark.id === selectedTargetId;
        const distanceBlocks = Math.round(
          Math.hypot(landmark.x - playerTransform.x, landmark.z - playerTransform.z)
        );

        ctx.save();
        ctx.translate(px, py);

        // Pin badge circle
        ctx.beginPath();
        ctx.arc(0, 0, isSelected ? 8 : 6, 0, Math.PI * 2);
        ctx.fillStyle = landmark.color;
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#38bdf8' : '#0f172a';
        ctx.lineWidth = isSelected ? 2 : 1.5;
        ctx.stroke();

        // Pin text tag
        if (isSelected || landmark.type === 'spawn' || landmark.type === 'village') {
          ctx.font = 'bold 8px monospace';
          ctx.fillStyle = '#f8fafc';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = '#000000';
          ctx.shadowBlur = 3;
          ctx.fillText(`${distanceBlocks}m`, 0, -11);
          ctx.shadowBlur = 0;
        }

        ctx.restore();
      }
    });

    // 10. Outer Compass Ring & Cardinal Direction Ticks (N, E, S, W)
    ctx.restore(); // Restore clip

    // Circular frame border
    ctx.beginPath();
    ctx.arc(cx, cy, mapRadius, 0, Math.PI * 2);
    ctx.strokeStyle = '#d97706'; // Gold accent
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, mapRadius + 2.5, 0, Math.PI * 2);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Cardinal directions
    const cardinalLabels = [
      { text: 'N', angle: -Math.PI / 2 + (rotateWithPlayer ? -playerHeadingAngle : 0), color: '#ef4444' },
      { text: 'E', angle: 0 + (rotateWithPlayer ? -playerHeadingAngle : 0), color: '#f8fafc' },
      { text: 'S', angle: Math.PI / 2 + (rotateWithPlayer ? -playerHeadingAngle : 0), color: '#f8fafc' },
      { text: 'W', angle: Math.PI + (rotateWithPlayer ? -playerHeadingAngle : 0), color: '#f8fafc' },
    ];

    cardinalLabels.forEach((c) => {
      const lx = cx + Math.cos(c.angle) * (mapRadius - 10);
      const ly = cy + Math.sin(c.angle) * (mapRadius - 10);
      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = c.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      ctx.fillText(c.text, lx, ly);
      ctx.shadowBlur = 0;
    });

  }, [
    playerTransform.x,
    playerTransform.y,
    playerTransform.z,
    playerTransform.dirX,
    playerTransform.dirZ,
    zoomLevel,
    isCollapsed,
    selectedTargetId,
    rotateWithPlayer,
    landmarks,
  ]);

  // Handle hotkey 'M' for toggling map collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key.toLowerCase() === 'm') {
        setIsCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="fixed top-4 right-4 z-35 pointer-events-auto select-none flex flex-col items-end gap-1.5 font-sans">
      {/* Top Map Header Pill (Always visible) */}
      <div className="flex items-center gap-2 bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/80 shadow-2xl">
        <div className="flex items-center gap-1.5">
          <Compass className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-mono font-bold text-amber-300">
            {currentLocationName}
          </span>
        </div>

        <div className="h-3.5 w-px bg-slate-700 mx-0.5" />

        {/* Real-time coordinates */}
        <div className="text-[11px] font-mono text-slate-300 flex items-center gap-1">
          <span className="text-emerald-400 font-bold">X:{Math.round(playerTransform.x)}</span>
          <span className="text-sky-400 font-bold">Y:{Math.round(playerTransform.y)}</span>
          <span className="text-amber-400 font-bold">Z:{Math.round(playerTransform.z)}</span>
        </div>

        {/* Toggle Collapse Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
          title={isCollapsed ? 'Развернуть мини-карту (M)' : 'Свернуть мини-карту (M)'}
        >
          {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded Mini-Map Card */}
      {!isCollapsed && (
        <div className="flex flex-col gap-2 bg-slate-950/90 backdrop-blur-xl p-2.5 rounded-2xl border-2 border-amber-500/70 shadow-[0_8px_30px_rgb(0,0,0,0.6)] w-56">
          {/* Canvas Radar Container */}
          <div className="relative w-full aspect-square flex items-center justify-center bg-slate-900/90 rounded-xl overflow-hidden border border-slate-800">
            <canvas
              ref={canvasRef}
              width={208}
              height={208}
              className="w-full h-full block"
            />

            {/* Quick Map Overlay Controls */}
            <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
              {/* Zoom In */}
              <button
                onClick={() => setZoomLevel((z) => (z === 0.5 ? 1 : 2))}
                disabled={zoomLevel === 2}
                className="w-6 h-6 flex items-center justify-center bg-slate-900/80 hover:bg-slate-800 disabled:opacity-35 text-slate-200 rounded-md border border-slate-700 text-xs shadow cursor-pointer transition-all"
                title="Приблизить"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              {/* Zoom Out */}
              <button
                onClick={() => setZoomLevel((z) => (z === 2 ? 1 : 0.5))}
                disabled={zoomLevel === 0.5}
                className="w-6 h-6 flex items-center justify-center bg-slate-900/80 hover:bg-slate-800 disabled:opacity-35 text-slate-200 rounded-md border border-slate-700 text-xs shadow cursor-pointer transition-all"
                title="Отдалить"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Rotation Mode Toggle (North-Up vs Follow Heading) */}
            <div className="absolute top-1.5 right-1.5">
              <button
                onClick={() => setRotateWithPlayer(!rotateWithPlayer)}
                className={`px-1.5 py-0.5 text-[9px] font-mono font-bold rounded border shadow cursor-pointer transition-all ${
                  rotateWithPlayer
                    ? 'bg-amber-500/90 text-slate-950 border-amber-400'
                    : 'bg-slate-900/80 text-slate-300 border-slate-700 hover:bg-slate-800'
                }`}
                title="Переключить ориентацию карты (Север сверху / По направлению взгляда)"
              >
                {rotateWithPlayer ? 'ВЗГЛЯД' : 'СЕВЕР'}
              </button>
            </div>

            {/* Facing direction footer */}
            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 bg-slate-950/80 px-2 py-0.5 rounded text-[9px] font-mono text-slate-300 border border-slate-800 shadow whitespace-nowrap">
              {cardinalDirection.label}
            </div>
          </div>

          {/* Navigation Target Selector & Active Bearing */}
          <div className="flex flex-col gap-1.5 bg-slate-900/70 p-2 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-400 flex items-center gap-1">
                <Navigation className="w-3 h-3 text-sky-400" />
                <span>Цель:</span>
              </span>
              <span className="font-bold text-sky-300 flex items-center gap-1">
                <span>{targetBearing.arrow}</span>
                <span>{targetDist}м</span>
              </span>
            </div>

            {/* Quick Destination Selectors */}
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => setSelectedTargetId('spawn')}
                className={`px-2 py-1 rounded-lg text-xs font-mono font-medium flex items-center justify-between transition-all cursor-pointer ${
                  selectedTargetId === 'spawn'
                    ? 'bg-emerald-600/90 text-white font-bold border border-emerald-400 shadow'
                    : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700'
                }`}
              >
                <span className="flex items-center gap-1">
                  <span>🧭</span>
                  <span>Спавн</span>
                </span>
                <span className="text-[10px] opacity-80">
                  {Math.round(Math.hypot(WORLD_SPAWN_X - playerTransform.x, WORLD_SPAWN_Z - playerTransform.z))}м
                </span>
              </button>

              <button
                onClick={() => setSelectedTargetId('village')}
                className={`px-2 py-1 rounded-lg text-xs font-mono font-medium flex items-center justify-between transition-all cursor-pointer ${
                  selectedTargetId === 'village'
                    ? 'bg-amber-600/90 text-white font-bold border border-amber-400 shadow'
                    : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700'
                }`}
              >
                <span className="flex items-center gap-1">
                  <span>🏘️</span>
                  <span>Деревня</span>
                </span>
                <span className="text-[10px] opacity-80">
                  {Math.round(Math.hypot(VILLAGE_CENTER_X - playerTransform.x, VILLAGE_CENTER_Z - playerTransform.z))}м
                </span>
              </button>
            </div>

            {/* Specific Structure Destinations (Sub-row) */}
            <div className="flex items-center gap-1 overflow-x-auto py-0.5 no-scrollbar text-[10px] font-mono">
              <button
                onClick={() => setSelectedTargetId('blacksmith')}
                className={`px-1.5 py-0.5 rounded border transition-colors cursor-pointer shrink-0 ${
                  selectedTargetId === 'blacksmith'
                    ? 'bg-red-500/80 text-white border-red-400 font-bold'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
                title="Кузница"
              >
                ⚒️ Кузница
              </button>
              <button
                onClick={() => setSelectedTargetId('farm')}
                className={`px-1.5 py-0.5 rounded border transition-colors cursor-pointer shrink-0 ${
                  selectedTargetId === 'farm'
                    ? 'bg-yellow-500/80 text-slate-950 border-yellow-300 font-bold'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
                title="Ферма"
              >
                🌾 Ферма
              </button>
              <button
                onClick={() => setSelectedTargetId('library')}
                className={`px-1.5 py-0.5 rounded border transition-colors cursor-pointer shrink-0 ${
                  selectedTargetId === 'library'
                    ? 'bg-indigo-500/80 text-white border-indigo-300 font-bold'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
                title="Библиотека"
              >
                📖 Библиотека
              </button>
              {activeEvent?.targetPos && (
                <button
                  onClick={() => setSelectedTargetId('event')}
                  className={`px-1.5 py-0.5 rounded border transition-colors cursor-pointer shrink-0 animate-pulse ${
                    selectedTargetId === 'event'
                      ? 'bg-purple-600 text-white border-purple-400 font-bold'
                      : 'bg-purple-950/80 text-purple-200 border-purple-700 hover:bg-purple-900'
                  }`}
                  title="Ивент"
                >
                  ⭐ Ивент
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
