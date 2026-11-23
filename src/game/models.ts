import * as THREE from 'three';
import { CabinSpec, LevelConfig, UpgradesState } from './types';
import { MaterialPalette } from './materials';

export interface SnowplowRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  bladeGroup: THREE.Group;
  leftWing: THREE.Mesh;
  rightWing: THREE.Mesh;
  turboBar: THREE.Group;
  beaconMesh: THREE.Mesh;
  beaconLight: THREE.PointLight;
  headlightSpot: THREE.SpotLight;
  frontWheels: { pivot: THREE.Group; spin: THREE.Group }[];
  rearWheels: THREE.Group[];
  applyUpgrades: (upgrades: UpgradesState) => void;
  dispose: () => void;
}

export interface CabinInstance {
  id: string;
  name: string;
  group: THREE.Group;
  windowMat: THREE.MeshStandardMaterial;
  lanternMat: THREE.MeshStandardMaterial;
  porchLight: THREE.PointLight;
  chimneyWorldPos: THREE.Vector3;
  cleared: boolean;
  setClearedVisual: (cleared: boolean) => void;
  dispose: () => void;
}

function createWheel(palette: MaterialPalette): THREE.Group {
  const wheel = new THREE.Group();
  const tireGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 16);
  tireGeo.rotateZ(Math.PI / 2);
  const tire = new THREE.Mesh(tireGeo, palette.tireRubber);
  tire.castShadow = true;
  tire.receiveShadow = true;
  wheel.add(tire);

  const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.34, 12);
  rimGeo.rotateZ(Math.PI / 2);
  const rim = new THREE.Mesh(rimGeo, palette.wheelRim);
  wheel.add(rim);

  const hubGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.37, 8);
  hubGeo.rotateZ(Math.PI / 2);
  const hub = new THREE.Mesh(hubGeo, palette.plowFrame);
  wheel.add(hub);

  return wheel;
}

