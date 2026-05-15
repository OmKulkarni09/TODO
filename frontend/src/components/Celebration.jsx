import { useEffect, useMemo } from 'react'
import { Sparkles, Skull } from 'lucide-react'

const COLORS = [
  '#b8ff3a',
  '#caff5e',
  '#88e300',
  '#ff2d6d',
  '#7c3aed',
  '#06b6d4',
  '#f59e0b',
  '#ffffff',
]

const SHAPES = ['square', 'circle', 'triangle', 'streamer']

const PHRASES = [
  'Congrats!',
  'Hunt closed.',
  'Devoured.',
  'Got it!',
  'Crushed it.',
  'Nailed it.',
]

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function makeParticles(n = 80) {
  return Array.from({ length: n }, (_, i) => {
    const shape = randomPick(SHAPES)
    return {
      id: i,
      color: randomPick(COLORS),
      shape,
      left: Math.random() * 100,
      size:
        shape === 'streamer'
          ? 4 + Math.random() * 3
          : 7 + Math.random() * 9,
      lengthFactor: shape === 'streamer' ? 2.5 + Math.random() * 2.5 : 1,
      delay: Math.random() * 0.35,
      duration: 2.2 + Math.random() * 1.6,
      drift: -120 + Math.random() * 240, // px
    }
  })
}

function Particle({ p }) {
  const isStreamer = p.shape === 'streamer'
  return (
    <span
      className="absolute top-0 animate-fall will-change-transform"
      style={{
        left: `${p.left}%`,
        width: `${p.size}px`,
        height: `${isStreamer ? p.size * p.lengthFactor : p.size}px`,
        background:
          p.shape === 'triangle' ? 'transparent' : p.color,
        borderRadius:
          p.shape === 'circle'
            ? '50%'
            : p.shape === 'streamer'
            ? '2px'
            : '2px',
        clipPath:
          p.shape === 'triangle'
            ? 'polygon(50% 0%, 0% 100%, 100% 100%)'
            : undefined,
        borderColor: p.color,
        ['--drift']: `${p.drift}px`,
        ['--fall-dur']: `${p.duration}s`,
        animationDelay: `${p.delay}s`,
        boxShadow: isStreamer
          ? `0 0 6px ${p.color}88`
          : `0 0 8px ${p.color}55`,
      }}
    >
      {p.shape === 'triangle' && (
        <span
          className="block h-full w-full"
          style={{
            background: p.color,
            clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
          }}
        />
      )}
    </span>
  )
}

export default function Celebration({ onDone }) {
  const particles = useMemo(() => makeParticles(80), [])
  const phrase = useMemo(() => randomPick(PHRASES), [])

  useEffect(() => {
    const t = setTimeout(() => onDone?.(), 2700)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[100] overflow-hidden"
      aria-hidden="true"
    >
      {/* Radial green burst from center */}
      <div className="absolute inset-0 grid place-items-center">
        <div
          className="h-40 w-40 rounded-full animate-burst"
          style={{
            background:
              'radial-gradient(circle, rgba(184,255,58,0.55), rgba(184,255,58,0.0) 70%)',
          }}
        />
      </div>

      {/* Confetti rain */}
      {particles.map((p) => (
        <Particle key={p.id} p={p} />
      ))}

      {/* Center text card */}
      <div className="absolute inset-0 grid place-items-center">
        <div className="animate-celebrate text-center">
          <div className="mb-3 flex items-center justify-center gap-2">
            <Sparkles
              size={22}
              className="text-venom-300 animate-sparkle"
              style={{ animationDelay: '0.1s' }}
            />
            <Skull
              size={26}
              className="text-venom-200 drop-shadow-[0_0_12px_rgba(184,255,58,0.7)]"
            />
            <Sparkles
              size={22}
              className="text-venom-300 animate-sparkle"
              style={{ animationDelay: '0.3s' }}
            />
          </div>
          <div className="text-6xl md:text-7xl font-black italic tracking-tight leading-none">
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  'linear-gradient(135deg, #caff5e 0%, #b8ff3a 45%, #88e300 100%)',
                filter:
                  'drop-shadow(0 0 22px rgba(184,255,58,0.55)) drop-shadow(0 0 60px rgba(184,255,58,0.35))',
              }}
            >
              {phrase}
            </span>
          </div>
          <div className="mt-3 text-xs font-bold uppercase tracking-[0.32em] text-venom-300/90">
            One more for the trophies
          </div>
        </div>
      </div>
    </div>
  )
}
