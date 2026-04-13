import { useState, useRef, useEffect, useCallback } from 'react'
import { type Occupation, loadOccupations, saveOccupations } from './occupations'
import AgendaSettingsModal from './widgets/AgendaSettingsModal'

const API   = import.meta.env.VITE_API_URL
const FONT  = '-apple-system,BlinkMacSystemFont,"SF Pro Display",sans-serif'

const DAYS_F  = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche']
const MONTHS  = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const HOUR_H  = 52
const SLOT_H  = HOUR_H / 12          // slot 5 min ≈ 4.33 px
const HOURS   = Array.from({ length: 15 }, (_, i) => i + 7)

// ── Palette dark — identique App.tsx ────────────────────────────────
const T1   = 'rgba(255,255,255,0.88)'
const T2   = 'rgba(255,255,255,0.55)'
const T3   = 'rgba(255,255,255,0.32)'
const BDR  = 'rgba(255,255,255,0.10)'
const BLUE = '#6ee7b7'   // accent vert comme App.tsx

// ── Couleurs événements ──────────────────────────────────────────────
const EV_COLORS = {
  blue:   '#60a5fa',
  purple: '#c084fc',
  green:  '#34d399',
  yellow: '#fbbf24',
  red:    '#f87171',
}

type AgendaMode = 'jour' | 'semaine' | 'mois'
type SlotInfo   = { dateStr: string; hour: number; min: number }

type CalEvent = {
  date: string; hour: number; duration: number
  title: string; color: string
  occupationId?: string
  location?: string; participants?: string[]
}

const MOCK: CalEvent[] = [
  { date:'2026-04-07', hour:9,  duration:1,   title:'Réunion hebdo',  color:EV_COLORS.blue,   occupationId:'rh-auto',      participants:['Flavien','Marie','Jo']           },
  { date:'2026-04-09', hour:14, duration:1.5, title:'Code review',    color:EV_COLORS.purple, occupationId:'rh-auto',      participants:['Flavien','Dev team']             },
  { date:'2026-04-12', hour:10, duration:1,   title:'Revue planning', color:EV_COLORS.green,  occupationId:'hello-soins',  location:'Salle A', participants:['Flavien']    },
  { date:'2026-04-12', hour:15, duration:0.5, title:'Stand-up async', color:EV_COLORS.blue,   occupationId:'rh-auto'                                                       },
  { date:'2026-04-14', hour:10, duration:1,   title:'Appel client',   color:EV_COLORS.yellow, occupationId:'hello-soins',  location:'En ligne', participants:['Client X']  },
  { date:'2026-04-16', hour:14, duration:2,   title:'Formation',      color:EV_COLORS.red,    occupationId:'enseignement', location:'Centre ville'                         },
  { date:'2026-04-20', hour:9,  duration:1,   title:'Sprint review',  color:EV_COLORS.blue,   occupationId:'rh-auto',      participants:["Toute l'équipe"]                 },
  { date:'2026-04-23', hour:15, duration:1.5, title:'Présentation',   color:EV_COLORS.purple, occupationId:'perso',        location:'Salle conf.', participants:['Direction'] },
  { date:'2026-04-28', hour:9,  duration:1,   title:'Planning mai',   color:EV_COLORS.green,  occupationId:'perso',        participants:['Flavien','Marie']                },
]

function toStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function fmtEnd(h: number, dur: number) {
  const t = h*60 + dur*60
  return `${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`
}
function periodLabel(d: Date, mode: AgendaMode): string {
  if (mode === 'jour') return `${DAYS_F[(d.getDay()+6)%7]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
  if (mode === 'semaine') {
    const dow = (d.getDay()+6)%7
    const mon = new Date(d); mon.setDate(d.getDate()-dow)
    const sun = new Date(mon); sun.setDate(mon.getDate()+6)
    return mon.getMonth() === sun.getMonth()
      ? `${mon.getDate()} – ${sun.getDate()} ${MONTHS[mon.getMonth()]} ${mon.getFullYear()}`
      : `${mon.getDate()} ${MONTHS[mon.getMonth()].slice(0,4)}. – ${sun.getDate()} ${MONTHS[sun.getMonth()].slice(0,4)}. ${sun.getFullYear()}`
  }
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

type ClickCb = (ev: CalEvent) => void

// ── Kiala Chat Panel ─────────────────────────────────────────────────
type KMsg = { role: 'user'|'assistant'; content: string; timestamp: number }

function KialaMsg({ msg }: { msg: KMsg }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{ display:'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div style={{
        maxWidth:'88%', fontFamily:FONT,
        background: isUser ? 'rgba(110,231,183,0.1)' : 'rgba(255,255,255,0.06)',
        border: `1px solid ${isUser ? 'rgba(110,231,183,0.2)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: isUser ? '12px 3px 12px 12px' : '3px 12px 12px 12px',
        padding:'8px 11px', fontSize:11.5, color:T1, lineHeight:1.65,
      }}>
        {msg.content}
      </div>
    </div>
  )
}

