const FRAMES_BUFFERED = 40;
const FRAMES_DELAYED = 4;

let waveBuffer;
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
   * @param samplesPerFrame Samples in a single Screen frame
   */
  initSampleBuffer (samplesPerFrame) {
    // Buffer size for stereo: 2 values per sample (left + right)
    waveBuffer = new Float32Array(
      (Math.floor(samplesPerFrame) + 1) * FRAMES_BUFFERED * 2
    );
    writeIndex = 0;
    readIndex = 0;

    // Initialize with silence for both channels
    for (let i = 0; i < FRAMES_DELAYED * samplesPerFrame * 2; i++) {
      waveBuffer[writeIndex++] = 0.0;
    }
  }

  /**
   * Stores the samples to render
   * @param samples Interleaved stereo samples [L, R, L, R, ...]
   */
  storeSamples (samples) {
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
        const left = waveBuffer[readIndex++] || 0;
        const right = waveBuffer[readIndex++] || 0;
        if (readIndex >= waveBuffer.length) {
          readIndex = 0;
        }
        outputChannel[i] = (left + right) / 2;
      }
    } else {
      // Stereo output: de-interleave samples
      const leftChannel = output[0];
      const rightChannel = output[1];
      
      for (let i = 0; i < leftChannel.length; ++i) {
        leftChannel[i] = waveBuffer[readIndex++] || 0;
        rightChannel[i] = waveBuffer[readIndex++] || 0;
        if (readIndex >= waveBuffer.length) {
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
