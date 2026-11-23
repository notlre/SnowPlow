import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { LEVELS } from '../game/levels';

interface TitleOverlayProps {
  unlockedLevel: number;
  selectedLevelIndex: number;
  snowflakes: number;
  isMuted: boolean;
  onSelectLevel: (idx: number) => void;
  onStartGame: (idx: number) => void;
  onToggleMute: () => void;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  unlockedLevel,
  selectedLevelIndex,
  snowflakes,
  isMuted,
  onSelectLevel,
  onStartGame,
  onToggleMute,
}) => {
  const activeLevel = LEVELS[selectedLevelIndex] ?? LEVELS[0];
  const endlessIndex = LEVELS.findIndex((l) => l.isEndless);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-6 md:p-10">
      {/* Top Row: Bespoke SVG Lockup + Mute Toggle */}
      <div className="flex items-start justify-between gap-6">
        <div className="pointer-events-auto max-w-lg rounded-2xl bg-[#14192b]/88 px-6 py-5 border border-slate-700/60 shadow-2xl">
          {/* Bespoke Inline SVG Title Lockup */}
          <svg
            viewBox="0 0 380 86"
            className="h-14 w-auto md:h-16"
            aria-label="Hearthplow"
            role="img"
          >
            {/* Stylized Snowplow V-Blade & Cozy Cabin Lantern Emblem */}
            <g transform="translate(4, 10)">
              <path
                d="M12 48 L32 28 L52 48"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect x="24" y="38" width="16" height="16" rx="2" fill="#f59e0b" opacity="0.22" />
              <circle cx="32" cy="43" r="4.2" fill="#fbbf24" />
              <path
                d="M6 56 L22 48 L42 48 L58 56 L54 62 L10 62 Z"
                fill="#dce7f8"
                stroke="#94a3b8"
                strokeWidth="1.5"
              />
              <path d="M32 10 L32 19 M21 15 L25 21 M43 15 L39 21" stroke="#fbbf24" strokeWidth="2.2" strokeLinecap="round" />
            </g>
            {/* Title Wordmark */}
            <text
              x="74"
              y="48"
              fill="#f8f4eb"
              fontFamily="Fraunces, Georgia, serif"
              fontWeight="700"
              fontSize="40"
              letterSpacing="-0.5"
            >
              Hearthplow
            </text>
            <text
              x="76"
              y="70"
              fill="#cbd5e1"
              fontFamily="Plus Jakarta Sans, sans-serif"
              fontWeight="500"
              fontSize="13.5"
              letterSpacing="0.4"
            >
              Twilight Village Snow Clearing
            </text>
          </svg>

          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            Carve crisp lanes through twilight snowdrifts, light up cabin porches, and upgrade your rig against black ice and squalls.
          </p>

          {/* Neighborhood Selector */}
          <div className="mt-4 flex flex-wrap gap-1.5">
            {LEVELS.map((lvl) => {
              const locked = !lvl.isEndless && lvl.index > unlockedLevel;
              const selected = lvl.index === selectedLevelIndex;
              return (
                <button
                  key={lvl.id}
                  type="button"
                  disabled={locked}
                  onClick={() => onSelectLevel(lvl.index)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                    selected
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : locked
                        ? 'bg-slate-800/60 text-slate-500 cursor-not-allowed'
                        : 'bg-slate-800/90 text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  {lvl.isEndless ? 'Endless Chill' : `${lvl.index + 1}. ${lvl.name}`}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
            <span>{activeLevel.weatherLabel}</span>
            <span aria-hidden="true">·</span>
            <span>{activeLevel.subtitle}</span>
            {snowflakes > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono-nums text-amber-300">{snowflakes.toLocaleString()} Snowflakes</span>
              </>
            )}
          </div>

          {/* Primary Actions */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onStartGame(selectedLevelIndex)}
              className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg hover:bg-amber-400 active:translate-y-px transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              Start Shift
            </button>
            {endlessIndex >= 0 && selectedLevelIndex !== endlessIndex && (
              <button
                type="button"
                onClick={() => onStartGame(endlessIndex)}
                className="rounded-lg border border-slate-600/80 bg-slate-800/90 px-4 py-2.5 text-sm font-medium text-slate-100 hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Endless Chill Mode
              </button>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleMute}
          aria-label={isMuted ? 'Unmute synth audio' : 'Mute synth audio'}
          className="pointer-events-auto flex items-center gap-2 rounded-lg border border-slate-700/70 bg-[#14192b]/90 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {isMuted ? <VolumeX className="h-4 w-4 text-slate-400" /> : <Volume2 className="h-4 w-4 text-amber-400" />}
          <span>{isMuted ? 'Muted' : 'Synth On'}</span>
        </button>
      </div>

      {/* Single Flat Control-Hint Line */}
      <div className="flex justify-center">
        <div className="rounded-lg border border-slate-700/50 bg-[#14192b]/85 px-4 py-2 text-xs font-medium text-slate-300 tracking-wide">
          WASD / Arrows Drive · Shift Turbo · G Garage · M Mute · Esc Pause
        </div>
      </div>
    </div>
  );
};
