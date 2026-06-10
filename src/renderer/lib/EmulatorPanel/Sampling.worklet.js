const FRAMES_BUFFERED = 6;
const FRAMES_DELAYED = 1;
const MAX_LAG_FRAMES = 3;

let waveBuffer;
let samplesPerFrameStereo = 0;
let writeIndex = 0;
let readIndex = 0;

class SamplingGenerator extends AudioWorkletProcessor {
  constructor() {
    super();
    this.port.onmessage = (event) => {
      if (event.data.initialize) {
        this.initSampleBuffer(event.data.initialize);
      } else if (event.data.samples) {
        this.storeSamples(event.data.samples);
      }
    };
  }

  initSampleBuffer(samplesPerFrame) {
    samplesPerFrameStereo = (Math.floor(samplesPerFrame) + 1) * 2;
    waveBuffer = new Float32Array(samplesPerFrameStereo * FRAMES_BUFFERED);
    writeIndex = 0;
    readIndex = 0;

    for (let i = 0; i < FRAMES_DELAYED * samplesPerFrameStereo; i++) {
      waveBuffer[writeIndex++] = 0.0;
    }
  }

  bufferedPairs() {
    const len = waveBuffer ? waveBuffer.length : 0;
    if (len === 0) {
      return 0;
    }
    return ((writeIndex - readIndex + len) % len) >> 1;
  }

  storeSamples(samples) {
    if (!waveBuffer) {
      return;
    }

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

  process(_inputs, outputs) {
    const output = outputs[0];
    const channelCount = output.length;

    if (channelCount === 1) {
      const outputChannel = output[0];
      for (let i = 0; i < outputChannel.length; i++) {
        const left = waveBuffer ? waveBuffer[readIndex++] || 0 : 0;
        const right = waveBuffer ? waveBuffer[readIndex++] || 0 : 0;
        if (waveBuffer && readIndex >= waveBuffer.length) {
          readIndex = 0;
        }
        outputChannel[i] = (left + right) / 2;
      }
    } else {
      const leftChannel = output[0];
      const rightChannel = output[1];
      for (let i = 0; i < leftChannel.length; i++) {
        leftChannel[i] = waveBuffer ? waveBuffer[readIndex++] || 0 : 0;
        rightChannel[i] = waveBuffer ? waveBuffer[readIndex++] || 0 : 0;
        if (waveBuffer && readIndex >= waveBuffer.length) {
          readIndex = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor("sampling-generator", SamplingGenerator);
