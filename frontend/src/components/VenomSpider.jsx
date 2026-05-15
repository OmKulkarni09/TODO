export function VenomSpider({ size = 28, className = '', glow = false }) {
  return (
    <img
      src="/brand/venom-bg.jpg"
      alt="Venom"
      width={size}
      height={size}
      draggable={false}
      className={`select-none rounded-full ${glow ? 'animate-pulse-venom' : ''} ${className}`}
      style={
        glow
          ? { filter: 'drop-shadow(0 0 8px rgba(184,255,58,0.55))' }
          : undefined
      }
    />
  )
}

export function VenomFace({ width = 220, className = '' }) {
  return (
    <img
      src="/brand/venom-face.png"
      alt="Venom"
      width={width}
      draggable={false}
      className={`select-none ${className}`}
    />
  )
}

export function VenomWordmark({ height = 28, className = '' }) {
  return (
    <img
      src="/brand/venom-wordmark.png"
      alt="venom"
      style={{ height }}
      draggable={false}
      className={`select-none ${className}`}
    />
  )
}
