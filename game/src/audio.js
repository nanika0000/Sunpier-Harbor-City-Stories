// Sound, synthesized with WebAudio — no audio files, so the game stays fully offline.
// A tiny engine hum follows the player's speed, a two-tone siren swells when the law is
// near, and everything else is a short blip: cash, pickup, punch, crash, alarm, success.
// The context is created lazily on the first user gesture, as browsers require; every
// call is a no-op until then, and in a headless screenshot nothing is heard at all.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenFlip = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return false;
    }
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineOsc.connect(engineFilter).connect(engineGain).connect(master);
    engineOsc.start();
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain).connect(master);
    sirenOsc.start();
    let high = false;
    sirenFlip = window.setInterval(() => {
      if (!ctx) return;
      high = !high;
      sirenOsc.frequency.setTargetAtTime(high ? 880 : 660, ctx.currentTime, 0.03);
    }, 380);
    return true;
  }

  function tone(freq, seconds, type = 'square', volume = 0.16, slideTo = null) {
    if (!ensure()) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + seconds);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds);
    osc.connect(gain).connect(master);
    osc.start();
    osc.stop(ctx.currentTime + seconds);
  }

  function noise(seconds, volume = 0.2) {
    if (!ensure()) return;
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain).connect(master);
    source.start();
  }

  return {
    unlock() { ensure(); },
    /** Continuous engine note: pass the car's speed, or null when on foot. */
    engine(speed) {
      if (!ctx) return;
      if (speed === null) {
        engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
        return;
      }
      engineOsc.frequency.setTargetAtTime(55 + Math.abs(speed) * 0.55, ctx.currentTime, 0.05);
      engineGain.gain.setTargetAtTime(0.05 + Math.min(0.05, Math.abs(speed) / 6000), ctx.currentTime, 0.08);
    },
    siren(on) {
      if (!ctx) return;
      sirenGain.gain.setTargetAtTime(on ? 0.028 : 0, ctx.currentTime, 0.2);
    },
    cash() { tone(880, 0.09, 'square', 0.12); setTimeout(() => tone(1320, 0.12, 'square', 0.12), 55); },
    pickup() { tone(620, 0.1, 'triangle', 0.18, 940); },
    punch() { noise(0.08, 0.22); tone(140, 0.08, 'sine', 0.2, 70); },
    crash() { noise(0.22, 0.3); tone(90, 0.2, 'sine', 0.22, 45); },
    alarm() { tone(1180, 0.12, 'square', 0.1); setTimeout(() => tone(1180, 0.12, 'square', 0.1), 170); },
    enter() { tone(330, 0.08, 'triangle', 0.14, 495); },
    complete() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.16), i * 95)); },
    fail() { tone(392, 0.2, 'triangle', 0.16, 311); setTimeout(() => tone(311, 0.3, 'triangle', 0.16, 233), 160); },
    busted() { [660, 660, 660].forEach((f, i) => setTimeout(() => tone(f, 0.14, 'square', 0.12), i * 150)); },
    dispose() { if (sirenFlip) window.clearInterval(sirenFlip); },
  };
}
