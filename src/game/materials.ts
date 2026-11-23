import * as THREE from 'three';

export interface MaterialPalette {
  cobbleRoad: THREE.MeshStandardMaterial;
  snowSurface: THREE.MeshStandardMaterial;
  outerSnow: THREE.MeshStandardMaterial;
  blackIce: THREE.MeshPhysicalMaterial;
  plowBody: THREE.MeshPhysicalMaterial;
  plowFrame: THREE.MeshStandardMaterial;
  plowBlade: THREE.MeshStandardMaterial;
  plowWindshield: THREE.MeshPhysicalMaterial;
  tireRubber: THREE.MeshStandardMaterial;
  wheelRim: THREE.MeshStandardMaterial;
  headlightGlow: THREE.MeshStandardMaterial;
  beaconAmber: THREE.MeshStandardMaterial;
  cabinTimber: THREE.MeshStandardMaterial;
  cabinStone: THREE.MeshStandardMaterial;
  cabinRoofSnow: THREE.MeshStandardMaterial;
  lanternMetal: THREE.MeshStandardMaterial;
  lanternGlow: THREE.MeshStandardMaterial;
  pineTrunk: THREE.MeshStandardMaterial;
  pineFoliage: THREE.MeshStandardMaterial;
  rockGranite: THREE.MeshStandardMaterial;
  contactShadowTex: THREE.CanvasTexture;
  snowflakeTex: THREE.CanvasTexture;
  dispose: () => void;
}

function createCobbleTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#2b3242';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle cobblestones / winter asphalt pavers
  const rows = 16;
  const cols = 12;
  const cellH = 512 / rows;
  const cellW = 512 / cols;

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (cellW * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x = c * cellW + offset + 2;
      const y = r * cellH + 2;
      const shade = 44 + Math.floor(Math.random() * 18);
      const blueShift = shade + 10 + Math.floor(Math.random() * 8);
      ctx.fillStyle = `rgb(${shade}, ${shade + 4}, ${blueShift})`;
      ctx.beginPath();
      ctx.roundRect(x, y, cellW - 4, cellH - 4, 5);
      ctx.fill();

      // Slight frost dusting in crevices
      if (Math.random() < 0.25) {
        ctx.fillStyle = 'rgba(205, 222, 245, 0.08)';
        ctx.fillRect(x, y, cellW - 4, 3);
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 14);
  tex.anisotropy = maxAniso;
  return tex;
}

function createTimberTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#7c5338';
  ctx.fillRect(0, 0, 256, 256);

  for (let y = 0; y < 256; y += 24) {
    const tone = 105 + Math.floor(Math.random() * 25);
    ctx.fillStyle = `rgb(${tone}, ${Math.floor(tone * 0.68)}, ${Math.floor(tone * 0.45)})`;
    ctx.fillRect(0, y, 256, 22);
    ctx.fillStyle = 'rgba(35, 20, 12, 0.45)';
    ctx.fillRect(0, y + 22, 256, 2);

    // Wood grain lines
    ctx.strokeStyle = 'rgba(55, 32, 18, 0.2)';
    ctx.lineWidth = 1;
    for (let g = 0; g < 4; g++) {
      const gy = y + 4 + g * 5;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.bezierCurveTo(85, gy + 2, 170, gy - 2, 256, gy);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAniso;
  return tex;
}

function createSnowNoiseTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#eef4fc';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 1800; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const r = 0.7 + Math.random() * 1.4;
    const bright = Math.random() > 0.3;
    ctx.fillStyle = bright ? 'rgba(255,255,255,0.45)' : 'rgba(182,202,232,0.35)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 16);
  tex.anisotropy = maxAniso;
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
  grad.addColorStop(0, 'rgba(12, 16, 30, 0.58)');
  grad.addColorStop(0.55, 'rgba(12, 16, 30, 0.25)');
  grad.addColorStop(1, 'rgba(12, 16, 30, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSnowflakeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.4, 'rgba(232, 242, 255, 0.78)');
  grad.addColorStop(1, 'rgba(220, 234, 255, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createMaterialPalette(renderer: THREE.WebGLRenderer, isSoftwareGl: boolean): MaterialPalette {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const cobbleTex = createCobbleTexture(maxAniso);
  const timberTex = createTimberTexture(maxAniso);
  const snowTex = createSnowNoiseTexture(maxAniso);
  const contactShadowTex = createContactShadowTexture();
  const snowflakeTex = createSnowflakeTexture();

  const cobbleRoad = new THREE.MeshStandardMaterial({
    map: cobbleTex,
    color: 0xd0d8e8,
    roughness: 0.78,
    metalness: 0.08,
  });

  const snowSurface = new THREE.MeshStandardMaterial({
    map: snowTex,
    vertexColors: true,
    roughness: 0.88,
    metalness: 0.02,
  });

  const outerSnow = new THREE.MeshStandardMaterial({
    map: snowTex,
    color: 0xd5e2f5,
    roughness: 0.9,
    metalness: 0.02,
  });

  const blackIce = new THREE.MeshPhysicalMaterial({
    color: 0x72bef2,
    roughness: 0.07,
    metalness: 0.12,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    transparent: true,
    opacity: isSoftwareGl ? 0.72 : 0.85,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const plowBody = new THREE.MeshPhysicalMaterial({
    color: 0xd95a38,
    roughness: 0.34,
    metalness: 0.22,
    clearcoat: 0.75,
    clearcoatRoughness: 0.22,
  });

  const plowFrame = new THREE.MeshStandardMaterial({
    color: 0x262d3d,
    roughness: 0.62,
    metalness: 0.55,
  });

  const plowBlade = new THREE.MeshStandardMaterial({
    color: 0xc8d2df,
    roughness: 0.28,
    metalness: 0.85,
  });

  const plowWindshield = new THREE.MeshPhysicalMaterial({
    color: 0x9bd2f5,
    roughness: 0.08,
    metalness: 0.1,
    clearcoat: 1.0,
    transparent: true,
    opacity: isSoftwareGl ? 0.55 : 0.78,
  });

  const tireRubber = new THREE.MeshStandardMaterial({
    color: 0x1c202a,
    roughness: 0.92,
    metalness: 0.05,
  });

  const wheelRim = new THREE.MeshStandardMaterial({
    color: 0xe6a13c,
    roughness: 0.35,
    metalness: 0.65,
  });

  const headlightGlow = new THREE.MeshStandardMaterial({
    color: 0xfff3c4,
    emissive: 0xffd275,
    emissiveIntensity: 2.0,
    roughness: 0.2,
  });

  const beaconAmber = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.6,
    roughness: 0.25,
  });

  const cabinTimber = new THREE.MeshStandardMaterial({
    map: timberTex,
    roughness: 0.82,
    metalness: 0.04,
  });

  const cabinStone = new THREE.MeshStandardMaterial({
    color: 0x5c6475,
    roughness: 0.92,
    metalness: 0.05,
  });

  const cabinRoofSnow = new THREE.MeshStandardMaterial({
    color: 0xeaf2fc,
    roughness: 0.88,
    metalness: 0.02,
  });

  const lanternMetal = new THREE.MeshStandardMaterial({
    color: 0x242a38,
    roughness: 0.55,
    metalness: 0.7,
  });

  const lanternGlow = new THREE.MeshStandardMaterial({
    color: 0xffe49c,
    emissive: 0xffa726,
    emissiveIntensity: 2.3,
    roughness: 0.25,
  });

  const pineTrunk = new THREE.MeshStandardMaterial({
    color: 0x4c3629,
    roughness: 0.92,
    metalness: 0.02,
  });

  const pineFoliage = new THREE.MeshStandardMaterial({
    color: 0x2b5949,
    roughness: 0.86,
    metalness: 0.02,
  });

  const rockGranite = new THREE.MeshStandardMaterial({
    color: 0x5d677a,
    roughness: 0.9,
    metalness: 0.06,
  });

  const allMaterials: THREE.Material[] = [
    cobbleRoad,
    snowSurface,
    outerSnow,
    blackIce,
    plowBody,
    plowFrame,
    plowBlade,
    plowWindshield,
    tireRubber,
    wheelRim,
    headlightGlow,
    beaconAmber,
    cabinTimber,
    cabinStone,
    cabinRoofSnow,
    lanternMetal,
    lanternGlow,
    pineTrunk,
    pineFoliage,
    rockGranite,
  ];

  const allTextures: THREE.Texture[] = [
    cobbleTex,
    timberTex,
    snowTex,
    contactShadowTex,
    snowflakeTex,
  ];

  return {
    cobbleRoad,
    snowSurface,
    outerSnow,
    blackIce,
    plowBody,
    plowFrame,
    plowBlade,
    plowWindshield,
    tireRubber,
    wheelRim,
    headlightGlow,
    beaconAmber,
    cabinTimber,
    cabinStone,
    cabinRoofSnow,
    lanternMetal,
    lanternGlow,
    pineTrunk,
    pineFoliage,
    rockGranite,
    contactShadowTex,
    snowflakeTex,
    dispose: () => {
      allMaterials.forEach((m) => m.dispose());
      allTextures.forEach((t) => t.dispose());
    },
  };
}
