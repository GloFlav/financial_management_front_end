import { useEffect, useState, Component } from 'react'
import type { ReactNode } from 'react'

class ChartErrorBoundary extends Component<{children: ReactNode}, {error: string|null}> {
  state = { error: null }
  static getDerivedStateFromError(e: Error) { return { error: e.message } }
  render() {
    if (this.state.error) return (
      <div style={{ fontSize: 9, color: '#fca5a5', padding: '4px 0', wordBreak: 'break-all' }}>
        Erreur graphe : {this.state.error}
      </div>
    )
    return this.props.children
  }
}

interface MonthData { month: string; income: number; expenses: number }
interface CurrentMonth { income: number; expenses: number; balance: number }
interface DayPoint { day: number; cum_income: number; cum_expenses: number; balance: number; daily_exp: number; daily_inc: number }
interface ProjPoint { day: number; proj_expenses: number; proj_income: number; balance: number; daily_exp: number; daily_inc: number }
interface Breakdown {
  current_balance: number
  salary_incoming: number
  daily_spend: number
  fixed_charges: number
  provisionals: number
}
interface DailyStats {
  days: DayPoint[]
  today: number
  days_in_month: number
  daily_rate: number
  cum_income: number
  cum_expenses: number
  salary_day: number | null
  salary_received: boolean
  projection: ProjPoint[]
  projected_end_balance: number
  breakdown?: Breakdown
  balance_today: number
  savings_balance: number
}

const API = import.meta.env.VITE_API_URL

const fmtK = (n: number) =>
  n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + 'M'
  : n >= 1_000   ? Math.round(n / 1_000) + 'k'
  : String(n)