function TypingDots() {
  return (
    <div style={{ display:'flex', gap:4, padding:'9px 12px', background:'rgba(255,255,255,0.06)', borderRadius:'3px 12px 12px 12px', alignSelf:'flex-start' }}>
      {[0,1,2].map(i => (
        <div key={i} style={{ width:5, height:5, borderRadius:'50%', background:'rgba(255,255,255,0.4)', animation:`dotBounce 1.4s ${i*0.16}s ease-in-out infinite` }}/>
      ))}
    </div>
  )
}

const KIALA_WELCOME: KMsg = {
  role: 'assistant',
  content: "Bonjour ! Je suis Kiala, votre assistante agenda. Posez-moi n'importe quelle question sur votre planning.",
  timestamp: 0,
}

function KialaPanel({ onClose }: { onClose: () => void }) {
  const [msgs,    setMsgs]    = useState<KMsg[]>([KIALA_WELCOME])
  const [input,   setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const histRef   = useRef<{ role: string; content: string }[]>([])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return
    const userMsg: KMsg = { role: 'user', content: text, timestamp: Date.now() }
    setMsgs(p => [...p, userMsg])
    histRef.current = [...histRef.current, { role: 'user', content: text }]
    setLoading(true)
    setInput('')
    try {
      const r = await fetch(`${API}/finance/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: histRef.current.slice(-10) }),
      })
      if (!r.ok) throw new Error()
      const data = await r.json()
      const content: string = data.message ?? JSON.stringify(data)
      const aMsg: KMsg = { role: 'assistant', content, timestamp: Date.now() }
      setMsgs(p => [...p, aMsg])
      histRef.current = [...histRef.current, { role: 'assistant', content }]
    } catch {
      setMsgs(p => [...p, { role: 'assistant', content: 'Je suis indisponible pour le moment.', timestamp: Date.now() }])
    } finally { setLoading(false) }
  }, [loading])

  return (
    <div style={{ width:280, display:'flex', flexDirection:'column', borderLeft:`1px solid ${BDR}`, background:'rgba(255,255,255,0.04)', flexShrink:0, animation:'slideInRight 0.22s ease-out' } as React.CSSProperties}>
      {/* Header */}
      <div style={{ padding:'10px 12px', borderBottom:`1px solid ${BDR}`, background:'rgba(255,255,255,0.04)', display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
        <div style={{ width:32, height:32, borderRadius:'50%', background:'rgba(110,231,183,0.12)', border:'1px solid rgba(110,231,183,0.25)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:BLUE, flexShrink:0 }}>K</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:12, fontWeight:800, color:T1 }}>Kiala Saika Retera</div>
          <div style={{ fontSize:9, color:T3, marginTop:1 }}>assistante agenda</div>
        </div>
        <button
          onClick={onClose}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background='rgba(255,255,255,0.1)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background='rgba(255,255,255,0.05)' }}
          style={{ width:22, height:22, borderRadius:6, border:`1px solid ${BDR}`, background:'rgba(255,255,255,0.05)', color:T2, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:0, fontFamily:FONT, fontSize:13, lineHeight:1, flexShrink:0, transition:'background 0.15s' }}
        >✕</button>
      </div>
      {/* Messages */}
      <div style={{ flex:1, overflowY:'auto', padding:'12px 10px', display:'flex', flexDirection:'column', gap:8 }}>
        {msgs.map((m, i) => <KialaMsg key={i} msg={m}/>)}
        {loading && <TypingDots/>}
        <div ref={bottomRef}/>
      </div>
      {/* Input */}
      <div style={{ padding:'8px 10px 10px', borderTop:`1px solid ${BDR}`, background:'rgba(255,255,255,0.04)', display:'flex', gap:6, flexShrink:0 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
          placeholder="Message à Kiala…"
          style={{ flex:1, background:'rgba(255,255,255,0.07)', border:`1px solid ${BDR}`, borderRadius:8, padding:'7px 10px', color:T1, fontSize:11, fontFamily:FONT, outline:'none', minWidth:0 }}
          onFocus={e => { (e.currentTarget as HTMLInputElement).style.borderColor='rgba(110,231,183,0.4)' }}
          onBlur={e  => { (e.currentTarget as HTMLInputElement).style.borderColor=BDR }}
        />
        <button
          onClick={() => send(input)}
          disabled={loading || !input.trim()}
          style={{ width:33, height:33, borderRadius:8, border:'none', background: loading||!input.trim() ? 'rgba(255,255,255,0.05)' : 'rgba(110,231,183,0.15)', color: loading||!input.trim() ? T3 : BLUE, cursor: loading||!input.trim() ? 'default' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, border: `1px solid ${loading||!input.trim() ? BDR : 'rgba(110,231,183,0.3)'}` } as React.CSSProperties}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

// ── EventDetail (modal) ──────────────────────────────────────────────
function EventDetail({ event, onClose }: { event: CalEvent; onClose: () => void }) {
  const d     = new Date(event.date+'T00:00:00')
  const label = `${DAYS_F[(d.getDay()+6)%7]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'rgba(18,18,28,0.97)', backdropFilter:'blur(32px)', WebkitBackdropFilter:'blur(32px)', border:`1px solid ${BDR}`, borderRadius:16, overflow:'hidden', width:320, fontFamily:FONT, boxShadow:'0 24px 64px rgba(0,0,0,0.7)' } as React.CSSProperties}>
        <div style={{ height:4, background:event.color }}/>
        <div style={{ padding:'16px 20px 20px' }}>
          <div style={{ fontSize:17, fontWeight:800, color:T1, marginBottom:4 }}>{event.title}</div>
          <div style={{ fontSize:11, color:T3, marginBottom:16 }}>{label}</div>
          <Row icon={<ClockIcon c={event.color}/>} label={`${event.hour}:00 → ${fmtEnd(event.hour,event.duration)}`} sub={`${event.duration}h`}/>
          {event.location && <Row icon="📍" label={event.location}/>}
          {event.participants && (
            <div style={{ padding:'8px 12px', background:'rgba(255,255,255,0.05)', borderRadius:9, marginBottom:10 }}>
              <div style={{ fontSize:9, color:T3, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:6 }}>Participants</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                {event.participants.map((p,i) => <span key={i} style={{ fontSize:11, color:T2, background:'rgba(255,255,255,0.07)', border:`1px solid ${BDR}`, borderRadius:5, padding:'2px 8px' }}>{p}</span>)}
              </div>
            </div>
          )}
          <button onClick={onClose} style={{ width:'100%', padding:'9px 0', borderRadius:10, cursor:'pointer', background:'rgba(255,255,255,0.06)', border:`1px solid ${BDR}`, color:T2, fontSize:12, fontWeight:600, fontFamily:FONT }}>Fermer</button>
        </div>
      </div>
    </div>
  )
}
function Row({ icon, label, sub }: { icon: React.ReactNode; label: string; sub?: string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, padding:'8px 12px', background:'rgba(255,255,255,0.06)', borderRadius:9 }}>
      <span style={{ flexShrink:0 }}>{icon}</span>
      <div>
        <div style={{ fontSize:12, color:T1, fontWeight:600 }}>{label}</div>
        {sub && <div style={{ fontSize:10, color:T3, marginTop:1 }}>{sub}</div>}
      </div>
    </div>
  )
}
function ClockIcon({ c }: { c: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  )
}

