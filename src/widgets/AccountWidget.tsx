import { useEffect, useState, useMemo } from 'react'
import type { CSSProperties, ReactElement } from 'react'
import type { WalletItem } from '../types'

interface PeriodDay { date: string; day: number; remaining: number | null; is_past: boolean }
interface BudgetPeriod {
  period_start: string; period_end: string; budget_libre: number; days: PeriodDay[]
}

function BudgetPeriodChart({ data }: { data: BudgetPeriod }) {
  const W = 236, H = 56, PT = 6, PB = 16, PL = 4, PR = 4
  const iW = W - PL - PR, iH = H - PT - PB
  const pastDays = data.days.filter(d => d.is_past && d.remaining !== null)
  if (pastDays.length < 2) return null

  const vals = useMemo(() => {
    const n = data.days.length
    const rem = pastDays.map(d => d.remaining as number)
    const mn = Math.min(...rem, 0)
    const mx = Math.max(data.budget_libre, ...rem)
    const range = mx - mn || 1
    const sx = (i: number) => PL + (i / (n - 1)) * iW
    const sy = (v: number) => PT + iH - ((v - mn) / range) * iH
    const zero = sy(0)
    return { sx, sy, zero, mn, mx }
  }, [data, pastDays])

  // Indices dans data.days pour les jours passés
  const pastIndices = data.days.map((d, i) => d.is_past && d.remaining !== null ? i : -1).filter(i => i >= 0)

  const pathD = pastIndices.map((di, pi) => {
    const x = vals.sx(di).toFixed(1)
    const y = vals.sy(pastDays[pi].remaining as number).toFixed(1)
    return `${pi === 0 ? 'M' : 'L'} ${x} ${y}`
  }).join(' ')

  // Marques d'axe : 15 et milieu
  const startDay = new Date(data.period_start).getDate()
  const labelIdxs = [0, Math.floor(data.days.length / 2), data.days.length - 1]

  return (
    <svg width={W} height={H} style={{ overflow: 'visible', display: 'block', margin: '6px 0 0' }}>
      {/* Zone positive / négative */}
      {vals.zero < H - PB && vals.zero > PT && (
        <line x1={PL} x2={W - PR} y1={vals.zero.toFixed(1)} y2={vals.zero.toFixed(1)}
          stroke="rgba(252,165,165,0.2)" strokeWidth="1" strokeDasharray="3,3" />
      )}
      {/* Ligne du budget libre initial */}
      <line x1={PL} x2={W - PR}
        y1={vals.sy(data.budget_libre).toFixed(1)} y2={vals.sy(data.budget_libre).toFixed(1)}
        stroke="rgba(167,139,250,0.2)" strokeWidth="1" strokeDasharray="2,4" />
      {/* Ligne réelle */}
      <path d={pathD} fill="none" stroke="#6ee7b7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Dot du jour actuel */}
      {pastIndices.length > 0 && (() => {
        const li = pastIndices[pastIndices.length - 1]
        const lv = pastDays[pastDays.length - 1].remaining as number
        return <circle cx={vals.sx(li).toFixed(1)} cy={vals.sy(lv).toFixed(1)} r="3"
          fill={lv >= 0 ? '#6ee7b7' : '#fca5a5'} />
      })()}
      {/* Labels jours */}
      {labelIdxs.map(i => (
        <text key={i} x={vals.sx(i).toFixed(1)} y={H - 2} textAnchor="middle"
          fontSize="8" fill="rgba(255,255,255,0.25)">
          {data.days[i]?.day ?? ''}
        </text>
      ))}
      <text x={PL} y={PT + 4} fontSize="8" fill="rgba(167,139,250,0.4)">
        {startDay}
      </text>
    </svg>
  )
}

interface Budget {
  salary: number; savings: number; savings_is_exc: boolean
  fixed_charges: number; provisionals: number; libre: number
}
interface Summary {
  balance: number; savings_balance: number; usable_balance: number
  savings_wallet_id: number; income: number; expenses: number
  currency: string; budget: Budget; wallets: WalletItem[]
}

const fmt = (n: number) => n.toLocaleString('fr-FR') + ' Ar'

const IconBank = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/>
    <line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/>
    <line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/>
  </svg>
)
const IconPhone = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
  </svg>
)
const IconCash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
  </svg>
)

