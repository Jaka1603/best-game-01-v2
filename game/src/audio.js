// All sound is synthesized WebAudio — no audio files ship with the game.
//
// Architecture (v8 Audio Implementation): three buses — music, sfx, ui —
// under a master gain with a compressor gluing the mix. The score is a
// real procedural loop (v8 Music Composition): D minor i–VI–III–VII at
// 108 BPM, scheduled with a lookahead scheduler on the audio clock —
// bass on eighth notes, an arp cycling chord tones, a detuned pad per
// bar — and a danger layer (arp an octave up, hats, the pad filter
// opened) that fades in on bar boundaries when the Night Wall closes in.
//
// Every effect is a recipe (v8 Sound Design): source + envelope + filter,
// written once here — core = sine blip 880→1320 Hz climbing with the
// combo; gate = noise whoosh + a fifth chime; near miss = a high tick
// sweep; crash = noise burst + a 90 Hz square thud, and the music ducks
// −6 dB under it; engine = detuned saws tracking speed through a
// lowpass; wind = the shared noise buffer through a bandpass.

import { MUSIC } from './config.js';

const CHORD_INTERVALS = { min: [0, 3, 7, 12], maj: [0, 4, 7, 12] };
const VOICE_CAPS = { core: 6, gate: 3, near: 4, crash: 3 };

