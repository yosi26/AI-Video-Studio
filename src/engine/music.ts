// Procedural cinematic soundtrack built with the Web Audio API: a slow
// Am–F–C–G pad, a sub-bass drone, a soft heartbeat pulse and a riser at the end.

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12)

const CHORDS = [
  [57, 60, 64], // Am
  [53, 57, 60], // F
  [48, 55, 64], // C
  [55, 59, 62], // G
]

export interface MusicHandle {
  stop: () => void
}

/**
 * Schedule `duration` seconds of music into `dest`, starting now.
 * The same graph can feed speakers (preview) or a MediaStream (export).
 */
export function playSoundtrack(actx: AudioContext, dest: AudioNode, duration: number): MusicHandle {
  const t0 = actx.currentTime + 0.05
  const end = t0 + duration

  const master = actx.createGain()
  master.gain.setValueAtTime(0, t0)
  master.gain.linearRampToValueAtTime(0.5, t0 + 1.5)
  master.gain.setValueAtTime(0.5, Math.max(t0 + 1.5, end - 1.5))
  master.gain.linearRampToValueAtTime(0, end)
  master.connect(dest)

  const filter = actx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(700, t0)
  filter.frequency.linearRampToValueAtTime(2200, end)
  filter.Q.value = 0.7
  filter.connect(master)

  const nodes: AudioScheduledSourceNode[] = []
  const chordLen = Math.max(2, Math.min(4, duration / 4))

  for (let start = t0, i = 0; start < end; start += chordLen, i++) {
    const chord = CHORDS[i % CHORDS.length]
    const stop = Math.min(end, start + chordLen + 0.6)
    for (const note of chord) {
      for (const detune of [-7, 7]) {
        const osc = actx.createOscillator()
        osc.type = 'sawtooth'
        osc.frequency.value = midi(note)
        osc.detune.value = detune
        const g = actx.createGain()
        g.gain.setValueAtTime(0, start)
        g.gain.linearRampToValueAtTime(0.035, start + 0.8)
        g.gain.linearRampToValueAtTime(0, stop)
        osc.connect(g).connect(filter)
        osc.start(start)
        osc.stop(stop + 0.05)
        nodes.push(osc)
      }
    }
    // Sub bass on the chord root.
    const bass = actx.createOscillator()
    bass.type = 'sine'
    bass.frequency.value = midi(chord[0] - 24)
    const bg = actx.createGain()
    bg.gain.setValueAtTime(0, start)
    bg.gain.linearRampToValueAtTime(0.22, start + 0.4)
    bg.gain.linearRampToValueAtTime(0, stop)
    bass.connect(bg).connect(master)
    bass.start(start)
    bass.stop(stop + 0.05)
    nodes.push(bass)
  }

  // Heartbeat pulse every second.
  for (let b = t0 + 1; b < end - 1; b += 1) {
    for (const [off, vol] of [[0, 0.5], [0.22, 0.3]] as const) {
      const k = actx.createOscillator()
      k.type = 'sine'
      k.frequency.setValueAtTime(90, b + off)
      k.frequency.exponentialRampToValueAtTime(40, b + off + 0.18)
      const kg = actx.createGain()
      kg.gain.setValueAtTime(vol, b + off)
      kg.gain.exponentialRampToValueAtTime(0.001, b + off + 0.25)
      k.connect(kg).connect(master)
      k.start(b + off)
      k.stop(b + off + 0.3)
      nodes.push(k)
    }
  }

  // Noise riser over the last 3 seconds.
  if (duration > 4) {
    const len = 3
    const buf = actx.createBuffer(1, actx.sampleRate * len, actx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    const src = actx.createBufferSource()
    src.buffer = buf
    const bp = actx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(400, end - len)
    bp.frequency.exponentialRampToValueAtTime(6000, end - 0.2)
    const rg = actx.createGain()
    rg.gain.setValueAtTime(0, end - len)
    rg.gain.linearRampToValueAtTime(0.12, end - 0.3)
    rg.gain.linearRampToValueAtTime(0, end)
    src.connect(bp).connect(rg).connect(master)
    src.start(end - len)
    nodes.push(src)
  }

  return {
    stop() {
      for (const n of nodes) {
        try {
          n.stop()
        } catch {
          // already stopped
        }
      }
      master.disconnect()
    },
  }
}