const WALLET_STYLES: Record<string, { bg: string; color: string; icon: ReactElement }> = {
  bank:         { bg: 'rgba(147,197,253,0.18)', color: '#93c5fd', icon: <IconBank /> },
  mobile_money: { bg: 'rgba(110,231,183,0.18)', color: '#6ee7b7', icon: <IconPhone /> },
  cash:         { bg: 'rgba(253,230,138,0.18)', color: '#fcd34d', icon: <IconCash /> },
}

export default function AccountWidget({ onDataLoaded, onWalletClick, refreshKey }: {
  onDataLoaded?: (wallets: WalletItem[]) => void
  onWalletClick?: (wallet: WalletItem) => void
  refreshKey?: number
}) {
  const [data, setData] = useState<Summary | null>(null)
  const [period, setPeriod] = useState<BudgetPeriod | null>(null)
  const [error, setError] = useState(false)
  const [hoveredId, setHoveredId] = useState<number | null>(null)
  const API = import.meta.env.VITE_API_URL

  const load = () =>
    fetch(`${API}/finance/summary`)
      .then(r => r.json())
      .then(d => { setData(d); setError(false); onDataLoaded?.(d.wallets) })
      .catch(() => setError(true))

  const loadPeriod = () =>
    fetch(`${API}/finance/budget-period`)
      .then(r => r.json())
      .then(setPeriod)
      .catch(() => {})

  useEffect(() => {
    load(); loadPeriod()
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => { if (refreshKey !== undefined) { load(); loadPeriod() } }, [refreshKey])

  const usable = data?.usable_balance ?? 0
  const savings = data?.savings_balance ?? 0
  const hasSavings = savings > 0 || (data?.savings_wallet_id ?? 0) > 0

  return (
    <div style={css.card}>
      <div style={css.header}>
        <span style={css.headerLabel}>Finances</span>
        <span style={css.dot} />
      </div>

      {error ? (
        <p style={{ color: '#f87171', fontSize: 13, padding: '8px 0' }}>Service indisponible</p>
      ) : !data ? (
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, padding: '8px 0' }}>Chargement…</p>
      ) : <>
        {/* Solde utilisable — chiffre principal */}
        <div style={css.balanceSection}>
          <div style={css.balanceLabel}>{hasSavings ? 'Disponible (hors épargne)' : 'Solde total'}</div>
          <div style={{ ...css.balance, color: usable >= 0 ? '#6ee7b7' : '#fca5a5' }}>
            {fmt(usable)}
          </div>
          {hasSavings && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                Total <span style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>{fmt(data.balance)}</span>
              </div>
              <div style={{ fontSize: 10, color: 'rgba(167,139,250,0.5)' }}>·</div>
              <div style={{ fontSize: 10, color: 'rgba(167,139,250,0.7)' }}>
                Épargne <span style={{ color: '#a78bfa', fontWeight: 600 }}>{fmt(savings)}</span>
              </div>
            </div>
          )}
        </div>

        <div style={css.statsRow}>
          {[
            { label: 'Revenus',  value: '+' + fmt(data.income),   color: '#6ee7b7', bg: 'rgba(110,231,183,0.12)', arrow: '↑' },
            { label: 'Dépenses', value: '−' + fmt(data.expenses), color: '#fca5a5', bg: 'rgba(252,165,165,0.12)', arrow: '↓' },
          ].map(s => (
            <div key={s.label} style={css.statCard}>
              <div style={{ ...css.arrowBadge, background: s.bg, color: s.color }}>{s.arrow}</div>
              <div>
                <div style={css.statLabel}>{s.label}</div>
                <div style={{ ...css.statValue, color: s.color }}>{s.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Budget mensuel prévisionnel */}
        {data.budget && (
          <div style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12, padding: '10px 12px', marginBottom: 10,
          }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 8 }}>
              Budget ce mois prévisionnel
            </div>
            {[
              { label: 'Salaire', value: data.budget.salary, color: '#6ee7b7', sign: '+' },
              { label: data.budget.savings_is_exc ? 'Épargne (excep.)' : 'Épargne', value: data.budget.savings, color: '#a78bfa', sign: '−' },
              { label: 'Charges fixes', value: data.budget.fixed_charges, color: '#fca5a5', sign: '−' },
              ...(data.budget.provisionals > 0 ? [{ label: 'Prévisionnels', value: data.budget.provisionals, color: '#fcd34d', sign: '−' }] : []),
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{row.label}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: row.color }}>
                  {row.sign}{fmt(row.value)}
                </span>
              </div>
            ))}
            <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '7px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>Reste disponible</span>
              <span style={{
                fontSize: 13, fontWeight: 700,
                color: data.budget.libre >= 0 ? '#6ee7b7' : '#fca5a5',
              }}>
                {fmt(data.budget.libre)}
              </span>
            </div>

            {period && period.days.filter(d => d.is_past).length >= 2 && (
              <>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '8px 0 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.5px' }}>
                    {new Date(period.period_start + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    {' → '}
                    {new Date(period.period_end + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </span>
                  <span style={{ fontSize: 9, color: 'rgba(110,231,183,0.55)' }}>— disponible</span>
                </div>
                <BudgetPeriodChart data={period} />
              </>
            )}
          </div>
        )}

        <div style={css.divider} />

        <div style={css.walletList}>
          {data.wallets?.map(w => {
            const isSav = (w as any).is_savings
            const st = WALLET_STYLES[w.type] ?? WALLET_STYLES.cash
            const savSt = { bg: 'rgba(167,139,250,0.18)', color: '#a78bfa' }
            const hovered = hoveredId === w.id
            return (
              <div
                key={w.id}
                style={{
                  ...css.walletRow,
                  background: hovered
                    ? (isSav ? 'rgba(167,139,250,0.1)' : 'rgba(255,255,255,0.08)')
                    : (isSav ? 'rgba(167,139,250,0.05)' : 'rgba(255,255,255,0.04)'),
                  border: isSav ? '1px solid rgba(167,139,250,0.15)' : '1px solid transparent',
                }}
                onClick={() => onWalletClick?.(w)}
                onMouseEnter={() => setHoveredId(w.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <div style={css.walletLeft}>
                  <div style={{ ...css.walletBadge, background: isSav ? savSt.bg : st.bg, color: isSav ? savSt.color : st.color }}>
                    {isSav
                      ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
                      : st.icon}
                  </div>
                  <div>
                    <span style={{ ...css.walletName, color: isSav ? '#a78bfa' : 'rgba(255,255,255,0.65)' }}>{w.name}</span>
                    {isSav && <div style={{ fontSize: 9, color: 'rgba(167,139,250,0.6)', marginTop: 1, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Épargne</div>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ ...css.walletBal, color: w.balance > 0 ? (isSav ? '#a78bfa' : '#fff') : 'rgba(255,255,255,0.25)' }}>
                    {fmt(w.balance)}
                  </span>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none"
                    stroke="rgba(255,255,255,0.25)" strokeWidth="3" strokeLinecap="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </div>
              </div>
            )
          })}
        </div>
      </>}
    </div>
  )
}

