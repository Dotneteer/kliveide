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
    waveBuffer = new Float32Array(
      (Math.floor(samplesPerFrame) + 1) * FRAMES_BUFFERED
    );
    writeIndex = 0;
    readIndex = 0;

    for (let i = 0; i < FRAMES_DELAYED * samplesPerFrame; i++) {
      waveBuffer[writeIndex++] = 0.0;
    }
  }

  /**
   * Stores the samples to render
   * @param samples Next batch of samples to store
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

    for (let channel = 0; channel < output.length; ++channel) {
      const outputChannel = output[channel];
      for (let i = 0; i < outputChannel.length; ++i) {
        outputChannel[i] = waveBuffer[readIndex++];
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
