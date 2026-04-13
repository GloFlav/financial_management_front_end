import { useState, useRef, useEffect } from 'react'
import { type Occupation, loadOccupations } from '../occupations'

type AgendaMode = 'jour' | 'semaine' | 'mois'

const ACCENT  = '#60a5fa'
const ACCENT_BG = 'rgba(96,165,250,0.10)'
const ACCENT_BD = 'rgba(96,165,250,0.25)'
const FONT    = '-apple-system,BlinkMacSystemFont,"SF Pro Display",sans-serif'
const DAYS_S  = ['L','M','M','J','V','S','D']
const DAYS_F  = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche']
const MONTHS  = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

type CalEvent = {
  date: string; hour: number; duration: number
  title: string; color: string
  occupationId?: string
  location?: string; participants?: string[]
}

const MOCK: CalEvent[] = [
  { date:'2026-04-07', hour:9,  duration:1,   title:'Réunion hebdo',  color:ACCENT,    occupationId:'rh-auto',      participants:['Flavien','Marie','Jo']          },
  { date:'2026-04-09', hour:14, duration:1.5, title:'Code review',    color:'#a78bfa', occupationId:'rh-auto',      participants:['Flavien','Dev team']            },
  { date:'2026-04-12', hour:10, duration:1,   title:'Revue planning', color:'#34d399', occupationId:'hello-soins',  location:'Salle A', participants:['Flavien']   },
  { date:'2026-04-12', hour:15, duration:0.5, title:'Stand-up async', color:ACCENT,    occupationId:'rh-auto'                                                       },
  { date:'2026-04-14', hour:10, duration:1,   title:'Appel client',   color:'#fcd34d', occupationId:'hello-soins',  location:'En ligne', participants:['Client X'] },
  { date:'2026-04-16', hour:14, duration:2,   title:'Formation',      color:'#f87171', occupationId:'enseignement', location:'Centre ville'                        },
  { date:'2026-04-20', hour:9,  duration:1,   title:'Sprint review',  color:ACCENT,    occupationId:'rh-auto',      participants:["Toute l'équipe"]                },
  { date:'2026-04-23', hour:15, duration:1.5, title:'Présentation',   color:'#a78bfa', occupationId:'perso',        location:'Salle conf.', participants:['Direction'] },
  { date:'2026-04-28', hour:9,  duration:1,   title:'Planning mai',   color:'#34d399', occupationId:'perso',        participants:['Flavien','Marie']               },
]

function toStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function fmtEnd(h: number, dur: number) {
  const t = h*60 + dur*60
  return `${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`
}
function periodLabel(d: Date, mode: AgendaMode): string {
  if (mode === 'jour') {
    return `${DAYS_F[(d.getDay()+6)%7].slice(0,3)}. ${d.getDate()} ${MONTHS[d.getMonth()].slice(0,4)}.`
  }
  if (mode === 'semaine') {
    const dow = (d.getDay()+6)%7
    const mon = new Date(d); mon.setDate(d.getDate()-dow)
    const sun = new Date(mon); sun.setDate(mon.getDate()+6)
    return mon.getMonth() === sun.getMonth()
      ? `${mon.getDate()} – ${sun.getDate()} ${MONTHS[mon.getMonth()].slice(0,4)}.`
      : `${mon.getDate()} ${MONTHS[mon.getMonth()].slice(0,3)}. – ${sun.getDate()} ${MONTHS[sun.getMonth()].slice(0,3)}.`
  }
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

// ── Occupation Dropdown (compact — widget principal) ─────────────────
function OccDropdown({ occupations, selected, onSelect }: {
  occupations: Occupation[]; selected: string; onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = selected === 'tous' ? null : occupations.find(o => o.id === selected)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <div ref={ref} style={{ position:'relative', flexShrink:0 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display:'flex', alignItems:'center', gap:4,
          background: open ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.06)',
          border:`1px solid ${open ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius:7, padding:'3px 7px', cursor:'pointer', fontFamily:FONT,
          fontSize:9, fontWeight:600, color:'rgba(255,255,255,0.65)', transition:'all 0.15s',
        }}
      >
        <div style={{ width:6, height:6, borderRadius:'50%', background: current ? current.color : 'rgba(255,255,255,0.3)', flexShrink:0 }}/>
        <span style={{ maxWidth:72, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {current ? current.name : 'Tous'}
        </span>
        <svg width="5" height="5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity:0.5, flexShrink:0 }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 4px)', left:0, zIndex:99999,
          background:'rgba(11,11,19,0.98)', border:'1px solid rgba(255,255,255,0.12)',
          borderRadius:9, overflow:'hidden', minWidth:140,
          boxShadow:'0 10px 32px rgba(0,0,0,0.8)',
        }}>
          {[{ id:'tous', name:'Tous', color:'rgba(255,255,255,0.3)' }, ...occupations].map(o => (
            <div
              key={o.id}
              onClick={() => { onSelect(o.id); setOpen(false) }}
              style={{
                display:'flex', alignItems:'center', gap:7, padding:'7px 10px',
                cursor:'pointer', fontFamily:FONT, fontSize:10,
                color:'rgba(255,255,255,0.75)', fontWeight: selected===o.id ? 700 : 400,
                background: selected===o.id ? 'rgba(255,255,255,0.07)' : 'transparent',
              }}
              onMouseEnter={e => { if (selected!==o.id) (e.currentTarget as HTMLDivElement).style.background='rgba(255,255,255,0.04)' }}
              onMouseLeave={e => { if (selected!==o.id) (e.currentTarget as HTMLDivElement).style.background='transparent' }}
            >
              <div style={{ width:7, height:7, borderRadius:'50%', background:o.color, flexShrink:0 }}/>
              {o.name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tooltip (centré sur l'élément via DOMRect) ───────────────────────
type TipData  = { date: string; events: CalEvent[]; rect: DOMRect }
type HoverCb  = (e: React.MouseEvent, date: string, events: CalEvent[]) => void
type ClickCb  = (ev: CalEvent) => void

function Tooltip({ data }: { data: TipData }) {
  const d     = new Date(data.date + 'T00:00:00')
  const label = `${DAYS_F[(d.getDay()+6)%7]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
  const W     = 188
  const estH  = data.events.length * 54 + 46

  // Centré horizontalement sur l'élément, clampé aux bords du viewport
  const cx   = data.rect.left + data.rect.width / 2
  let left   = cx - W / 2
  left = Math.max(8, Math.min(left, window.innerWidth - W - 8))

  let top = data.rect.bottom + 8
  if (top + estH > window.innerHeight - 8) top = data.rect.top - estH - 8

  return (
    <div style={{
      position:'fixed', zIndex:999999, left, top, width:W,
      background:'rgba(11,11,19,0.97)',
      border:'1px solid rgba(255,255,255,0.13)',
      borderRadius:12, padding:'10px 12px',
      boxShadow:'0 16px 48px rgba(0,0,0,0.8)',
      fontFamily:FONT, pointerEvents:'none',
      animation:'tooltipIn 0.12s ease',
    }}>
      <div style={{ fontSize:10, color:'rgba(255,255,255,0.38)', fontWeight:600, marginBottom:8 }}>{label}</div>
      {data.events.length === 0
        ? <div style={{ fontSize:10, color:'rgba(255,255,255,0.2)', fontStyle:'italic' }}>Aucun événement</div>
        : data.events.map((ev,i) => (
          <div key={i} style={{ marginBottom: i<data.events.length-1 ? 8 : 0, paddingLeft:9, borderLeft:`2px solid ${ev.color}` }}>
            <div style={{ fontSize:11, color:'#fff', fontWeight:700, marginBottom:2 }}>{ev.title}</div>
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.32)' }}>{ev.hour}:00 → {fmtEnd(ev.hour,ev.duration)} · {ev.duration}h</div>
            {ev.location && <div style={{ fontSize:9, color:'rgba(255,255,255,0.25)', marginTop:1 }}>📍 {ev.location}</div>}
          </div>
        ))
      }
    </div>
  )
}

// ── Détail événement (modal) ─────────────────────────────────────────
function EventDetail({ event, onClose }: { event: CalEvent; onClose: () => void }) {
  const d     = new Date(event.date+'T00:00:00')
  const label = `${DAYS_F[(d.getDay()+6)%7]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`

  return (
    <div
      onClick={onClose}
      style={{ position:'fixed', inset:0, zIndex:99998, background:'rgba(0,0,0,0.65)', display:'flex', alignItems:'center', justifyContent:'center', animation:'overlayIn 0.15s ease' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background:'rgba(14,14,22,0.98)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:16, overflow:'hidden', width:266, boxShadow:'0 24px 64px rgba(0,0,0,0.8)', fontFamily:FONT, animation:'liquidIn 0.22s ease' }}
      >
        <div style={{ height:4, background:event.color }}/>
        <div style={{ padding:'14px 16px 16px' }}>
          <div style={{ fontSize:15, fontWeight:800, color:'#fff', marginBottom:3, lineHeight:1.3 }}>{event.title}</div>
          <div style={{ fontSize:10, color:'rgba(255,255,255,0.35)', marginBottom:14 }}>{label}</div>

          {/* Horaire */}
          <Row icon={<ClockIcon color={event.color}/>} label={`${event.hour}:00 → ${fmtEnd(event.hour,event.duration)}`} sub={`${event.duration}h de durée`}/>
          {/* Lieu */}
          {event.location && <Row icon={<PinIcon/>} label={event.location}/>}
          {/* Participants */}
          {event.participants && event.participants.length > 0 && (
            <div style={{ padding:'7px 10px', background:'rgba(255,255,255,0.05)', borderRadius:9, marginBottom:8 }}>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.28)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:5 }}>Participants</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                {event.participants.map((p,i) => (
                  <span key={i} style={{ fontSize:10, color:'rgba(255,255,255,0.65)', background:'rgba(255,255,255,0.07)', borderRadius:5, padding:'2px 7px' }}>{p}</span>
                ))}
              </div>
            </div>
          )}
          {/* Notes */}
          <div style={{ padding:'7px 10px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:9, marginBottom:14 }}>
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.25)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:4 }}>Notes</div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.18)', fontStyle:'italic' }}>Aucune note pour l'instant</div>
          </div>

          <button onClick={onClose} style={{ width:'100%', padding:'8px 0', borderRadius:10, cursor:'pointer', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.55)', fontSize:12, fontWeight:600, fontFamily:FONT }}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({ icon, label, sub }: { icon: React.ReactNode; label: string; sub?: string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:8, padding:'7px 10px', background:'rgba(255,255,255,0.05)', borderRadius:9 }}>
      {icon}
      <div>
        <div style={{ fontSize:11, color:'rgba(255,255,255,0.7)', fontWeight:600 }}>{label}</div>
        {sub && <div style={{ fontSize:9, color:'rgba(255,255,255,0.3)', marginTop:1 }}>{sub}</div>}
      </div>
    </div>
  )
}
function ClockIcon({ color }: { color: string }) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}>
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  )
}
function PinIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  )
}

