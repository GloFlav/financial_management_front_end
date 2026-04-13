import { useState } from 'react'
import { type Occupation } from '../occupations'

const FONT  = '-apple-system,BlinkMacSystemFont,"SF Pro Display",sans-serif'
const T1    = 'rgba(255,255,255,0.88)'
const T2    = 'rgba(255,255,255,0.55)'
const T3    = 'rgba(255,255,255,0.32)'
const BLUE  = '#6ee7b7'
const COLOR_OPTS = ['#60a5fa','#c084fc','#34d399','#fbbf24','#f87171','#fb923c','#a78bfa','#38bdf8']

export default function AgendaSettingsModal({ occupations, onUpdate, onClose }: {
  occupations: Occupation[]
  onUpdate: (occs: Occupation[]) => void
  onClose: () => void
}) {
  const [newName,  setNewName]  = useState('')
  const [newColor, setNewColor] = useState(COLOR_OPTS[0])

  const add = () => {
    if (!newName.trim()) return
    onUpdate([...occupations, { id: Date.now().toString(), name: newName.trim(), color: newColor }])
    setNewName('')
  }
  const remove = (id: string) => onUpdate(occupations.filter(o => o.id !== id))

  const inputStyle: React.CSSProperties = {
    flex:1, background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.14)',
    borderRadius:8, padding:'7px 10px', color:T1, fontSize:11, fontFamily:FONT, outline:'none',
  }

  return (
    <div
      onClick={onClose}
      style={{ position:'fixed', inset:0, zIndex:10000, background:'rgba(0,0,0,0.65)', display:'flex', alignItems:'center', justifyContent:'center' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background:'rgba(14,14,22,0.98)', backdropFilter:'blur(32px)', WebkitBackdropFilter:'blur(32px)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:16, width:320, fontFamily:FONT, boxShadow:'0 24px 64px rgba(0,0,0,0.8)', overflow:'hidden' } as React.CSSProperties}
      >
        {/* Header */}
        <div style={{ padding:'14px 16px 12px', borderBottom:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ fontSize:13, fontWeight:800, color:T1 }}>Paramètres Agenda</div>
          <button onClick={onClose} style={{ width:24, height:24, borderRadius:7, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.05)', color:T2, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, padding:0 }}>✕</button>
        </div>

        <div style={{ padding:'14px 16px 16px', display:'flex', flexDirection:'column', gap:14 }}>
          {/* Liste */}
          <div>
            <div style={{ fontSize:10, color:T3, fontWeight:700, letterSpacing:'0.3px', marginBottom:8 }}>TYPES D'OCCUPATION</div>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {occupations.map(o => (
                <div key={o.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', background:'rgba(255,255,255,0.05)', borderRadius:9 }}>
                  <div style={{ width:10, height:10, borderRadius:'50%', background:o.color, flexShrink:0 }}/>
                  <span style={{ flex:1, fontSize:12, color:T1, fontWeight:600 }}>{o.name}</span>
                  <button
                    onClick={() => remove(o.id)}
                    style={{ width:20, height:20, borderRadius:6, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.05)', color:'rgba(255,100,100,0.7)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, padding:0, flexShrink:0 }}
                  >✕</button>
                </div>
              ))}
              {occupations.length === 0 && (
                <div style={{ fontSize:11, color:T3, fontStyle:'italic', textAlign:'center', padding:'8px 0' }}>Aucun type défini</div>
              )}
            </div>
          </div>

          {/* Ajouter */}
          <div>
            <div style={{ fontSize:10, color:T3, fontWeight:700, letterSpacing:'0.3px', marginBottom:8 }}>AJOUTER</div>
            <div style={{ display:'flex', gap:6 }}>
              <input
                value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && add()}
                placeholder="Nom du type…"
                style={inputStyle}
                onFocus={e => { (e.currentTarget as HTMLInputElement).style.borderColor='rgba(110,231,183,0.4)' }}
                onBlur={e  => { (e.currentTarget as HTMLInputElement).style.borderColor='rgba(255,255,255,0.14)' }}
              />
              <button
                onClick={add}
                disabled={!newName.trim()}
                style={{ width:33, height:33, borderRadius:8, border:'none', flexShrink:0, background: newName.trim() ? 'rgba(110,231,183,0.15)' : 'rgba(255,255,255,0.05)', color: newName.trim() ? BLUE : T3, cursor: newName.trim() ? 'pointer' : 'default', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:300 }}
              >+</button>
            </div>
            <div style={{ display:'flex', gap:6, marginTop:8 }}>
              {COLOR_OPTS.map(c => (
                <button key={c} onClick={() => setNewColor(c)}
                  style={{ width:20, height:20, borderRadius:'50%', background:c, border: newColor===c ? '2px solid rgba(255,255,255,0.85)' : '2px solid transparent', cursor:'pointer', padding:0, transition:'border 0.12s', flexShrink:0 }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