function midiHz(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function createAudio() {
  let ctx = null;
  let master, musicBus, sfxBus, uiBus;
  let engineOsc, engineSub, engineFilter, engineGain, windFilter, windGain;
  let padFilter, arpHiGain, hatGain;
  let noiseBuffer = null;
  let muted = false;
  let danger = false;
  const voices = { core: 0, gate: 0, near: 0, crash: 0 };

  // Music scheduler state.
  const stepDur = 60 / MUSIC.bpm / 4; // one sixteenth note
  let nextStepTime = 0;
  let stepIndex = 0;

  function buildGraph() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 4;
    master.connect(comp);
    comp.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.8; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
    uiBus = ctx.createGain(); uiBus.gain.value = 0.7; uiBus.connect(master);

    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;

    // Engine: two detuned saws + a square sub through one lowpass.
    engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 52;
    engineSub = ctx.createOscillator(); engineSub.type = 'square'; engineSub.frequency.value = 26;
    engineFilter = ctx.createBiquadFilter(); engineFilter.type = 'lowpass'; engineFilter.frequency.value = 320;
    engineGain = ctx.createGain(); engineGain.gain.value = 0;
    engineOsc.connect(engineFilter); engineSub.connect(engineFilter);
    engineFilter.connect(engineGain); engineGain.connect(sfxBus);
    engineOsc.start(); engineSub.start();

    // Wind: looped noise through a bandpass that opens with speed.
    const wind = ctx.createBufferSource(); wind.buffer = noiseBuffer; wind.loop = true;
    windFilter = ctx.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.frequency.value = 480; windFilter.Q.value = 0.7;
    windGain = ctx.createGain(); windGain.gain.value = 0;
    wind.connect(windFilter); windFilter.connect(windGain); windGain.connect(sfxBus);
    wind.start();

    // Music layer plumbing: the pad lives behind its own filter (the
    // danger layer opens it); the high arp and the hats sit behind
    // gains that stay at zero until danger fades them in.
    padFilter = ctx.createBiquadFilter(); padFilter.type = 'lowpass'; padFilter.frequency.value = 750;
    padFilter.connect(musicBus);
    arpHiGain = ctx.createGain(); arpHiGain.gain.value = 0; arpHiGain.connect(musicBus);
    hatGain = ctx.createGain(); hatGain.gain.value = 0; hatGain.connect(musicBus);
  }

  function tone({ type = 'sine', from, to, at, dur, gain, bus, dest }) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, at);
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g);
    g.connect(dest || bus || sfxBus);
    osc.start(at);
    osc.stop(at + dur + 0.05);
    return osc;
  }

  function noiseHit({ at, dur, gain, filterType, from, to, q = 1, bus, dest }) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(from, at);
    if (to) filter.frequency.exponentialRampToValueAtTime(to, at + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(filter); filter.connect(g); g.connect(dest || bus || sfxBus);
    src.start(at);
    src.stop(at + dur + 0.05);
  }

  // ---- the procedural score ----

  function schedulePad(chord, at, barDur) {
    const root = MUSIC.chordRoots[chord];
    for (const [offset, detune] of [[12, -6], [19, 6]]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = midiHz(root + offset);
      osc.detune.value = detune;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.035, at + 0.4);
      g.gain.setValueAtTime(0.035, at + barDur - 0.3);
      g.gain.linearRampToValueAtTime(0, at + barDur + 0.05);
      osc.connect(g); g.connect(padFilter);
      osc.start(at); osc.stop(at + barDur + 0.1);
    }
  }

  function scheduleStep(step, at) {
    const s = step % 16;
    const chord = Math.floor(step / 16) % 4;
    const tones = CHORD_INTERVALS[MUSIC.chordKinds[chord]].map((i) => MUSIC.chordRoots[chord] + i);
    if (s === 0) {
      schedulePad(chord, at, stepDur * 16);
      // Layer changes land on bar boundaries only — a mid-bar switch
      // sounds like a mistake.
      arpHiGain.gain.setTargetAtTime(danger ? 0.05 : 0, at, 0.15);
      hatGain.gain.setTargetAtTime(danger ? 0.16 : 0, at, 0.15);
      padFilter.frequency.setTargetAtTime(danger ? 1500 : 750, at, 0.3);
    }
    if (s % 2 === 0) {
      const note = MUSIC.bassRoots[chord] + MUSIC.bassPattern[s / 2];
      tone({ type: 'square', from: midiHz(note), at, dur: stepDur * 1.8, gain: 0.075, bus: musicBus });
    }
    const arpNote = tones[MUSIC.arpPattern[s] % tones.length];
    tone({ type: 'triangle', from: midiHz(arpNote), at, dur: stepDur * 1.4, gain: 0.045, bus: musicBus });
    tone({ type: 'triangle', from: midiHz(arpNote + 12), at, dur: stepDur * 1.2, gain: 1, dest: arpHiGain });
    if (s % 4 === 2) {
      noiseHit({ at, dur: 0.03, gain: 0.5, filterType: 'highpass', from: 6500, dest: hatGain });
    }
  }

  function schedulerTick() {
    while (nextStepTime < ctx.currentTime + 0.12) {
      scheduleStep(stepIndex, nextStepTime);
      nextStepTime += stepDur;
      stepIndex += 1;
    }
  }

  function duckMusic() {
    if (!ctx) return;
    const t = ctx.currentTime;
    musicBus.gain.cancelScheduledValues(t);
    musicBus.gain.setValueAtTime(0.4, t);
    musicBus.gain.linearRampToValueAtTime(0.8, t + 0.35);
  }

  function claim(kind) {
    if (voices[kind] >= VOICE_CAPS[kind]) return false;
    voices[kind] += 1;
    return true;
  }
  function release(kind) {
    voices[kind] = Math.max(0, voices[kind] - 1);
  }

  return {
    /** Create/resume the graph. Must be called from a user gesture. */
    wake() {
      if (!ctx) {
        buildGraph();
        nextStepTime = ctx.currentTime + 0.06;
        stepIndex = 0;
        setInterval(schedulerTick, 25);
      }
      if (ctx.state === 'suspended') ctx.resume();
    },
    /** Engine + wind follow the run; `danger` arms the music's top layer. */
    setEngine(speedNorm, running) {
      if (!ctx) return;
      const t = ctx.currentTime;
      const n = Math.max(0, Math.min(1, speedNorm));
      engineOsc.frequency.setTargetAtTime(52 + n * 68, t, 0.08);
      engineSub.frequency.setTargetAtTime(26 + n * 34, t, 0.08);
      engineFilter.frequency.setTargetAtTime(300 + n * 750, t, 0.1);
      engineGain.gain.setTargetAtTime(running ? 0.05 + n * 0.05 : 0, t, 0.12);
      windFilter.frequency.setTargetAtTime(420 + n * 950, t, 0.15);
      windGain.gain.setTargetAtTime(running ? 0.012 + n * 0.05 : 0, t, 0.2);
    },
    setDanger(on) {
      danger = on;
    },
    core(combo) {
      if (!ctx || !claim('core')) return;
      const t = ctx.currentTime;
      const base = 880 * Math.pow(1.059, Math.min(combo, 12));
      const osc = tone({ type: 'sine', from: base, to: base * 1.5, at: t, dur: 0.09, gain: 0.16 });
      osc.onended = () => release('core');
    },
    gate() {
      if (!ctx || !claim('gate')) return;
      const t = ctx.currentTime;
      noiseHit({ at: t, dur: 0.28, gain: 0.12, filterType: 'bandpass', from: 500, to: 2600, q: 1.6 });
      const a = tone({ type: 'sine', from: 659, at: t, dur: 0.22, gain: 0.1 });
      tone({ type: 'sine', from: 988, at: t + 0.05, dur: 0.26, gain: 0.09 });
      a.onended = () => release('gate');
    },
    nearMiss() {
      if (!ctx || !claim('near')) return;
      const t = ctx.currentTime;
      const osc = tone({ type: 'sawtooth', from: 1900, to: 900, at: t, dur: 0.07, gain: 0.035 });
      osc.onended = () => release('near');
    },
    crash() {
      if (!ctx || !claim('crash')) return;
      const t = ctx.currentTime;
      noiseHit({ at: t, dur: 0.3, gain: 0.3, filterType: 'lowpass', from: 3200, to: 300 });
      const osc = tone({ type: 'square', from: 96, to: 38, at: t, dur: 0.32, gain: 0.26 });
      osc.onended = () => release('crash');
      duckMusic();
    },
    victory() {
      if (!ctx) return;
      const t = ctx.currentTime;
      [62, 66, 69, 74].forEach((note, i) => {
        tone({ type: 'triangle', from: midiHz(note), at: t + i * 0.09, dur: 0.34, gain: 0.14 });
      });
      duckMusic();
    },
    defeat() {
      if (!ctx) return;
      const t = ctx.currentTime;
      tone({ type: 'sawtooth', from: 220, to: 110, at: t, dur: 0.5, gain: 0.12 });
      tone({ type: 'sawtooth', from: 165, to: 55, at: t + 0.18, dur: 0.7, gain: 0.12 });
    },
    click() {
      if (!ctx) return;
      tone({ type: 'sine', from: 1200, at: ctx.currentTime, dur: 0.03, gain: 0.08, bus: uiBus });
    },
    toggleMute() {
      muted = !muted;
      if (ctx) master.gain.value = muted ? 0 : 0.9;
      return muted;
    },
  };
}