// ── SlotGrid : colonne de jours avec slots 5 min ─────────────────────
function SlotGrid({
  dateStr, isToday, events, compact, onEventClick, onSlotClick,
}: {
  dateStr: string; isToday: boolean; events: CalEvent[]
  compact?: boolean; onEventClick: ClickCb; onSlotClick: (s: SlotInfo) => void
}) {
  const [hoverTop, setHoverTop] = useState<number|null>(null)

  const yToSlot = (el: HTMLDivElement, clientY: number) => {
    const y = clientY - el.getBoundingClientRect().top + el.scrollTop
    const idx = Math.floor(y / SLOT_H)
    const totalMin = idx * 5 + 7 * 60
    return { top: idx * SLOT_H, hour: Math.floor(totalMin / 60), min: totalMin % 60 }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const { top } = yToSlot(e.currentTarget, e.clientY)
    setHoverTop(top)
  }
  const handleMouseLeave = () => setHoverTop(null)

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-event]')) return
    const { hour, min } = yToSlot(e.currentTarget, e.clientY)
    if (hour < 7 || hour >= 22) return
    onSlotClick({ dateStr, hour, min })
  }

  return (
    <div
      style={{ flex:1, position:'relative', overflowY:'auto', cursor:'crosshair',
        background: isToday ? 'rgba(110,231,183,0.04)' : 'transparent' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {/* Lignes horaires */}
      {HOURS.map((_,hi) => (
        <div key={hi} style={{ height:HOUR_H, borderTop:'1px solid rgba(255,255,255,0.06)' }}/>
      ))}

      {/* Slot hover — invisible au repos, visible au survol */}
      {hoverTop !== null && (
        <div style={{
          position:'absolute', top:hoverTop, left:0, right:0, height:SLOT_H,
          background:'rgba(255,255,255,0.10)',
          borderTop:'1px solid rgba(255,255,255,0.18)',
          pointerEvents:'none', zIndex:1,
        }}/>
      )}

      {/* Événements */}
      {events.map((ev, i) => {
        const top    = (ev.hour - 7) * HOUR_H + (compact ? 2 : 3)
        const height = Math.max(ev.duration * HOUR_H - (compact ? 4 : 6), compact ? 20 : 28)
        return (
          <div key={i} data-event="1"
            onClick={e => { e.stopPropagation(); onEventClick(ev) }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background=ev.color+'38' }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background=ev.color+'22' }}
            style={{
              position:'absolute', zIndex:2,
              top, left: compact?2:8, right: compact?2:16, height,
              borderRadius: compact?5:8,
              background:ev.color+'22', border:`1px solid ${ev.color}50`,
              borderLeft:`${compact?3:4}px solid ${ev.color}`,
              padding: compact?'3px 5px':'6px 10px',
              cursor:'pointer', overflow:'hidden', transition:'background 0.1s',
            }}
          >
            <div style={{ fontSize: compact?10:13, fontWeight:700, color:'#fff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', lineHeight:1.3 }}>{ev.title}</div>
            {!compact && <div style={{ fontSize:10, color:'rgba(255,255,255,0.6)', marginTop:2 }}>{ev.hour}:00 → {fmtEnd(ev.hour,ev.duration)}</div>}
            {!compact && ev.location && height > 60 && <div style={{ fontSize:10, color:'rgba(255,255,255,0.5)', marginTop:2 }}>📍 {ev.location}</div>}
            {compact && height > 32 && <div style={{ fontSize:8, color:'rgba(255,255,255,0.55)', marginTop:1 }}>{ev.hour}:00</div>}
          </div>
        )
      })}
      {!compact && events.length === 0 && (
        <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', textAlign:'center' }}>
          <div style={{ fontSize:13, color:T3, fontStyle:'italic' }}>Aucun événement</div>
        </div>
      )}
    </div>
  )
}

