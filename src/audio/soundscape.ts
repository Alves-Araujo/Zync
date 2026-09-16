import { BINAURAL_BEAT, binauralCarrier, type BinauralBand, type NatureKind, type NoiseKind } from './scenes';

// generated on the audio thread so the sound never loops (see noise-processor.js)
const NOISE_WORKLET_URL = new URL('./noise-processor.js', import.meta.url).href;

/**
 * Procedural soundscape engine — every sound is synthesised live with the Web
 * Audio API (no audio files): coloured noise buffers shaped by filters and
 * envelopes, plus scheduled one-shots for rain drops, thunder, birds and crackles.
 */

export interface SoundState {
  playing: boolean;
  noise: NoiseKind | null;
  nature: NatureKind | null;
  volume: number;
  noiseVolume: number;
  natureVolume: number;
  rainIntensity: number;
  thunder: boolean;
  /** 0 = darker, 0.5 = neutral, 1 = brighter (a gentle tilt EQ per category). */
  noiseTone: number;
  natureTone: number;
  binauralBand: BinauralBand;
  /** 0..1 → the carrier tone both ears share (80–320 Hz). */
  binauralTone: number;
}

type NoiseColor = 'white' | 'pink' | 'brown';

const NOISE_SECONDS = 8;
const XFADE = 4096;
const rand = Math.random;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function biquad(ctx: AudioContext, type: BiquadFilterType, freq: number, q = 0.707) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

function amp(ctx: AudioContext, value: number) {
  const g = ctx.createGain();
  g.gain.value = value;
  return g;
}

function pan(ctx: AudioContext, value: number) {
  const p = ctx.createStereoPanner();
  p.pan.value = value;
  return p;
}

function chain(...nodes: AudioNode[]) {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
}

/** One running sound: owns its looping sources, timers and output gain (for fades). */
class Layer {
  readonly ctx: AudioContext;
  readonly out: GainNode;
  update: (s: SoundState) => void = () => {};
  private alive = true;
  private sources: AudioNode[] = [];
  private timers = new Set<number>();

  constructor(ctx: AudioContext, dest: AudioNode) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.gain.setTargetAtTime(1, ctx.currentTime, 0.5);
    this.out.connect(dest);
  }

  hold<T extends AudioNode>(src: T): T {
    this.sources.push(src);
    return src;
  }

  after(ms: number, fn: () => void) {
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      if (this.alive) fn();
    }, ms);
    this.timers.add(id);
  }

  stop() {
    if (!this.alive) return;
    this.alive = false;
    this.timers.forEach((id) => window.clearTimeout(id));
    this.timers.clear();
    const now = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setValueAtTime(this.out.gain.value, now);
    this.out.gain.setTargetAtTime(0, now, 0.25);
    window.setTimeout(() => {
      for (const s of this.sources) {
        try {
          (s as { stop?: () => void }).stop?.();
        } catch {
          // already stopped
        }
        s.disconnect();
      }
      this.out.disconnect();
    }, 1600);
  }
}

class SoundscapeEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBus: GainNode | null = null;
  private natureBus: GainNode | null = null;
  private noiseEq: [BiquadFilterNode, BiquadFilterNode] | null = null;
  private natureEq: [BiquadFilterNode, BiquadFilterNode] | null = null;
  private buffers = new Map<NoiseColor, AudioBuffer>();
  private noiseLayer: { kind: NoiseKind; layer: Layer } | null = null;
  private natureLayer: { kind: NatureKind; layer: Layer } | null = null;
  private listeners = new Set<(strength: number) => void>();
  private suspendTimer = 0;
  private workletReady = false;
  private lastState: SoundState | null = null;
  private alarmTimer = 0;
  private alarmBus: GainNode | null = null;

  /** Subscribe to lightning strikes (fired at the flash, before the rumble arrives). */
  onThunder(fn: (strength: number) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  /** Reconcile the audio graph with the desired state. Call from a user-gesture-driven update. */
  sync(s: SoundState) {
    this.lastState = s;
    if (!s.playing || (!s.noise && !s.nature)) {
      this.pause();
      return;
    }
    const ctx = this.ensure();
    if (!ctx || !this.master || !this.noiseBus || !this.natureBus) return;
    window.clearTimeout(this.suspendTimer);
    if (ctx.state === 'suspended') void ctx.resume();

    const now = ctx.currentTime;
    // squared sliders feel closer to perceived loudness
    this.master.gain.setTargetAtTime(s.volume * s.volume, now, 0.15);
    this.noiseBus.gain.setTargetAtTime(s.noiseVolume * s.noiseVolume, now, 0.15);
    this.natureBus.gain.setTargetAtTime(s.natureVolume * s.natureVolume, now, 0.15);
    this.tilt(this.noiseEq, s.noiseTone, now);
    this.tilt(this.natureEq, s.natureTone, now);

    if ((this.noiseLayer?.kind ?? null) !== s.noise) {
      this.noiseLayer?.layer.stop();
      this.noiseLayer = s.noise ? { kind: s.noise, layer: this.buildNoise(ctx, s.noise, s) } : null;
    }
    if ((this.natureLayer?.kind ?? null) !== s.nature) {
      this.natureLayer?.layer.stop();
      this.natureLayer = s.nature ? { kind: s.nature, layer: this.buildNature(ctx, s.nature, s) } : null;
    }
    this.noiseLayer?.layer.update(s);
    this.natureLayer?.layer.update(s);
  }

  private tilt(eq: [BiquadFilterNode, BiquadFilterNode] | null, tone: number, now: number) {
    if (!eq) return;
    const db = (clamp01(tone) - 0.5) * 20;
    eq[0].gain.setTargetAtTime(-db * 0.6, now, 0.1);
    eq[1].gain.setTargetAtTime(db, now, 0.1);
  }

  private pause() {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    this.master.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
    window.clearTimeout(this.suspendTimer);
    this.suspendTimer = window.setTimeout(() => {
      this.noiseLayer?.layer.stop();
      this.natureLayer?.layer.stop();
      this.noiseLayer = null;
      this.natureLayer = null;
      window.setTimeout(() => void ctx.suspend(), 1700);
    }, 700);
  }

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -8;
    limiter.knee.value = 6;
    limiter.ratio.value = 6;
    this.master = amp(ctx, 0);
    this.noiseBus = amp(ctx, 1);
    this.natureBus = amp(ctx, 1);
    this.noiseEq = [biquad(ctx, 'lowshelf', 250), biquad(ctx, 'highshelf', 3500)];
    this.natureEq = [biquad(ctx, 'lowshelf', 250), biquad(ctx, 'highshelf', 3500)];
    chain(this.noiseBus, this.noiseEq[0], this.noiseEq[1], this.master);
    chain(this.natureBus, this.natureEq[0], this.natureEq[1], this.master);
    chain(this.master, limiter, ctx.destination);
    this.ctx = ctx;
    void ctx.audioWorklet
      ?.addModule(NOISE_WORKLET_URL)
      .then(() => {
        this.workletReady = true;
        this.refresh();
      })
      .catch(() => {
        // keep the buffer fallback
      });
    return ctx;
  }

  /** Rebuild the running layers (used once the seamless generator is ready). */
  private refresh() {
    const s = this.lastState;
    if (!s || !this.ctx || (!this.noiseLayer && !this.natureLayer)) return;
    this.noiseLayer?.layer.stop();
    this.natureLayer?.layer.stop();
    this.noiseLayer = null;
    this.natureLayer = null;
    this.sync(s);
  }

  /** Ring until stopAlarm(), ducking whatever ambience is playing. */
  startAlarm(tone: 'rest' | 'focus' | 'done') {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    this.stopAlarm(false);
    window.clearTimeout(this.suspendTimer);
    if (ctx.state === 'suspended') void ctx.resume();
    const ambient = this.lastState?.playing ? (this.lastState.volume ?? 0.7) ** 2 : 0;
    this.master.gain.setTargetAtTime(ambient * 0.25, ctx.currentTime, 0.2);

    const bus = amp(ctx, 0.5);
    bus.connect(ctx.destination);
    this.alarmBus = bus;
    const notes = tone === 'rest' ? [880, 660] : tone === 'focus' ? [660, 990] : [880, 1170, 880];
    const ring = () => {
      const t0 = ctx.currentTime + 0.02;
      notes.forEach((freq, i) => {
        const t = t0 + i * 0.22;
        for (const [type, level, mult] of [
          ['triangle', 0.5, 1],
          ['sine', 0.18, 2],
        ] as const) {
          const osc = ctx.createOscillator();
          osc.type = type;
          osc.frequency.value = freq * mult;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(level, t + 0.012);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
          chain(osc, g, bus);
          osc.start(t);
          osc.stop(t + 0.24);
        }
      });
      this.alarmTimer = window.setTimeout(ring, 1500);
    };
    ring();
  }

  stopAlarm(restore = true) {
    window.clearTimeout(this.alarmTimer);
    this.alarmTimer = 0;
    const ctx = this.ctx;
    if (this.alarmBus && ctx) {
      const bus = this.alarmBus;
      bus.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
      window.setTimeout(() => bus.disconnect(), 700);
      this.alarmBus = null;
    }
    if (restore && ctx && this.master) {
      const ambient = this.lastState?.playing ? (this.lastState.volume ?? 0.7) ** 2 : 0;
      this.master.gain.setTargetAtTime(ambient, ctx.currentTime, 0.4);
    }
  }

  private emit(strength: number) {
    this.listeners.forEach((fn) => fn(strength));
  }

  // -- noise buffers -------------------------------------------------------------

  /** Stereo, seamlessly looping coloured noise (tail cross-faded into the head). */
  private buffer(color: NoiseColor): AudioBuffer {
    const cached = this.buffers.get(color);
    if (cached) return cached;
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * NOISE_SECONDS);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    const raw = new Float32Array(len + XFADE);
    for (let ch = 0; ch < 2; ch++) {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
      for (let i = 0; i < raw.length; i++) {
        const w = rand() * 2 - 1;
        if (color === 'white') {
          raw[i] = w * 0.5;
        } else if (color === 'pink') {
          // Paul Kellet's refined pink-noise filter
          b0 = 0.99886 * b0 + w * 0.0555179;
          b1 = 0.99332 * b1 + w * 0.0750759;
          b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856;
          b4 = 0.55 * b4 + w * 0.5329522;
          b5 = -0.7616 * b5 - w * 0.016898;
          raw[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
          b6 = w * 0.115926;
        } else {
          last = (last + 0.02 * w) / 1.02;
          raw[i] = last * 3.5;
        }
      }
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        if (i < XFADE) {
          // equal power: a linear fade would dip ~3 dB on uncorrelated noise, and that dip is audible
          const t = (i / XFADE) * (Math.PI / 2);
          data[i] = raw[i] * Math.sin(t) + raw[len + i] * Math.cos(t);
        } else {
          data[i] = raw[i];
        }
      }
    }
    this.buffers.set(color, buf);
    return buf;
  }

  /**
   * A never-ending noise source. Uses the audio-thread generator when it is
   * loaded (no repetition at all); falls back to a cross-faded buffer loop.
   */
  private loop(ctx: AudioContext, layer: Layer, color: NoiseColor): AudioNode {
    if (this.workletReady) {
      const node = new AudioWorkletNode(ctx, 'zync-noise', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        processorOptions: { color },
      });
      return layer.hold(node);
    }
    const src = ctx.createBufferSource();
    src.buffer = this.buffer(color);
    src.loop = true;
    src.start(0, rand() * NOISE_SECONDS);
    return layer.hold(src);
  }

  /** A one-shot slice of noise starting at `t` (for drops, cracks, rumbles). */
  private burst(ctx: AudioContext, color: NoiseColor, t: number, dur: number) {
    const src = ctx.createBufferSource();
    src.buffer = this.buffer(color);
    if (dur > NOISE_SECONDS * 0.5) {
      src.loop = true;
      src.start(t, rand() * NOISE_SECONDS);
      src.stop(t + dur);
    } else {
      src.start(t, rand() * (NOISE_SECONDS - dur), dur);
    }
    return src;
  }

  // -- noises --------------------------------------------------------------------

  private buildNoise(ctx: AudioContext, kind: NoiseKind, s: SoundState): Layer {
    const layer = new Layer(ctx, this.noiseBus!);
    if (kind === 'white') {
      chain(this.loop(ctx, layer, 'white'), biquad(ctx, 'lowpass', 14000), amp(ctx, 0.55), layer.out);
    } else if (kind === 'pink') {
      chain(this.loop(ctx, layer, 'pink'), amp(ctx, 0.95), layer.out);
    } else if (kind === 'brown') {
      chain(this.loop(ctx, layer, 'brown'), amp(ctx, 1.1), layer.out);
    } else if (kind === 'fan') {
      // fan: soft airflow with a gentle blade wobble and a faint motor hum
      const body = amp(ctx, 0.75);
      chain(this.loop(ctx, layer, 'pink'), biquad(ctx, 'lowpass', 650), body, layer.out);
      const lfo = layer.hold(ctx.createOscillator());
      lfo.frequency.value = 3.1;
      const depth = amp(ctx, 0.08);
      chain(lfo, depth);
      depth.connect(body.gain);
      lfo.start();
      chain(this.loop(ctx, layer, 'brown'), biquad(ctx, 'bandpass', 140, 1.2), amp(ctx, 0.6), layer.out);
      const hum = layer.hold(ctx.createOscillator());
      hum.frequency.value = 59;
      chain(hum, amp(ctx, 0.012), layer.out);
      hum.start();
    } else if (kind === 'grey') {
      // pink noise shaped by an inverted equal-loudness curve: fuller lows, softened presence peak
      const low = biquad(ctx, 'lowshelf', 220);
      low.gain.value = 7;
      const dip = biquad(ctx, 'peaking', 3000, 0.8);
      dip.gain.value = -5;
      const air = biquad(ctx, 'highshelf', 9000);
      air.gain.value = 3;
      chain(this.loop(ctx, layer, 'pink'), low, dip, air, amp(ctx, 0.7), layer.out);
    } else if (kind === 'airplane') {
      const cabin = amp(ctx, 0.9);
      chain(this.loop(ctx, layer, 'brown'), biquad(ctx, 'lowpass', 380), cabin, layer.out);
      chain(this.loop(ctx, layer, 'pink'), biquad(ctx, 'bandpass', 700, 0.5), amp(ctx, 0.22), layer.out);
      chain(this.loop(ctx, layer, 'white'), biquad(ctx, 'highpass', 5000), biquad(ctx, 'lowpass', 9000), amp(ctx, 0.02), layer.out);
      // two slightly detuned turbine drones beating slowly against each other
      const drone = amp(ctx, 1);
      chain(drone, biquad(ctx, 'lowpass', 300), layer.out);
      for (const f of [118, 119.3]) {
        const o = layer.hold(ctx.createOscillator());
        o.frequency.value = f;
        chain(o, amp(ctx, 0.018), drone);
        o.start();
      }
      const drift = () => {
        cabin.gain.setTargetAtTime(0.75 + rand() * 0.3, ctx.currentTime, 2);
        layer.after(3000 + rand() * 3000, drift);
      };
      drift();
    } else if (kind === 'train') {
      const body = amp(ctx, 0.7);
      chain(this.loop(ctx, layer, 'brown'), biquad(ctx, 'lowpass', 520), body, layer.out);
      chain(this.loop(ctx, layer, 'pink'), biquad(ctx, 'bandpass', 1500, 0.7), amp(ctx, 0.05), layer.out);
      const thumps = amp(ctx, 1);
      thumps.connect(layer.out);
      const thump = (t: number, loud: number) => {
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(loud, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
        chain(this.burst(ctx, 'brown', t, 0.15), biquad(ctx, 'lowpass', 700), g, thumps);
        const c = ctx.createGain();
        c.gain.setValueAtTime(0, t);
        c.gain.linearRampToValueAtTime(loud * 0.08, t + 0.002);
        c.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
        chain(this.burst(ctx, 'white', t, 0.04), biquad(ctx, 'bandpass', 2500, 3), c, thumps);
      };
      // clickety-clack: two wheel pairs crossing each rail joint
      const cycle = () => {
        const t = ctx.currentTime + 0.05;
        thump(t, 2.7);
        thump(t + 0.13, 2.2);
        thump(t + 0.5, 2.5);
        thump(t + 0.63, 2.1);
        body.gain.setTargetAtTime(0.6 + rand() * 0.2, t, 0.5);
        layer.after((1.05 + rand() * 0.08) * 1000, cycle);
      };
      cycle();
    } else {
      this.binaural(ctx, layer, s);
    }
    return layer;
  }

  // -- nature --------------------------------------------------------------------

  private buildNature(ctx: AudioContext, kind: NatureKind, s: SoundState): Layer {
    const layer = new Layer(ctx, this.natureBus!);
    if (kind === 'rain') this.rain(ctx, layer, s);
    else if (kind === 'ocean') this.ocean(ctx, layer);
    else if (kind === 'forest') this.forest(ctx, layer);
    else if (kind === 'fire') this.fire(ctx, layer);
    else if (kind === 'stream') this.stream(ctx, layer);
    else if (kind === 'waterfall') this.waterfall(ctx, layer);
    else if (kind === 'night') this.night(ctx, layer);
    else this.wind(ctx, layer);
    return layer;
  }

  private rain(ctx: AudioContext, layer: Layer, s: SoundState) {
    const hissLP = biquad(ctx, 'lowpass', 4000);
    const hissGain = amp(ctx, 0.3);
    chain(this.loop(ctx, layer, 'pink'), biquad(ctx, 'highpass', 380), hissLP, hissGain, layer.out);
    const bodyGain = amp(ctx, 0.3);
    chain(this.loop(ctx, layer, 'brown'), biquad(ctx, 'lowpass', 520), bodyGain, layer.out);
    const drops = amp(ctx, 1);
    drops.connect(layer.out);
    const thunderBus = amp(ctx, 1);
    thunderBus.connect(layer.out);

    let intensity = clamp01(s.rainIntensity);
    let thunder = s.thunder;

    const strike = () => {
      const dist = rand(); // 0 = overhead, 1 = far away
      const strength = 1 - dist * 0.65;
      this.emit(strength);
      // light travels faster than sound: the rumble arrives after the flash
      const t = ctx.currentTime + 0.2 + dist * 2.2;
      const lp = biquad(ctx, 'lowpass', dist < 0.4 ? 1100 : 420);
      lp.frequency.setTargetAtTime(150, t + 0.3, 1.2);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(2.6 * strength, t + 0.06 + dist * 0.5);
      g.gain.setTargetAtTime(1.1 * strength, t + 0.5, 0.35);
      g.gain.setTargetAtTime(1.8 * strength, t + 1.3 + rand() * 0.6, 0.25);
      g.gain.setTargetAtTime(0, t + 2.4, 1.3 + dist * 1.2);
      chain(this.burst(ctx, 'brown', t, 9), lp, g, pan(ctx, rand() * 1.2 - 0.6), thunderBus);
      if (dist < 0.45) {
        const crack = ctx.createGain();
        crack.gain.setValueAtTime(0, t);
        crack.gain.linearRampToValueAtTime(0.5 * strength, t + 0.008);
        crack.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
        chain(this.burst(ctx, 'white', t, 0.5), biquad(ctx, 'lowpass', 2600), crack, thunderBus);
      }
    };

    const apply = (next: SoundState, first: boolean) => {
      const now = ctx.currentTime;
      const hadThunder = thunder;
      intensity = clamp01(next.rainIntensity);
      thunder = next.thunder;
      hissLP.frequency.setTargetAtTime(1600 + 7400 * intensity, now, 0.3);
      hissGain.gain.setTargetAtTime(0.1 + 0.55 * intensity, now, 0.3);
      bodyGain.gain.setTargetAtTime(0.08 + 0.7 * intensity * intensity, now, 0.3);
      // immediate feedback when thunder is switched on
      if (!first && thunder && !hadThunder) layer.after(1200, strike);
    };
    layer.update = (next) => apply(next, false);
    apply(s, true);

    const TICK = 100;
    const dropTick = () => {
      const rate = 3 + 55 * intensity; // drops per second
      const n = Math.floor((rate * TICK) / 1000 + rand());
      const base = ctx.currentTime + 0.05;
      for (let i = 0; i < n; i++) {
        this.drop(ctx, drops, base + (rand() * TICK) / 1000, (0.05 + rand() * 0.18) * (0.6 + intensity));
      }
      layer.after(TICK, dropTick);
    };
    dropTick();

    const scheduleThunder = () => {
      const wait = (7 + rand() * 20) * (1.35 - intensity * 0.7);
      layer.after(wait * 1000, () => {
        if (thunder) strike();
        scheduleThunder();
      });
    };
    scheduleThunder();
    if (thunder) layer.after(2500, strike);
  }

  /** One raindrop tick: a tiny band-passed noise click somewhere in the stereo field. */
  private drop(ctx: AudioContext, dest: AudioNode, t: number, loud: number) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(loud, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.025 + rand() * 0.06);
    chain(
      this.burst(ctx, 'white', t, 0.12),
      biquad(ctx, 'bandpass', 1400 + rand() * 5200, 1 + rand() * 6),
      g,
      pan(ctx, rand() * 1.8 - 0.9),
      dest,
    );
  }

  /**
   * Binaural beats: a pure tone in each ear, a few Hz apart. The beat itself is
   * never played — the brain hears the difference, which only works on headphones.
   */
  private binaural(ctx: AudioContext, layer: Layer, s: SoundState) {
    const ear = (side: number) => {
      const panner = ctx.createStereoPanner();
      panner.pan.value = side;
      panner.connect(layer.out);
      const osc = layer.hold(ctx.createOscillator());
      osc.type = 'sine';
      chain(osc, amp(ctx, 0.3), panner);
      osc.start();
      return osc;
    };
    const left = ear(-1);
    const right = ear(1);

    // a soft harmonic and a quiet bed of air keep the pure tones from feeling harsh
    const harmonic = layer.hold(ctx.createOscillator());
    harmonic.type = 'sine';
    chain(harmonic, amp(ctx, 0.05), layer.out);
    harmonic.start();
    chain(this.loop(ctx, layer, 'pink'), biquad(ctx, 'lowpass', 900), amp(ctx, 0.07), layer.out);

    const apply = (next: SoundState) => {
      const carrier = binauralCarrier(next.binauralTone);
      const beat = BINAURAL_BEAT[next.binauralBand] ?? 10;
      const now = ctx.currentTime;
      left.frequency.setTargetAtTime(carrier - beat / 2, now, 0.15);
      right.frequency.setTargetAtTime(carrier + beat / 2, now, 0.15);
      harmonic.frequency.setTargetAtTime(carrier * 2, now, 0.15);
    };
    layer.update = apply;
    apply(s);
  }

  private ocean(ctx: AudioContext, layer: Layer) {
    const lp = biquad(ctx, 'lowpass', 300);
    const env = amp(ctx, 0.15);
    chain(this.loop(ctx, layer, 'brown'), lp, env, layer.out);
    const foam = amp(ctx, 0.01);
    chain(
      this.loop(ctx, layer, 'pink'),
      biquad(ctx, 'highpass', 1500),
      biquad(ctx, 'lowpass', 6500),
      foam,
      layer.out,
    );
    // distant, constant surf underneath
    chain(this.loop(ctx, layer, 'pink'), biquad(ctx, 'lowpass', 700), amp(ctx, 0.12), layer.out);

    const wave = () => {
      const t = ctx.currentTime + 0.05;
      const dur = 5 + rand() * 5;
      const peak = 0.6 + rand() * 0.8;
      env.gain.setTargetAtTime(peak, t, dur * 0.16);
      env.gain.setTargetAtTime(0.14, t + dur * 0.42, dur * 0.2);
      lp.frequency.setTargetAtTime(500 + 900 * peak, t, dur * 0.16);
      lp.frequency.setTargetAtTime(280, t + dur * 0.42, dur * 0.22);
      foam.gain.setTargetAtTime(0.18 * peak, t + dur * 0.3, dur * 0.07);
      foam.gain.setTargetAtTime(0.01, t + dur * 0.48, dur * 0.2);
      layer.after(dur * 1000, wave);
    };
    wave();
  }

  private forest(ctx: AudioContext, layer: Layer) {
    const windBP = biquad(ctx, 'bandpass', 420, 0.5);
    const wind = amp(ctx, 0.35);
    chain(this.loop(ctx, layer, 'pink'), windBP, wind, layer.out);
    const leaves = amp(ctx, 0.02);
    chain(
      this.loop(ctx, layer, 'white'),
      biquad(ctx, 'highpass', 2800),
      biquad(ctx, 'lowpass', 9000),
      leaves,
      layer.out,
    );
    const gust = () => {
      const now = ctx.currentTime;
      const g = rand();
      wind.gain.setTargetAtTime(0.18 + g * 0.5, now, 1.6);
      windBP.frequency.setTargetAtTime(280 + g * 520, now, 2);
      leaves.gain.setTargetAtTime(0.01 + g * 0.06, now, 1.2);
      layer.after(2500 + rand() * 3500, gust);
    };
    gust();

    const birds = amp(ctx, 1);
    birds.connect(layer.out);
    const bird = () => {
      const far = rand();
      const tone = biquad(ctx, 'lowpass', 9000 - far * 5500);
      chain(tone, pan(ctx, rand() * 1.8 - 0.9), birds);
      const species = Math.floor(rand() * 4);
      const vol = (0.05 + rand() * 0.07) * (1 - far * 0.7);
      const base = 2000 + rand() * 2800;
      const notes =
        species === 3 ? 2 : species === 2 ? 8 + Math.floor(rand() * 10) : 2 + Math.floor(rand() * 5);
      let t = ctx.currentTime + 0.05;
      for (let n = 0; n < notes; n++) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        let d: number;
        if (species === 0) {
          // rising chirps
          d = 0.05 + rand() * 0.04;
          osc.frequency.setValueAtTime(base, t);
          osc.frequency.exponentialRampToValueAtTime(base * 1.45, t + d);
        } else if (species === 1) {
          // falling whistles
          d = 0.14 + rand() * 0.12;
          osc.frequency.setValueAtTime(base * 1.25, t);
          osc.frequency.exponentialRampToValueAtTime(base * 0.7, t + d);
        } else if (species === 2) {
          // fast trill
          d = 0.025;
          osc.frequency.setValueAtTime(base * (n % 2 ? 1.1 : 0.95), t);
        } else {
          // distant dove, two low notes
          d = 0.3;
          const f = n === 0 ? 900 : 720;
          osc.frequency.setValueAtTime(f, t);
          osc.frequency.linearRampToValueAtTime(f * 0.97, t + d);
        }
        const peak = vol * (species === 3 ? 0.6 : 1);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(peak, t + Math.min(0.015, d * 0.3));
        g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        chain(osc, g, tone);
        osc.start(t);
        osc.stop(t + d + 0.03);
        t += d + (species === 2 ? 0.02 : species === 3 ? 0.18 : 0.04 + rand() * 0.09);
      }
      layer.after(800 + rand() * 4200, bird);
    };
    layer.after(600, bird);
  }

  private stream(ctx: AudioContext, layer: Layer) {
    const flowBP = biquad(ctx, 'bandpass', 1200, 0.5);
    const flow = amp(ctx, 0.5);
    chain(this.loop(ctx, layer, 'pink'), flowBP, flow, layer.out);
    chain(this.loop(ctx, layer, 'brown'), biquad(ctx, 'lowpass', 300), amp(ctx, 0.35), layer.out);
    const drift = () => {
      const now = ctx.currentTime;
      flowBP.frequency.setTargetAtTime(900 + rand() * 900, now, 1.5);
      flow.gain.setTargetAtTime(0.4 + rand() * 0.2, now, 1.5);
      layer.after(2000 + rand() * 2000, drift);
    };
    drift();
    // babbling: tiny resonant bubbles whose pitch rises as they burst
    const bubbles = amp(ctx, 1);
    bubbles.connect(layer.out);
    const tick = () => {
      const base = ctx.currentTime + 0.05;
      const n = Math.floor(2 + rand() * 3);
      for (let i = 0; i < n; i++) {
        const t = base + rand() * 0.1;
        const f0 = 300 + rand() * 1300;
        const d = 0.02 + rand() * 0.05;
        const osc = ctx.createOscillator();
        osc.frequency.setValueAtTime(f0, t);
        osc.frequency.exponentialRampToValueAtTime(f0 * (1.5 + rand()), t + d);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.02 + rand() * 0.05, t + 0.003);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        chain(osc, g, pan(ctx, rand() * 1.6 - 0.8), bubbles);
        osc.start(t);
        osc.stop(t + d + 0.02);
      }
      layer.after(100, tick);
    };
    tick();
  }

  private waterfall(ctx: AudioContext, layer: Layer) {
    chain(this.loop(ctx, layer, 'pink'), biquad(ctx, 'lowpass', 4000), amp(ctx, 0.9), layer.out);
    chain(this.loop(ctx, layer, 'brown'), biquad(ctx, 'lowpass', 220), amp(ctx, 0.9), layer.out);
    chain(this.loop(ctx, layer, 'white'), biquad(ctx, 'highpass', 5000), amp(ctx, 0.06), layer.out);
    const splash = amp(ctx, 0.6);
    splash.connect(layer.out);
    const tick = () => {
      const base = ctx.currentTime + 0.05;
      if (rand() < 0.7) this.drop(ctx, splash, base + rand() * 0.15, 0.06 + rand() * 0.12);
      layer.after(150, tick);
    };
    tick();
  }

  private night(ctx: AudioContext, layer: Layer) {
    // calm night air
    chain(this.loop(ctx, layer, 'pink'), biquad(ctx, 'lowpass', 900), amp(ctx, 0.08), layer.out);
    const insects = amp(ctx, 1);
    insects.connect(layer.out);

    // crickets: a high carrier gated into short pulse trains, each insect at its own pace
    const cricket = (carrier: number, where: number, vol: number, period: number) => {
      const osc = layer.hold(ctx.createOscillator());
      osc.frequency.value = carrier;
      const g = amp(ctx, 0);
      chain(osc, g, pan(ctx, where), insects);
      osc.start();
      const chirp = () => {
        let t = ctx.currentTime + 0.05;
        const pulses = 3 + Math.floor(rand() * 3);
        for (let p = 0; p < pulses; p++) {
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(vol, t + 0.004);
          g.gain.setValueAtTime(vol, t + 0.014);
          g.gain.linearRampToValueAtTime(0, t + 0.02);
          t += 0.035;
        }
        layer.after(period * (0.9 + rand() * 0.2) * 1000, chirp);
      };
      layer.after(rand() * 800, chirp);
    };
    for (let i = 0; i < 6; i++) {
      cricket(3900 + rand() * 1300, rand() * 1.8 - 0.9, 0.01 + rand() * 0.02, 0.45 + rand() * 0.5);
    }

    // distant frogs: low buzzy croaks
    const frog = () => {
      const t = ctx.currentTime + 0.05;
      const f = 180 + rand() * 140;
      const d = 0.18 + rand() * 0.12;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.linearRampToValueAtTime(f * 0.85, t + d);
      const trill = ctx.createOscillator();
      trill.frequency.value = 28 + rand() * 12;
      const shaper = amp(ctx, 0.5);
      const depth = amp(ctx, 0.5);
      chain(trill, depth);
      depth.connect(shaper.gain);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.05, t + 0.02);
      g.gain.setValueAtTime(0.05, t + d - 0.04);
      g.gain.linearRampToValueAtTime(0, t + d);
      chain(osc, biquad(ctx, 'lowpass', 900), shaper, g, pan(ctx, rand() * 1.4 - 0.7), insects);
      osc.start(t);
      osc.stop(t + d + 0.05);
      trill.start(t);
      trill.stop(t + d + 0.05);
      layer.after(1500 + rand() * 5000, frog);
    };
    layer.after(1200, frog);
  }

  private wind(ctx: AudioContext, layer: Layer) {
    const bp = biquad(ctx, 'bandpass', 500, 1.2);
    const gustGain = amp(ctx, 0.4);
    chain(this.loop(ctx, layer, 'pink'), bp, gustGain, layer.out);
    // whistling between the rocks
    const whistleBP = biquad(ctx, 'bandpass', 900, 12);
    const whistle = amp(ctx, 0);
    chain(this.loop(ctx, layer, 'white'), whistleBP, whistle, layer.out);
    chain(this.loop(ctx, layer, 'brown'), biquad(ctx, 'lowpass', 200), amp(ctx, 0.3), layer.out);
    const gust = () => {
      const now = ctx.currentTime;
      const k = rand();
      bp.frequency.setTargetAtTime(300 + k * 900, now, 1.2);
      gustGain.gain.setTargetAtTime(0.2 + k * 0.6, now, 1);
      whistleBP.frequency.setTargetAtTime(700 + k * 900, now, 1.5);
      whistle.gain.setTargetAtTime(k > 0.55 ? 0.25 * k : 0.02, now, 1.2);
      layer.after(1800 + rand() * 2800, gust);
    };
    gust();
  }

  private fire(ctx: AudioContext, layer: Layer) {
    const roar = amp(ctx, 0.6);
    chain(this.loop(ctx, layer, 'brown'), biquad(ctx, 'lowpass', 360), roar, layer.out);
    chain(this.loop(ctx, layer, 'pink'), biquad(ctx, 'bandpass', 2600, 0.6), amp(ctx, 0.035), layer.out);
    const pops = amp(ctx, 1);
    pops.connect(layer.out);

    const pop = (t: number, loud: number) => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(loud, t + 0.0015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.006 + rand() * 0.03);
      chain(
        this.burst(ctx, 'white', t, 0.06),
        biquad(ctx, 'highpass', 900 + rand() * 3500),
        g,
        pan(ctx, rand() * 1.2 - 0.6),
        pops,
      );
    };
    const tick = () => {
      const base = ctx.currentTime + 0.05;
      const n = Math.floor(0.6 + rand() * 1.4);
      for (let i = 0; i < n; i++) if (rand() < 0.55) pop(base + rand() * 0.15, 0.08 + rand() * 0.35);
      if (rand() < 0.06) {
        // a knot in the wood bursting: a quick cluster of pops
        const t0 = base + rand() * 0.1;
        const k = 4 + Math.floor(rand() * 9);
        for (let j = 0; j < k; j++) pop(t0 + rand() * 0.35, 0.05 + rand() * 0.25);
      }
      roar.gain.setTargetAtTime(0.45 + rand() * 0.3, ctx.currentTime, 0.6);
      layer.after(150, tick);
    };
    tick();
  }
}

export const soundscape = new SoundscapeEngine();
