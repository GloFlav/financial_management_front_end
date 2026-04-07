import { useEffect, useState, useMemo } from 'react'

interface MonthData { month: string; income: number; expenses: number }
interface CurrentMonth { income: number; expenses: number; balance: number }
interface DayPoint { day: number; cum_income: number; cum_expenses: number }

const API = import.meta.env.VITE_API_URL

const fmtK = (n: number) =>
  n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + 'M'
  : n >= 1_000   ? Math.round(n / 1_000) + 'k'
  : String(n)

function MonthLineChart({ days }: { days: DayPoint[] }) {
  const W = 236, H = 60, PT = 4, PB = 14, PL = 2, PR = 2
  const iW = W - PL - PR, iH = H - PT - PB
  const n = days.length
  if (n < 2) return null

  const maxVal = Math.max(...days.map(d => Math.max(d.cum_income, d.cum_expenses)), 1)
  const sx = (i: number) => PL + (i / (n - 1)) * iW
  const sy = (v: number) => PT + iH - (v / maxVal) * iH

  const pathInc = days.map((d, i) => `${i === 0 ? 'M' : 'L'} ${sx(i).toFixed(1)} ${sy(d.cum_income).toFixed(1)}`).join(' ')
  const pathExp = days.map((d, i) => `${i === 0 ? 'M' : 'L'} ${sx(i).toFixed(1)} ${sy(d.cum_expenses).toFixed(1)}`).join(' ')

  // Label tous les ~7 jours
  const labelDays = days.filter((_, i) => i === 0 || i === n - 1 || (days[i].day % 7 === 0))

  return (
    <svg width={W} height={H} style={{ overflow: 'visible', display: 'block', margin: '4px 0' }}>
      <path d={pathInc} fill="none" stroke="rgba(110,231,183,0.75)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d={pathExp} fill="none" stroke="rgba(252,165,165,0.7)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {/* Dot fin de ligne */}
      {[
        { val: days[n-1].cum_income,   color: '#6ee7b7' },
        { val: days[n-1].cum_expenses, color: '#fca5a5' },
      ].map((p, i) => (
        <circle key={i} cx={sx(n-1).toFixed(1)} cy={sy(p.val).toFixed(1)} r="2.5" fill={p.color} />
      ))}
      {/* Labels jours */}
      {labelDays.map(d => {
        const i = days.indexOf(d)
        return (
          <text key={d.day} x={sx(i).toFixed(1)} y={H - 2}
            textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.25)">{d.day}</text>
        )
      })}
    </svg>
  )
}

