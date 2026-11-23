// Procedural Web Audio API Synth Engine for Hearthplow
// Zero external audio assets — 100% real-time oscillators and filtered noise.

const PENTATONIC_FREQS = [
  261.63, // C4
  293.66, // D4
  329.63, // E4
  392.0,  // G4
  440.0,  // A4
  523.25, // C5
  587.33, // D5
  659.25, // E5
  783.99, // G5
  880.0,  // A5
  1046.5, // C6
];

export class SynthAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineSubOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;

  private scrapeGain: GainNode | null = null;
  private scrapeFilter: BiquadFilterNode | null = null;

  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;

  private iceGain: GainNode | null = null;

  private muted = false;
  private initialized = false;
  private lastChimeTime = 0;
  private chimeStep = 0;

  constructor(initialMuted = false) {
    this.muted = initialMuted;
  }

  public unlock(): void {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    try {
      const ctx = new AudioCtx();
      this.ctx = ctx;

      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : 0.42;
      master.connect(ctx.destination);
      this.masterGain = master;

      // 1. Cozy low-pass diesel/electric plow purr
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 140;
      engineFilter.Q.value = 1.6;

      const engineGain = ctx.createGain();
      engineGain.gain.value = 0.0;

      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 54;

      const sub = ctx.createOscillator();
      sub.type = 'sine';
      sub.frequency.value = 27;

      osc.connect(engineFilter);
      sub.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);

      osc.start();
      sub.start();

      this.engineOsc = osc;
      this.engineSubOsc = sub;
      this.engineGain = engineGain;
      this.engineFilter = engineFilter;

      // 2. Shared procedural noise buffer for snow scrape & twilight breeze
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + white * 0.099046;
        b1 = 0.96300 * b1 + white * 0.2965164;
        b2 = 0.57000 * b2 + white * 1.0526913;
        data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.16;
      }

      // Snow scrape loop
      const scrapeSrc = ctx.createBufferSource();
      scrapeSrc.buffer = noiseBuffer;
      scrapeSrc.loop = true;

      const scrapeFilter = ctx.createBiquadFilter();
      scrapeFilter.type = 'bandpass';
      scrapeFilter.frequency.value = 900;
      scrapeFilter.Q.value = 1.1;

      const scrapeGain = ctx.createGain();
      scrapeGain.gain.value = 0;

      scrapeSrc.connect(scrapeFilter);
      scrapeFilter.connect(scrapeGain);
      scrapeGain.connect(master);
      scrapeSrc.start();

      this.scrapeFilter = scrapeFilter;
      this.scrapeGain = scrapeGain;

      // Gentle twilight wind bed
      const windSrc = ctx.createBufferSource();
      windSrc.buffer = noiseBuffer;
      windSrc.loop = true;

      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'lowpass';
      windFilter.frequency.value = 340;
      windFilter.Q.value = 0.7;

      const windGain = ctx.createGain();
      windGain.gain.value = 0;

      windSrc.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(master);
      windSrc.start();

      this.windFilter = windFilter;
      this.windGain = windGain;

      // Ice crystalline shimmer loop
      const iceSrc = ctx.createBufferSource();
      iceSrc.buffer = noiseBuffer;
      iceSrc.loop = true;

      const iceFilter = ctx.createBiquadFilter();
      iceFilter.type = 'bandpass';
      iceFilter.frequency.value = 2800;
      iceFilter.Q.value = 6.5;

      const iceGain = ctx.createGain();
      iceGain.gain.value = 0;

      iceSrc.connect(iceFilter);
      iceFilter.connect(iceGain);
      iceGain.connect(master);
      iceSrc.start();
      this.iceGain = iceGain;

      this.initialized = true;
    } catch {
      // AudioContext unavailable in restricted environments
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.42, this.ctx.currentTime, 0.04);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public updateContinuous(params: {
    playing: boolean;
    speedRatio: number; // 0..1.5
    snowClearedRate: number; // 0..1
    inDeepDrift: boolean;
    onIce: boolean;
    windStrength: number;
    turboActive: boolean;
  }): void {
    if (!this.initialized || !this.ctx) return;
    const t = this.ctx.currentTime;

    if (!params.playing) {
      this.engineGain?.gain.setTargetAtTime(0, t, 0.12);
      this.scrapeGain?.gain.setTargetAtTime(0, t, 0.08);
      this.iceGain?.gain.setTargetAtTime(0, t, 0.08);
      this.windGain?.gain.setTargetAtTime(params.windStrength * 0.05, t, 0.25);
      return;
    }

    const speedClamped = Math.min(1.5, Math.max(0, params.speedRatio));
    const baseFreq = 46 + speedClamped * 34 + (params.turboActive ? 16 : 0);
    this.engineOsc?.frequency.setTargetAtTime(baseFreq, t, 0.08);
    this.engineSubOsc?.frequency.setTargetAtTime(baseFreq * 0.5, t, 0.08);
    this.engineFilter?.frequency.setTargetAtTime(
      110 + speedClamped * 140 + (params.inDeepDrift ? 70 : 0),
      t,
      0.08,
    );
    this.engineGain?.gain.setTargetAtTime(0.05 + speedClamped * 0.075, t, 0.08);

    // Tactile snow scrape
    const scrapeTarget = params.snowClearedRate > 0.01
      ? Math.min(0.24, 0.04 + params.snowClearedRate * 0.22 + (params.inDeepDrift ? 0.06 : 0))
      : 0;
    this.scrapeGain?.gain.setTargetAtTime(scrapeTarget, t, 0.05);
    this.scrapeFilter?.frequency.setTargetAtTime(
      params.inDeepDrift ? 620 : 980 + speedClamped * 420,
      t,
      0.06,
    );

    // Black ice shimmer
    const iceTarget = params.onIce && speedClamped > 0.08 ? Math.min(0.11, speedClamped * 0.09) : 0;
    this.iceGain?.gain.setTargetAtTime(iceTarget, t, 0.05);

    // Ambient wind
    this.windGain?.gain.setTargetAtTime(0.025 + params.windStrength * 0.075, t, 0.2);
    this.windFilter?.frequency.setTargetAtTime(280 + params.windStrength * 320, t, 0.2);
  }

  public playSnowChime(comboMultiplier: number, isDriftBonus = false): void {
    if (!this.initialized || !this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    if (now - this.lastChimeTime < 0.09) return;
    this.lastChimeTime = now;

    const comboIdx = Math.min(
      PENTATONIC_FREQS.length - 1,
      Math.floor((comboMultiplier - 1) * 1.4) + (this.chimeStep % 3),
    );
    this.chimeStep = (this.chimeStep + 1) % 3;

    const freq = PENTATONIC_FREQS[comboIdx] * (isDriftBonus ? 1.5 : 1.0);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(isDriftBonus ? 0.11 : 0.065, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.32);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.34);
  }

  public playCabinCleared(): void {
    if (!this.initialized || !this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const start = now + idx * 0.065;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.11, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.55);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(start);
      osc.stop(start + 0.58);
    });
  }

  public playUpgradePurchased(): void {
    if (!this.initialized || !this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const notes = [392.0, 493.88, 587.33, 783.99];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const start = now + idx * 0.045;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.12, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.45);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(start);
      osc.stop(start + 0.48);
    });
  }

  public playLevelVictory(): void {
    if (!this.initialized || !this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const chord = [261.63, 329.63, 392.0, 523.25, 659.25];
    chord.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const start = now + idx * 0.08;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.12, start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0008, start + 1.15);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(start);
      osc.stop(start + 1.2);
    });
  }

  public dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.initialized = false;
    }
  }
}