export function createSnowplowRig(palette: MaterialPalette): SnowplowRig {
  const root = new THREE.Group();
  const disposables: THREE.BufferGeometry[] = [];

  // Ground contact shadow plane
  const shadowGeo = new THREE.PlaneGeometry(4.4, 5.2);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: palette.contactShadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.55,
  });
  const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
  shadowPlane.position.set(0, 0.02, 0.2);
  root.add(shadowPlane);
  disposables.push(shadowGeo);

  // Suspension body group (tilts on pitch & roll)
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  // 1. Heavy steel chassis frame
  const frameGeo = new THREE.BoxGeometry(1.45, 0.24, 3.2);
  const frame = new THREE.Mesh(frameGeo, palette.plowFrame);
  frame.position.set(0, 0.52, -0.05);
  frame.castShadow = true;
  frame.receiveShadow = true;
  bodyGroup.add(frame);
  disposables.push(frameGeo);

  // 2. Sculpted cab silhouette using ExtrudeGeometry
  const cabShape = new THREE.Shape();
  cabShape.moveTo(-0.7, 0);
  cabShape.lineTo(0.85, 0);
  cabShape.lineTo(0.85, 0.58);
  cabShape.lineTo(0.35, 0.65);
  cabShape.lineTo(0.12, 1.24);
  cabShape.lineTo(-0.68, 1.24);
  cabShape.lineTo(-0.7, 0);

  const cabGeo = new THREE.ExtrudeGeometry(cabShape, {
    depth: 1.46,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.06,
    bevelSegments: 2,
  });
  cabGeo.center();
  // Orient extrude side profile along +Z forward
  cabGeo.rotateY(-Math.PI / 2);
  const cab = new THREE.Mesh(cabGeo, palette.plowBody);
  cab.position.set(0, 1.22, 0.35);
  cab.castShadow = true;
  cab.receiveShadow = true;
  bodyGroup.add(cab);
  disposables.push(cabGeo);

  // 3. Tinted windshield pane
  const glassGeo = new THREE.BoxGeometry(1.32, 0.52, 0.1);
  const windshield = new THREE.Mesh(glassGeo, palette.plowWindshield);
  windshield.position.set(0, 1.5, 0.64);
  windshield.rotation.x = -0.34;
  bodyGroup.add(windshield);
  disposables.push(glassGeo);

  // Side cab windows
  const sideGlassGeo = new THREE.BoxGeometry(1.56, 0.42, 0.66);
  const sideGlass = new THREE.Mesh(sideGlassGeo, palette.plowWindshield);
  sideGlass.position.set(0, 1.5, 0.18);
  bodyGroup.add(sideGlass);
  disposables.push(sideGlassGeo);

  // 4. Rear salt/ballast hopper bed
  const hopperGeo = new THREE.BoxGeometry(1.48, 0.68, 1.32);
  const hopper = new THREE.Mesh(hopperGeo, palette.plowFrame);
  hopper.position.set(0, 0.96, -1.02);
  hopper.castShadow = true;
  hopper.receiveShadow = true;
  bodyGroup.add(hopper);
  disposables.push(hopperGeo);

  const ballastGeo = new THREE.BoxGeometry(1.3, 0.18, 1.14);
  const ballast = new THREE.Mesh(ballastGeo, palette.cabinRoofSnow);
  ballast.position.set(0, 1.28, -1.02);
  bodyGroup.add(ballast);
  disposables.push(ballastGeo);

  // 5. Roof amber beacon + subtle warm glow
  const beaconBaseGeo = new THREE.CylinderGeometry(0.16, 0.2, 0.1, 12);
  const beaconBase = new THREE.Mesh(beaconBaseGeo, palette.plowFrame);
  beaconBase.position.set(0, 1.92, 0.15);
  bodyGroup.add(beaconBase);
  disposables.push(beaconBaseGeo);

  const beaconGeo = new THREE.CylinderGeometry(0.11, 0.13, 0.2, 12);
  const beaconMesh = new THREE.Mesh(beaconGeo, palette.beaconAmber);
  beaconMesh.position.set(0, 2.04, 0.15);
  bodyGroup.add(beaconMesh);
  disposables.push(beaconGeo);

  const beaconLight = new THREE.PointLight(0xf59e0b, 1.4, 9, 2);
  beaconLight.position.set(0, 2.25, 0.15);
  bodyGroup.add(beaconLight);

  // 6. Dual front headlights + subtle forward spotlight
  const lampGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12);
  lampGeo.rotateX(Math.PI / 2);
  disposables.push(lampGeo);

  const leftLamp = new THREE.Mesh(lampGeo, palette.headlightGlow);
  leftLamp.position.set(-0.52, 0.92, 1.24);
  bodyGroup.add(leftLamp);

  const rightLamp = new THREE.Mesh(lampGeo, palette.headlightGlow);
  rightLamp.position.set(0.52, 0.92, 1.24);
  bodyGroup.add(rightLamp);

  const headlightSpot = new THREE.SpotLight(0xffe19c, 6.5, 22, Math.PI / 4.2, 0.55, 1.6);
  headlightSpot.position.set(0, 1.15, 1.25);
  headlightSpot.target.position.set(0, 0, 8.5);
  bodyGroup.add(headlightSpot);
  bodyGroup.add(headlightSpot.target);

  // 7. Upgradeable roof floodlight / turbo blower bar
  const turboBar = new THREE.Group();
  const barGeo = new THREE.BoxGeometry(1.16, 0.1, 0.16);
  const bar = new THREE.Mesh(barGeo, palette.plowFrame);
  bar.position.set(0, 1.93, 0.52);
  turboBar.add(bar);
  disposables.push(barGeo);

  const podGeo = new THREE.BoxGeometry(0.18, 0.14, 0.14);
  disposables.push(podGeo);
  [-0.4, -0.14, 0.14, 0.4].forEach((px) => {
    const pod = new THREE.Mesh(podGeo, palette.headlightGlow);
    pod.position.set(px, 2.02, 0.55);
    turboBar.add(pod);
  });
  turboBar.visible = false;
  bodyGroup.add(turboBar);

  // 8. Articulated V-Blade assembly at front
  const bladeGroup = new THREE.Group();
  bladeGroup.position.set(0, 0.46, 1.78);
  bodyGroup.add(bladeGroup);

  // Hydraulic push arms
  const armGeo = new THREE.BoxGeometry(0.14, 0.14, 0.72);
  disposables.push(armGeo);
  [-0.44, 0.44].forEach((ax) => {
    const arm = new THREE.Mesh(armGeo, palette.plowFrame);
    arm.position.set(ax, 0.02, -0.34);
    bladeGroup.add(arm);
  });

  // Curved steel main V-blade halves
  const halfBladeGeo = new THREE.BoxGeometry(1.32, 0.72, 0.14);
  disposables.push(halfBladeGeo);

  const bladeLeft = new THREE.Mesh(halfBladeGeo, palette.plowBlade);
  bladeLeft.position.set(-0.56, 0.08, 0.08);
  bladeLeft.rotation.y = 0.24;
  bladeLeft.castShadow = true;
  bladeGroup.add(bladeLeft);

  const bladeRight = new THREE.Mesh(halfBladeGeo, palette.plowBlade);
  bladeRight.position.set(0.56, 0.08, 0.08);
  bladeRight.rotation.y = -0.24;
  bladeRight.castShadow = true;
  bladeGroup.add(bladeRight);

  // Bottom orange-gold wear edge
  const edgeGeo = new THREE.BoxGeometry(2.48, 0.12, 0.18);
  const wearEdge = new THREE.Mesh(edgeGeo, palette.wheelRim);
  wearEdge.position.set(0, -0.24, 0.08);
  bladeGroup.add(wearEdge);
  disposables.push(edgeGeo);

  // Upgradeable side snow wings (visible at bladeWidth >= 2)
  const wingGeo = new THREE.BoxGeometry(0.62, 0.64, 0.12);
  disposables.push(wingGeo);

  const leftWing = new THREE.Mesh(wingGeo, palette.plowBody);
  leftWing.position.set(-1.35, 0.08, -0.08);
  leftWing.rotation.y = 0.42;
  leftWing.visible = false;
  bladeGroup.add(leftWing);

  const rightWing = new THREE.Mesh(wingGeo, palette.plowBody);
  rightWing.position.set(1.35, 0.08, -0.08);
  rightWing.rotation.y = -0.42;
  rightWing.visible = false;
  bladeGroup.add(rightWing);

  // 9. Four grounded wheels (front wheels have steering pivot)
  const frontWheels: { pivot: THREE.Group; spin: THREE.Group }[] = [];
  const rearWheels: THREE.Group[] = [];

  const wheelPositions: { x: number; z: number; front: boolean }[] = [
    { x: -0.82, z: 0.88, front: true },
    { x: 0.82, z: 0.88, front: true },
    { x: -0.82, z: -0.96, front: false },
    { x: 0.82, z: -0.96, front: false },
  ];

  wheelPositions.forEach((wp) => {
    const wheelMesh = createWheel(palette);
    if (wp.front) {
      const pivot = new THREE.Group();
      pivot.position.set(wp.x, 0.42, wp.z);
      pivot.add(wheelMesh);
      root.add(pivot);
      frontWheels.push({ pivot, spin: wheelMesh });
    } else {
      wheelMesh.position.set(wp.x, 0.42, wp.z);
      root.add(wheelMesh);
      rearWheels.push(wheelMesh);
    }
  });

  const applyUpgrades = (upgrades: UpgradesState) => {
    const widthScale = 1 + (upgrades.bladeWidth - 1) * 0.16;
    bladeGroup.scale.set(widthScale, 1, 1);
    const showWings = upgrades.bladeWidth >= 2;
    leftWing.visible = showWings;
    rightWing.visible = showWings;
    turboBar.visible = upgrades.turboBlower >= 2;
    headlightSpot.intensity = 6.5 + (upgrades.turboBlower - 1) * 1.1;
  };

  return {
    root,
    bodyGroup,
    bladeGroup,
    leftWing,
    rightWing,
    turboBar,
    beaconMesh,
    beaconLight,
    headlightSpot,
    frontWheels,
    rearWheels,
    applyUpgrades,
    dispose: () => {
      disposables.forEach((g) => g.dispose());
      shadowMat.dispose();
    },
  };
}

