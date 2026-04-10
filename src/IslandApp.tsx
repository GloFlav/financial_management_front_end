import type { CSSProperties } from 'react'
import DynamicIsland from './widgets/DynamicIsland'

const pulseStyle = `
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.4; transform: scale(0.75); }
}
`

export default function IslandApp() {
  return (
    <>
      <style>{pulseStyle}</style>
      <div style={{
        width: '100%',
        padding: '4px',
        boxSizing: 'border-box',
        minHeight: '100vh',
        background: 'transparent',
      } as CSSProperties}>
        <DynamicIsland />
      </div>
    </>
  )
}
