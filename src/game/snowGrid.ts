import * as THREE from 'three';
import { LevelConfig } from './types';

export const GRID_RES = 128;
export const ARENA_SIZE = 74;
export const HALF_ARENA = ARENA_SIZE / 2;
export const CELL_STEP = ARENA_SIZE / (GRID_RES - 1);

function distToSegment(px: number, pz: number, x1: number, z1: number, x2: number, z2: number): number {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const lenSq = dx * dx + dz * dz;
  if (lenSq < 1e-6) return Math.hypot(px - x1, pz - z1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (pz - z1) * dz) / lenSq));
  return Math.hypot(px - (x1 + t * dx), pz - (z1 + t * dz));
}

export interface CarveResult {
  clearedAmount: number;
  clearedCells: number;
  hitDrift: boolean;
  onIce: boolean;
  newlyClearedCabins: number[];
}

export class SnowGridWorld {
  public readonly geometry: THREE.PlaneGeometry;
  public readonly snowDepth = new Float32Array(GRID_RES * GRID_RES);
  public readonly initialDepth = new Float32Array(GRID_RES * GRID_RES);
  public readonly isRoadCell = new Uint8Array(GRID_RES * GRID_RES);
  public readonly isIceCell = new Uint8Array(GRID_RES * GRID_RES);
  public readonly cabinCellMap = new Int8Array(GRID_RES * GRID_RES);

  private cabinTotalCells: number[] = [];
  private cabinClearedCells: number[] = [];
  private cabinCompleted: boolean[] = [];

  public totalRoadCells = 1;
  public clearedRoadCells = 0;

  private level!: LevelConfig;

  constructor() {
    this.geometry = new THREE.PlaneGeometry(ARENA_SIZE, ARENA_SIZE, GRID_RES - 1, GRID_RES - 1);
    this.geometry.rotateX(-Math.PI / 2);

    const count = GRID_RES * GRID_RES;
    const colors = new Float32Array(count * 3);
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }

  public isPointNearRoad(x: number, z: number, pad = 0): boolean {
    if (!this.level) return false;
    for (const seg of this.level.roads) {
      if (distToSegment(x, z, seg.x1, seg.z1, seg.x2, seg.z2) <= seg.halfWidth + pad) {
        return true;
      }
    }
    for (const cab of this.level.cabins) {
      if (Math.hypot(x - cab.drivewayX, z - cab.drivewayZ) <= cab.drivewayRadius + pad) {
        return true;
      }
    }
    return false;
  }

  public loadLevel(level: LevelConfig): void {
    this.level = level;
    this.cabinTotalCells = new Array(level.cabins.length).fill(0);
    this.cabinClearedCells = new Array(level.cabins.length).fill(0);
    this.cabinCompleted = new Array(level.cabins.length).fill(false);

    this.totalRoadCells = 0;
    this.clearedRoadCells = 0;

    const posAttr = this.geometry.attributes.position as THREE.BufferAttribute;
    const colorAttr = this.geometry.attributes.color as THREE.BufferAttribute;

    for (let gz = 0; gz < GRID_RES; gz++) {
      const wz = -HALF_ARENA + gz * CELL_STEP;
      for (let gx = 0; gx < GRID_RES; gx++) {
        const wx = -HALF_ARENA + gx * CELL_STEP;
        const idx = gz * GRID_RES + gx;

        let road = false;
        for (const seg of level.roads) {
          if (distToSegment(wx, wz, seg.x1, seg.z1, seg.x2, seg.z2) <= seg.halfWidth) {
            road = true;
            break;
          }
        }

        let cabinIdx = -1;
        for (let ci = 0; ci < level.cabins.length; ci++) {
          const c = level.cabins[ci];
          if (Math.hypot(wx - c.drivewayX, wz - c.drivewayZ) <= c.drivewayRadius) {
            road = true;
            cabinIdx = ci;
            break;
          }
        }

        // Check black ice patches (rotated ellipse)
        let onIce = false;
        for (const ice of level.icePatches) {
          const dx = wx - ice.x;
          const dz = wz - ice.z;
          const cosR = Math.cos(-ice.rotationY);
          const sinR = Math.sin(-ice.rotationY);
          const lx = dx * cosR - dz * sinR;
          const lz = dx * sinR + dz * cosR;
          const norm = (lx * lx) / (ice.radiusX * ice.radiusX) + (lz * lz) / (ice.radiusZ * ice.radiusZ);
          if (norm <= 1.0) {
            onIce = true;
            break;
          }
        }

        // Base snow depth + drifts
        let depth = road ? 0.56 + Math.sin(wx * 0.25) * Math.cos(wz * 0.25) * 0.08 : 0.65 + Math.sin(wx * 0.18 + wz * 0.14) * 0.12;
        for (const drift of level.drifts) {
          const d = Math.hypot(wx - drift.x, wz - drift.z);
          if (d < drift.radius) {
            const t = 1 - d / drift.radius;
            const smooth = t * t * (3 - 2 * t);
            depth += drift.depth * smooth;
          }
        }

        // Clear a small cozy pad directly around the plow spawn
        if (Math.hypot(wx - level.spawn.x, wz - level.spawn.z) < 2.2) {
          depth = 0;
        }

        this.isRoadCell[idx] = road ? 1 : 0;
        this.isIceCell[idx] = road && onIce ? 1 : 0;
        this.cabinCellMap[idx] = cabinIdx;
        this.snowDepth[idx] = depth;
        this.initialDepth[idx] = Math.max(0.55, depth);

        if (road) {
          this.totalRoadCells++;
          if (depth <= 0.05) this.clearedRoadCells++;
          if (cabinIdx >= 0) {
            this.cabinTotalCells[cabinIdx]++;
            if (depth <= 0.05) this.cabinClearedCells[cabinIdx]++;
          }
        }

        this.syncVertex(idx, posAttr, colorAttr);
      }
    }

    this.totalRoadCells = Math.max(1, this.totalRoadCells);
    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }

