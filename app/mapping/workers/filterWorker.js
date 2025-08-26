self.onmessage = (e) => {
  const msg = e.data || {};
  if (msg.type === 'frame') {
    const samples = msg.samples || [];
    const filtered = samples; // TODO: implement IIR BPF + notch; stub passthrough for now
    const artifact = { blink: false, emg: false, clip: false };
    self.postMessage({ type:'frame', filtered, artifact });
  }
};