export function createCabinModel(spec: CabinSpec, palette: MaterialPalette): CabinInstance {
  const group = new THREE.Group();
  group.position.set(spec.x, 0, spec.z);
  group.rotation.y = spec.rotationY;

  const disposables: THREE.BufferGeometry[] = [];

  // Stone foundation plinth (grounded at y = 0)
  const plinthGeo = new THREE.BoxGeometry(5.6, 0.5, 4.8);
  const plinth = new THREE.Mesh(plinthGeo, palette.cabinStone);
  plinth.position.set(0, 0.25, 0);
  plinth.receiveShadow = true;
  plinth.castShadow = true;
  group.add(plinth);
  disposables.push(plinthGeo);

  // Timber cabin walls
  const bodyGeo = new THREE.BoxGeometry(5.1, 2.5, 4.3);
  const body = new THREE.Mesh(bodyGeo, palette.cabinTimber);
  body.position.set(0, 1.75, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  disposables.push(bodyGeo);

  // Pitched roof frame (dark shingle/wood underside)
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-3.1, 0);
  roofShape.lineTo(0, 2.15);
  roofShape.lineTo(3.1, 0);
  roofShape.lineTo(2.7, -0.2);
  roofShape.lineTo(0, 1.75);
  roofShape.lineTo(-2.7, -0.2);
  roofShape.closePath();

  const roofBaseGeo = new THREE.ExtrudeGeometry(roofShape, {
    depth: 5.1,
    bevelEnabled: false,
  });
  roofBaseGeo.center();
  const roofBaseMat = new THREE.MeshStandardMaterial({
    color: spec.roofTint,
    roughness: 0.78,
    metalness: 0.08,
  });
  const roofBase = new THREE.Mesh(roofBaseGeo, roofBaseMat);
  roofBase.position.set(0, 3.85, 0);
  roofBase.castShadow = true;
  group.add(roofBase);
  disposables.push(roofBaseGeo);

  // Thick snow cap on roof
  const snowRoofShape = new THREE.Shape();
  snowRoofShape.moveTo(-3.2, 0.06);
  snowRoofShape.lineTo(0, 2.38);
  snowRoofShape.lineTo(3.2, 0.06);
  snowRoofShape.lineTo(3.02, -0.05);
  snowRoofShape.lineTo(0, 2.08);
  snowRoofShape.lineTo(-3.02, -0.05);
  snowRoofShape.closePath();

  const snowRoofGeo = new THREE.ExtrudeGeometry(snowRoofShape, {
    depth: 5.25,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.08,
    bevelSegments: 2,
  });
  snowRoofGeo.center();
  const snowRoof = new THREE.Mesh(snowRoofGeo, palette.cabinRoofSnow);
  snowRoof.position.set(0, 4.02, 0);
  snowRoof.castShadow = true;
  snowRoof.receiveShadow = true;
  group.add(snowRoof);
  disposables.push(snowRoofGeo);

  // Stone chimney
  const chimneyGeo = new THREE.BoxGeometry(0.85, 2.6, 0.85);
  const chimney = new THREE.Mesh(chimneyGeo, palette.cabinStone);
  chimney.position.set(1.5, 4.3, -1.1);
  chimney.castShadow = true;
  group.add(chimney);
  disposables.push(chimneyGeo);

  // Chimney snow rim
  const chimneyCapGeo = new THREE.BoxGeometry(1.02, 0.18, 1.02);
  const chimneyCap = new THREE.Mesh(chimneyCapGeo, palette.cabinRoofSnow);
  chimneyCap.position.set(1.5, 5.6, -1.1);
  group.add(chimneyCap);
  disposables.push(chimneyCapGeo);

  // Warm glowing window material (unique per cabin so cleared driveways brighten its hearth!)
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0xffd584,
    emissive: 0xff9f2e,
    emissiveIntensity: 1.05,
    roughness: 0.2,
  });

  const lanternMat = new THREE.MeshStandardMaterial({
    color: 0xffe49c,
    emissive: 0xffa726,
    emissiveIntensity: 1.15,
    roughness: 0.25,
  });

  // Front & side glowing windows
  const winGeo = new THREE.BoxGeometry(0.95, 0.95, 0.14);
  disposables.push(winGeo);
  [-1.35, 1.35].forEach((wx) => {
    const win = new THREE.Mesh(winGeo, windowMat);
    win.position.set(wx, 1.85, 2.15);
    group.add(win);
  });

  const sideWinGeo = new THREE.BoxGeometry(0.14, 0.95, 1.1);
  disposables.push(sideWinGeo);
  [-2.56, 2.56].forEach((sx) => {
    const sw = new THREE.Mesh(sideWinGeo, windowMat);
    sw.position.set(sx, 1.85, 0.1);
    group.add(sw);
  });

  // Front door + porch awning
  const doorGeo = new THREE.BoxGeometry(0.95, 1.75, 0.16);
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x452a1e, roughness: 0.8 });
  const door = new THREE.Mesh(doorGeo, doorMat);
  door.position.set(0, 1.38, 2.15);
  group.add(door);
  disposables.push(doorGeo);

  const porchLampGeo = new THREE.BoxGeometry(0.28, 0.36, 0.28);
  const porchLamp = new THREE.Mesh(porchLampGeo, lanternMat);
  porchLamp.position.set(0.75, 2.25, 2.38);
  group.add(porchLamp);
  disposables.push(porchLampGeo);

  // Subtle warm point light illuminating the snow around the porch
  const porchLight = new THREE.PointLight(0xffaa44, 1.8, 12, 2);
  porchLight.position.set(0, 2.6, 3.1);
  group.add(porchLight);

  group.updateMatrixWorld(true);
  const chimneyWorldPos = new THREE.Vector3(1.5, 5.75, -1.1).applyMatrix4(group.matrixWorld);

  const setClearedVisual = (cleared: boolean) => {
    windowMat.emissiveIntensity = cleared ? 2.4 : 1.05;
    lanternMat.emissiveIntensity = cleared ? 2.8 : 1.15;
    porchLight.intensity = cleared ? 4.2 : 1.8;
  };

  return {
    id: spec.id,
    name: spec.name,
    group,
    windowMat,
    lanternMat,
    porchLight,
    chimneyWorldPos,
    cleared: false,
    setClearedVisual,
    dispose: () => {
      disposables.forEach((g) => g.dispose());
      roofBaseMat.dispose();
      windowMat.dispose();
      lanternMat.dispose();
      doorMat.dispose();
    },
  };
}

