import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { LEVELS } from './levels';
import { createMaterialPalette, MaterialPalette } from './materials';
import {
  CabinInstance,
  createCabinModel,
  createLanternPostModel,
  createSnowplowRig,
  createVillageForestAndRocks,
  SnowplowRig,
} from './models';
import { ARENA_SIZE, SnowGridWorld } from './snowGrid';
import { SynthAudioEngine } from './audio';
import {
  GamePhase,
  HudSnapshot,
  LevelConfig,
  SteeringMode,
  UpgradesState,
} from './types';

// Module-scope reusable scratch objects (zero per-frame allocations)
const _dummy = new THREE.Object3D();

interface SprayParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  scale: number;
  rotX: number;
  rotZ: number;
}

interface SmokeParticle {
  x: number;
  y: number;
  z: number;
  vy: number;
  life: number;
  maxLife: number;
  cabinIdx: number;
}

export interface EngineCallbacks {
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onSnowflakesEarned: (amount: number, isEndless: boolean) => void;
  onLevelVictory: (levelId: string, shiftEarnings: number, bestCombo: number) => void;
  onActionHotkey: (action: 'toggle_garage' | 'toggle_pause' | 'toggle_mute' | 'start_or_continue') => void;
  onContextLost: (lost: boolean) => void;
}

