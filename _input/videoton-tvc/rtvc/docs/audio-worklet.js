class RtvcAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.queue = [];
    this.queueOffset = 0;
    this.buffered = 0;
    this.maxBuffered = sampleRate;
    this.port.onmessage = (event) => this.enqueue(event.data);
  }

  enqueue(samples) {
    if (!(samples instanceof Float32Array) || samples.length === 0) {
      return;
    }
    this.queue.push(samples);
    this.buffered += samples.length;
    while (this.buffered > this.maxBuffered && this.queue.length > 0) {
      const head = this.queue.shift();
      this.buffered -= head.length - this.queueOffset;
      this.queueOffset = 0;
    }
  }

  nextSample() {
    while (this.queue.length > 0) {
      const head = this.queue[0];
      if (this.queueOffset < head.length) {
        const sample = head[this.queueOffset++];
        this.buffered--;
        return sample;
      }
      this.queue.shift();
      this.queueOffset = 0;
    }
    return 0;
  }

  process(_inputs, outputs) {
    const output = outputs[0][0];
    for (let i = 0; i < output.length; i++) {
      output[i] = this.nextSample();
    }
    return true;
  }
}

registerProcessor("rtvc-audio", RtvcAudioProcessor);
