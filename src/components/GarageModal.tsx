import React from 'react';
import { Snowflake, Wrench, X } from 'lucide-react';
import {
  getUpgradeCost,
  SteeringMode,
  UPGRADE_SPECS,
  UpgradeKey,
  UpgradesState,
} from '../game/types';

interface GarageModalProps {
  snowflakes: number;
  upgrades: UpgradesState;
  steeringMode: SteeringMode;
  onPurchase: (key: UpgradeKey) => void;
  onChangeSteering: (mode: SteeringMode) => void;
  onClose: () => void;
}

export const GarageModal: React.FC<GarageModalProps> = ({
  snowflakes,
  upgrades,
  steeringMode,
  onPurchase,
  onChangeSteering,
  onClose,
}) => {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0c101d]/75 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-700/80 bg-[#151b2e] p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700/60 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-amber-400" />
              <h2 className="font-display text-2xl font-bold text-slate-50">Village Garage</h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              Upgrades update your snowplow rig immediately in the field
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-700/70 bg-slate-900/70 px-3 py-1.5 text-amber-300">
              <Snowflake className="h-4 w-4" />
              <span className="font-mono-nums text-base font-bold">
                {snowflakes.toLocaleString()}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Garage"
              className="rounded-lg bg-slate-800 p-2 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {UPGRADE_SPECS.map((spec) => {
            const level = upgrades[spec.key];
            const maxed = level >= spec.maxLevel;
            const cost = getUpgradeCost(spec, level);
            const affordable = !maxed && snowflakes >= cost;

            return (
              <div
                key={spec.key}
                className="flex flex-col justify-between rounded-xl border border-slate-700/60 bg-slate-900/55 p-4"
              >
                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-100">{spec.label}</h3>
                    <span className="font-mono-nums text-xs text-slate-400">
                      Lv {level}/{spec.maxLevel}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">{spec.shortDesc}</p>

                  {/* Level Segment Bars */}
                  <div className="mt-3 flex gap-1.5">
                    {Array.from({ length: spec.maxLevel }).map((_, idx) => (
                      <div
                        key={idx}
                        className={`h-1.5 flex-1 rounded-full ${
                          idx < level ? 'bg-amber-400' : 'bg-slate-800'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <button
                    type="button"
                    disabled={!affordable}
                    onClick={() => onPurchase(spec.key)}
                    className={`w-full rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                      maxed
                        ? 'bg-slate-800 text-slate-400 cursor-default'
                        : affordable
                          ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 cursor-pointer'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {maxed ? 'Max Level' : `Upgrade · ${cost} Snowflakes`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Steering Mode & Resume Footer */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-slate-700/60 pt-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-300">Steering</span>
            <div className="flex rounded-lg bg-slate-900 p-1 border border-slate-700/60">
              <button
                type="button"
                onClick={() => onChangeSteering('screen')}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                  steeringMode === 'screen'
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Screen-Relative
              </button>
              <button
                type="button"
                onClick={() => onChangeSteering('vehicle')}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                  steeringMode === 'vehicle'
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Cab-Relative
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-100 px-5 py-2 text-xs font-semibold text-slate-950 hover:bg-white transition-colors cursor-pointer"
          >
            Back to Street
          </button>
        </div>
      </div>
    </div>
  );
};