function MonthLineChart({ stats }: { stats: DailyStats }) {
  const { days, projection, days_in_month, salary_day, salary_received, savings_balance } = stats
  if (days.length < 1 && projection.length < 1) return null

  const W = 236, PL = 2, PR = 2

  // ── Graphe 1 : Solde ─────────────────────────────────────────────
  const H_bal = 70, PT_b = 6, PB_b = 14
  const iW = W - PL - PR, iH_b = H_bal - PT_b - PB_b

  const allBalances = [
    ...days.map(d => d.balance),
    ...projection.map(p => p.balance),
  ]
  const minBal = Math.min(...allBalances, 0)
  const maxBal = Math.max(...allBalances, 1)
  const rangeBal = maxBal - minBal || 1

  const sx  = (day: number) => PL + ((day - 1) / Math.max(days_in_month - 1, 1)) * iW
  const syB = (v: number)   => PT_b + iH_b - ((v - minBal) / rangeBal) * iH_b

  // Ligne solde réel
  const pathBal = days.map((d, i) => `${i === 0 ? 'M' : 'L'} ${sx(d.day).toFixed(1)} ${syB(d.balance).toFixed(1)}`).join(' ')
  // Ligne solde projeté (depuis aujourd'hui)
  const lastDay = days.length ? days[days.length - 1] : null
  const projBalPath = lastDay ? [
    { day: lastDay.day, v: lastDay.balance },
    ...projection.map(p => ({ day: p.day, v: p.balance })),
  ].map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(p.day).toFixed(1)} ${syB(p.v).toFixed(1)}`).join(' ') : ''

  const projEndBal = projection.length ? projection[projection.length - 1].balance : (lastDay?.balance ?? 0)
  const balColor = projEndBal < 0 ? '#fca5a5' : projEndBal < 200_000 ? '#fcd34d' : '#6ee7b7'
  const showSalary = !salary_received && salary_day !== null

  // Zone épargne (bande horizontale)
  const savY = savings_balance > 0 ? syB(savings_balance) : null

  const labelSet = new Set([1, 10, 15, days_in_month])

  // ── Graphe 2 : Dépenses du jour ──────────────────────────────────
  const H_bar = 36, PT_bar = 4, PB_bar = 12
  const iH_bar = H_bar - PT_bar - PB_bar

  const allDailyExp = [
    ...days.map(d => d.daily_exp),
    ...projection.map(p => p.daily_exp),
  ]
  const maxDailyExp = Math.max(...allDailyExp, 1)
  const barW = Math.max(Math.floor(iW / days_in_month) - 1, 1)
  const syBar = (v: number) => PT_bar + iH_bar - (v / maxDailyExp) * iH_bar
  const barH  = (v: number) => Math.max((v / maxDailyExp) * iH_bar, v > 0 ? 1 : 0)

  return (
    <div style={{ margin: '4px 0' }}>

      {/* ── Solde ── */}
      <svg width={W} height={H_bal} style={{ overflow: 'visible', display: 'block' }}>
        {/* Zone épargne */}
        {savY !== null && savY > PT_b && savY < H_bal - PB_b && (
          <>
            <rect x={PL} y={savY.toFixed(1)} width={iW} height={Math.max(H_bal - PB_b - savY, 0).toFixed(1)}
              fill="rgba(167,139,250,0.07)" />
            <line x1={PL} y1={savY.toFixed(1)} x2={W - PR} y2={savY.toFixed(1)}
              stroke="rgba(167,139,250,0.3)" strokeWidth="1" strokeDasharray="3 3" />
            <text x={(W - PR - 2).toFixed(1)} y={(savY - 2).toFixed(1)}
              textAnchor="end" fontSize="7" fill="rgba(167,139,250,0.55)">épargne {fmtK(savings_balance)}</text>
          </>
        )}

        {/* Ligne zéro si le solde peut être négatif */}
        {minBal < 0 && (
          <line x1={PL} y1={syB(0).toFixed(1)} x2={W - PR} y2={syB(0).toFixed(1)}
            stroke="rgba(252,165,165,0.2)" strokeWidth="1" strokeDasharray="2 3" />
        )}

        {/* Solde réel (plein) */}
        {days.length > 1 && (
          <path d={pathBal} fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Solde projeté (pointillé) */}
        {projBalPath && (
          <path d={projBalPath} fill="none" stroke={balColor} strokeWidth="1.5"
            strokeDasharray="4 3" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
        )}

        {/* Marqueur salaire */}
        {showSalary && salary_day && (
          <>
            <line x1={sx(salary_day).toFixed(1)} y1={PT_b.toString()}
              x2={sx(salary_day).toFixed(1)} y2={(H_bal - PB_b).toString()}
              stroke="rgba(110,231,183,0.18)" strokeWidth="1" strokeDasharray="2 3" />
            <text x={sx(salary_day).toFixed(1)} y={(PT_b + 7).toFixed(1)}
              textAnchor="middle" fontSize="7" fill="rgba(110,231,183,0.5)">💰</text>
          </>
        )}

        {/* Dot + label solde aujourd'hui */}
        {lastDay && (
          <>
            <circle cx={sx(lastDay.day).toFixed(1)} cy={syB(lastDay.balance).toFixed(1)}
              r="3" fill="rgba(255,255,255,0.8)" />
            <text x={(sx(lastDay.day) + 5).toFixed(1)} y={(syB(lastDay.balance) - 3).toFixed(1)}
              fontSize="8" fill="rgba(255,255,255,0.7)" fontWeight="600">
              {fmtK(lastDay.balance)}
            </text>
          </>
        )}

        {/* Dot + label solde projeté fin de mois */}
        {projection.length > 0 && (
          <>
            <circle cx={sx(days_in_month).toFixed(1)} cy={syB(projEndBal).toFixed(1)}
              r="2.5" fill={balColor} opacity="0.9" />
            <text x={(sx(days_in_month) - 3).toFixed(1)} y={(syB(projEndBal) - 4).toFixed(1)}
              textAnchor="end" fontSize="8" fill={balColor} fontWeight="600">
              {fmtK(projEndBal)}
            </text>
          </>
        )}

        {/* Ligne verticale aujourd'hui */}
        {lastDay && (
          <line x1={sx(lastDay.day).toFixed(1)} y1={PT_b.toString()}
            x2={sx(lastDay.day).toFixed(1)} y2={(H_bal - PB_b).toString()}
            stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="2 3" />
        )}

        {/* Labels jours */}
        {[...labelSet].filter(d => d <= days_in_month).map(d => (
          <text key={d} x={sx(d).toFixed(1)} y={H_bal - 2}
            textAnchor={d === 1 ? 'start' : d === days_in_month ? 'end' : 'middle'}
            fontSize="7.5" fill="rgba(255,255,255,0.18)">{d}</text>
        ))}
      </svg>

      {/* ── Dépenses du jour (barres) ── */}
      <svg width={W} height={H_bar} style={{ overflow: 'visible', display: 'block', marginTop: 3 }}>
        {/* Barres réelles */}
        {days.map(d => d.daily_exp > 0 && (
          <rect key={d.day}
            x={(sx(d.day) - barW / 2).toFixed(1)} y={syBar(d.daily_exp).toFixed(1)}
            width={barW} height={barH(d.daily_exp).toFixed(1)}
            rx="1" fill="rgba(252,165,165,0.7)" />
        ))}
        {/* Charges fixes projetées (barre distincte, plus marquée) */}
        {projection.map(p => p.daily_exp > 0 && (
          <rect key={p.day}
            x={(sx(p.day) - barW / 2).toFixed(1)} y={syBar(p.daily_exp).toFixed(1)}
            width={barW} height={barH(p.daily_exp).toFixed(1)}
            rx="1" fill="rgba(252,165,165,0.28)" />
        ))}
        {/* Barres revenus projetés (vert, pour le salaire) */}
        {projection.map(p => p.daily_inc > 0 && (
          <rect key={`inc-${p.day}`}
            x={(sx(p.day) - barW / 2).toFixed(1)} y={PT_bar.toFixed(1)}
            width={barW} height={iH_bar.toFixed(1)}
            rx="1" fill="rgba(110,231,183,0.3)" />
        ))}
        {/* Séparateur */}
        <line x1={PL} y1={(H_bar - PB_bar).toFixed(1)} x2={W - PR} y2={(H_bar - PB_bar).toFixed(1)}
          stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        {/* Labels max barre */}
        {maxDailyExp > 0 && (
          <text x={W - PR} y={PT_bar + 8} textAnchor="end" fontSize="7" fill="rgba(255,255,255,0.2)">
            {fmtK(maxDailyExp)}
          </text>
        )}
      </svg>

    </div>
  )
}

export default function TrendChart({ refreshKey }: { refreshKey?: number }) {
  const [data, setData]   = useState<MonthData[]>([])
  const [cur, setCur]     = useState<CurrentMonth | null>(null)
  const [stats, setStats] = useState<DailyStats | null>(null)
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
      .then(d => { console.log('[daily-stats]', d); setStats(d) })
      .catch(e => console.error('[daily-stats error]', e))
  }, [refreshKey])

  const hasChart = data.length > 0 && data.some(d => d.income > 0 || d.expenses > 0)
  const hasCur   = cur !== null

  // Afficher dès qu'on a une projection ou un historique
  if (!stats && !hasCur && !hasChart) return null

  const ratio = cur && cur.income > 0 ? Math.round(cur.expenses / cur.income * 100) : null
  const ratioColor = ratio === null ? 'rgba(255,255,255,0.4)'
    : ratio > 80 ? '#fca5a5' : ratio > 60 ? '#fcd34d' : '#6ee7b7'

  // Solde projeté fin de mois
  const projBalance    = stats?.projected_end_balance ?? null
  const projAlertColor = projBalance === null ? null
    : projBalance < 0           ? '#fca5a5'
    : projBalance < 200_000     ? '#fcd34d'
    : '#6ee7b7'

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
            {slide === 0 && stats?.projection?.length
              ? <LegendDash color="rgba(255,255,255,0.5)" label="Solde proj." />
              : null}
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
      {slide === 0 && (
        <>
          {stats
            ? <ChartErrorBoundary><MonthLineChart stats={stats} /></ChartErrorBoundary>
            : <div style={{ height: 68, display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:10, color:'rgba(255,255,255,0.2)' }}>Chargement…</div>
          }
          <div style={{ display:'flex', gap:6, marginTop:6 }}>
            {[
              { label:'Revenus',     val: fmtK(stats?.cum_income ?? cur?.income ?? 0) + ' Ar', color:'#6ee7b7' },
              { label:'Dépenses',    val: fmtK(stats?.cum_expenses ?? cur?.expenses ?? 0) + ' Ar', color:'#fca5a5' },
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
          {/* Bandeau solde projeté fin de mois */}
          {projBalance !== null && projAlertColor && (
            <div style={{
              marginTop:6, borderRadius:9, padding:'6px 9px',
              background: `${projAlertColor}12`,
              border: `1px solid ${projAlertColor}30`,
            }}>
              {/* Header */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: stats?.breakdown ? 5 : 0 }}>
                <div>
                  <div style={{ fontSize:8, color:'rgba(255,255,255,0.3)', letterSpacing:'0.5px', marginBottom:1 }}>
                    SOLDE PROJETÉ FIN DE MOIS
                  </div>
                  {stats && !stats.salary_received && stats.salary_day && (
                    <div style={{ fontSize:8, color:'rgba(110,231,183,0.5)' }}>
                      💰 salaire attendu vers le {stats.salary_day}
                    </div>
                  )}
                </div>
                <span style={{ fontSize:12, fontWeight:700, color: projAlertColor }}>
                  {projBalance < 0 ? '−' : ''}{fmtK(Math.abs(projBalance))} Ar
                </span>
              </div>
              {/* Breakdown */}
              {stats?.breakdown && (() => {
                const b = stats.breakdown!
                const totalExp = b.daily_spend + b.fixed_charges + b.provisionals
                return (
                  <div style={{
                    borderTop: '1px solid rgba(255,255,255,0.07)',
                    paddingTop: 4,
                    display: 'flex', flexDirection: 'column', gap: 2,
                  }}>
                    <BreakdownRow label="Solde actuel"    value={b.current_balance}  color="rgba(255,255,255,0.55)" sign="+" />
                    {b.salary_incoming > 0 && (
                      <BreakdownRow label="Salaire attendu" value={b.salary_incoming} color="rgba(110,231,183,0.7)"  sign="+" />
                    )}
                    {totalExp > 0 && (
                      <BreakdownRow label="Dépenses prévues" value={totalExp} color="rgba(252,165,165,0.7)" sign="−" detail={[
                        b.daily_spend   > 0 ? `${fmtK(b.daily_spend)} courant`   : null,
                        b.fixed_charges > 0 ? `${fmtK(b.fixed_charges)} fixes`   : null,
                        b.provisionals  > 0 ? `${fmtK(b.provisionals)} prév.`    : null,
                      ].filter(Boolean).join(' · ')} />
                    )}
                  </div>
                )
              })()}
            </div>
          )}
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

function LegendDash({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
      <svg width="12" height="7"><line x1="0" y1="3.5" x2="12" y2="3.5"
        stroke={color} strokeWidth="1.5" strokeDasharray="3 2" strokeLinecap="round" /></svg>
      <span style={{ fontSize:9, color:'rgba(255,255,255,0.3)' }}>{label}</span>
    </div>
  )
}

function BreakdownRow({ label, value, color, sign, detail }: {
  label: string; value: number; color: string; sign: '+' | '−'; detail?: string
}) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
      <div>
        <span style={{ fontSize:8, color:'rgba(255,255,255,0.3)' }}>{sign} {label}</span>
        {detail && <span style={{ fontSize:7, color:'rgba(255,255,255,0.2)', marginLeft:4 }}>{detail}</span>}
      </div>
      <span style={{ fontSize:9, fontWeight:600, color }}>{fmtK(value)} Ar</span>
    </div>
  )
}
