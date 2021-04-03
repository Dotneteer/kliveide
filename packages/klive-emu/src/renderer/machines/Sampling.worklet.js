const FRAMES_BUFFERED = 400;
const FRAMES_DELAYED = 8;

let waveBuffer;
let writeIndex = 0;
let readIndex = 0;
let writeCount = 0;
let readCount = 0;

class SamplingGenerator extends AudioWorkletProcessor {
  constructor() {
    super();
    this.port.onmessage = (event) => {
      if (event.data.initialize) {
        this.initSampleBuffer(event.data.initialize);
      } 
      else if (event.data.samples) {
        this.storeSamples(event.data.samples)
      }
    };
  }

  /**
   * Initializes sample buffer
   * @param samplesPerFrame Samples in a single Screen frame
   */
  initSampleBuffer(samplesPerFrame) {
    waveBuffer = new Float32Array(
      (Math.floor(samplesPerFrame) + 1) * FRAMES_BUFFERED
    );
    writeIndex = 0;
    readIndex = 0;
    for (let i = 0; i < FRAMES_DELAYED * samplesPerFrame; i++) {
      waveBuffer[writeIndex++] = 0.0;
      writeCount++;
    }
  }

  /**
   * Stores the samples to render
   * @param samples Next batch of samples to store
   */
  storeSamples(samples) {
    for (const sample of samples) {
      waveBuffer[writeIndex++] = sample;
      writeCount++;
      if (writeIndex >= waveBuffer.length) {
        writeIndex = 0;
      }
    }
  }

  process(_inputs, outputs) {
    const output = outputs[0];

    for (let channel = 0; channel < output.length; ++channel) {
      const outputChannel = output[channel];
      for (let i = 0; i < outputChannel.length; ++i) {
        // This loop can branch out based on AudioParam array length, but
        // here we took a simple approach for the demonstration purpose.
        outputChannel[i] = waveBuffer[readIndex++];
        readCount++;
        if (readIndex >= waveBuffer.length) {
          readIndex = 0;
        }
      }
    }
    this.port.postMessage({diff: writeCount - readCount});
    return true;
  }
}

registerProcessor("sampling-generator", SamplingGenerator);
