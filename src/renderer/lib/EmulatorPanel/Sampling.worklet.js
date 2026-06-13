// Total ring buffer capacity in frames. Small enough to bound maximum latency.
const FRAMES_BUFFERED = 6;
// Pre-fill frames of silence to absorb scheduling jitter without gaps.
const FRAMES_DELAYED = 1;
// If the buffer fills beyond this many frames, skip ahead to stay in sync.
const MAX_LAG_FRAMES = 3;

let waveBuffer;
let samplesPerFrameStereo = 0; // stereo sample-pairs per frame
let writeIndex = 0;
let readIndex = 0;

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
   * @param samplesPerFrame Samples in a single screen frame
   */
  initSampleBuffer (samplesPerFrame) {
    // Buffer size for stereo: 2 values per sample (left + right)
    samplesPerFrameStereo = (Math.floor(samplesPerFrame) + 1) * 2;
    waveBuffer = new Float32Array(samplesPerFrameStereo * FRAMES_BUFFERED);
    writeIndex = 0;
    readIndex = 0;

    // Pre-fill one frame of silence so the reader never starves on the first callback
    for (let i = 0; i < FRAMES_DELAYED * samplesPerFrameStereo; i++) {
      waveBuffer[writeIndex++] = 0.0;
    }
  }

  /**
   * Returns the number of stereo sample-pairs currently queued.
   */
  bufferedPairs () {
    const len = waveBuffer ? waveBuffer.length : 0;
    if (len === 0) return 0;
    return ((writeIndex - readIndex + len) % len) >> 1; // divide by 2 for pairs
  }

  /**
   * Stores the samples to render, discarding oldest data if the buffer
   * has grown too large.
   * @param samples Interleaved stereo samples [L, R, L, R, ...]
   */
  storeSamples (samples) {
    if (!waveBuffer) return;

    // If we have accumulated more than MAX_LAG_FRAMES worth of audio,
    // skip the read pointer forward to drop the oldest data and
    // keep the output latency bounded.
    const maxPairs = MAX_LAG_FRAMES * (samplesPerFrameStereo >> 1);
    if (this.bufferedPairs() > maxPairs) {
      const skipStereoValues = (this.bufferedPairs() - maxPairs) * 2;
      readIndex = (readIndex + skipStereoValues) % waveBuffer.length;
    }

    for (const sample of samples) {
      waveBuffer[writeIndex++] = sample;
      if (writeIndex >= waveBuffer.length) {
        writeIndex = 0;
      }
    }
  }

  process (_inputs, outputs) {
    const output = outputs[0];
    const channelCount = output.length;

    if (channelCount === 1) {
      // Mono output: downmix stereo to mono
      const outputChannel = output[0];
      for (let i = 0; i < outputChannel.length; ++i) {
        const left = waveBuffer ? (waveBuffer[readIndex++] || 0) : 0;
        const right = waveBuffer ? (waveBuffer[readIndex++] || 0) : 0;
        if (waveBuffer && readIndex >= waveBuffer.length) {
          readIndex = 0;
        }
        outputChannel[i] = (left + right) / 2;
      }
    } else {
      // Stereo output: de-interleave samples
      const leftChannel = output[0];
      const rightChannel = output[1];
      
      for (let i = 0; i < leftChannel.length; ++i) {
        leftChannel[i] = waveBuffer ? (waveBuffer[readIndex++] || 0) : 0;
        rightChannel[i] = waveBuffer ? (waveBuffer[readIndex++] || 0) : 0;
        if (waveBuffer && readIndex >= waveBuffer.length) {
          readIndex = 0;
        }
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
