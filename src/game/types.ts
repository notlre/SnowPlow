export type GamePhase = 'title' | 'playing' | 'paused' | 'victory';

export type SteeringMode = 'screen' | 'vehicle';

export type WeatherType = 'flurries' | 'crosswind' | 'freezing_mist' | 'twilight_squall' | 'endless_calm';

export type UpgradeKey = 'bladeWidth' | 'engineTorque' | 'tireTraction' | 'turboBlower';

export type UpgradesState = Record<UpgradeKey, number>;

export interface UpgradeSpec {
  key: UpgradeKey;
  label: string;
  shortDesc: string;
  maxLevel: number;
  baseCost: number;
  costMultiplier: number;
}

export const UPGRADE_SPECS: UpgradeSpec[] = [
  {
    key: 'bladeWidth',
    label: 'V-Blade Span',
    shortDesc: 'Widens the steel plow blade and side snow wings',
    maxLevel: 5,
    baseCost: 120,
    costMultiplier: 1.75,
  },
  {
    key: 'engineTorque',
    label: 'Diesel Torque',
    shortDesc: 'Powers smoothly through deep snowdrifts without bogging',
    maxLevel: 5,
    baseCost: 140,
    costMultiplier: 1.8,
  },
  {
    key: 'tireTraction',
    label: 'Heated Tire Grip',
    shortDesc: 'Cuts skidding on black ice and sharpens cornering',
    maxLevel: 5,
    baseCost: 130,
    costMultiplier: 1.75,
  },
  {
    key: 'turboBlower',
    label: 'Turbo Blower',
    shortDesc: 'Boosts Shift turbo speed and expands combo sustain window',
    maxLevel: 5,
    baseCost: 150,
    costMultiplier: 1.85,
  },
];

export function getUpgradeCost(spec: UpgradeSpec, currentLevel: number): number {
  if (currentLevel >= spec.maxLevel) return 0;
  return Math.round((spec.baseCost * Math.pow(spec.costMultiplier, currentLevel - 1)) / 10) * 10;
}

export interface RoadSegment {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  halfWidth: number;
}

export interface CabinSpec {
  id: string;
  name: string;
  x: number;
  z: number;
  rotationY: number;
  drivewayX: number;
  drivewayZ: number;
  drivewayRadius: number;
  roofTint: number;
}

export interface DriftZone {
  x: number;
  z: number;
  radius: number;
  depth: number;
}

export interface IceZone {
  x: number;
  z: number;
  radiusX: number;
  radiusZ: number;
  rotationY: number;
}

export interface LanternSpec {
  x: number;
  z: number;
}

export interface LevelConfig {
  id: string;
  index: number;
  name: string;
  subtitle: string;
  isEndless: boolean;
  targetPercent: number;
  weather: WeatherType;
  weatherLabel: string;
  snowfallIntensity: number; // 0..1
  windStrength: number; // 0..1
  windAngle: number;
  reaccumulationRate: number; // snow depth/sec in endless or squall
  spawn: { x: number; z: number; heading: number };
  roads: RoadSegment[];
  cabins: CabinSpec[];
  drifts: DriftZone[];
  icePatches: IceZone[];
  lanterns: LanternSpec[];
}

export interface HudSnapshot {
  phase: GamePhase;
  levelIndex: number;
  levelName: string;
  weatherLabel: string;
  isEndless: boolean;
  clearPercent: number;
  targetPercent: number;
  snowflakes: number;
  shiftEarnings: number;
  comboMultiplier: number;
  comboProgress: number; // 0..1 decay meter
  bestCombo: number;
  cabinsCleared: number;
  totalCabins: number;
  speedKmh: number;
  turboEnergy: number; // 0..1
  onIce: boolean;
  inDeepDrift: boolean;
  bannerText: string | null;
}

export interface SaveData {
  snowflakes: number;
  upgrades: UpgradesState;
  unlockedLevel: number;
  completedLevels: string[];
  steeringMode: SteeringMode;
  isMuted: boolean;
  bestEndlessEarned: number;
}

export const DEFAULT_SAVE: SaveData = {
  snowflakes: 0,
  upgrades: {
    bladeWidth: 1,
    engineTorque: 1,
    tireTraction: 1,
    turboBlower: 1,
  },
  unlockedLevel: 0,
  completedLevels: [],
  steeringMode: 'screen',
  isMuted: false,
  bestEndlessEarned: 0,
};

const SAVE_KEY = 'hearthplow_save_v1';

export function loadSaveData(): SaveData {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return { ...DEFAULT_SAVE, upgrades: { ...DEFAULT_SAVE.upgrades } };
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return {
      snowflakes: typeof parsed.snowflakes === 'number' ? Math.max(0, Math.floor(parsed.snowflakes)) : 0,
      upgrades: {
        bladeWidth: Math.min(5, Math.max(1, parsed.upgrades?.bladeWidth ?? 1)),
        engineTorque: Math.min(5, Math.max(1, parsed.upgrades?.engineTorque ?? 1)),
        tireTraction: Math.min(5, Math.max(1, parsed.upgrades?.tireTraction ?? 1)),
        turboBlower: Math.min(5, Math.max(1, parsed.upgrades?.turboBlower ?? 1)),
      },
      unlockedLevel: typeof parsed.unlockedLevel === 'number' ? Math.max(0, parsed.unlockedLevel) : 0,
      completedLevels: Array.isArray(parsed.completedLevels) ? parsed.completedLevels : [],
      steeringMode: parsed.steeringMode === 'vehicle' ? 'vehicle' : 'screen',
      isMuted: Boolean(parsed.isMuted),
      bestEndlessEarned: typeof parsed.bestEndlessEarned === 'number' ? parsed.bestEndlessEarned : 0,
    };
  } catch {
    return { ...DEFAULT_SAVE, upgrades: { ...DEFAULT_SAVE.upgrades } };
  }
}

export function persistSaveData(data: SaveData): void {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors cleanly
  }
}