// ── Day View ─────────────────────────────────────────────────────────
function DayViewExpanded({ date, todayStr, events, onEventClick, onSlotClick }: {
  date:Date; todayStr:string; events:CalEvent[]; onEventClick:ClickCb; onSlotClick:(s:SlotInfo)=>void
}) {
  const dateStr = toStr(date)
  const dayEvs  = events.filter(e => e.date === dateStr)
  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>
      <div style={{ width:56, flexShrink:0 }}>
        {HOURS.map(h => (
          <div key={h} style={{ height:HOUR_H, display:'flex', alignItems:'flex-start', justifyContent:'flex-end', paddingRight:10, paddingTop:5 }}>
            <span style={{ fontSize:10, color:T3, fontWeight:600 }}>{h}:00</span>
          </div>
        ))}
      </div>
      <div style={{ flex:1, borderLeft:`1px solid ${BDR}`, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <SlotGrid dateStr={dateStr} isToday={dateStr===todayStr} events={dayEvs}
          onEventClick={onEventClick} onSlotClick={onSlotClick}/>
      </div>
    </div>
  )
}

// ── Week View ─────────────────────────────────────────────────────────
function WeekViewExpanded({ date, todayStr, events, onEventClick, onSlotClick }: {
  date:Date; todayStr:string; events:CalEvent[]; onEventClick:ClickCb; onSlotClick:(s:SlotInfo)=>void
}) {
  const dow    = (date.getDay()+6)%7
  const monday = new Date(date); monday.setDate(date.getDate()-dow)
  const days   = Array.from({ length:7 }, (_,i) => { const d=new Date(monday); d.setDate(monday.getDate()+i); return d })
  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>
      <div style={{ width:56, flexShrink:0, paddingTop:40 }}>
        {HOURS.map(h => (
          <div key={h} style={{ height:HOUR_H, display:'flex', alignItems:'flex-start', justifyContent:'flex-end', paddingRight:10, paddingTop:5 }}>
            <span style={{ fontSize:10, color:T3, fontWeight:600 }}>{h}:00</span>
          </div>
        ))}
      </div>
      <div style={{ flex:1, display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3, overflow:'hidden' }}>
        {days.map((d, ci) => {
          const str     = toStr(d)
          const isToday = str === todayStr
          const dayEvs  = events.filter(e => e.date === str)
          return (
            <div key={ci} style={{ display:'flex', flexDirection:'column', minWidth:0 }}>
              <div style={{ height:40, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flexShrink:0, borderBottom:`1px solid ${BDR}` }}>
                <div style={{ fontSize:9, color:T3, fontWeight:700, letterSpacing:'0.5px' }}>{DAYS_F[ci].slice(0,3).toUpperCase()}</div>
                <div style={{ width:26, height:26, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight: isToday?700:400, background: isToday?BLUE:'transparent', color: isToday?'#fff':T1, marginTop:2 }}>
                  {d.getDate()}
                </div>
              </div>
              <SlotGrid dateStr={str} isToday={isToday} events={dayEvs} compact
                onEventClick={onEventClick} onSlotClick={onSlotClick}/>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── AddEventModal ─────────────────────────────────────────────────────
const EVENT_COLOR_OPTS = Object.entries(EV_COLORS) as [string, string][]
const DURATION_OPTS = [
  { label:'15 min', v:0.25 }, { label:'30 min', v:0.5 },
  { label:'1h',     v:1    }, { label:'2h',     v:2   },
]

function AddEventModal({ slot, occupations, onClose, onAdd }: {
  slot: SlotInfo; occupations: Occupation[]; onClose: ()=>void; onAdd: (ev: CalEvent)=>void
}) {
  const [title,      setTitle]    = useState('')
  const [duration,   setDuration] = useState(1)
  const [occId,      setOccId]    = useState(occupations[0]?.id ?? '')
  const occColor = occupations.find(o => o.id === occId)?.color ?? EV_COLORS.blue
  const color    = occColor

  const d      = new Date(slot.dateStr+'T00:00:00')
  const label  = `${DAYS_F[(d.getDay()+6)%7]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
  const timeStr= `${slot.hour}:${String(slot.min).padStart(2,'0')}`

  const submit = () => {
    if (!title.trim()) return
    onAdd({ date: slot.dateStr, hour: slot.hour + slot.min / 60, duration, title, color, occupationId: occId || undefined })
    onClose()
  }

  const inputStyle: React.CSSProperties = {
    width:'100%', boxSizing:'border-box', background:'rgba(255,255,255,0.07)',
    border:'1px solid rgba(255,255,255,0.14)', borderRadius:9, padding:'8px 11px',
    color:T1, fontSize:12, fontFamily:FONT, outline:'none',
  }

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:9998, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'rgba(18,18,28,0.97)', backdropFilter:'blur(32px)', WebkitBackdropFilter:'blur(32px)', border:`1px solid rgba(255,255,255,0.12)`, borderRadius:16, width:300, fontFamily:FONT, boxShadow:'0 24px 64px rgba(0,0,0,0.7)', overflow:'hidden' } as React.CSSProperties}>
        {/* Header */}
        <div style={{ padding:'14px 16px 12px', borderBottom:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:13, fontWeight:800, color:T1 }}>Nouvel événement</div>
            <div style={{ fontSize:10, color:T3, marginTop:2 }}>{label} · {timeStr}</div>
          </div>
          <button onClick={onClose} style={{ width:24, height:24, borderRadius:7, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.05)', color:T2, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>✕</button>
        </div>
        {/* Form */}
        <div style={{ padding:'14px 16px 16px', display:'flex', flexDirection:'column', gap:12 }}>
          {/* Titre */}
          <input
            autoFocus
            value={title} onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="Titre de l'événement"
            style={inputStyle}
            onFocus={e => { (e.currentTarget as HTMLInputElement).style.borderColor='rgba(110,231,183,0.4)' }}
            onBlur={e  => { (e.currentTarget as HTMLInputElement).style.borderColor='rgba(255,255,255,0.14)' }}
          />
          {/* Durée */}
          <div>
            <div style={{ fontSize:10, color:T3, marginBottom:6, fontWeight:600 }}>Durée</div>
            <div style={{ display:'flex', gap:6 }}>
              {DURATION_OPTS.map(o => (
                <button key={o.v} onClick={() => setDuration(o.v)}
                  style={{ flex:1, padding:'6px 0', borderRadius:8, border:`1px solid ${duration===o.v ? 'rgba(110,231,183,0.4)' : 'rgba(255,255,255,0.1)'}`, background: duration===o.v ? 'rgba(110,231,183,0.1)' : 'rgba(255,255,255,0.05)', color: duration===o.v ? BLUE : T2, fontSize:10, fontFamily:FONT, cursor:'pointer', fontWeight:600 }}
                >{o.label}</button>
              ))}
            </div>
          </div>
          {/* Type d'occupation */}
          {occupations.length > 0 && (
            <div>
              <div style={{ fontSize:10, color:T3, marginBottom:6, fontWeight:600 }}>Type d'occupation</div>
              <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                {occupations.map(o => (
                  <div
                    key={o.id}
                    onClick={() => setOccId(o.id)}
                    style={{
                      display:'flex', alignItems:'center', gap:8, padding:'6px 10px',
                      borderRadius:8, cursor:'pointer', transition:'background 0.1s',
                      background: occId===o.id ? `${o.color}18` : 'rgba(255,255,255,0.04)',
                      border: occId===o.id ? `1px solid ${o.color}50` : '1px solid transparent',
                    }}
                  >
                    <div style={{ width:9, height:9, borderRadius:'50%', background:o.color, flexShrink:0 }}/>
                    <span style={{ fontSize:11, color: occId===o.id ? T1 : T2, fontFamily:FONT, fontWeight: occId===o.id ? 700 : 400 }}>{o.name}</span>
                    {occId===o.id && <div style={{ marginLeft:'auto', fontSize:9, color:o.color }}>✓</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Submit */}
          <button
            onClick={submit}
            disabled={!title.trim()}
            style={{ padding:'9px 0', borderRadius:10, border:'none', background: title.trim() ? `rgba(110,231,183,0.18)` : 'rgba(255,255,255,0.05)', color: title.trim() ? BLUE : T3, fontSize:12, fontWeight:700, fontFamily:FONT, cursor: title.trim() ? 'pointer' : 'default', transition:'all 0.15s' }}
          >
            Ajouter l'événement
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Month View ────────────────────────────────────────────────────────
function MonthViewExpanded({ date, todayStr, onEventClick }: { date:Date; todayStr:string; onEventClick:ClickCb }) {
  const y       = date.getFullYear()
  const m       = date.getMonth()
  const offset  = (new Date(y,m,1).getDay()+6)%7
  const daysCnt = new Date(y,m+1,0).getDate()
  const cells: (number|null)[] = [...Array(offset).fill(null), ...Array.from({length:daysCnt},(_,i)=>i+1)]
  while (cells.length%7 !== 0) cells.push(null)
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3, marginBottom:4, flexShrink:0 }}>
        {DAYS_F.map((d,i) => (
          <div key={i} style={{ textAlign:'center', fontSize:10, color:T3, fontWeight:700, padding:'4px 0', letterSpacing:'0.3px' }}>
            {d.slice(0,3).toUpperCase()}
          </div>
        ))}
      </div>
      <div style={{ flex:1, display:'grid', gridTemplateColumns:'repeat(7,1fr)', gridAutoRows:'1fr', gap:3, overflow:'hidden' }}>
        {cells.map((day, i) => {
          if (day === null) return <div key={i} style={{ background:'rgba(255,255,255,0.02)', borderRadius:8 }}/>
          const cs      = `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const isToday = cs === todayStr
          const evs     = MOCK.filter(e => e.date === cs)
          return (
            <div key={i} style={{ background: isToday?'rgba(110,231,183,0.08)':'rgba(255,255,255,0.04)', border: isToday?'1px solid rgba(110,231,183,0.3)':`1px solid ${BDR}`, borderRadius:8, padding:'6px 7px', overflow:'hidden', display:'flex', flexDirection:'column' }}>
              <div style={{ fontSize:12, fontWeight: isToday?700:400, color: isToday?BLUE:T1, marginBottom:5, flexShrink:0 }}>{day}</div>
              <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column', gap:2 }}>
                {evs.slice(0,3).map((ev,j) => (
                  <div key={j} onClick={() => onEventClick(ev)}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background=ev.color+'38' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background=ev.color+'22' }}
                    style={{ fontSize:9, fontWeight:700, color:'#fff', background:ev.color+'22', borderLeft:`2px solid ${ev.color}`, borderRadius:3, padding:'2px 5px', cursor:'pointer', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', transition:'background 0.1s' }}
                  >{ev.title}</div>
                ))}
                {evs.length > 3 && <div style={{ fontSize:8, color:T3, paddingLeft:4 }}>+{evs.length-3} autres</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}


// ── Occupation Dropdown ───────────────────────────────────────────────
function OccupationDropdown({ occupations, selected, onSelect, compact }: {
  occupations: Occupation[]; selected: string
  onSelect: (id: string) => void; compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = selected === 'tous' ? null : occupations.find(o => o.id === selected)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const dotSize = compact ? 7 : 8

  return (
    <div ref={ref} style={{ position:'relative', flexShrink:0 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display:'flex', alignItems:'center', gap:5,
          background: open ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.06)',
          border:`1px solid ${open ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.12)'}`,
          borderRadius:8, padding: compact ? '4px 7px' : '5px 9px',
          cursor:'pointer', color:T1, fontFamily:FONT,
          fontSize: compact ? 9 : 10, fontWeight:600, transition:'all 0.15s',
        }}
      >
        {current
          ? <div style={{ width:dotSize, height:dotSize, borderRadius:'50%', background:current.color, flexShrink:0 }}/>
          : <div style={{ width:dotSize, height:dotSize, borderRadius:'50%', background:'rgba(255,255,255,0.3)', flexShrink:0 }}/>
        }
        <span style={{ maxWidth: compact ? 70 : 90, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {current ? current.name : 'Tous'}
        </span>
        <svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity:0.5, flexShrink:0, transform: open ? 'rotate(180deg)' : 'none', transition:'transform 0.15s' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 5px)', left:0, zIndex:9999,
          background:'rgba(14,14,22,0.98)', border:'1px solid rgba(255,255,255,0.12)',
          borderRadius:10, overflow:'hidden', minWidth:150,
          boxShadow:'0 12px 40px rgba(0,0,0,0.7)',
          animation:'tooltipIn 0.12s ease',
        }}>
          {[{ id:'tous', name:'Tous', color:'rgba(255,255,255,0.3)' }, ...occupations].map(o => (
            <div
              key={o.id}
              onClick={() => { onSelect(o.id); setOpen(false) }}
              style={{
                display:'flex', alignItems:'center', gap:8, padding:'8px 12px',
                cursor:'pointer', fontFamily:FONT, fontSize:11, color:T1, fontWeight: selected===o.id ? 700 : 400,
                background: selected===o.id ? 'rgba(255,255,255,0.07)' : 'transparent',
                transition:'background 0.1s',
              }}
              onMouseEnter={e => { if (selected!==o.id) (e.currentTarget as HTMLDivElement).style.background='rgba(255,255,255,0.04)' }}
              onMouseLeave={e => { if (selected!==o.id) (e.currentTarget as HTMLDivElement).style.background='transparent' }}
            >
              <div style={{ width:8, height:8, borderRadius:'50%', background:o.color, flexShrink:0 }}/>
              {o.name}
              {selected===o.id && <div style={{ marginLeft:'auto', fontSize:9, color:BLUE }}>✓</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// AgendaSettingsModal importé depuis widgets/AgendaSettingsModal.tsx

// ── Icônes ────────────────────────────────────────────────────────────
function ChevronIcon({ dir }: { dir: 'left'|'right' }) {
  return (
    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      {dir === 'left' ? <polyline points="15 18 9 12 15 6"/> : <polyline points="9 18 15 12 9 6"/>}
    </svg>
  )
}

// ── SchedulerExpanded ─────────────────────────────────────────────────
export default function SchedulerExpanded() {
  const today    = new Date()
  const todayStr = toStr(today)

  const [mode,        setMode]      = useState<AgendaMode>('semaine')
  const [viewDate,    setView]      = useState(today)
  const [selected,    setSel]       = useState<CalEvent|null>(null)
  const [showKiala,   setKiala]     = useState(false)
  const [events,      setEvents]    = useState<CalEvent[]>(MOCK)
  const [addSlot,     setAddSlot]   = useState<SlotInfo|null>(null)
  const [occupations, setOccupations] = useState<Occupation[]>(loadOccupations)
  const [filterOcc,   setFilterOcc]   = useState<string>('tous')
  const [showAgendaSettings, setAgendaSettings] = useState(false)

  const updateOccupations = (occs: Occupation[]) => {
    setOccupations(occs)
    saveOccupations(occs)
  }

  const filteredEvents = filterOcc === 'tous'
    ? events
    : events.filter(e => e.occupationId === filterOcc)

  // Même logique de navigation que avant
  const navigate = (dir: -1|1) => setView(prev => {
    const d = new Date(prev)
    if (mode==='jour')    d.setDate(d.getDate()+dir)
    if (mode==='semaine') d.setDate(d.getDate()+dir*7)
    if (mode==='mois')    d.setMonth(d.getMonth()+dir)
    return d
  })

  // Palette boutons — identique App.tsx (dark)
  const btnBase: React.CSSProperties = {
    display:'flex', alignItems:'center', justifyContent:'center',
    background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)',
    borderRadius:9, cursor:'pointer', transition:'all 0.15s ease',
  }

  return (
    <div style={{
      display:'flex', flexDirection:'column',
      padding:'10px 12px 0', height:'100vh', boxSizing:'border-box',
      position:'relative', background:'rgba(0,0,0,0.18)',
      fontFamily:FONT, color:T1, overflow:'hidden',
    }}>
      {/* Specular identique makeGlassWindow */}
      <div style={{ position:'absolute', inset:0, zIndex:0, pointerEvents:'none',
        background:'linear-gradient(to bottom, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.02) 28%, transparent 60%)',
      } as React.CSSProperties}/>

      {/* ── Ligne 1 : DragHandle (identique App.tsx) ── */}
      {/* paddingLeft:68 pour laisser la place aux traffic lights */}
      <div style={{ position:'relative', zIndex:1, paddingLeft:68, display:'flex', alignItems:'center', height:22, marginBottom:4, flexShrink:0 }}>
        {/* 5 dots — identique DragHandle App.tsx */}
        <div style={{ flex:1, display:'flex', justifyContent:'center', alignItems:'center', gap:3,
          WebkitAppRegion:'drag', cursor:'grab', userSelect:'none',
        } as React.CSSProperties}>
          {[0,1,2,3,4].map(i => (
            <div key={i} style={{ width:3, height:3, borderRadius:'50%', background:'rgba(255,255,255,0.22)' }}/>
          ))}
        </div>
        {/* Kiala toggle — identique bouton Chat dans App.tsx */}
        <button
          onClick={() => setKiala(k => !k)}
          title="Kiala"
          style={{
            ...btnBase,
            width:26, height:26, borderRadius:8, padding:0, flexShrink:0,
            background: showKiala ? 'rgba(110,231,183,0.12)' : 'rgba(255,255,255,0.06)',
            border: showKiala ? '1px solid rgba(110,231,183,0.3)' : '1px solid rgba(255,255,255,0.12)',
            color: showKiala ? BLUE : T2,
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
      </div>

      {/* ── Ligne 2 : Header nav (identique layout header App.tsx) ── */}
      <div style={{
        position:'relative', zIndex:1,
        display:'flex', alignItems:'center', justifyContent:'space-between',
        marginBottom:10, flexShrink:0,
      }}>
        {/* Gauche — navigation mode (◀ Semaine ▶) + filtre occupation */}
        {(() => {
          const modes: AgendaMode[] = ['jour','semaine','mois']
          const mi = modes.indexOf(mode)
          const btnD: React.CSSProperties = { ...btnBase, width:22, height:22, padding:0, color:T3, cursor:'default', opacity:0.4 }
          const btnA: React.CSSProperties = { ...btnBase, width:22, height:22, padding:0, color:T2 }
          return (
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                {mi > 0
                  ? <button onClick={() => setMode(modes[mi-1])} style={btnA}><ChevronIcon dir="left"/></button>
                  : <button disabled style={btnD}><ChevronIcon dir="left"/></button>
                }
                <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.2px', color:T2, minWidth:60, textAlign:'center', fontFamily:FONT }}>
                  {mode.charAt(0).toUpperCase()+mode.slice(1)}
                </span>
                {mi < modes.length-1
                  ? <button onClick={() => setMode(modes[mi+1])} style={btnA}><ChevronIcon dir="right"/></button>
                  : <button disabled style={btnD}><ChevronIcon dir="right"/></button>
                }
              </div>
              {/* Filtre occupation */}
              <OccupationDropdown
                occupations={occupations}
                selected={filterOcc}
                onSelect={setFilterOcc}
              />
            </div>
          )
        })()}

        {/* Droite — nav période + aujourd'hui + settings */}
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <button onClick={() => navigate(-1)} style={{ ...btnBase, width:22, height:22, padding:0, color:T2 }}>
            <ChevronIcon dir="left"/>
          </button>
          <span style={{ fontSize:10, fontWeight:700, color:T2, minWidth:130, textAlign:'center', letterSpacing:'0.1px' }}>
            {periodLabel(viewDate, mode)}
          </span>
          <button onClick={() => navigate(1)} style={{ ...btnBase, width:22, height:22, padding:0, color:T2 }}>
            <ChevronIcon dir="right"/>
          </button>
          <button
            onClick={() => setView(today)}
            style={{
              ...btnBase, padding:'5px 10px', fontSize:10, fontWeight:700,
              color: BLUE, background:'rgba(110,231,183,0.08)',
              border:'1px solid rgba(110,231,183,0.25)', borderRadius:8,
            }}
          >
            Aujourd'hui
          </button>
          {/* Paramètres agenda */}
          <button
            onClick={() => setAgendaSettings(true)}
            title="Paramètres agenda"
            style={{ ...btnBase, width:26, height:26, padding:0, color:T2 }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Séparateur ── */}
      <div style={{ position:'relative', zIndex:1, height:1, background:'rgba(255,255,255,0.08)', marginBottom:10, flexShrink:0 }}/>

      {/* ── Contenu ── */}
      <div style={{ position:'relative', zIndex:1, flex:1, display:'flex', overflow:'hidden', minHeight:0 }}>
        <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
          {mode==='jour'    && <DayViewExpanded   date={viewDate} todayStr={todayStr} events={filteredEvents} onEventClick={setSel} onSlotClick={setAddSlot}/>}
          {mode==='semaine' && <WeekViewExpanded  date={viewDate} todayStr={todayStr} events={filteredEvents} onEventClick={setSel} onSlotClick={setAddSlot}/>}
          {mode==='mois'    && <MonthViewExpanded date={viewDate} todayStr={todayStr} onEventClick={setSel}/>}
        </div>
        {showKiala && <KialaPanel onClose={() => setKiala(false)}/>}
      </div>

      {/* ── Footer (identique App.tsx) — saisie rapide ── */}
      <div style={{
        position:'relative', zIndex:1, flexShrink:0,
        padding:'8px 0 12px',
        background:'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)',
      }}>
        <div style={{
          display:'flex', alignItems:'center', gap:6,
          background:'rgba(255,255,255,0.07)',
          border:'1px solid rgba(255,255,255,0.11)',
          borderRadius:14, padding:'6px 8px 6px 12px',
        }}>
          <input
            placeholder="Ajouter un événement ou demander à Kiala…"
            style={{
              flex:1, background:'transparent', border:'none', outline:'none',
              color:T1, fontSize:11, fontFamily:FONT,
            }}
            onFocus={e => (e.currentTarget.parentElement!.style.borderColor='rgba(110,231,183,0.35)')}
            onBlur={e  => (e.currentTarget.parentElement!.style.borderColor='rgba(255,255,255,0.11)')}
          />
          <button style={{
            width:26, height:26, borderRadius:8, flexShrink:0, padding:0,
            display:'flex', alignItems:'center', justifyContent:'center',
            background:'rgba(110,231,183,0.1)', border:'1px solid rgba(110,231,183,0.25)',
            color:BLUE, cursor:'pointer',
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>

      {selected          && <EventDetail event={selected} onClose={() => setSel(null)}/>}
      {addSlot           && <AddEventModal slot={addSlot} occupations={occupations} onClose={() => setAddSlot(null)} onAdd={ev => setEvents(p => [...p, ev])}/>}
      {showAgendaSettings && <AgendaSettingsModal occupations={occupations} onUpdate={updateOccupations} onClose={() => setAgendaSettings(false)}/>}
    </div>
  )
}
