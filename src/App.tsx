/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GarageModal } from './components/GarageModal';
import { GameHud } from './components/GameHud';
import { PauseVictoryModal } from './components/PauseVictoryModal';
import { TitleOverlay } from './components/TitleOverlay';
import { HearthplowEngine } from './game/engine';
import { LEVELS } from './game/levels';
import {
  getUpgradeCost,
  HudSnapshot,
  loadSaveData,
  persistSaveData,
  SaveData,
  SteeringMode,
  UPGRADE_SPECS,
  UpgradeKey,
} from './game/types';

const INITIAL_HUD: HudSnapshot = {
  phase: 'title',
  levelIndex: 0,
  levelName: LEVELS[0].name,
  weatherLabel: LEVELS[0].weatherLabel,
  isEndless: false,
  clearPercent: 0,
  targetPercent: LEVELS[0].targetPercent,
  snowflakes: 0,
  shiftEarnings: 0,
  comboMultiplier: 1.0,
  comboProgress: 0,
  bestCombo: 1.0,
  cabinsCleared: 0,
  totalCabins: LEVELS[0].cabins.length,
  speedKmh: 0,
  turboEnergy: 1.0,
  onIce: false,
  inDeepDrift: false,
  bannerText: null,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<HearthplowEngine | null>(null);

  const [save, setSave] = useState<SaveData>(() => loadSaveData());
  const saveRef = useRef<SaveData>(save);
  saveRef.current = save;

  const [selectedTitleLevel, setSelectedTitleLevel] = useState<number>(0);
  const selectedTitleLevelRef = useRef<number>(0);
  selectedTitleLevelRef.current = selectedTitleLevel;
  const [hud, setHud] = useState<HudSnapshot>(() => ({
    ...INITIAL_HUD,
    snowflakes: save.snowflakes,
  }));
  const [garageOpen, setGarageOpen] = useState(false);
  const [contextLost, setContextLost] = useState(false);

  const garageOpenRef = useRef(garageOpen);
  garageOpenRef.current = garageOpen;

  const hudPhaseRef = useRef(hud.phase);
  hudPhaseRef.current = hud.phase;

  // Persist save changes to localStorage
  useEffect(() => {
    persistSaveData(save);
  }, [save]);

  const handleToggleMute = useCallback(() => {
    setSave((prev) => {
      const nextMuted = !prev.isMuted;
      engineRef.current?.setMuted(nextMuted);
      return { ...prev, isMuted: nextMuted };
    });
  }, []);

  const handleOpenGarage = useCallback(() => {
    if (hudPhaseRef.current === 'playing') {
      engineRef.current?.setPhase('paused');
    }
    setGarageOpen(true);
  }, []);

  const handleCloseGarage = useCallback(() => {
    setGarageOpen(false);
    if (hudPhaseRef.current === 'paused') {
      engineRef.current?.setPhase('playing');
    }
  }, []);

  const handleStartLevel = useCallback((idx: number) => {
    setGarageOpen(false);
    setSelectedTitleLevel(idx);
    engineRef.current?.audio.unlock();
    engineRef.current?.loadLevel(idx, 'playing');
  }, []);

  const handleSelectTitleLevel = useCallback((idx: number) => {
    setSelectedTitleLevel(idx);
    engineRef.current?.loadLevel(idx, 'title');
  }, []);

  const handleTogglePause = useCallback(() => {
    if (garageOpenRef.current) {
      setGarageOpen(false);
      engineRef.current?.setPhase('playing');
      return;
    }
    if (hudPhaseRef.current === 'playing') {
      engineRef.current?.setPhase('paused');
    } else if (hudPhaseRef.current === 'paused') {
      engineRef.current?.setPhase('playing');
    }
  }, []);

  const handlePurchaseUpgrade = useCallback((key: UpgradeKey) => {
    const spec = UPGRADE_SPECS.find((s) => s.key === key);
    if (!spec) return;

    setSave((prev) => {
      const currentLvl = prev.upgrades[key];
      if (currentLvl >= spec.maxLevel) return prev;
      const cost = getUpgradeCost(spec, currentLvl);
      if (prev.snowflakes < cost) return prev;

      const nextUpgrades = { ...prev.upgrades, [key]: currentLvl + 1 };
      const nextSnowflakes = prev.snowflakes - cost;

      engineRef.current?.applyUpgrades(nextUpgrades, nextSnowflakes);
      engineRef.current?.audio.unlock();
      engineRef.current?.audio.playUpgradePurchased();

      return {
        ...prev,
        snowflakes: nextSnowflakes,
        upgrades: nextUpgrades,
      };
    });
  }, []);

  const handleChangeSteering = useCallback((mode: SteeringMode) => {
    engineRef.current?.setSteeringMode(mode);
    setSave((prev) => ({ ...prev, steeringMode: mode }));
  }, []);

  const handleTouchSteer = useCallback((x: number, z: number, turbo: boolean) => {
    engineRef.current?.audio.unlock();
    engineRef.current?.setTouchInput(x, z, turbo);
  }, []);

  // Initialize isolated 3D engine once
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const initialSave = saveRef.current;
    const engine = new HearthplowEngine(
      mount,
      initialSave.upgrades,
      initialSave.snowflakes,
      initialSave.steeringMode,
      initialSave.isMuted,
      {
        onHudUpdate: (snapshot) => {
          setHud(snapshot);
        },
        onSnowflakesEarned: (amount) => {
          setSave((prev) => ({
            ...prev,
            snowflakes: prev.snowflakes + amount,
          }));
        },
        onLevelVictory: (levelId) => {
          const lvlIdx = LEVELS.findIndex((l) => l.id === levelId);
          setSave((prev) => ({
            ...prev,
            unlockedLevel: Math.max(prev.unlockedLevel, Math.min(LEVELS.length - 1, lvlIdx + 1)),
            completedLevels: prev.completedLevels.includes(levelId)
              ? prev.completedLevels
              : [...prev.completedLevels, levelId],
          }));
        },
        onActionHotkey: (action) => {
          if (action === 'toggle_mute') {
            handleToggleMute();
          } else if (action === 'toggle_garage') {
            if (hudPhaseRef.current === 'playing' || hudPhaseRef.current === 'paused') {
              if (garageOpenRef.current) {
                handleCloseGarage();
              } else {
                handleOpenGarage();
              }
            }
          } else if (action === 'toggle_pause') {
            handleTogglePause();
          } else if (action === 'start_or_continue') {
            if (hudPhaseRef.current === 'title') {
              engine.audio.unlock();
              engine.loadLevel(selectedTitleLevelRef.current, 'playing');
            }
          }
        },
        onContextLost: (lost) => setContextLost(lost),
      },
    );

    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [handleCloseGarage, handleOpenGarage, handleToggleMute, handleTogglePause]);

  const canAffordAnyUpgrade = useMemo(() => {
    return UPGRADE_SPECS.some((spec) => {
      const lvl = save.upgrades[spec.key];
      if (lvl >= spec.maxLevel) return false;
      return save.snowflakes >= getUpgradeCost(spec, lvl);
    });
  }, [save.snowflakes, save.upgrades]);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#14192b]">
      {/* Isolated WebGL Viewport Container */}
      <div ref={canvasMountRef} className="absolute inset-0 h-full w-full" />

      {/* Title Screen */}
      {hud.phase === 'title' && (
        <TitleOverlay
          unlockedLevel={save.unlockedLevel}
          selectedLevelIndex={selectedTitleLevel}
          snowflakes={save.snowflakes}
          isMuted={save.isMuted}
          onSelectLevel={handleSelectTitleLevel}
          onStartGame={handleStartLevel}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* Active Gameplay HUD */}
      {hud.phase !== 'title' && (
        <GameHud
          hud={{ ...hud, snowflakes: save.snowflakes }}
          isMuted={save.isMuted}
          canAffordAnyUpgrade={canAffordAnyUpgrade}
          onOpenGarage={handleOpenGarage}
          onTogglePause={handleTogglePause}
          onToggleMute={handleToggleMute}
          onTouchSteer={handleTouchSteer}
        />
      )}

      {/* Garage Upgrade Drawer */}
      {garageOpen && (
        <GarageModal
          snowflakes={save.snowflakes}
          upgrades={save.upgrades}
          steeringMode={save.steeringMode}
          onPurchase={handlePurchaseUpgrade}
          onChangeSteering={handleChangeSteering}
          onClose={handleCloseGarage}
        />
      )}

      {/* Pause or Victory Modal */}
      {!garageOpen && (hud.phase === 'paused' || hud.phase === 'victory') && (
        <PauseVictoryModal
          mode={hud.phase}
          hud={{ ...hud, snowflakes: save.snowflakes }}
          unlockedLevel={save.unlockedLevel}
          onResume={() => engineRef.current?.setPhase('playing')}
          onOpenGarage={handleOpenGarage}
          onRestart={() => handleStartLevel(hud.levelIndex)}
          onSelectLevel={handleStartLevel}
          onReturnTitle={() => {
            setGarageOpen(false);
            engineRef.current?.loadLevel(selectedTitleLevel, 'title');
          }}
        />
      )}

      {/* WebGL Context Lost Fallback */}
      {contextLost && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#14192b]/95 p-6 text-center">
          <div className="max-w-sm rounded-2xl border border-slate-700 bg-[#182038] p-6">
            <h2 className="font-display text-xl font-bold text-slate-100">Graphics Context Paused</h2>
            <p className="mt-2 text-sm text-slate-300">
              Your browser temporarily suspended the 3D viewport. Reload or switch back to restore the village.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