  private syncVertex(
    idx: number,
    posAttr: THREE.BufferAttribute,
    colorAttr: THREE.BufferAttribute,
  ): void {
    const d = this.snowDepth[idx];
    const y = d <= 0.04 ? -0.1 : 0.045 + d * 0.44;
    posAttr.setY(idx, y);

    if (d <= 0.04) {
      colorAttr.setXYZ(idx, 0.72, 0.8, 0.92);
    } else if (d > 1.05) {
      // Deep drift highlight: cool shadowed base blending into crisp cream-blue peak
      const t = Math.min(1, (d - 1.05) / 1.0);
      colorAttr.setXYZ(idx, 0.8 + t * 0.16, 0.87 + t * 0.11, 0.98);
    } else {
      const roadShade = this.isRoadCell[idx] ? 0.94 : 0.89;
      colorAttr.setXYZ(idx, roadShade * 0.94, roadShade * 0.97, 1.0);
    }
  }

  public sampleAt(wx: number, wz: number): { depth: number; onIce: boolean; onRoad: boolean } {
    const gx = Math.round((wx + HALF_ARENA) / CELL_STEP);
    const gz = Math.round((wz + HALF_ARENA) / CELL_STEP);
    if (gx < 0 || gx >= GRID_RES || gz < 0 || gz >= GRID_RES) {
      return { depth: 0.7, onIce: false, onRoad: false };
    }
    const idx = gz * GRID_RES + gx;
    return {
      depth: this.snowDepth[idx],
      onIce: this.isIceCell[idx] === 1 && this.snowDepth[idx] <= 0.18,
      onRoad: this.isRoadCell[idx] === 1,
    };
  }

  public carveBladeFootprint(
    bladeX: number,
    bladeZ: number,
    heading: number,
    halfWidth: number,
  ): CarveResult {
    const posAttr = this.geometry.attributes.position as THREE.BufferAttribute;
    const colorAttr = this.geometry.attributes.color as THREE.BufferAttribute;

    const rightX = Math.cos(heading);
    const rightZ = -Math.sin(heading);
    const fwdX = Math.sin(heading);
    const fwdZ = Math.cos(heading);

    const searchRadius = halfWidth + 1.4;
    const minGx = Math.max(1, Math.floor((bladeX - searchRadius + HALF_ARENA) / CELL_STEP));
    const maxGx = Math.min(GRID_RES - 2, Math.ceil((bladeX + searchRadius + HALF_ARENA) / CELL_STEP));
    const minGz = Math.max(1, Math.floor((bladeZ - searchRadius + HALF_ARENA) / CELL_STEP));
    const maxGz = Math.min(GRID_RES - 2, Math.ceil((bladeZ + searchRadius + HALF_ARENA) / CELL_STEP));

    let clearedAmount = 0;
    let clearedCells = 0;
    let hitDrift = false;
    let onIce = false;
    const newlyClearedCabins: number[] = [];

    for (let gz = minGz; gz <= maxGz; gz++) {
      const wz = -HALF_ARENA + gz * CELL_STEP;
      for (let gx = minGx; gx <= maxGx; gx++) {
        const wx = -HALF_ARENA + gx * CELL_STEP;
        const dx = wx - bladeX;
        const dz = wz - bladeZ;

        // Local coordinates relative to blade center & heading
        const localSide = dx * rightX + dz * rightZ;
        const localFwd = dx * fwdX + dz * fwdZ;

        const idx = gz * GRID_RES + gx;
        const prevDepth = this.snowDepth[idx];

        if (Math.abs(localSide) <= halfWidth && Math.abs(localFwd) <= 0.95) {
          if (this.isIceCell[idx] === 1) onIce = true;

          if (prevDepth > 0.03) {
            if (prevDepth > 1.05) hitDrift = true;
            this.snowDepth[idx] = 0;
            clearedAmount += prevDepth;

            if (this.isRoadCell[idx] === 1) {
              this.clearedRoadCells++;
              clearedCells++;
              const cabId = this.cabinCellMap[idx];
              if (cabId >= 0) {
                this.cabinClearedCells[cabId]++;
                if (
                  !this.cabinCompleted[cabId] &&
                  this.cabinTotalCells[cabId] > 0 &&
                  this.cabinClearedCells[cabId] / this.cabinTotalCells[cabId] >= 0.88
                ) {
                  this.cabinCompleted[cabId] = true;
                  newlyClearedCabins.push(cabId);
                }
              }
            }
            this.syncVertex(idx, posAttr, colorAttr);
          }
        } else if (
          Math.abs(localSide) > halfWidth &&
          Math.abs(localSide) <= halfWidth + 0.72 &&
          localFwd > -1.0 &&
          localFwd < 0.7 &&
          prevDepth > 0.05 &&
          prevDepth < 1.5
        ) {
          // Subtle pushed snow berm outside blade edges
          this.snowDepth[idx] = Math.min(1.6, prevDepth + 0.015);
          this.syncVertex(idx, posAttr, colorAttr);
        }
      }
    }

    if (clearedAmount > 0) {
      posAttr.needsUpdate = true;
      colorAttr.needsUpdate = true;
      this.recomputeNormalsRegion(minGx - 1, maxGx + 1, minGz - 1, maxGz + 1);
    }

    return { clearedAmount, clearedCells, hitDrift, onIce, newlyClearedCabins };
  }