export function createLanternPostModel(palette: MaterialPalette): { group: THREE.Group; dispose: () => void } {
  const group = new THREE.Group();
  const disposables: THREE.BufferGeometry[] = [];

  const baseGeo = new THREE.CylinderGeometry(0.18, 0.24, 0.45, 8);
  const base = new THREE.Mesh(baseGeo, palette.lanternMetal);
  base.position.y = 0.225;
  group.add(base);
  disposables.push(baseGeo);

  const postGeo = new THREE.CylinderGeometry(0.07, 0.09, 2.75, 8);
  const post = new THREE.Mesh(postGeo, palette.lanternMetal);
  post.position.y = 1.65;
  post.castShadow = true;
  group.add(post);
  disposables.push(postGeo);

  const glassGeo = new THREE.CylinderGeometry(0.22, 0.16, 0.42, 6);
  const glass = new THREE.Mesh(glassGeo, palette.lanternGlow);
  glass.position.y = 3.18;
  group.add(glass);
  disposables.push(glassGeo);

  const capGeo = new THREE.ConeGeometry(0.32, 0.26, 6);
  const cap = new THREE.Mesh(capGeo, palette.lanternMetal);
  cap.position.y = 3.5;
  group.add(cap);
  disposables.push(capGeo);

  const snowCapGeo = new THREE.ConeGeometry(0.28, 0.14, 6);
  const snowCap = new THREE.Mesh(snowCapGeo, palette.cabinRoofSnow);
  snowCap.position.y = 3.58;
  group.add(snowCap);
  disposables.push(snowCapGeo);

  return {
    group,
    dispose: () => disposables.forEach((g) => g.dispose()),
  };
}

