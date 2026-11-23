import React from 'react';
import { LEVELS } from '../game/levels';
import { HudSnapshot } from '../game/types';

interface PauseVictoryModalProps {
  mode: 'paused' | 'victory';
  hud: HudSnapshot;
  unlockedLevel: number;
  onResume: () => void;
  onOpenGarage: () => void;
  onRestart: () => void;
  onSelectLevel: (idx: number) => void;
  onReturnTitle: () => void;
}

export const PauseVictoryModal: React.FC<PauseVictoryModalProps> = ({
  mode,
  hud,
  unlockedLevel,
  onResume,
  onOpenGarage,
  onRestart,
  onSelectLevel,
  onReturnTitle,
}) => {
  const isVictory = mode === 'victory';
  const nextIndex = hud.levelIndex + 1;
  const hasNextNeighborhood = nextIndex < LEVELS.length;

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0c101d]/75 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-700/80 bg-[#151b2e] p-6 shadow-2xl">
        <div className="text-xs font-medium text-amber-400">
          {isVictory ? 'Neighborhood Cleared' : 'Shift Paused'} · {hud.levelName}
        </div>
        <h2 className="mt-1 font-display text-3xl font-bold text-slate-50">
          {isVictory ? 'Warm Hearths All Around' : 'Take a Breather'}
        </h2>
        <p className="mt-1.5 text-sm text-slate-300">
          {isVictory
            ? 'Every road is open and the cabin lanterns are glowing brightly.'
            : 'Switch neighborhoods, visit the garage, or jump back behind the blade.'}
        </p>

        {/* Shift Metrics */}
        <div className="mt-5 grid grid-cols-3 gap-2 rounded-xl border border-slate-700/60 bg-slate-900/60 p-3.5 text-center">
          <div>
            <div className="text-[11px] text-slate-400">Cleared</div>
            <div className="mt-0.5 font-mono-nums text-lg font-bold text-slate-100">
              {hud.clearPercent}%
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Earned</div>
            <div className="mt-0.5 font-mono-nums text-lg font-bold text-amber-300">
              +{hud.shiftEarnings.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Best Combo</div>
            <div className="mt-0.5 font-mono-nums text-lg font-bold text-slate-100">
              {hud.bestCombo.toFixed(1)}x
            </div>
          </div>
        </div>

        {/* Neighborhood Switcher */}
        <div className="mt-5">
          <div className="text-xs font-medium text-slate-400 mb-2">Neighborhoods</div>
          <div className="flex flex-wrap gap-1.5">
            {LEVELS.map((lvl) => {
              const locked = !lvl.isEndless && lvl.index > unlockedLevel;
              const current = lvl.index === hud.levelIndex;
              return (
                <button
                  key={lvl.id}
                  type="button"
                  disabled={locked}
                  onClick={() => onSelectLevel(lvl.index)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    current
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : locked
                        ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed'
                        : 'bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer'
                  }`}
                >
                  {lvl.isEndless ? 'Endless Chill' : `${lvl.index + 1}. ${lvl.name}`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col gap-2">
          {isVictory && hasNextNeighborhood ? (
            <button
              type="button"
              onClick={() => onSelectLevel(nextIndex)}
              className="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer"
            >
              Drive to {LEVELS[nextIndex].name}
            </button>
          ) : (
            <button
              type="button"
              onClick={onResume}
              className="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer"
            >
              Resume Shift
            </button>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onOpenGarage}
              className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Garage Upgrades
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Reset Snow
            </button>
          </div>

          <button
            type="button"
            onClick={onReturnTitle}
            className="mt-1 w-full rounded-lg border border-slate-700/70 bg-transparent px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800/70 transition-colors cursor-pointer"
          >
            Return to Title
          </button>
        </div>
      </div>
    </div>
  );
};