  public applyWeatherReaccumulation(ratePerSec: number, dt: number, plowX: number, plowZ: number): void {
    if (ratePerSec <= 0) return;
    const posAttr = this.geometry.attributes.position as THREE.BufferAttribute;
    const colorAttr = this.geometry.attributes.color as THREE.BufferAttribute;

    // Gentle stochastic dusting across cleared road cells far from the plow
    let changed = false;
    const stepSamples = 90;
    for (let s = 0; s < stepSamples; s++) {
      const gx = 1 + Math.floor(Math.random() * (GRID_RES - 2));
      const gz = 1 + Math.floor(Math.random() * (GRID_RES - 2));
      const idx = gz * GRID_RES + gx;
      if (this.isRoadCell[idx] === 0) continue;

      const wx = -HALF_ARENA + gx * CELL_STEP;
      const wz = -HALF_ARENA + gz * CELL_STEP;
      if (Math.hypot(wx - plowX, wz - plowZ) < 6.5) continue;

      const prev = this.snowDepth[idx];
      const target = Math.min(1.1, this.initialDepth[idx]);
      if (prev < target) {
        const next = Math.min(target, prev + ratePerSec * dt * 16);
        this.snowDepth[idx] = next;
        if (prev <= 0.04 && next > 0.04) {
          this.clearedRoadCells = Math.max(0, this.clearedRoadCells - 1);
        }
        this.syncVertex(idx, posAttr, colorAttr);
        changed = true;
      }
    }

    if (changed) {
      posAttr.needsUpdate = true;
      colorAttr.needsUpdate = true;
    }
  }

  private recomputeNormalsRegion(minGx: number, maxGx: number, minGz: number, maxGz: number): void {
    const posAttr = this.geometry.attributes.position as THREE.BufferAttribute;
    const normAttr = this.geometry.attributes.normal as THREE.BufferAttribute;

    const x0 = Math.max(1, minGx);
    const x1 = Math.min(GRID_RES - 2, maxGx);
    const z0 = Math.max(1, minGz);
    const z1 = Math.min(GRID_RES - 2, maxGz);

    for (let gz = z0; gz <= z1; gz++) {
      for (let gx = x0; gx <= x1; gx++) {
        const idx = gz * GRID_RES + gx;
        const hL = posAttr.getY(idx - 1);
        const hR = posAttr.getY(idx + 1);
        const hD = posAttr.getY(idx - GRID_RES);
        const hU = posAttr.getY(idx + GRID_RES);

        const nx = hL - hR;
        const ny = 2 * CELL_STEP;
        const nz = hD - hU;
        const len = Math.hypot(nx, ny, nz) || 1;
        normAttr.setXYZ(idx, nx / len, ny / len, nz / len);
      }
    }
    normAttr.needsUpdate = true;
  }

  public getClearPercent(): number {
    return Math.min(100, (this.clearedRoadCells / this.totalRoadCells) * 100);
  }

  public getCabinsClearedCount(): number {
    return this.cabinCompleted.filter(Boolean).length;
  }

  public dispose(): void {
    this.geometry.dispose();
  }
}