export default function TrendChart({ refreshKey }: { refreshKey?: number }) {
  const [data, setData] = useState<MonthData[]>([])
  const [cur, setCur]   = useState<CurrentMonth | null>(null)
  const [daily, setDaily] = useState<DayPoint[]>([])
  const [slide, setSlide] = useState(1)

  useEffect(() => {
    fetch(`${API}/finance/monthly-stats?months=6`)
      .then(r => r.json()).then(setData).catch(() => {})
    fetch(`${API}/finance/summary`)
      .then(r => r.json())
      .then(d => setCur({ income: d.income, expenses: d.expenses, balance: d.balance }))
      .catch(() => {})
    fetch(`${API}/finance/daily-stats`)
      .then(r => r.json())
      .then(d => setDaily(d.days || []))
      .catch(() => {})
  }, [refreshKey])

  const hasChart = data.length > 0 && data.some(d => d.income > 0 || d.expenses > 0)
  const hasCur   = cur !== null

  if (!hasCur && !hasChart) return null

  const ratio = cur && cur.income > 0 ? Math.round(cur.expenses / cur.income * 100) : null
  const ratioColor = ratio === null ? 'rgba(255,255,255,0.4)'
    : ratio > 80 ? '#fca5a5' : ratio > 60 ? '#fcd34d' : '#6ee7b7'

  const maxVal = hasChart ? Math.max(...data.flatMap(d => [d.income, d.expenses]), 1) : 1
  const H = 72, barW = 10, gap = 3, groupGap = 8
  const groupW = barW * 2 + gap + groupGap
  const totalW = data.length * groupW - groupGap + 4

  return (
    <div style={{ padding:'10px 16px 12px', borderTop:'1px solid rgba(255,255,255,0.07)' }}>
      {/* Header avec navigation */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <span style={{ fontSize:9, letterSpacing:'1.5px', textTransform:'uppercase', color:'rgba(255,255,255,0.25)' }}>
          {slide === 0 ? 'Ce mois-ci' : 'Tendances 6 mois'}
        </span>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ display:'flex', gap:10 }}>
            <LegendDot color="rgba(110,231,183,0.8)" label="Revenus" />
            <LegendDot color="rgba(252,165,165,0.75)" label="Dépenses" />
          </div>
          {/* Arrows */}
          <div style={{ display:'flex', gap:4 }}>
            <button onClick={() => setSlide(0)} style={{
              width:16, height:16, borderRadius:4, border:'none', cursor:'pointer',
              background: slide===0 ? 'rgba(110,231,183,0.2)' : 'rgba(255,255,255,0.06)',
              color: slide===0 ? '#6ee7b7' : 'rgba(255,255,255,0.3)',
              display:'flex', alignItems:'center', justifyContent:'center', padding:0,
            }}>‹</button>
            <button onClick={() => setSlide(1)} style={{
              width:16, height:16, borderRadius:4, border:'none', cursor:'pointer',
              background: slide===1 ? 'rgba(110,231,183,0.2)' : 'rgba(255,255,255,0.06)',
              color: slide===1 ? '#6ee7b7' : 'rgba(255,255,255,0.3)',
              display:'flex', alignItems:'center', justifyContent:'center', padding:0,
            }}>›</button>
          </div>
        </div>
      </div>

      {/* Slide 0 — Ce mois : courbe + stats */}
      {slide === 0 && hasCur && (
        <>
          {daily.length >= 2
            ? <MonthLineChart days={daily} />
            : <div style={{ height: 60, display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:10, color:'rgba(255,255,255,0.2)' }}>Pas encore de données ce mois</div>
          }
          <div style={{ display:'flex', gap:6, marginTop:6 }}>
            {[
              { label:'Revenus',     val: fmtK(cur!.income)   + ' Ar', color:'#6ee7b7' },
              { label:'Dépenses',    val: fmtK(cur!.expenses) + ' Ar', color:'#fca5a5' },
              { label:'Taux effort', val: ratio !== null ? ratio + '%' : '—', color: ratioColor },
            ].map(({ label, val, color }) => (
              <div key={label} style={{
                flex:1, background:'rgba(255,255,255,0.04)',
                border:'1px solid rgba(255,255,255,0.07)',
                borderRadius:10, padding:'5px 7px',
              }}>
                <div style={{ fontSize:8, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:2 }}>{label}</div>
                <div style={{ fontSize:11, fontWeight:700, color }}>{val}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Slide 1 — 6 mois */}
      {slide === 1 && hasChart && (
        <svg width={totalW} height={H + 20} style={{ overflow:'visible', display:'block' }}>
          {data.map((d, i) => {
            const x    = i * groupW + 2
            const incH = d.income   > 0 ? Math.max(Math.round((d.income   / maxVal) * H), 2) : 0
            const expH = d.expenses > 0 ? Math.max(Math.round((d.expenses / maxVal) * H), 2) : 0
            return (
              <g key={i}>
                {incH > 0 && <rect x={x} y={H - incH} width={barW} height={incH} rx={2} fill="rgba(110,231,183,0.75)" />}
                {expH > 0 && <rect x={x + barW + gap} y={H - expH} width={barW} height={expH} rx={2} fill="rgba(252,165,165,0.7)" />}
                {(incH > 0 || expH > 0) && (
                  <text x={x + barW + gap / 2} y={H - Math.max(incH, expH) - 3}
                    textAnchor="middle" fontSize={7} fill="rgba(255,255,255,0.2)">
                    {fmtK(Math.max(d.income, d.expenses))}
                  </text>
                )}
                <text x={x + barW + gap / 2} y={H + 13}
                  textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.3)">
                  {d.month}
                </text>
              </g>
            )
          })}
          <line x1={0} y1={H} x2={totalW} y2={H} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
        </svg>
      )}
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
      <div style={{ width:7, height:7, borderRadius:2, background:color }} />
      <span style={{ fontSize:9, color:'rgba(255,255,255,0.3)' }}>{label}</span>
    </div>
  )
}
