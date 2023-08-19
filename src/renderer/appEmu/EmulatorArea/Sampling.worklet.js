const FRAMES_BUFFERED = 40000;
const FRAMES_DELAYED = 1;

let waveBuffer;
let writeIndex = 0;
let readIndex = 0;
let avg = 0;
let storeCount = 0;
let lastProcess = 0;

class SamplingGenerator extends AudioWorkletProcessor {
  constructor () {
    super();
    this.port.onmessage = event => {
      if (event.data.initialize) {
        this.initSampleBuffer(event.data.initialize);
      } else if (event.data.samples) {
        this.storeSamples(event.data.samples);
        const diff = writeIndex - readIndex;
        storeCount++;
        avg = (avg * (storeCount - 1) + diff) / storeCount;
        console.log("wb", diff, Math.round(avg), lastProcess);
        lastProcess = 0;
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
    let processed = 0;

    for (let channel = 0; channel < output.length; ++channel) {
      const outputChannel = output[channel];
      processed += outputChannel.length;
      for (let i = 0; i < outputChannel.length; ++i) {
        outputChannel[i] = waveBuffer[readIndex++];
        if (readIndex >= waveBuffer.length) {
          readIndex = 0;
        }
      }
    }
    processed /= output.length;
    lastProcess += processed;
    return true;
  }
}

registerProcessor("sampling-generator", SamplingGenerator);
