// Custom AudioContext synthesizer for police/emergency siren sound

let audioCtx: AudioContext | null = null;
let osc1: OscillatorNode | null = null;
let osc2: OscillatorNode | null = null;
let modulator: OscillatorNode | null = null;
let gainNode: GainNode | null = null;
let isPlaying = false;

export const startSiren = () => {
  if (isPlaying) return;

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
    
    gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime); // Safe volume level

    // Oscillators
    osc1 = audioCtx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(800, audioCtx.currentTime);

    osc2 = audioCtx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(600, audioCtx.currentTime);

    // Modulator for siren yelp sound
    modulator = audioCtx.createOscillator();
    modulator.type = 'sine';
    modulator.frequency.setValueAtTime(2, audioCtx.currentTime); // 2Hz frequency variation

    const modulationGain = audioCtx.createGain();
    modulationGain.gain.setValueAtTime(300, audioCtx.currentTime); // Sweep amplitude

    // Connections
    modulator.connect(modulationGain);
    modulationGain.connect(osc1.frequency);
    modulationGain.connect(osc2.frequency);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    // Start playback
    modulator.start();
    osc1.start();
    osc2.start();
    isPlaying = true;
  } catch (err) {
    console.error('Failed to initialize AudioContext siren:', err);
  }
};

export const stopSiren = () => {
  if (!isPlaying) return;

  try {
    if (osc1) { osc1.stop(); osc1.disconnect(); }
    if (osc2) { osc2.stop(); osc2.disconnect(); }
    if (modulator) { modulator.stop(); modulator.disconnect(); }
    if (gainNode) { gainNode.disconnect(); }
    if (audioCtx && audioCtx.state !== 'closed') {
      audioCtx.close();
    }
  } catch (err) {
    console.error('Error stopping AudioContext siren:', err);
  } finally {
    osc1 = null;
    osc2 = null;
    modulator = null;
    gainNode = null;
    audioCtx = null;
    isPlaying = false;
  }
};