// ── Day View ─────────────────────────────────────────────────────────
function DayView({ date, todayStr, events: allEvents, onHover, onLeave, onEventClick }: { date:Date; todayStr:string; events:CalEvent[]; onHover:HoverCb; onLeave:()=>void; onEventClick:ClickCb }) {
  const dateStr = toStr(date)
  const isToday = dateStr === todayStr
  const events  = allEvents.filter(e => e.date === dateStr)
  const hours   = Array.from({ length:13 }, (_, i) => i+8)
  const label   = `${DAYS_F[(date.getDay()+6)%7]} ${date.getDate()} ${MONTHS[date.getMonth()]}`

  return (
    <div style={{ fontFamily:FONT }}>
      <div style={{ fontSize:11, marginBottom:10, fontWeight:700, color: isToday ? ACCENT : 'rgba(255,255,255,0.45)' }}>
        {label}{isToday && <span style={{ marginLeft:6, fontSize:9, fontWeight:400, opacity:0.6 }}>Aujourd'hui</span>}
      </div>
      <div style={{ overflowY:'auto', maxHeight:300 }}>
        {hours.map(h => {
          const ev = events.find(e => e.hour === h)
          return (
            <div key={h} style={{ display:'flex', alignItems:'flex-start', gap:8, marginBottom:5 }}>
              <div style={{ width:30, fontSize:9, color:'rgba(255,255,255,0.22)', flexShrink:0, paddingTop: ev ? 6 : 4, textAlign:'right' }}>{h}:00</div>
              <div style={{ flex:1 }}>
                {ev ? (
                  <div
                    onMouseEnter={e => { onHover(e, dateStr, [ev]); (e.currentTarget as HTMLDivElement).style.background=ev.color+'28' }}
                    onMouseLeave={e => { onLeave(); (e.currentTarget as HTMLDivElement).style.background=ev.color+'15' }}
                    onClick={() => onEventClick(ev)}
                    style={{ background:ev.color+'15', border:`1px solid ${ev.color}35`, borderLeft:`3px solid ${ev.color}`, borderRadius:7, padding:'5px 9px', fontSize:11, color:'#fff', fontWeight:600, cursor:'pointer', transition:'background 0.1s' }}
                  >
                    {ev.title}
                    <span style={{ marginLeft:6, fontSize:9, color:'rgba(255,255,255,0.35)', fontWeight:400 }}>{ev.duration}h</span>
                  </div>
                ) : (
                  <div style={{ height:1, background:'rgba(255,255,255,0.05)', marginTop:8 }}/>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Week View ────────────────────────────────────────────────────────
function WeekView({ date, todayStr, events: allEvents, onHover, onLeave, onEventClick }: { date:Date; todayStr:string; events:CalEvent[]; onHover:HoverCb; onLeave:()=>void; onEventClick:ClickCb }) {
  const dow    = (date.getDay()+6)%7
  const monday = new Date(date); monday.setDate(date.getDate()-dow)
  const days   = Array.from({ length:7 }, (_,i) => { const d=new Date(monday); d.setDate(monday.getDate()+i); return d })
  const startL = `${days[0].getDate()} au ${days[6].getDate()} ${MONTHS[days[6].getMonth()]}`

  const weekEvs = days.flatMap(d => {
    const str = toStr(d)
    return allEvents.filter(e => e.date === str).map(ev => ({ ...ev, dayLabel:`${d.getDate()} ${MONTHS[d.getMonth()].slice(0,4)}.` }))
  })

  return (
    <div style={{ fontFamily:FONT }}>
      <div style={{ fontSize:10, color:'rgba(255,255,255,0.35)', marginBottom:10, fontWeight:600 }}>Semaine du {startL}</div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:3, marginBottom:14 }}>
        {days.map((d,i) => {
          const str     = toStr(d)
          const isToday = str === todayStr
          const evs     = allEvents.filter(e => e.date === str)
          return (
            <div
              key={i}
              onMouseEnter={e => { onHover(e, str, evs); (e.currentTarget as HTMLDivElement).style.background='rgba(255,255,255,0.06)' }}
              onMouseLeave={e => { onLeave(); (e.currentTarget as HTMLDivElement).style.background='transparent' }}
              style={{ textAlign:'center', borderRadius:8, padding:'4px 0', cursor:'default', transition:'background 0.12s' }}
            >
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.3)', marginBottom:4, fontWeight:600 }}>{DAYS_S[i]}</div>
              <div style={{ width:26, height:26, borderRadius:'50%', margin:'0 auto 5px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight: isToday?700:500, background: isToday?ACCENT:'transparent', color: isToday?'#fff':'rgba(255,255,255,0.6)' }}>
                {d.getDate()}
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:2, alignItems:'center' }}>
                {evs.slice(0,3).map((ev,j) => <div key={j} style={{ width:'80%', height:3, borderRadius:2, background:ev.color, opacity:0.85 }}/>)}
                {evs.length>3 && <div style={{ fontSize:8, color:'rgba(255,255,255,0.3)' }}>+{evs.length-3}</div>}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ borderTop:'1px solid rgba(255,255,255,0.07)', paddingTop:10 }}>
        <div style={{ fontSize:9, color:'rgba(255,255,255,0.25)', marginBottom:7, textTransform:'uppercase', letterSpacing:'0.5px', fontWeight:600 }}>Événements</div>
        {weekEvs.length === 0
          ? <div style={{ fontSize:11, color:'rgba(255,255,255,0.2)', textAlign:'center', padding:'12px 0' }}>Aucun événement cette semaine</div>
          : weekEvs.map((ev,i) => (
            <div
              key={i}
              onClick={() => onEventClick(ev)}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background='rgba(255,255,255,0.09)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background='rgba(255,255,255,0.04)' }}
              style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5, padding:'5px 8px', background:'rgba(255,255,255,0.04)', borderRadius:8, borderLeft:`3px solid ${ev.color}`, cursor:'pointer', transition:'background 0.1s' }}
            >
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.3)', flexShrink:0, minWidth:34 }}>{ev.dayLabel}</div>
              <div style={{ fontSize:10, color:'#fff', fontWeight:600, flex:1 }}>{ev.title}</div>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.25)', flexShrink:0 }}>{ev.hour}:00</div>
            </div>
          ))
        }
      </div>
    </div>
  )
}

// ── Month View ───────────────────────────────────────────────────────
function MonthView({ date, todayStr, events: allEvents, onHover, onLeave, onEventClick }: { date:Date; todayStr:string; events:CalEvent[]; onHover:HoverCb; onLeave:()=>void; onEventClick:ClickCb }) {
  const y = date.getFullYear(), m = date.getMonth()
  const offset  = (new Date(y,m,1).getDay()+6)%7
  const daysCnt = new Date(y,m+1,0).getDate()
  const cells: (number|null)[] = [...Array(offset).fill(null), ...Array.from({length:daysCnt},(_,i)=>i+1)]
  while (cells.length%7 !== 0) cells.push(null)

  return (
    <div style={{ fontFamily:FONT }}>
      <div style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.7)', marginBottom:10 }}>{MONTHS[m]} {y}</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:3 }}>
        {DAYS_S.map((d,i) => <div key={i} style={{ textAlign:'center', fontSize:9, color:'rgba(255,255,255,0.28)', fontWeight:600, padding:'2px 0' }}>{d}</div>)}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
        {cells.map((day,i) => {
          if (day === null) return <div key={i}/>
          const cs     = `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const isToday = cs === todayStr
          const evs    = allEvents.filter(e => e.date === cs)
          return (
            <div
              key={i}
              onMouseEnter={e => { onHover(e, cs, evs); (e.currentTarget as HTMLDivElement).style.background = isToday?'rgba(96,165,250,0.2)':'rgba(255,255,255,0.07)' }}
              onMouseLeave={e => { onLeave(); (e.currentTarget as HTMLDivElement).style.background='transparent' }}
              style={{ textAlign:'center', paddingBottom:4, borderRadius:6, cursor:'default', transition:'background 0.1s' }}
            >
              <div style={{ width:24, height:24, borderRadius:'50%', margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight: isToday?700:400, background: isToday?ACCENT:'transparent', color: isToday?'#fff':evs.length>0?'rgba(255,255,255,0.85)':'rgba(255,255,255,0.38)' }}>
                {day}
              </div>
              {evs.length > 0 && (
                <div style={{ display:'flex', justifyContent:'center', gap:2, marginTop:2 }}>
                  {evs.slice(0,2).map((ev,j) => <div key={j} style={{ width:4, height:4, borderRadius:'50%', background: isToday?'rgba(255,255,255,0.7)':ev.color }}/>)}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ marginTop:12, borderTop:'1px solid rgba(255,255,255,0.07)', paddingTop:10 }}>
        <div style={{ fontSize:9, color:'rgba(255,255,255,0.25)', marginBottom:7, textTransform:'uppercase', letterSpacing:'0.5px', fontWeight:600 }}>À venir</div>
        {allEvents.filter(e => e.date >= todayStr).slice(0,3).map((ev,i) => {
          const d = new Date(ev.date+'T00:00:00')
          return (
            <div
              key={i}
              onClick={() => onEventClick(ev)}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background='rgba(255,255,255,0.09)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background='rgba(255,255,255,0.04)' }}
              style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5, padding:'5px 8px', background:'rgba(255,255,255,0.04)', borderRadius:8, borderLeft:`3px solid ${ev.color}`, cursor:'pointer', transition:'background 0.1s' }}
            >
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.3)', flexShrink:0, minWidth:30 }}>{d.getDate()} {MONTHS[d.getMonth()].slice(0,4)}.</div>
              <div style={{ fontSize:10, color:'#fff', fontWeight:600, flex:1 }}>{ev.title}</div>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.25)', flexShrink:0 }}>{ev.hour}:00</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── ProScheduler ─────────────────────────────────────────────────────
export default function ProScheduler() {
  const today    = new Date()
  const todayStr = toStr(today)

  const [mode,        setMode]      = useState<AgendaMode>('semaine')
  const [viewDate,    setView]      = useState(today)
  const [tooltip,     setTip]       = useState<TipData|null>(null)
  const [selected,    setSel]       = useState<CalEvent|null>(null)
  const [occupations, ]             = useState<Occupation[]>(loadOccupations)
  const [filterOcc,   setFilterOcc] = useState<string>('tous')

  const filteredMock = filterOcc === 'tous' ? MOCK : MOCK.filter(e => e.occupationId === filterOcc)

  const navigate = (dir: -1|1) => {
    setTip(null)
    setView(prev => {
      const d = new Date(prev)
      if (mode==='jour')    d.setDate(d.getDate()+dir)
      if (mode==='semaine') d.setDate(d.getDate()+dir*7)
      if (mode==='mois')    d.setMonth(d.getMonth()+dir)
      return d
    })
  }

  const onHover: HoverCb = (e, date, events) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setTip({ date, events, rect })
  }
  const onLeave = () => setTip(null)
  const onEventClick: ClickCb = ev => { setTip(null); setSel(ev) }
  const changeMode = (m: AgendaMode) => { setMode(m); setTip(null) }

  const expand = () => {
    try { ;(window as any).webkit?.messageHandlers?.scheduler?.postMessage?.({ action:'expand' }) } catch {}
  }

  return (
    <div style={{ fontFamily:FONT, color:'#fff' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
          <div style={{ fontSize:13, fontWeight:700 }}>Agenda</div>
          <OccDropdown occupations={occupations} selected={filterOcc} onSelect={setFilterOcc}/>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
          <div style={{ fontSize:9, color:ACCENT, fontWeight:700, background:ACCENT_BG, border:`1px solid ${ACCENT_BD}`, borderRadius:6, padding:'3px 8px', letterSpacing:'0.4px', textTransform:'uppercase' }}>Vitrine</div>
          <button
            onClick={expand} title="Agrandir l'agenda"
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color='#fff'; (e.currentTarget as HTMLButtonElement).style.background='rgba(255,255,255,0.12)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color='rgba(255,255,255,0.5)'; (e.currentTarget as HTMLButtonElement).style.background='rgba(255,255,255,0.06)' }}
            style={{ width:24, height:24, borderRadius:7, padding:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', cursor:'pointer', color:'rgba(255,255,255,0.5)', transition:'all 0.15s', flexShrink:0 }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
              <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Mode tabs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', background:'rgba(255,255,255,0.05)', borderRadius:10, padding:3, marginBottom:10 }}>
        {(['jour','semaine','mois'] as AgendaMode[]).map(m => (
          <button key={m} onClick={() => changeMode(m)} style={{
            padding:'6px 0', borderRadius:8, border:'none',
            background: mode===m ? ACCENT_BG : 'transparent',
            outline: mode===m ? `1px solid ${ACCENT_BD}` : '1px solid transparent',
            cursor:'pointer', color: mode===m ? ACCENT : 'rgba(255,255,255,0.38)',
            fontSize:11, fontWeight: mode===m ? 700 : 500, fontFamily:FONT, transition:'all 0.15s',
          }}>
            {m.charAt(0).toUpperCase()+m.slice(1)}
          </button>
        ))}
      </div>

      {/* Navigation date */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <NavBtn onClick={() => navigate(-1)} dir="left"/>
        <span style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.55)', fontFamily:FONT }}>{periodLabel(viewDate,mode)}</span>
        <NavBtn onClick={() => navigate(1)} dir="right"/>
      </div>

      {/* Content */}
      {mode==='jour'    && <DayView   date={viewDate} todayStr={todayStr} events={filteredMock} onHover={onHover} onLeave={onLeave} onEventClick={onEventClick}/>}
      {mode==='semaine' && <WeekView  date={viewDate} todayStr={todayStr} events={filteredMock} onHover={onHover} onLeave={onLeave} onEventClick={onEventClick}/>}
      {mode==='mois'    && <MonthView date={viewDate} todayStr={todayStr} events={filteredMock} onHover={onHover} onLeave={onLeave} onEventClick={onEventClick}/>}

      {tooltip  && <Tooltip data={tooltip}/>}
      {selected && <EventDetail event={selected} onClose={() => setSel(null)}/>}
    </div>
  )
}

function NavBtn({ onClick, dir }: { onClick: () => void; dir: 'left'|'right' }) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background='rgba(255,255,255,0.1)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background='rgba(255,255,255,0.05)' }}
      style={{ width:22, height:22, borderRadius:7, padding:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', cursor:'pointer', color:'rgba(255,255,255,0.55)', flexShrink:0 }}
    >
      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {dir==='left' ? <polyline points="15 18 9 12 15 6"/> : <polyline points="9 18 15 12 9 6"/>}
      </svg>
    </button>
  )
}
