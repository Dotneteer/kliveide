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
