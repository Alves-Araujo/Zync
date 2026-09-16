/**
 * Continuous noise generator running on the audio thread.
 *
 * Looping a recorded buffer always leaves a seam you can hear every few
 * seconds; this synthesises every sample on the fly, so the sound never
 * repeats and never clicks.
 */
class NoiseProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.color = (options && options.processorOptions && options.processorOptions.color) || 'white';
    this.state = [];
  }

  channelState(ch) {
    if (!this.state[ch]) {
      this.state[ch] = { b0: 0, b1: 0, b2: 0, b3: 0, b4: 0, b5: 0, b6: 0, last: 0 };
    }
    return this.state[ch];
  }

  process(_inputs, outputs) {
    const out = outputs[0];
    for (let ch = 0; ch < out.length; ch++) {
      const s = this.channelState(ch);
      const data = out[ch];
      for (let i = 0; i < data.length; i++) {
        const w = Math.random() * 2 - 1;
        if (this.color === 'white') {
          data[i] = w * 0.5;
        } else if (this.color === 'pink') {
          // Paul Kellet's refined pink-noise filter
          s.b0 = 0.99886 * s.b0 + w * 0.0555179;
          s.b1 = 0.99332 * s.b1 + w * 0.0750759;
          s.b2 = 0.969 * s.b2 + w * 0.153852;
          s.b3 = 0.8665 * s.b3 + w * 0.3104856;
          s.b4 = 0.55 * s.b4 + w * 0.5329522;
          s.b5 = -0.7616 * s.b5 - w * 0.016898;
          data[i] = (s.b0 + s.b1 + s.b2 + s.b3 + s.b4 + s.b5 + s.b6 + w * 0.5362) * 0.11;
          s.b6 = w * 0.115926;
        } else {
          s.last = (s.last + 0.02 * w) / 1.02;
          data[i] = s.last * 3.5;
        }
      }
    }
    return true;
  }
}

registerProcessor('zync-noise', NoiseProcessor);
