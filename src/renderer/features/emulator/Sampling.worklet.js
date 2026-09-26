/*
 * A "frame" here is one *burst*: the samples the machine delivers between two sleeps of its
 * controller. That is one machine frame on most machines, but a Cambridge Z88 runs eight 5 ms frames
 * back to back and then sleeps 40 ms, so its samples arrive eight frames at a time.
 * `useEmulatorAudio` passes the burst size. Sized in machine frames, the lag bound below dropped
 * over half of every Z88 burst and the rest played as short blips between silences (issue #1374).
 */
// Total ring buffer capacity in bursts. Small enough to bound maximum latency.
const FRAMES_BUFFERED = 6;
// Bursts to hold back before playing (at start and after running dry) to absorb scheduling jitter.
const FRAMES_DELAYED = 1;
// If the buffer fills beyond this many bursts, skip ahead to stay in sync.
const MAX_LAG_FRAMES = 3;
// Per-sample decay of the held value while dry: fades any DC level out over a few milliseconds
// instead of cutting it to zero, which would click.
const DRY_DECAY = 0.995;

let waveBuffer;
let samplesPerFrameStereo = 0; // interleaved values (L, R) per frame, rounded up by one sample
// Queued values that end priming: FRAMES_DELAYED frames, less a little slack, because a frame's
// sample count is fractional and a delivered frame can be a sample or two short of the rounded-up size
let primeValues = 0;
let writeIndex = 0;
let readIndex = 0;
// Interleaved values written but not yet played. Kept explicitly: when `writeIndex === readIndex`
// the indices alone cannot tell an empty ring from a full one.
let available = 0;
// True until FRAMES_DELAYED frames are queued again after the start or after running dry
let priming = true;
// The last value played on each channel, faded out while there is nothing to play
let lastLeft = 0;
let lastRight = 0;

/*
 * The reader must never overtake the writer. The machine delivers a frame of samples only when it
 * completes one, and it falls behind real time whenever the debugger runs it an instruction at a time
 * or it waits on an SD-card round trip. Reading on regardless wraps the reader around the ring into
 * samples it has already played - which is how, after `.nexload` was typed in a debug session, the
 * key clicks kept coming back as echoes. Running dry fades the last value out instead (silence, with
 * no click), and waits for a frame's worth of samples before playing again.
 */
class SamplingGenerator extends AudioWorkletProcessor {
  constructor () {
    super();
    this.port.onmessage = event => {
      if (event.data.initialize) {
        this.initSampleBuffer(event.data.initialize);
      } else if (event.data.samples) {
        this.storeSamples(event.data.samples);
      }
    };
  }

  /**
   * Initializes sample buffer
   * @param samplesPerFrame Samples in a single burst (see the header comment); may be fractional
   */
  initSampleBuffer (samplesPerFrame) {
    // Buffer size for stereo: 2 values per sample (left + right)
    samplesPerFrameStereo = (Math.floor(samplesPerFrame) + 1) * 2;
    waveBuffer = new Float32Array(samplesPerFrameStereo * FRAMES_BUFFERED);
    primeValues = FRAMES_DELAYED * (samplesPerFrameStereo - 8);
    writeIndex = 0;
    readIndex = 0;
    available = 0;
    priming = true;
    lastLeft = 0;
    lastRight = 0;
  }

  /**
   * Stores the samples to render, discarding the oldest data if the buffer has grown too large.
   * @param samples Interleaved stereo samples [L, R, L, R, ...]
   */
  storeSamples (samples) {
    if (!waveBuffer) return;
    const len = waveBuffer.length;

    // --- A batch larger than the ring can only keep its newest part
    let start = 0;
    if (samples.length > len) {
      start = (samples.length - len) & ~1;
    }
    for (let i = start; i < samples.length; i++) {
      waveBuffer[writeIndex++] = samples[i];
      if (writeIndex >= len) writeIndex = 0;
    }
    available += samples.length - start;

    // --- Keep the output latency bounded: drop the oldest queued audio beyond MAX_LAG_FRAMES
    const maxValues = MAX_LAG_FRAMES * samplesPerFrameStereo;
    if (available > maxValues) {
      readIndex = (readIndex + (available - maxValues)) % len;
      available = maxValues;
    }

    if (priming && available >= primeValues) {
      priming = false;
    }
  }

  /**
   * Takes the next stereo pair into `lastLeft`/`lastRight`, or fades them out when dry.
   */
  nextPair () {
    if (priming || available < 2) {
      // --- Ran dry: wait for a frame's worth before playing again, so a machine delivering
      // --- slightly slower than real time is heard with gaps rather than as a stutter
      priming = true;
      lastLeft *= DRY_DECAY;
      lastRight *= DRY_DECAY;
      return;
    }
    lastLeft = waveBuffer[readIndex++];
    lastRight = waveBuffer[readIndex++];
    if (readIndex >= waveBuffer.length) readIndex = 0;
    available -= 2;
  }

  process (_inputs, outputs) {
    const output = outputs[0];
    const channelCount = output.length;

    if (channelCount === 1) {
      // Mono output: downmix stereo to mono
      const outputChannel = output[0];
      for (let i = 0; i < outputChannel.length; ++i) {
        this.nextPair();
        outputChannel[i] = (lastLeft + lastRight) / 2;
      }
    } else {
      // Stereo output: de-interleave samples
      const leftChannel = output[0];
      const rightChannel = output[1];
      for (let i = 0; i < leftChannel.length; ++i) {
        this.nextPair();
        leftChannel[i] = lastLeft;
        rightChannel[i] = lastRight;
      }
    }
    return true;
  }
}

// --- Let's register the worklet (only once)
let registered = false;

if (!registered) {
  registered = true;
  registerProcessor("sampling-generator", SamplingGenerator);
}
