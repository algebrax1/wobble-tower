// Tiny synthesized sound engine (no asset files needed).

let ctx: AudioContext | null = null;
let enabled = true;
let hapticsOn = true;

export function setAudioEnabled(v: boolean) {
  enabled = v;
}
export function setHapticsEnabled(v: boolean) {
  hapticsOn = v;
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

export function unlockAudio() {
  getCtx();
}

function tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.15, slideTo?: number, delay = 0) {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function noise(dur: number, vol = 0.2, lp = 1800, delay = 0, hp = 0) {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = lp;
  const g = c.createGain();
  g.gain.value = vol;
  let node: AudioNode = src.connect(f);
  if (hp) {
    const h = c.createBiquadFilter();
    h.type = "highpass";
    h.frequency.value = hp;
    node = node.connect(h);
  }
  node.connect(g).connect(c.destination);
  src.start(t0);
}

export function vibrate(ms: number | number[]) {
  if (!hapticsOn) return;
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(ms);
    } catch {
      /* ignore */
    }
  }
}

export const sfx = {
  click() {
    tone(620, 0.07, "triangle", 0.12, 880);
    vibrate(8);
  },
  grab() {
    tone(180, 0.09, "sine", 0.18, 120);
    vibrate(12);
  },
  deny() {
    tone(150, 0.16, "square", 0.08, 90);
    vibrate([20, 30, 20]);
  },
  slide(speed = 1) {
    noise(0.08, 0.05 * Math.min(1, speed), 700 + speed * 500, 0, 200);
  },
  pop() {
    tone(520, 0.12, "triangle", 0.2, 1040);
    tone(780, 0.14, "sine", 0.12, 1560, 0.05);
    noise(0.06, 0.1, 3000);
    vibrate(25);
  },
  coin() {
    tone(988, 0.09, "square", 0.08);
    tone(1319, 0.2, "square", 0.08, undefined, 0.08);
    vibrate(15);
  },
  bomb() {
    noise(0.7, 0.45, 600);
    tone(90, 0.6, "sawtooth", 0.25, 30);
    vibrate([60, 40, 120]);
  },
  tremorWarn() {
    tone(440, 0.12, "square", 0.07);
    tone(440, 0.12, "square", 0.07, undefined, 0.2);
  },
  tremor() {
    noise(0.9, 0.18, 220);
    vibrate([30, 30, 30, 30, 30]);
  },
  crash() {
    noise(1.3, 0.55, 1400);
    noise(0.8, 0.3, 500, 0.15);
    tone(110, 0.8, "sawtooth", 0.2, 38);
    vibrate([80, 40, 80, 40, 160]);
  },
  win() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.28, "triangle", 0.16, undefined, i * 0.1));
    vibrate([30, 40, 30, 40, 80]);
  },
  star() {
    tone(1200, 0.18, "sine", 0.14, 1800);
  },
  buy() {
    [660, 880, 1320].forEach((f, i) => tone(f, 0.16, "triangle", 0.14, undefined, i * 0.07));
    vibrate(20);
  },
  boost() {
    tone(300, 0.35, "sine", 0.16, 900);
    tone(600, 0.35, "triangle", 0.1, 1500, 0.08);
    vibrate(30);
  },
  tick() {
    tone(1500, 0.03, "square", 0.04);
  },
};
