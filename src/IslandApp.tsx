import type { CSSProperties } from 'react'
import DynamicIsland from './widgets/DynamicIsland'

export default function IslandApp() {
  return (
    <div style={{
      width: '100%',
      padding: '4px',
      boxSizing: 'border-box',
      minHeight: '100vh',
      background: 'transparent',
    } as CSSProperties}>
      <DynamicIsland />
    </div>
  )
}
