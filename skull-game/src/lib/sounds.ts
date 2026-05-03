let _ctx: AudioContext | null = null

function ctx(): AudioContext {
  if (!_ctx) _ctx = new AudioContext()
  if (_ctx.state === 'suspended') _ctx.resume()
  return _ctx
}

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = 'sine',
  gain = 0.25,
) {
  try {
    const c = ctx()
    const osc = c.createOscillator()
    const gainNode = c.createGain()
    osc.connect(gainNode)
    gainNode.connect(c.destination)
    osc.type = type
    osc.frequency.setValueAtTime(frequency, c.currentTime)
    gainNode.gain.setValueAtTime(gain, c.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration)
    osc.start(c.currentTime)
    osc.stop(c.currentTime + duration)
  } catch {
    // Silently ignore if AudioContext is unavailable
  }
}

export function playButtonPress() {
  playTone(600, 0.08, 'square', 0.12)
}

export function playFlowerFlip() {
  try {
    const c = ctx()
    const osc = c.createOscillator()
    const gainNode = c.createGain()
    osc.connect(gainNode)
    gainNode.connect(c.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, c.currentTime)
    osc.frequency.exponentialRampToValueAtTime(1320, c.currentTime + 0.15)
    gainNode.gain.setValueAtTime(0.2, c.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.4)
    osc.start(c.currentTime)
    osc.stop(c.currentTime + 0.4)
  } catch {
    // ignore
  }
}

export function playSkullFlip() {
  try {
    const c = ctx()
    // Low ominous thud
    const osc = c.createOscillator()
    const gainNode = c.createGain()
    osc.connect(gainNode)
    gainNode.connect(c.destination)
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(220, c.currentTime)
    osc.frequency.exponentialRampToValueAtTime(60, c.currentTime + 0.4)
    gainNode.gain.setValueAtTime(0.3, c.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.5)
    osc.start(c.currentTime)
    osc.stop(c.currentTime + 0.5)

    // Noise burst for impact
    const bufferSize = c.sampleRate * 0.1
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
    const noise = c.createBufferSource()
    noise.buffer = buffer
    const noiseGain = c.createGain()
    noise.connect(noiseGain)
    noiseGain.connect(c.destination)
    noiseGain.gain.setValueAtTime(0.15, c.currentTime)
    noiseGain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.1)
    noise.start(c.currentTime)
  } catch {
    // ignore
  }
}
