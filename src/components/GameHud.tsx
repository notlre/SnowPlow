import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Pause, Volume2, VolumeX, Wrench, Snowflake } from 'lucide-react';
import { HudSnapshot } from '../game/types';

interface GameHudProps {
  hud: HudSnapshot;
  isMuted: boolean;
  canAffordAnyUpgrade: boolean;
  onOpenGarage: () => void;
  onTogglePause: () => void;
  onToggleMute: () => void;
  onTouchSteer: (x: number, z: number, turbo: boolean) => void;
}

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  isMuted,
  canAffordAnyUpgrade,
  onOpenGarage,
  onTogglePause,
  onToggleMute,
  onTouchSteer,
}) => {
  const [dockCollapsed, setDockCollapsed] = useState(false);

  const progressRatio = hud.isEndless
    ? Math.min(1, hud.clearPercent / 100)
    : Math.min(1, hud.clearPercent / hud.targetPercent);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-4 md:p-5">
      {/* Top Perimeter HUD Clusters (>85% viewport unobstructed) */}
      <div className="flex items-start justify-between gap-4">
        {/* Top-Left: Neighborhood, Weather & Clear Progress */}
        <div className="rounded-xl border border-slate-700/65 bg-[#14192b]/88 px-4 py-3 shadow-lg min-w-[230px]">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="font-medium text-slate-200">{hud.levelName}</span>
            <span aria-hidden="true">·</span>
            <span>{hud.weatherLabel}</span>
          </div>

          <div className="mt-1.5 flex items-baseline justify-between gap-4">
            <span className="font-mono-nums text-xl font-bold text-slate-50">
              {hud.clearPercent}%
            </span>
            <span className="text-xs text-slate-400 font-mono-nums">
              {hud.isEndless ? 'Free-Plow' : `Goal ${hud.targetPercent}%`} · {hud.cabinsCleared}/{hud.totalCabins} Cabins
            </span>
          </div>

          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-amber-400 transition-transform duration-150 origin-left"
              style={{ transform: `scaleX(${progressRatio})` }}
            />
          </div>

          {/* Turbo Bar */}
          <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
            <span className="whitespace-nowrap">Turbo</span>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full bg-sky-400 transition-transform duration-100 origin-left"
                style={{ transform: `scaleX(${hud.turboEnergy})` }}
              />
            </div>
            <span className="font-mono-nums text-slate-300 w-12 text-right">{hud.speedKmh} km/h</span>
          </div>
        </div>

        {/* Center-Top: Quiet Toast Banner */}
        {hud.bannerText && (
          <div className="hidden md:block rounded-xl border border-amber-400/45 bg-[#14192b]/92 px-4 py-2 text-xs font-medium text-amber-200 shadow-lg">
            {hud.bannerText}
          </div>
        )}

        {/* Top-Right: Snowflakes, Combo Multiplier & Surface Hazard Readout */}
        <div className="flex flex-col items-end gap-2">
          <div className="rounded-xl border border-slate-700/65 bg-[#14192b]/88 px-4 py-3 shadow-lg min-w-[190px]">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5 text-amber-300">
                <Snowflake className="h-4 w-4" />
                <span className="font-mono-nums text-lg font-bold">
                  {hud.snowflakes.toLocaleString()}
                </span>
              </div>
              <div className="font-mono-nums text-sm font-bold text-slate-100">
                {hud.comboMultiplier.toFixed(1)}x
              </div>
            </div>

            <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
              <span>Shift +{hud.shiftEarnings.toLocaleString()}</span>
              <span>Combo</span>
            </div>

            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full bg-amber-500 transition-transform duration-75 origin-left"
                style={{ transform: `scaleX(${hud.comboProgress})` }}
              />
            </div>
          </div>

          {(hud.onIce || hud.inDeepDrift) && (
            <div
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium shadow-md ${
                hud.onIce
                  ? 'border-sky-400/50 bg-[#14192b]/92 text-sky-200'
                  : 'border-amber-400/50 bg-[#14192b]/92 text-amber-200'
              }`}
            >
              {hud.onIce ? 'Black Ice · Reduced Traction' : 'Deep Snowdrift · Bonus Yield'}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row: Touch Pad (small screens) + Collapsible Bottom Control Dock */}
      <div className="flex items-end justify-between gap-4">
        {/* Compact Touch Drive Pad for touch/mobile */}
        <div className="pointer-events-auto grid grid-cols-3 gap-1 md:hidden rounded-xl border border-slate-700/60 bg-[#14192b]/85 p-1.5">
          <div />
          <button
            type="button"
            onPointerDown={() => onTouchSteer(0, 1, false)}
            onPointerUp={() => onTouchSteer(0, 0, false)}
            onPointerLeave={() => onTouchSteer(0, 0, false)}
            className="h-10 w-10 rounded-lg bg-slate-800 text-xs font-semibold text-slate-100 active:bg-amber-500 active:text-slate-950"
          >
            W
          </button>
          <button
            type="button"
            onPointerDown={() => onTouchSteer(0, 1, true)}
            onPointerUp={() => onTouchSteer(0, 0, false)}
            onPointerLeave={() => onTouchSteer(0, 0, false)}
            className="h-10 w-10 rounded-lg bg-sky-900/70 text-[10px] font-semibold text-sky-200"
          >
            Turbo
          </button>
          <button
            type="button"
            onPointerDown={() => onTouchSteer(-1, 0, false)}
            onPointerUp={() => onTouchSteer(0, 0, false)}
            onPointerLeave={() => onTouchSteer(0, 0, false)}
            className="h-10 w-10 rounded-lg bg-slate-800 text-xs font-semibold text-slate-100 active:bg-amber-500 active:text-slate-950"
          >
            A
          </button>
          <button
            type="button"
            onPointerDown={() => onTouchSteer(0, -1, false)}
            onPointerUp={() => onTouchSteer(0, 0, false)}
            onPointerLeave={() => onTouchSteer(0, 0, false)}
            className="h-10 w-10 rounded-lg bg-slate-800 text-xs font-semibold text-slate-100 active:bg-amber-500 active:text-slate-950"
          >
            S
          </button>
          <button
            type="button"
            onPointerDown={() => onTouchSteer(1, 0, false)}
            onPointerUp={() => onTouchSteer(0, 0, false)}
            onPointerLeave={() => onTouchSteer(0, 0, false)}
            className="h-10 w-10 rounded-lg bg-slate-800 text-xs font-semibold text-slate-100 active:bg-amber-500 active:text-slate-950"
          >
            D
          </button>
        </div>

        {/* Centered Collapsible Bottom Control Dock */}
        <div className="pointer-events-auto mx-auto flex flex-col items-center">
          <button
            type="button"
            onClick={() => setDockCollapsed((c) => !c)}
            className="mb-1.5 flex items-center gap-1.5 rounded-md border border-slate-700/60 bg-[#14192b]/88 px-3 py-1 text-[11px] font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            {dockCollapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            <span>{dockCollapsed ? 'Show Controls' : 'Hide Controls'}</span>
          </button>

          {!dockCollapsed && (
            <div className="flex items-center gap-2 rounded-xl border border-slate-700/70 bg-[#14192b]/92 px-3 py-2 shadow-xl">
              <button
                type="button"
                onClick={onOpenGarage}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  canAffordAnyUpgrade
                    ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                    : 'bg-slate-800 text-slate-100 hover:bg-slate-700'
                }`}
              >
                <Wrench className="h-3.5 w-3.5" />
                <span>Garage (G)</span>
              </button>

              <button
                type="button"
                onClick={onToggleMute}
                className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                {isMuted ? (
                  <VolumeX className="h-3.5 w-3.5 text-slate-400" />
                ) : (
                  <Volume2 className="h-3.5 w-3.5 text-amber-400" />
                )}
                <span>{isMuted ? 'Unmute (M)' : 'Mute (M)'}</span>
              </button>

              <button
                type="button"
                onClick={onTogglePause}
                className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                <Pause className="h-3.5 w-3.5" />
                <span>Pause (Esc)</span>
              </button>
            </div>
          )}
        </div>

        <div className="hidden md:block w-[110px]" />
      </div>
    </div>
  );
};
