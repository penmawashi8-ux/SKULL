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

// Card place sound (soft thump)
export function playCardPlace() {
  try {
    const c = ctx()
    const bufferSize = Math.floor(c.sampleRate * 0.06)
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3))
    }
    const noise = c.createBufferSource()
    noise.buffer = buffer
    const gainNode = c.createGain()
    noise.connect(gainNode)
    gainNode.connect(c.destination)
    gainNode.gain.setValueAtTime(0.18, c.currentTime)
    noise.start(c.currentTime)
  } catch { /* ignore */ }
}

// Challenge success fanfare
export function playSuccess() {
  try {
    const c = ctx()
    const notes = [523, 659, 784, 1047]  // C E G C
    notes.forEach((freq, i) => {
      const osc = c.createOscillator()
      const g = c.createGain()
      osc.connect(g); g.connect(c.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, c.currentTime + i * 0.1)
      g.gain.setValueAtTime(0.0, c.currentTime + i * 0.1)
      g.gain.linearRampToValueAtTime(0.22, c.currentTime + i * 0.1 + 0.02)
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + i * 0.1 + 0.35)
      osc.start(c.currentTime + i * 0.1)
      osc.stop(c.currentTime + i * 0.1 + 0.35)
    })
  } catch { /* ignore */ }
}

// Challenge failure (skull hit)
export function playFailure() {
  try {
    const c = ctx()
    const osc = c.createOscillator()
    const g = c.createGain()
    osc.connect(g); g.connect(c.destination)
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(180, c.currentTime)
    osc.frequency.exponentialRampToValueAtTime(40, c.currentTime + 0.6)
    g.gain.setValueAtTime(0.35, c.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.7)
    osc.start(c.currentTime)
    osc.stop(c.currentTime + 0.7)
    // Second descending hit for emphasis
    setTimeout(() => {
      try {
        const osc2 = c.createOscillator()
        const g2 = c.createGain()
        osc2.connect(g2); g2.connect(c.destination)
        osc2.type = 'sawtooth'
        osc2.frequency.setValueAtTime(120, c.currentTime)
        osc2.frequency.exponentialRampToValueAtTime(30, c.currentTime + 0.5)
        g2.gain.setValueAtTime(0.25, c.currentTime)
        g2.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.5)
        osc2.start(c.currentTime)
        osc2.stop(c.currentTime + 0.5)
      } catch { /* ignore */ }
    }, 200)
  } catch { /* ignore */ }
}

export function playBombFlip() {
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