export function createVillageForestAndRocks(
  level: LevelConfig,
  palette: MaterialPalette,
  isNearClearable: (x: number, z: number, pad: number) => boolean,
): { group: THREE.Group; dispose: () => void } {
  const group = new THREE.Group();

  // Collect valid tree coordinates around village perimeter & scenic pockets
  const treeCoords: { x: number; z: number; scale: number; rot: number }[] = [];
  let seed = (level.index + 1) * 9173;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let i = 0; i < 240; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = 24 + rand() * 34;
    const x = Math.cos(angle) * dist + (rand() - 0.5) * 8;
    const z = Math.sin(angle) * dist + (rand() - 0.5) * 8;
    if (Math.abs(x) > 56 || Math.abs(z) > 56) continue;
    if (isNearClearable(x, z, 4.8)) continue;

    // Avoid overlapping cabins
    const nearCabin = level.cabins.some((c) => Math.hypot(x - c.x, z - c.z) < 6.2);
    if (nearCabin) continue;

    // Avoid clustering directly on top of another tree
    const nearTree = treeCoords.some((t) => Math.hypot(x - t.x, z - t.z) < 3.2);
    if (nearTree) continue;

    treeCoords.push({
      x,
      z,
      scale: 0.85 + rand() * 0.34,
      rot: rand() * Math.PI * 2,
    });
  }

  const count = Math.max(1, treeCoords.length);
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 1.35, 7);
  trunkGeo.translate(0, 0.675, 0);

  const lowerConeGeo = new THREE.ConeGeometry(1.55, 2.5, 7);
  lowerConeGeo.translate(0, 2.1, 0);

  const upperConeGeo = new THREE.ConeGeometry(1.15, 2.2, 7);
  upperConeGeo.translate(0, 3.45, 0);

  const snowCapGeo = new THREE.ConeGeometry(0.95, 1.35, 7);
  snowCapGeo.translate(0, 4.0, 0);

  const trunkInst = new THREE.InstancedMesh(trunkGeo, palette.pineTrunk, count);
  const lowerInst = new THREE.InstancedMesh(lowerConeGeo, palette.pineFoliage, count);
  const upperInst = new THREE.InstancedMesh(upperConeGeo, palette.pineFoliage, count);
  const snowInst = new THREE.InstancedMesh(snowCapGeo, palette.cabinRoofSnow, count);

  lowerInst.castShadow = true;
  upperInst.castShadow = true;
  snowInst.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const tintColor = new THREE.Color();

  treeCoords.forEach((tc, i) => {
    dummy.position.set(tc.x, 0, tc.z);
    dummy.rotation.set(0, tc.rot, 0);
    dummy.scale.setScalar(tc.scale);
    dummy.updateMatrix();

    trunkInst.setMatrixAt(i, dummy.matrix);
    lowerInst.setMatrixAt(i, dummy.matrix);
    upperInst.setMatrixAt(i, dummy.matrix);
    snowInst.setMatrixAt(i, dummy.matrix);

    const shade = 0.88 + (i % 5) * 0.06;
    tintColor.setRGB(shade * 0.92, shade * 1.04, shade);
    lowerInst.setColorAt(i, tintColor);
    upperInst.setColorAt(i, tintColor);
  });

  trunkInst.instanceMatrix.needsUpdate = true;
  lowerInst.instanceMatrix.needsUpdate = true;
  upperInst.instanceMatrix.needsUpdate = true;
  snowInst.instanceMatrix.needsUpdate = true;
  if (lowerInst.instanceColor) lowerInst.instanceColor.needsUpdate = true;
  if (upperInst.instanceColor) upperInst.instanceColor.needsUpdate = true;

  trunkInst.computeBoundingSphere();
  lowerInst.computeBoundingSphere();
  upperInst.computeBoundingSphere();
  snowInst.computeBoundingSphere();

  group.add(trunkInst, lowerInst, upperInst, snowInst);

  // Perimeter snow-capped granite rocks
  const rockCoords: { x: number; z: number; sx: number; sy: number; sz: number; rot: number }[] = [];
  for (let i = 0; i < 45; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = 25 + rand() * 28;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    if (isNearClearable(x, z, 4.2)) continue;
    const nearCabin = level.cabins.some((c) => Math.hypot(x - c.x, z - c.z) < 5.5);
    if (nearCabin) continue;
    rockCoords.push({
      x,
      z,
      sx: 0.8 + rand() * 0.9,
      sy: 0.5 + rand() * 0.65,
      sz: 0.8 + rand() * 0.9,
      rot: rand() * Math.PI * 2,
    });
  }

  const rockCount = Math.max(1, rockCoords.length);
  const rockGeo = new THREE.DodecahedronGeometry(0.95, 0);
  rockGeo.translate(0, 0.35, 0);
  const rockInst = new THREE.InstancedMesh(rockGeo, palette.rockGranite, rockCount);
  rockInst.castShadow = true;
  rockInst.receiveShadow = true;

  rockCoords.forEach((rc, i) => {
    dummy.position.set(rc.x, 0, rc.z);
    dummy.rotation.set(0, rc.rot, 0);
    dummy.scale.set(rc.sx, rc.sy, rc.sz);
    dummy.updateMatrix();
    rockInst.setMatrixAt(i, dummy.matrix);
  });
  rockInst.instanceMatrix.needsUpdate = true;
  rockInst.computeBoundingSphere();
  group.add(rockInst);

  return {
    group,
    dispose: () => {
      trunkGeo.dispose();
      lowerConeGeo.dispose();
      upperConeGeo.dispose();
      snowCapGeo.dispose();
      rockGeo.dispose();
    },
  };
}