export class HearthplowEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  public readonly audio: SynthAudioEngine;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private palette!: MaterialPalette;
  private snowGrid!: SnowGridWorld;
  private plowRig!: SnowplowRig;

  private levelPropsGroup = new THREE.Group();
  private cabins: CabinInstance[] = [];
  private cabinDisposables: (() => void)[] = [];

  // Particle pools
  private sprayMesh!: THREE.InstancedMesh;
  private sprayPool: SprayParticle[] = [];
  private sprayCursor = 0;

  private sparkMesh!: THREE.InstancedMesh;
  private sparkPool: SprayParticle[] = [];
  private sparkCursor = 0;

  private smokeMesh!: THREE.InstancedMesh;
  private smokePool: SmokeParticle[] = [];

  private weatherPoints!: THREE.Points;
  private weatherPositions!: Float32Array;
  private weatherGeo!: THREE.BufferGeometry;
  private weatherMat!: THREE.PointsMaterial;

  // Rendering loop state
  private isSoftwareGl = false;
  private frameId = 0;
  private lastTime = 0;
  private elapsed = 0;
  private disposed = false;

  // Game & Physics State
  private phase: GamePhase = 'title';
  private currentLevel: LevelConfig = LEVELS[0];
  private upgrades: UpgradesState = {
    bladeWidth: 1,
    engineTorque: 1,
    tireTraction: 1,
    turboBlower: 1,
  };
  private steeringMode: SteeringMode = 'screen';
  private totalBankedSnowflakes = 0;

  private plowX = 0;
  private plowZ = 0;
  private plowVx = 0;
  private plowVz = 0;
  private plowHeading = 0;
  private wheelSpinAngle = 0;
  private steerVisualAngle = 0;
  private pitchSpring = 0;
  private rollSpring = 0;

  private turboEnergy = 1.0;
  private comboPoints = 0;
  private comboMultiplier = 1.0;
  private comboTimer = 0;
  private bestCombo = 1.0;
  private shiftEarnings = 0;
  private fractionalEarn = 0;
  private victoryTriggered = false;

  private cameraTarget = new THREE.Vector3();
  private cameraPos = new THREE.Vector3(30, 32, 30);
  private cameraShake = 0;
  private titleOrbitAngle = 0.72;

  private bannerText: string | null = null;
  private bannerTimer = 0;
  private lastHudPush = 0;

  // Input state (strictly separated held vs edge-triggered)
  private heldKeys = new Set<string>();
  private touchSteer = { x: 0, z: 0, turbo: false };

  private resizeObserver: ResizeObserver | null = null;

  constructor(
    container: HTMLElement,
    initialUpgrades: UpgradesState,
    initialSnowflakes: number,
    initialSteeringMode: SteeringMode,
    initialMuted: boolean,
    callbacks: EngineCallbacks,
  ) {
    this.container = container;
    this.upgrades = { ...initialUpgrades };
    this.totalBankedSnowflakes = initialSnowflakes;
    this.steeringMode = initialSteeringMode;
    this.callbacks = callbacks;
    this.audio = new SynthAudioEngine(initialMuted);

    this.initRendererAndScene();
    this.initPools();
    this.loadLevel(0, 'title');
    this.bindEvents();
    this.startLoop();
  }

  private detectSoftwareWebGL(): boolean {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  }

  private initRendererAndScene(): void {
    this.isSoftwareGl = this.detectSoftwareWebGL();

    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);

    const renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !this.isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    this.container.appendChild(renderer.domElement);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    const skyColor = new THREE.Color(0x161c30);
    scene.background = skyColor;
    scene.fog = new THREE.FogExp2(0x161c30, 0.0115);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.scene = scene;
    this.palette = createMaterialPalette(renderer, this.isSoftwareGl);

    // Isometric narrow-FOV perspective camera
    const camera = new THREE.PerspectiveCamera(28, width / height, 0.5, 240);
    camera.position.copy(this.cameraPos);
    camera.lookAt(0, 0, 0);
    this.camera = camera;

    // 3-point warm/cool twilight lighting rig (same intensities across GPU/software)
    const hemi = new THREE.HemisphereLight(0x7393d4, 0x1c2338, 0.9);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xffd7a8, 1.45);
    keyLight.position.set(28, 42, 22);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 4;
    keyLight.shadow.camera.far = 115;
    const d = 40;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x7ba4f2, 0.55);
    rimLight.position.set(-30, 22, -28);
    scene.add(rimLight);

    // Outer snowfield ground skirt (4 seamless bands around the 74x74 arena blending into horizon fog)
    const halfA = ARENA_SIZE / 2;
    const outerSpan = 100;
    const bandLongGeo = new THREE.PlaneGeometry(ARENA_SIZE + outerSpan * 2, outerSpan);
    bandLongGeo.rotateX(-Math.PI / 2);
    const bandSideGeo = new THREE.PlaneGeometry(outerSpan, ARENA_SIZE);
    bandSideGeo.rotateX(-Math.PI / 2);

    const northBand = new THREE.Mesh(bandLongGeo, this.palette.outerSnow);
    northBand.position.set(0, 0.33, -(halfA + outerSpan / 2));
    northBand.receiveShadow = true;

    const southBand = new THREE.Mesh(bandLongGeo, this.palette.outerSnow);
    southBand.position.set(0, 0.33, halfA + outerSpan / 2);
    southBand.receiveShadow = true;

    const westBand = new THREE.Mesh(bandSideGeo, this.palette.outerSnow);
    westBand.position.set(-(halfA + outerSpan / 2), 0.33, 0);
    westBand.receiveShadow = true;

    const eastBand = new THREE.Mesh(bandSideGeo, this.palette.outerSnow);
    eastBand.position.set(halfA + outerSpan / 2, 0.33, 0);
    eastBand.receiveShadow = true;

    scene.add(northBand, southBand, westBand, eastBand);

    // Cobblestone road base directly under snow grid
    const roadBaseGeo = new THREE.PlaneGeometry(ARENA_SIZE, ARENA_SIZE);
    roadBaseGeo.rotateX(-Math.PI / 2);
    const roadBase = new THREE.Mesh(roadBaseGeo, this.palette.cobbleRoad);
    roadBase.position.y = 0.0;
    roadBase.receiveShadow = true;
    scene.add(roadBase);

    // Dynamic snow grid mesh
    this.snowGrid = new SnowGridWorld();
    const snowMesh = new THREE.Mesh(this.snowGrid.geometry, this.palette.snowSurface);
    snowMesh.receiveShadow = true;
    scene.add(snowMesh);

    // Level props container
    scene.add(this.levelPropsGroup);

    // Hero Snowplow Rig
    this.plowRig = createSnowplowRig(this.palette);
    this.plowRig.applyUpgrades(this.upgrades);
    scene.add(this.plowRig.root);

    if (!this.isSoftwareGl) {
      renderer.compile(scene, camera);
    }
  }

  private initPools(): void {
    // 1. Snow spray particles (220 instances)
    const sprayGeo = new THREE.IcosahedronGeometry(0.16, 0);
    const sprayMat = new THREE.MeshStandardMaterial({
      color: 0xeef5ff,
      roughness: 0.85,
      metalness: 0.02,
    });
    const sprayCount = 220;
    this.sprayMesh = new THREE.InstancedMesh(sprayGeo, sprayMat, sprayCount);
    this.sprayMesh.frustumCulled = false;
    this.scene.add(this.sprayMesh);

    for (let i = 0; i < sprayCount; i++) {
      this.sprayPool.push({
        active: false,
        x: 0, y: -20, z: 0,
        vx: 0, vy: 0, vz: 0,
        life: 0, maxLife: 1,
        scale: 1, rotX: 0, rotZ: 0,
      });
      _dummy.position.set(0, -20, 0);
      _dummy.scale.setScalar(0.001);
      _dummy.updateMatrix();
      this.sprayMesh.setMatrixAt(i, _dummy.matrix);
    }
    this.sprayMesh.instanceMatrix.needsUpdate = true;

    // 2. Golden celebration sparks (90 instances)
    const sparkGeo = new THREE.OctahedronGeometry(0.14, 0);
    const sparkMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xf59e0b,
      emissiveIntensity: 2.2,
      roughness: 0.2,
    });
    const sparkCount = 90;
    this.sparkMesh = new THREE.InstancedMesh(sparkGeo, sparkMat, sparkCount);
    this.sparkMesh.frustumCulled = false;
    this.scene.add(this.sparkMesh);

    for (let i = 0; i < sparkCount; i++) {
      this.sparkPool.push({
        active: false,
        x: 0, y: -20, z: 0,
        vx: 0, vy: 0, vz: 0,
        life: 0, maxLife: 1,
        scale: 1, rotX: 0, rotZ: 0,
      });
      _dummy.position.set(0, -20, 0);
      _dummy.scale.setScalar(0.001);
      _dummy.updateMatrix();
      this.sparkMesh.setMatrixAt(i, _dummy.matrix);
    }
    this.sparkMesh.instanceMatrix.needsUpdate = true;

    // 3. Chimney smoke puffs (42 instances)
    const smokeGeo = new THREE.DodecahedronGeometry(0.32, 0);
    const smokeMat = new THREE.MeshStandardMaterial({
      color: 0xc2cde0,
      roughness: 0.95,
      transparent: true,
      opacity: 0.45,
    });
    const smokeCount = 42;
    this.smokeMesh = new THREE.InstancedMesh(smokeGeo, smokeMat, smokeCount);
    this.smokeMesh.frustumCulled = false;
    this.scene.add(this.smokeMesh);

    for (let i = 0; i < smokeCount; i++) {
      this.smokePool.push({
        x: 0, y: -20, z: 0,
        vy: 1.1 + (i % 4) * 0.2,
        life: (i / smokeCount) * 3.2,
        maxLife: 3.2,
        cabinIdx: i,
      });
    }

    // 4. Falling twilight snowflakes (900 points)
    const flakeCount = 900;
    this.weatherPositions = new Float32Array(flakeCount * 3);
    for (let i = 0; i < flakeCount; i++) {
      this.weatherPositions[i * 3] = (Math.random() - 0.5) * 90;
      this.weatherPositions[i * 3 + 1] = Math.random() * 26;
      this.weatherPositions[i * 3 + 2] = (Math.random() - 0.5) * 90;
    }
    this.weatherGeo = new THREE.BufferGeometry();
    this.weatherGeo.setAttribute('position', new THREE.BufferAttribute(this.weatherPositions, 3));
    this.weatherMat = new THREE.PointsMaterial({
      size: 0.42,
      map: this.palette.snowflakeTex,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      color: 0xe6f0ff,
    });
    this.weatherPoints = new THREE.Points(this.weatherGeo, this.weatherMat);
    this.scene.add(this.weatherPoints);
  }

  public loadLevel(levelIndex: number, targetPhase: GamePhase = 'playing'): void {
    const level = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, levelIndex))];
    this.currentLevel = level;
    this.phase = targetPhase;

    // Clear previous level props
    this.cabinDisposables.forEach((fn) => fn());
    this.cabinDisposables = [];
    this.cabins = [];
    while (this.levelPropsGroup.children.length > 0) {
      this.levelPropsGroup.remove(this.levelPropsGroup.children[0]);
    }

    // Rebuild snow grid
    this.snowGrid.loadLevel(level);

    // Place black ice patches slightly above road (0.015) so they shine when uncovered
    level.icePatches.forEach((ice) => {
      const iceGeo = new THREE.CircleGeometry(1, 24);
      iceGeo.rotateX(-Math.PI / 2);
      iceGeo.scale(ice.radiusX, 1, ice.radiusZ);
      const iceMesh = new THREE.Mesh(iceGeo, this.palette.blackIce);
      iceMesh.position.set(ice.x, 0.016, ice.z);
      iceMesh.rotation.y = ice.rotationY;
      iceMesh.receiveShadow = true;
      this.levelPropsGroup.add(iceMesh);
      this.cabinDisposables.push(() => iceGeo.dispose());
    });

    // Place cozy cabins
    level.cabins.forEach((cSpec) => {
      const cabin = createCabinModel(cSpec, this.palette);
      this.cabins.push(cabin);
      this.levelPropsGroup.add(cabin.group);
      this.cabinDisposables.push(() => cabin.dispose());
    });

    // Place wrought-iron street lanterns with warm amber point lights
    level.lanterns.forEach((lSpec, idx) => {
      const lantern = createLanternPostModel(this.palette);
      lantern.group.position.set(lSpec.x, 0, lSpec.z);
      this.levelPropsGroup.add(lantern.group);
      this.cabinDisposables.push(() => lantern.dispose());

      if (idx < 6) {
        const pt = new THREE.PointLight(0xffab3d, 2.8, 15, 2);
        pt.position.set(lSpec.x, 3.25, lSpec.z);
        this.levelPropsGroup.add(pt);
      }
    });

    // Surrounding pine forest & granite boulders
    const forest = createVillageForestAndRocks(level, this.palette, (x, z, pad) =>
      this.snowGrid.isPointNearRoad(x, z, pad),
    );
    this.levelPropsGroup.add(forest.group);
    this.cabinDisposables.push(() => forest.dispose());

    // Reset plow state
    this.plowX = level.spawn.x;
    this.plowZ = level.spawn.z;
    this.plowVx = 0;
    this.plowVz = 0;
    this.plowHeading = level.spawn.heading;
    this.pitchSpring = 0;
    this.rollSpring = 0;
    this.turboEnergy = 1.0;
    this.comboPoints = 0;
    this.comboMultiplier = 1.0;
    this.comboTimer = 0;
    this.bestCombo = 1.0;
    this.shiftEarnings = 0;
    this.fractionalEarn = 0;
    this.victoryTriggered = false;
    this.bannerText = null;
    this.bannerTimer = 0;

    this.plowRig.root.position.set(this.plowX, 0, this.plowZ);
    this.plowRig.root.rotation.y = this.plowHeading;
    this.cameraTarget.set(this.plowX, 0.5, this.plowZ);
    this.cameraPos.set(this.plowX + 28, 30, this.plowZ + 28);

    // Reassign smoke particles to current cabins
    this.smokePool.forEach((p, idx) => {
      const cab = this.cabins[idx % Math.max(1, this.cabins.length)];
      if (cab) {
        p.x = cab.chimneyWorldPos.x;
        p.y = cab.chimneyWorldPos.y;
        p.z = cab.chimneyWorldPos.z;
      }
    });

    this.pushHudSnapshot(true);
  }

  public setPhase(nextPhase: GamePhase): void {
    this.phase = nextPhase;
    if (nextPhase === 'playing') {
      this.audio.unlock();
    }
    this.pushHudSnapshot(true);
  }

  public applyUpgrades(nextUpgrades: UpgradesState, bankedSnowflakes: number): void {
    this.upgrades = { ...nextUpgrades };
    this.totalBankedSnowflakes = bankedSnowflakes;
    this.plowRig.applyUpgrades(this.upgrades);
    this.pushHudSnapshot(true);
  }

  public setTotalSnowflakes(banked: number): void {
    this.totalBankedSnowflakes = banked;
    this.pushHudSnapshot(true);
  }

  public setSteeringMode(mode: SteeringMode): void {
    this.steeringMode = mode;
  }

  public setMuted(muted: boolean): void {
    this.audio.setMuted(muted);
  }

  public setTouchInput(x: number, z: number, turbo: boolean): void {
    this.touchSteer.x = x;
    this.touchSteer.z = z;
    this.touchSteer.turbo = turbo;
  }

  private showBanner(text: string, duration = 2.6): void {
    this.bannerText = text;
    this.bannerTimer = duration;
    this.pushHudSnapshot(true);
  }

  private spawnSprayBurst(x: number, z: number, sideDirX: number, sideDirZ: number, count: number, boost = 1): void {
    for (let i = 0; i < count; i++) {
      const p = this.sprayPool[this.sprayCursor];
      this.sprayCursor = (this.sprayCursor + 1) % this.sprayPool.length;
      const sideSign = i % 2 === 0 ? 1 : -1;
      p.active = true;
      p.x = x + (Math.random() - 0.5) * 0.8;
      p.y = 0.25 + Math.random() * 0.25;
      p.z = z + (Math.random() - 0.5) * 0.8;
      const spread = (2.6 + Math.random() * 3.4) * boost;
      p.vx = sideDirX * sideSign * spread + (Math.random() - 0.5) * 1.4;
      p.vy = (2.8 + Math.random() * 3.2) * boost;
      p.vz = sideDirZ * sideSign * spread + (Math.random() - 0.5) * 1.4;
      p.life = 0;
      p.maxLife = 0.45 + Math.random() * 0.35;
      p.scale = 0.7 + Math.random() * 0.85;
      p.rotX = Math.random() * Math.PI;
      p.rotZ = Math.random() * Math.PI;
    }
  }

  private spawnSparkBurst(x: number, y: number, z: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const p = this.sparkPool[this.sparkCursor];
      this.sparkCursor = (this.sparkCursor + 1) % this.sparkPool.length;
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.8 + Math.random() * 4.5;
      p.active = true;
      p.x = x + (Math.random() - 0.5) * 1.5;
      p.y = y;
      p.z = z + (Math.random() - 0.5) * 1.5;
      p.vx = Math.cos(angle) * speed;
      p.vy = 3.5 + Math.random() * 4.2;
      p.vz = Math.sin(angle) * speed;
      p.life = 0;
      p.maxLife = 0.75 + Math.random() * 0.5;
      p.scale = 0.8 + Math.random() * 0.8;
      p.rotX = 0;
      p.rotZ = 0;
    }
  }

  private bindEvents(): void {
    const onKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      if (!e.repeat) {
        if (e.code === 'Escape') {
          this.callbacks.onActionHotkey('toggle_pause');
          return;
        }
        if (e.code === 'KeyG') {
          this.callbacks.onActionHotkey('toggle_garage');
          return;
        }
        if (e.code === 'KeyM') {
          this.callbacks.onActionHotkey('toggle_mute');
          return;
        }
        if ((e.code === 'Enter' || e.code === 'Space') && this.phase === 'title') {
          this.callbacks.onActionHotkey('start_or_continue');
          return;
        }
      }
      this.heldKeys.add(e.code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      this.heldKeys.delete(e.code);
    };

    const onBlur = () => {
      this.heldKeys.clear();
      this.touchSteer.x = 0;
      this.touchSteer.z = 0;
      this.touchSteer.turbo = false;
    };

    const onContextLost = (e: Event) => {
      e.preventDefault();
      this.callbacks.onContextLost(true);
    };

    const onContextRestored = () => {
      this.callbacks.onContextLost(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    this.renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    this.resizeObserver = new ResizeObserver(() => {
      if (this.disposed) return;
      const w = Math.max(1, this.container.clientWidth);
      const h = Math.max(1, this.container.clientHeight);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
    this.resizeObserver.observe(this.container);

    // Store cleanup reference on instance
    this.unbindEvents = () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      this.renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      this.renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      this.resizeObserver?.disconnect();
    };
  }

  private unbindEvents: () => void = () => {};

  private startLoop(): void {
    this.lastTime = performance.now();

    const afterDraw = (cb: () => void) => {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      if (this.disposed) return;
      const now = performance.now();
      const rawDt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      this.stepSimulation(dt, now);
      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      afterDraw(tick);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private stepSimulation(dt: number, nowMs: number): void {
    this.elapsed += dt;

    // Beacon pulse
    this.plowRig.beaconLight.intensity = 1.2 + Math.sin(this.elapsed * 6.5) * 0.55;

    // Update falling snowflakes regardless of phase
    this.updateWeatherParticles(dt);
    this.updateSmokeParticles(dt);
    this.updateSprayAndSparkPools(dt);

    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) {
        this.bannerText = null;
      }
    }

    if (this.phase === 'title') {
      // Atmospheric slow live-world orbital pan around the twilight village
      this.titleOrbitAngle += dt * 0.085;
      const radius = 37;
      const targetX = this.plowX * 0.35;
      const targetZ = this.plowZ * 0.35;
      this.cameraPos.set(
        targetX + Math.cos(this.titleOrbitAngle) * radius,
        24 + Math.sin(this.elapsed * 0.3) * 1.4,
        targetZ + Math.sin(this.titleOrbitAngle) * radius,
      );
      this.camera.position.copy(this.cameraPos);
      this.camera.lookAt(targetX, 1.2, targetZ);

      this.audio.updateContinuous({
        playing: false,
        speedRatio: 0,
        snowClearedRate: 0,
        inDeepDrift: false,
        onIce: false,
        windStrength: this.currentLevel.windStrength,
        turboActive: false,
      });
      return;
    }

    if (this.phase === 'paused' || this.phase === 'victory') {
      this.audio.updateContinuous({
        playing: false,
        speedRatio: 0,
        snowClearedRate: 0,
        inDeepDrift: false,
        onIce: false,
        windStrength: this.currentLevel.windStrength * 0.5,
        turboActive: false,
      });
      return;
    }

    // Active Playing Step
    const inputX =
      (this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight') ? 1 : 0) -
      (this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft') ? 1 : 0) +
      this.touchSteer.x;
    const inputY =
      (this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp') ? 1 : 0) -
      (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown') ? 1 : 0) +
      this.touchSteer.z;
    const turboHeld =
      this.heldKeys.has('ShiftLeft') || this.heldKeys.has('ShiftRight') || this.touchSteer.turbo;

    const turboActive = turboHeld && this.turboEnergy > 0.05 && (Math.abs(inputX) > 0.05 || Math.abs(inputY) > 0.05);
    if (turboActive) {
      this.turboEnergy = Math.max(0, this.turboEnergy - dt * 0.36);
    } else {
      const recharge = 0.22 + (this.upgrades.turboBlower - 1) * 0.05;
      this.turboEnergy = Math.min(1, this.turboEnergy + dt * recharge);
    }

    // Sample snow/ice under vehicle
    const bladeOffset = 2.0;
    const bladeX = this.plowX + Math.sin(this.plowHeading) * bladeOffset;
    const bladeZ = this.plowZ + Math.cos(this.plowHeading) * bladeOffset;

    const underCenter = this.snowGrid.sampleAt(this.plowX, this.plowZ);
    const underBlade = this.snowGrid.sampleAt(bladeX, bladeZ);
    const onIce = underCenter.onIce;
    const inDeepDrift = underBlade.depth > 1.05 || underCenter.depth > 1.05;

    // Upgrade-driven handling parameters
    const torqueFactor = 1 + (this.upgrades.engineTorque - 1) * 0.22;
    const turboSpeedScale = 1 + (this.upgrades.turboBlower - 1) * 0.12;
    const baseMaxSpeed = 10.6 * (turboActive ? 1.42 * turboSpeedScale : 1.0);
    const driftPenalty = inDeepDrift ? Math.max(0.54, 0.54 + (torqueFactor - 1) * 0.36) : 1.0;
    const maxSpeed = baseMaxSpeed * driftPenalty;

    const iceGrip = 0.22 + (this.upgrades.tireTraction - 1) * 0.17; // Lv 5 = 0.90!
    const traction = onIce ? iceGrip : 1.0;
    const accel = 24 * torqueFactor * (turboActive ? 1.35 : 1.0) * (onIce ? 0.58 + iceGrip * 0.4 : 1.0);

    let desiredDirX = 0;
    let desiredDirZ = 0;
    let driveMag = 0;

    if (this.steeringMode === 'screen') {
      // Camera sits along (+1, y, +1), so screen-up is (-1, -1) normalized, screen-right is (+1, -1) normalized
      const screenUpX = -0.7071;
      const screenUpZ = -0.7071;
      const screenRightX = 0.7071;
      const screenRightZ = -0.7071;

      desiredDirX = screenRightX * inputX + screenUpX * inputY;
      desiredDirZ = screenRightZ * inputX + screenUpZ * inputY;
      const len = Math.hypot(desiredDirX, desiredDirZ);
      if (len > 0.05) {
        desiredDirX /= len;
        desiredDirZ /= len;
        driveMag = Math.min(1, len);
      }
    } else {
      // Vehicle-relative: W/Up throttle, S/Down reverse, A/D steer
      const throttle = inputY;
      const steer = inputX;
      const speedNow = Math.hypot(this.plowVx, this.plowVz);
      const steerFactor = (0.65 + Math.min(1, speedNow / 6) * 0.85) * (0.85 + traction * 0.3);
      this.plowHeading -= steer * 2.75 * steerFactor * dt;

      if (Math.abs(throttle) > 0.05) {
        const sign = throttle > 0 ? 1 : -0.65;
        desiredDirX = Math.sin(this.plowHeading) * sign;
        desiredDirZ = Math.cos(this.plowHeading) * sign;
        driveMag = Math.abs(throttle);
      }
    }

    // Smooth steering toward desired direction in screen mode
    if (this.steeringMode === 'screen' && driveMag > 0.05) {
      const targetHeading = Math.atan2(desiredDirX, desiredDirZ);
      let diff = targetHeading - this.plowHeading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turnRate = (5.2 + (this.upgrades.tireTraction - 1) * 0.7) * (onIce ? 0.55 + iceGrip * 0.45 : 1.0);
      this.plowHeading += diff * Math.min(1, turnRate * dt);
      this.steerVisualAngle = THREE.MathUtils.damp(
        this.steerVisualAngle,
        THREE.MathUtils.clamp(diff, -0.55, 0.55),
        12,
        dt,
      );
    } else {
      this.steerVisualAngle = THREE.MathUtils.damp(
        this.steerVisualAngle,
        this.steeringMode === 'vehicle' ? -inputX * 0.45 : 0,
        10,
        dt,
      );
    }

    // Apply acceleration and snow/ice friction
    if (driveMag > 0.05) {
      this.plowVx += desiredDirX * accel * driveMag * dt;
      this.plowVz += desiredDirZ * accel * driveMag * dt;
    }

    // Lateral velocity damping (drift on ice vs crisp grip on road)
    const fwdX = Math.sin(this.plowHeading);
    const fwdZ = Math.cos(this.plowHeading);
    const rightX = Math.cos(this.plowHeading);
    const rightZ = -Math.sin(this.plowHeading);

    const fwdVel = this.plowVx * fwdX + this.plowVz * fwdZ;
    const latVel = this.plowVx * rightX + this.plowVz * rightZ;

    const dampedLat = latVel * Math.exp(-(onIce ? 1.4 + iceGrip * 4.5 : 8.5) * dt);
    const dragRate = driveMag > 0.05 ? (inDeepDrift ? 2.1 : 1.1) : (onIce ? 0.9 : 4.8);
    let dampedFwd = fwdVel * Math.exp(-dragRate * dt);
    if (Math.abs(dampedFwd) > maxSpeed) {
      dampedFwd = Math.sign(dampedFwd) * maxSpeed;
    }

    this.plowVx = fwdX * dampedFwd + rightX * dampedLat;
    this.plowVz = fwdZ * dampedFwd + rightZ * dampedLat;

    // Gentle crosswind push in windy levels
    if (this.currentLevel.windStrength > 0.35 && Math.hypot(this.plowVx, this.plowVz) > 0.8) {
      const windPush = this.currentLevel.windStrength * 0.55 * dt;
      this.plowVx += Math.cos(this.currentLevel.windAngle) * windPush;
      this.plowVz += Math.sin(this.currentLevel.windAngle) * windPush;
    }

    let nextX = this.plowX + this.plowVx * dt;
    let nextZ = this.plowZ + this.plowVz * dt;

    // Soft cabin collision pushout so plow glides around cabins instead of getting stuck
    for (const c of this.currentLevel.cabins) {
      const dx = nextX - c.x;
      const dz = nextZ - c.z;
      const dist = Math.hypot(dx, dz);
      const minDist = 4.25;
      if (dist < minDist && dist > 0.001) {
        const nx = dx / dist;
        const nz = dz / dist;
        nextX = c.x + nx * minDist;
        nextZ = c.z + nz * minDist;
        const dot = this.plowVx * nx + this.plowVz * nz;
        if (dot < 0) {
          this.plowVx -= dot * nx * 1.1;
          this.plowVz -= dot * nz * 1.1;
        }
      }
    }

    // Clamp cleanly inside natural forest valley boundary
    const bound = 32.5;
    if (nextX < -bound) { nextX = -bound; this.plowVx = Math.max(0, this.plowVx); }
    if (nextX > bound) { nextX = bound; this.plowVx = Math.min(0, this.plowVx); }
    if (nextZ < -bound) { nextZ = -bound; this.plowVz = Math.max(0, this.plowVz); }
    if (nextZ > bound) { nextZ = bound; this.plowVz = Math.min(0, this.plowVz); }

    this.plowX = nextX;
    this.plowZ = nextZ;

    // Carve snow with blade
    const newBladeX = this.plowX + Math.sin(this.plowHeading) * bladeOffset;
    const newBladeZ = this.plowZ + Math.cos(this.plowHeading) * bladeOffset;
    const bladeHalfWidth = 1.42 + (this.upgrades.bladeWidth - 1) * 0.28;

    const carve = this.snowGrid.carveBladeFootprint(newBladeX, newBladeZ, this.plowHeading, bladeHalfWidth);

    // Gentle snowfall reaccumulation in Endless Chill / Squall
    if (this.currentLevel.reaccumulationRate > 0) {
      this.snowGrid.applyWeatherReaccumulation(
        this.currentLevel.reaccumulationRate,
        dt,
        this.plowX,
        this.plowZ,
      );
    }

    // Combo & Snowflake earnings
    const comboDuration = 2.6 + (this.upgrades.turboBlower - 1) * 0.45;
    if (carve.clearedAmount > 0.05) {
      this.comboTimer = comboDuration;
      this.comboPoints += carve.clearedAmount * (carve.hitDrift ? 1.8 : 1.0);
      const targetMult = this.computeMultiplierFromPoints(this.comboPoints);
      if (targetMult > this.comboMultiplier) {
        this.comboMultiplier = targetMult;
        this.bestCombo = Math.max(this.bestCombo, this.comboMultiplier);
      }

      const rawEarned = carve.clearedAmount * (carve.hitDrift ? 3.2 : 1.7) * this.comboMultiplier;
      this.fractionalEarn += rawEarned;
      const whole = Math.floor(this.fractionalEarn);
      if (whole >= 1) {
        this.fractionalEarn -= whole;
        this.shiftEarnings += whole;
        this.totalBankedSnowflakes += whole;
        this.callbacks.onSnowflakesEarned(whole, this.currentLevel.isEndless);
      }

      // Spray snow off blade edges + play chime
      const speedNow = Math.hypot(this.plowVx, this.plowVz);
      if (speedNow > 1.2) {
        this.spawnSprayBurst(
          newBladeX,
          newBladeZ,
          rightX,
          rightZ,
          carve.hitDrift ? 6 : 3,
          carve.hitDrift ? 1.35 : 0.95,
        );
      }
      if (carve.hitDrift) {
        this.cameraShake = Math.min(0.28, this.cameraShake + 0.09);
      }
      this.audio.playSnowChime(this.comboMultiplier, carve.hitDrift);
    } else if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboTimer = 0;
        this.comboPoints = 0;
        this.comboMultiplier = 1.0;
      }
    }

    // Check newly cleared cabin driveways
    if (carve.newlyClearedCabins.length > 0) {
      carve.newlyClearedCabins.forEach((ci) => {
        const cab = this.cabins[ci];
        if (cab && !cab.cleared) {
          cab.cleared = true;
          cab.setClearedVisual(true);
          this.spawnSparkBurst(cab.group.position.x, 2.2, cab.group.position.z, 22);
          this.audio.playCabinCleared();
          const bonus = 35;
          this.shiftEarnings += bonus;
          this.totalBankedSnowflakes += bonus;
          this.callbacks.onSnowflakesEarned(bonus, this.currentLevel.isEndless);
          this.showBanner(`${cab.name} driveway cleared · +${bonus} Snowflakes`);
        }
      });
    }

    // Check neighborhood completion
    const clearPct = this.snowGrid.getClearPercent();
    if (!this.currentLevel.isEndless && !this.victoryTriggered && clearPct >= this.currentLevel.targetPercent) {
      this.victoryTriggered = true;
      this.phase = 'victory';
      const completionBonus = 120 + this.currentLevel.index * 50;
      this.shiftEarnings += completionBonus;
      this.totalBankedSnowflakes += completionBonus;
      this.callbacks.onSnowflakesEarned(completionBonus, false);
      this.spawnSparkBurst(this.plowX, 2.0, this.plowZ, 45);
      this.audio.playLevelVictory();
      this.callbacks.onLevelVictory(this.currentLevel.id, this.shiftEarnings, this.bestCombo);
      this.pushHudSnapshot(true);
      return;
    }

    // Visual rig suspension, wheel spin & steering
    const speedNow = Math.hypot(this.plowVx, this.plowVz);
    this.wheelSpinAngle += (fwdVel / 0.42) * dt;
    this.plowRig.frontWheels.forEach((fw) => {
      fw.pivot.rotation.y = this.steerVisualAngle;
      fw.spin.rotation.x = this.wheelSpinAngle;
    });
    this.plowRig.rearWheels.forEach((rw) => {
      rw.rotation.x = this.wheelSpinAngle;
    });

    const targetPitch = (inDeepDrift ? -0.06 : 0) + (driveMag > 0.1 ? -0.025 : 0);
    const targetRoll = THREE.MathUtils.clamp(-latVel * 0.028, -0.1, 0.1);
    this.pitchSpring = THREE.MathUtils.damp(this.pitchSpring, targetPitch, 9, dt);
    this.rollSpring = THREE.MathUtils.damp(this.rollSpring, targetRoll, 10, dt);

    this.plowRig.bodyGroup.rotation.x = this.pitchSpring;
    this.plowRig.bodyGroup.rotation.z = this.rollSpring;
    this.plowRig.root.position.set(this.plowX, 0, this.plowZ);
    this.plowRig.root.rotation.y = this.plowHeading;

    // Smooth isometric follow camera with damped lookahead and trauma shake
    this.cameraShake = Math.max(0, this.cameraShake - dt * 0.65);
    const shakeAmt = this.cameraShake * this.cameraShake * 1.4;
    const shakeX = (Math.random() - 0.5) * shakeAmt;
    const shakeY = (Math.random() - 0.5) * shakeAmt;

    const lookAheadX = this.plowX + this.plowVx * 0.25;
    const lookAheadZ = this.plowZ + this.plowVz * 0.25;

    this.cameraTarget.x = THREE.MathUtils.damp(this.cameraTarget.x, lookAheadX, 5.2, dt);
    this.cameraTarget.z = THREE.MathUtils.damp(this.cameraTarget.z, lookAheadZ, 5.2, dt);

    const desiredCamX = this.cameraTarget.x + 26;
    const desiredCamY = 28.5;
    const desiredCamZ = this.cameraTarget.z + 26;

    this.cameraPos.x = THREE.MathUtils.damp(this.cameraPos.x, desiredCamX, 4.8, dt);
    this.cameraPos.y = THREE.MathUtils.damp(this.cameraPos.y, desiredCamY, 4.8, dt);
    this.cameraPos.z = THREE.MathUtils.damp(this.cameraPos.z, desiredCamZ, 4.8, dt);

    this.camera.position.set(this.cameraPos.x + shakeX, this.cameraPos.y + shakeY, this.cameraPos.z);
    this.camera.lookAt(this.cameraTarget.x, 0.4, this.cameraTarget.z);

    // Update audio engine
    this.audio.updateContinuous({
      playing: true,
      speedRatio: speedNow / 11,
      snowClearedRate: Math.min(1, carve.clearedAmount / 4.5),
      inDeepDrift,
      onIce,
      windStrength: this.currentLevel.windStrength,
      turboActive,
    });

    // Throttled HUD sync (~15Hz)
    if (nowMs - this.lastHudPush > 66) {
      this.pushHudSnapshot(false, speedNow, onIce, inDeepDrift);
      this.lastHudPush = nowMs;
    }
  }

  private computeMultiplierFromPoints(pts: number): number {
    if (pts >= 220) return 8.0;
    if (pts >= 155) return 6.0;
    if (pts >= 105) return 5.0;
    if (pts >= 68) return 4.0;
    if (pts >= 40) return 3.0;
    if (pts >= 22) return 2.5;
    if (pts >= 10) return 2.0;
    if (pts >= 3) return 1.5;
    return 1.0;
  }

  private updateSprayAndSparkPools(dt: number): void {
    let sprayDirty = false;
    for (let i = 0; i < this.sprayPool.length; i++) {
      const p = this.sprayPool[i];
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        _dummy.position.set(0, -25, 0);
        _dummy.scale.setScalar(0.001);
        _dummy.updateMatrix();
        this.sprayMesh.setMatrixAt(i, _dummy.matrix);
        sprayDirty = true;
        continue;
      }
      p.vy -= 14.5 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < 0.08) {
        p.y = 0.08;
        p.vy *= -0.2;
      }
      const fade = 1 - p.life / p.maxLife;
      _dummy.position.set(p.x, p.y, p.z);
      _dummy.rotation.set(p.rotX + p.life * 4, 0, p.rotZ + p.life * 3);
      _dummy.scale.setScalar(p.scale * fade);
      _dummy.updateMatrix();
      this.sprayMesh.setMatrixAt(i, _dummy.matrix);
      sprayDirty = true;
    }
    if (sprayDirty) this.sprayMesh.instanceMatrix.needsUpdate = true;

    let sparkDirty = false;
    for (let i = 0; i < this.sparkPool.length; i++) {
      const p = this.sparkPool[i];
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        _dummy.position.set(0, -25, 0);
        _dummy.scale.setScalar(0.001);
        _dummy.updateMatrix();
        this.sparkMesh.setMatrixAt(i, _dummy.matrix);
        sparkDirty = true;
        continue;
      }
      p.vy -= 8.0 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const fade = 1 - p.life / p.maxLife;
      _dummy.position.set(p.x, p.y, p.z);
      _dummy.rotation.set(p.life * 5, p.life * 4, 0);
      _dummy.scale.setScalar(p.scale * fade);
      _dummy.updateMatrix();
      this.sparkMesh.setMatrixAt(i, _dummy.matrix);
      sparkDirty = true;
    }
    if (sparkDirty) this.sparkMesh.instanceMatrix.needsUpdate = true;
  }

  private updateSmokeParticles(dt: number): void {
    if (this.cabins.length === 0) return;
    const windVx = Math.cos(this.currentLevel.windAngle) * (0.45 + this.currentLevel.windStrength * 1.4);
    const windVz = Math.sin(this.currentLevel.windAngle) * (0.45 + this.currentLevel.windStrength * 1.4);

    for (let i = 0; i < this.smokePool.length; i++) {
      const s = this.smokePool[i];
      s.life += dt;
      if (s.life >= s.maxLife) {
        s.life = 0;
        const cab = this.cabins[s.cabinIdx % this.cabins.length];
        s.x = cab.chimneyWorldPos.x + (Math.random() - 0.5) * 0.18;
        s.y = cab.chimneyWorldPos.y;
        s.z = cab.chimneyWorldPos.z + (Math.random() - 0.5) * 0.18;
      }
      const t = s.life / s.maxLife;
      s.x += windVx * dt;
      s.y += s.vy * dt;
      s.z += windVz * dt;
      const scale = (0.35 + t * 0.95) * (1 - t * 0.85);
      _dummy.position.set(s.x, s.y, s.z);
      _dummy.rotation.set(s.life * 0.6, s.life * 0.8, 0);
      _dummy.scale.setScalar(Math.max(0.01, scale));
      _dummy.updateMatrix();
      this.smokeMesh.setMatrixAt(i, _dummy.matrix);
    }
    this.smokeMesh.instanceMatrix.needsUpdate = true;
  }

  private updateWeatherParticles(dt: number): void {
    const intensity = this.currentLevel.snowfallIntensity;
    const activeCount = Math.floor(900 * Math.max(0.2, intensity));
    const windVx = Math.cos(this.currentLevel.windAngle) * this.currentLevel.windStrength * 6.5;
    const windVz = Math.sin(this.currentLevel.windAngle) * this.currentLevel.windStrength * 6.5;
    const fallSpeed = 3.2 + intensity * 2.8;

    for (let i = 0; i < 900; i++) {
      const idx3 = i * 3;
      if (i >= activeCount) {
        this.weatherPositions[idx3 + 1] = -30;
        continue;
      }
      let x = this.weatherPositions[idx3] + (windVx + Math.sin(this.elapsed * 1.4 + i) * 0.45) * dt;
      let y = this.weatherPositions[idx3 + 1] - fallSpeed * dt;
      let z = this.weatherPositions[idx3 + 2] + (windVz + Math.cos(this.elapsed * 1.2 + i) * 0.45) * dt;

      if (y < 0) {
        y = 24 + Math.random() * 4;
        x = (Math.random() - 0.5) * 90;
        z = (Math.random() - 0.5) * 90;
      }
      if (x > 45) x -= 90;
      if (x < -45) x += 90;
      if (z > 45) z -= 90;
      if (z < -45) z += 90;

      this.weatherPositions[idx3] = x;
      this.weatherPositions[idx3 + 1] = y;
      this.weatherPositions[idx3 + 2] = z;
    }
    (this.weatherGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  private pushHudSnapshot(
    force: boolean,
    speedNow = 0,
    onIce = false,
    inDeepDrift = false,
  ): void {
    if (!force && this.disposed) return;
    const comboDuration = 2.6 + (this.upgrades.turboBlower - 1) * 0.45;
    this.callbacks.onHudUpdate({
      phase: this.phase,
      levelIndex: this.currentLevel.index,
      levelName: this.currentLevel.name,
      weatherLabel: this.currentLevel.weatherLabel,
      isEndless: this.currentLevel.isEndless,
      clearPercent: Math.round(this.snowGrid.getClearPercent()),
      targetPercent: this.currentLevel.targetPercent,
      snowflakes: this.totalBankedSnowflakes,
      shiftEarnings: this.shiftEarnings,
      comboMultiplier: this.comboMultiplier,
      comboProgress: Math.max(0, Math.min(1, this.comboTimer / comboDuration)),
      bestCombo: this.bestCombo,
      cabinsCleared: this.snowGrid.getCabinsClearedCount(),
      totalCabins: this.cabins.length,
      speedKmh: Math.round(speedNow * 3.2),
      turboEnergy: this.turboEnergy,
      onIce,
      inDeepDrift,
      bannerText: this.bannerText,
    });
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.unbindEvents();

    this.cabinDisposables.forEach((fn) => fn());
    this.plowRig.dispose();
    this.snowGrid.dispose();
    this.palette.dispose();
    this.audio.dispose();

    this.sprayMesh.geometry.dispose();
    (this.sprayMesh.material as THREE.Material).dispose();
    this.sparkMesh.geometry.dispose();
    (this.sparkMesh.material as THREE.Material).dispose();
    this.smokeMesh.geometry.dispose();
    (this.smokeMesh.material as THREE.Material).dispose();
    this.weatherGeo.dispose();
    this.weatherMat.dispose();

    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
