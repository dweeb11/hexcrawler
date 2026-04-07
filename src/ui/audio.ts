// Web Audio API synthesized sound system — no external libraries.
// AudioContext is created lazily on first user gesture to satisfy browser autoplay policy.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
  }
  if (ctx.state === "suspended") {
    void ctx.resume();
  }
  return ctx;
}

function tone(
  frequency: number,
  type: OscillatorType,
  startTime: number,
  duration: number,
  gainPeak: number,
  audioCtx: AudioContext,
): void {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startTime);

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(gainPeak, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.01);
}

function noise(
  startTime: number,
  duration: number,
  gainPeak: number,
  audioCtx: AudioContext,
): void {
  const bufferSize = Math.ceil(audioCtx.sampleRate * duration);
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;

  const gain = audioCtx.createGain();
  source.connect(gain);
  gain.connect(audioCtx.destination);

  gain.gain.setValueAtTime(gainPeak, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  source.start(startTime);
}

export function playMove(): void {
  const ac = getCtx();
  const t = ac.currentTime;
  tone(220, "triangle", t, 0.08, 0.15, ac);
  tone(330, "triangle", t + 0.04, 0.06, 0.08, ac);
}

export function playEncounterOpen(): void {
  const ac = getCtx();
  const t = ac.currentTime;
  tone(440, "sine", t, 0.12, 0.2, ac);
  tone(554, "sine", t + 0.1, 0.12, 0.15, ac);
  tone(659, "sine", t + 0.2, 0.18, 0.18, ac);
}

export function playChoiceSelect(): void {
  const ac = getCtx();
  const t = ac.currentTime;
  tone(330, "square", t, 0.04, 0.1, ac);
  tone(440, "square", t + 0.04, 0.06, 0.12, ac);
}

export function playSearingAdvance(): void {
  const ac = getCtx();
  const t = ac.currentTime;
  // Low, ominous rumble
  tone(80, "sawtooth", t, 0.3, 0.25, ac);
  tone(60, "sawtooth", t + 0.05, 0.35, 0.2, ac);
  noise(t, 0.25, 0.08, ac);
}

export function playForage(): void {
  const ac = getCtx();
  const t = ac.currentTime;
  tone(523, "sine", t, 0.1, 0.12, ac);
  tone(659, "sine", t + 0.08, 0.12, 0.1, ac);
}

export function playRest(): void {
  const ac = getCtx();
  const t = ac.currentTime;
  // Soft descending chord
  tone(330, "sine", t, 0.4, 0.1, ac);
  tone(277, "sine", t + 0.1, 0.4, 0.08, ac);
  tone(220, "sine", t + 0.2, 0.5, 0.07, ac);
}

export function playWin(): void {
  const ac = getCtx();
  const t = ac.currentTime;
  const freqs = [523, 659, 784, 1047];
  freqs.forEach((f, i) => tone(f, "sine", t + i * 0.12, 0.3, 0.2, ac));
}

export function playLoss(): void {
  const ac = getCtx();
  const t = ac.currentTime;
  tone(220, "sawtooth", t, 0.25, 0.2, ac);
  tone(185, "sawtooth", t + 0.2, 0.3, 0.18, ac);
  tone(147, "sawtooth", t + 0.4, 0.5, 0.22, ac);
}