const css: Record<string, CSSProperties> = {
  card: {
    width: '100%', padding: '14px 16px',
    color: '#fff', boxSizing: 'border-box',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10, paddingBottom: 10,
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  headerLabel: { fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.3px' },
  dot: { width: 7, height: 7, borderRadius: '50%', background: '#6ee7b7', boxShadow: '0 0 6px #6ee7b7' },
  balanceSection: { marginBottom: 12 },
  balanceLabel: { fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 3 },
  balance: { fontSize: 30, fontWeight: 700, letterSpacing: '-0.5px', lineHeight: 1.1 },
  statsRow: { display: 'flex', gap: 8, marginBottom: 12 },
  statCard: {
    flex: 1, display: 'flex', alignItems: 'center', gap: 9,
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 12, padding: '9px 11px',
  },
  arrowBadge: {
    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, fontWeight: 700,
  },
  statLabel: { fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '1px', textTransform: 'uppercase' },
  statValue: { fontSize: 11, fontWeight: 600, marginTop: 2 },
  divider: { height: 1, background: 'rgba(255,255,255,0.07)', margin: '0 0 10px' },
  walletList: { display: 'flex', flexDirection: 'column', gap: 4 },
  walletRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '7px 9px', borderRadius: 10, cursor: 'pointer',
    transition: 'background 0.15s ease',
  },
  walletLeft: { display: 'flex', alignItems: 'center', gap: 9 },
  walletBadge: { width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  walletName: { fontSize: 12, color: 'rgba(255,255,255,0.65)', fontWeight: 500 },
  walletBal: { fontSize: 12, fontWeight: 600 },
}
