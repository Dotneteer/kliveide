import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/*
 * The audio worklet is plain JavaScript that runs in the AudioWorkletGlobalScope, so it cannot be
 * imported. Evaluate the real source against a stub scope instead: each call gets fresh module
 * state, as a freshly created AudioContext would.
 */
const WORKLET_SOURCE = readFileSync(
  resolve(__dirname, "../../src/renderer/features/emulator/Sampling.worklet.js"),
  "utf8"
);

/** Samples per frame at 44.1 kHz / 50 Hz, as `useEmulatorAudio` computes it */
const SAMPLES_PER_FRAME = 882;
/** The Web Audio render quantum */
const QUANTUM = 128;

type Worklet = {
  post: (data: unknown) => void;
  /** Runs one render quantum and returns the left channel */
  render: () => Float32Array;
};

function loadWorklet(): Worklet {
  let Processor: any;
  class AudioWorkletProcessor {
    port: { onmessage?: (event: { data: unknown }) => void } = {};
  }
  const registerProcessor = (_name: string, ctor: any) => {
    Processor = ctor;
  };
  new Function("AudioWorkletProcessor", "registerProcessor", WORKLET_SOURCE)(
    AudioWorkletProcessor,
    registerProcessor
  );
  const node = new Processor();
  return {
    post: (data) => node.port.onmessage({ data }),
    render: () => {
      const left = new Float32Array(QUANTUM);
      const right = new Float32Array(QUANTUM);
      node.process([], [[left, right]]);
      return left;
    }
  };
}

/** One frame of interleaved stereo samples, every value `level` */
function frame(level: number): number[] {
  return new Array(SAMPLES_PER_FRAME * 2).fill(level);
}

/** Renders `quanta` quanta and returns every left-channel value */
function renderQuanta(worklet: Worklet, quanta: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < quanta; i++) out.push(...worklet.render());
  return out;
}

const framesToQuanta = (frames: number) => Math.ceil((frames * SAMPLES_PER_FRAME) / QUANTUM);

describe("Sampling.worklet", () => {
  it("starts playing once a frame is queued", () => {
    const worklet = loadWorklet();
    worklet.post({ initialize: SAMPLES_PER_FRAME });
    worklet.post({ samples: frame(0.5) });

    const out = renderQuanta(worklet, framesToQuanta(2));
    expect(out.some((v) => v === 0.5)).toBe(true);
  });

  it("starts playing on a frame a sample short of the rounded-up frame size", () => {
    // --- 44.1 kHz does not divide evenly into frames: a delivered frame can be 881 samples
    const worklet = loadWorklet();
    worklet.post({ initialize: SAMPLES_PER_FRAME + 0.5 });
    worklet.post({ samples: frame(0.5).slice(2) });

    const out = renderQuanta(worklet, framesToQuanta(2));
    expect(out.filter((v) => v === 0.5).length).toBe(SAMPLES_PER_FRAME - 1);
  });

  it("never replays samples it has already played when the machine delivers late", () => {
    // --- A key-click, then the machine stalls (the debugger's per-instruction loop, an SD round
    // --- trip). The reader must run dry and fade out, not wrap around and play the click again.
    const worklet = loadWorklet();
    worklet.post({ initialize: SAMPLES_PER_FRAME });
    worklet.post({ samples: frame(0.5) });

    // --- Play the click out, then keep the output running for ten frames with nothing new
    const played = renderQuanta(worklet, framesToQuanta(2));
    const clickValues = played.filter((v) => v === 0.5).length;
    expect(clickValues).toBe(SAMPLES_PER_FRAME);

    const starved = renderQuanta(worklet, framesToQuanta(10));
    expect(starved.filter((v) => v === 0.5).length).toBe(0);
  });

  it("does not jump back over played audio when a late frame finally arrives", () => {
    const worklet = loadWorklet();
    worklet.post({ initialize: SAMPLES_PER_FRAME });
    worklet.post({ samples: frame(0.5) });
    renderQuanta(worklet, framesToQuanta(4));

    // --- The machine catches up with silent frames: nothing from the click may come back
    worklet.post({ samples: frame(0) });
    worklet.post({ samples: frame(0) });
    const after = renderQuanta(worklet, framesToQuanta(6));
    expect(after.filter((v) => v === 0.5).length).toBe(0);
  });

  it("keeps latency bounded when the machine delivers faster than real time", () => {
    const worklet = loadWorklet();
    worklet.post({ initialize: SAMPLES_PER_FRAME });
    for (let i = 0; i < 10; i++) worklet.post({ samples: frame(i === 9 ? 0.25 : 0.5) });

    // --- The newest frame must be audible within the lag bound (3 frames plus a quantum)
    const out = renderQuanta(worklet, framesToQuanta(4));
    expect(out.some((v) => v === 0.25)).toBe(true);
  });
});

/*
 * A Cambridge Z88 runs eight 5 ms frames back to back, then its controller sleeps 40 ms: the
 * worklet gets eight small frames at once, then nothing for 40 ms. `useEmulatorAudio` sizes the
 * worklet in these bursts (issue #1374). Played against a clock - a burst due every 40 ms of
 * output - nothing may be dropped and, once the first burst is queued, the output must never run dry.
 */
describe("Sampling.worklet - a machine that delivers in bursts (Cambridge Z88)", () => {
  const RATE = 44_100;
  /** 16384 tacts at 3.2768 MHz: 5 ms */
  const Z88_FRAME = (16_384 * RATE) / 3_276_800;
  const FRAMES_PER_BURST = 8;

  /** Plays `bursts` bursts on schedule and returns every left-channel value from the first on */
  function playBursts(initialize: number, bursts: number): number[] {
    const worklet = loadWorklet();
    worklet.post({ initialize });
    const out: number[] = [];
    let produced = 0; // --- fractional sample schedule, as the core keeps it
    let played = 0;
    for (let burst = 0; burst < bursts; burst++) {
      // --- The burst is due at this point of the output clock; render until then
      const due = burst * FRAMES_PER_BURST * Z88_FRAME;
      while (played + QUANTUM <= due) {
        out.push(...worklet.render());
        played += QUANTUM;
      }
      for (let frame = 0; frame < FRAMES_PER_BURST; frame++) {
        const count = Math.floor(produced + Z88_FRAME) - Math.floor(produced);
        produced += Z88_FRAME;
        worklet.post({ samples: new Array(count * 2).fill(0.5) });
      }
    }
    return out;
  }

  it("plays every sample of every burst, with no gaps", () => {
    const bursts = 25; // --- one second
    const out = playBursts(Z88_FRAME * FRAMES_PER_BURST, bursts);
    const firstSound = out.indexOf(0.5);
    expect(firstSound).toBeGreaterThanOrEqual(0);
    const afterStart = out.slice(firstSound);
    // --- Everything up to the last burst's arrival is sound: not one dry sample in between
    const lastDue = (bursts - 1) * FRAMES_PER_BURST * Z88_FRAME;
    const gaps = afterStart.slice(0, Math.floor(lastDue) - firstSound).filter((v) => v !== 0.5);
    expect(gaps.length).toBe(0);
  });

  it("chopped the sound when sized in machine frames (the bug this guards)", () => {
    const out = playBursts(Z88_FRAME, 25);
    const firstSound = out.indexOf(0.5);
    const silent = out.slice(firstSound).filter((v) => v !== 0.5).length;
    // --- Over half of the second after the first sound was silence
    expect(silent).toBeGreaterThan(out.length / 2);
  });
});
