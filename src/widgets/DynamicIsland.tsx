import { useEffect, useRef, useState, useMemo } from 'react'
import type { CSSProperties, ChangeEvent } from 'react'

interface Transaction {
  id: number; type: string; amount: number; category: string
  description: string | null; wallet_name: string; date: string
}
interface PendingItem { id: number; name: string; amount: number; kind: 'charge' | 'provisional' }

type NotifItem =
  | { kind: 'salary' }
  | { kind: 'pending'; item: PendingItem }
  | { kind: 'tip';  text: string; warn: boolean }
  | { kind: 'tx';   tx: Transaction }

type View = 'notif' | 'salary_form' | 'settings'

const API = import.meta.env.VITE_API_URL
const fmt = (n: number) => n.toLocaleString('fr-FR') + ' Ar'
const SALARY_KEY = 'expected_salary'
const DEFAULT_SALARY = 2_500_000  // sync avec backend user_settings.monthly_salary

function getExpectedSalary() {
  return parseInt(localStorage.getItem(SALARY_KEY) || String(DEFAULT_SALARY))
}
function sendIslandHeight(h: number) {
  try { ;(window as any).webkit?.messageHandlers?.island?.postMessage?.({ height: h }) } catch {}
}

export default function DynamicIsland() {
  const [txs, setTxs]             = useState<Transaction[]>([])
  const [tip, setTip]             = useState<{ tip: string; type: string } | null>(null)
  const [pending, setPending]     = useState<PendingItem[]>([])
  const [notifIdx, setNotifIdx]   = useState(0)
  const [animKey, setAnimKey]     = useState(0)
  const [salaryConfirmed, setSalaryConfirmed] = useState(false)
  const [salaryDismissedToday, setSalaryDismissedToday] = useState(
    () => localStorage.getItem('salary_dismiss_date') === new Date().toDateString()
  )
  const [dismissFeedback, setDismissFeedback] = useState(false)
  const [view, setView]           = useState<View>('notif')
  const [salaryAmt, setSalaryAmt] = useState(DEFAULT_SALARY)
  const [bonusAmt, setBonusAmt]   = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [settingsSalary, setSettingsSalary] = useState(DEFAULT_SALARY)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const bcRef    = useRef<BroadcastChannel | null>(null)

  useEffect(() => {
    const bc = new BroadcastChannel('mylife')
    bcRef.current = bc
    // Recharger transactions et pending quand un refresh arrive
    bc.onmessage = (e) => {
      if (e.data?.type === 'refresh') loadAll()
    }
    return () => bc.close()
  }, [])

  const loadAll = () => {
    fetch(`${API}/finance/transactions?limit=10`)
      .then(r => r.json()).then(setTxs).catch(() => {})
    fetch(`${API}/finance/pending-payments`)
      .then(r => r.json()).then(d => setPending(d.items || [])).catch(() => {})
  }

  useEffect(() => {
    loadAll()
    const id = setInterval(loadAll, 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    fetch(`${API}/finance/smart-tip`)
      .then(r => r.json()).then(setTip).catch(() => {})
  }, [])

  // Détecter salaire + rappel 3h
  useEffect(() => {
    const now = new Date()
    const confirmed = !!txs.find(tx => {
      const d = new Date(tx.date)
      return tx.type === 'income' && tx.category === 'salaire'
        && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    setSalaryConfirmed(confirmed)
    if (confirmed && view === 'salary_form') { setView('notif'); sendIslandHeight(46) }

    const dismissedToday = localStorage.getItem('salary_dismiss_date') === new Date().toDateString()
    if (!confirmed && !dismissedToday) {
      const last = parseInt(localStorage.getItem('salary_notif_ts') || '0')
      if (Date.now() - last > 3 * 60 * 60 * 1000) {
        localStorage.setItem('salary_notif_ts', String(Date.now()))
        setTimeout(() => {
          try { ;(window as any).webkit?.messageHandlers?.island?.postMessage?.({ show: true }) } catch {}
        }, 2000)
      }
    }
  }, [txs])

  const items: NotifItem[] = useMemo(() => {
    const now = new Date(), day = now.getDate()
    const list: NotifItem[] = []

    // Rappel salaire : tous les jours jusqu'à confirmation
    if (!salaryConfirmed && !salaryDismissedToday)
      list.push({ kind: 'salary' })

    // Dès le 14 : rappel pour chaque charge fixe non payée
    if (day >= 14)
      pending.filter(item => item.kind === 'charge').forEach(item => list.push({ kind: 'pending', item }))

    // Après paie confirmée : rappels prévisionnelles + charges restantes (avant le 14)
    if (salaryConfirmed && day < 14)
      pending.forEach(item => list.push({ kind: 'pending', item }))

    if (tip?.tip) list.push({ kind: 'tip', text: tip.tip, warn: tip.type === 'warning' })
    txs.slice(0, 3).forEach(tx => list.push({ kind: 'tx', tx }))
    if (list.length === 0) list.push({ kind: 'tip', text: 'Finances stables', warn: false })
    return list
  }, [txs, tip, pending, salaryConfirmed, salaryDismissedToday])

  useEffect(() => {
    if (view !== 'notif') return
    timerRef.current = setInterval(() => {
      setNotifIdx(i => { const n = (i + 1) % items.length; setAnimKey(k => k + 1); return n })
    }, 4000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [view, items.length])

  useEffect(() => {
    if (view === 'notif')        sendIslandHeight(46)
    else if (view === 'salary_form') sendIslandHeight(120)
    else if (view === 'settings')    sendIslandHeight(90)
  }, [view])

  const openSalaryForm = () => { setSalaryAmt(getExpectedSalary()); setBonusAmt(0); setView('salary_form') }

  const submitSalary = async () => {
    if (submitting) return
    setSubmitting(true)
    const bonus = bonusAmt > 0 ? ` et une prime de ${bonusAmt} Ar` : ''
    const msg = `J'ai reçu mon salaire de ${salaryAmt} Ar sur mon compte bancaire${bonus}`
    try {
      const r = await fetch(`${API}/finance/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history: [] }),
      })
      const data = await r.json()
      bcRef.current?.postMessage({ type: 'refresh' })
      if (data.action === 'answer' || data.requires_confirmation) {
        bcRef.current?.postMessage({ type: 'chat_exchange', userText: msg, result: data })
        try { ;(window as any).webkit?.messageHandlers?.chat?.postMessage?.('show') } catch {}
      }
    } catch {}
    setSubmitting(false)
    setView('notif')
  }

  const saveSettings = () => { localStorage.setItem(SALARY_KEY, String(settingsSalary)); setView('notif') }
  const openSettings = () => { setSettingsSalary(getExpectedSalary()); setView('settings') }

  const renderNotif = () => {
    const item = items[notifIdx]
    if (!item) return null

    if (item.kind === 'salary') return (
      <div style={{ display:'flex', alignItems:'center', gap:5, width:'100%' }}>
        <span style={{ fontSize:10, flexShrink:0 }}>💰</span>
        <span style={{ ...s.text('#fcd34d'), flex:1 }}>Paie reçue ce mois ?</span>
        <button onClick={openSalaryForm} style={s.pill('#6ee7b7')}>Oui</button>
        <button onClick={() => {
          localStorage.setItem('salary_dismiss_date', new Date().toDateString())
          setDismissFeedback(true)
          setTimeout(() => { setSalaryDismissedToday(true); setDismissFeedback(false) }, 1200)
        }} style={{
          background:'none', border:'none', cursor:'pointer', padding:'2px 4px',
          color: dismissFeedback ? '#6ee7b7' : 'rgba(255,255,255,0.25)',
          fontSize:10, flexShrink:0,
          fontFamily:'-apple-system,BlinkMacSystemFont,"SF Pro Display",sans-serif',
          textDecoration:'underline', textUnderlineOffset:'2px', transition:'color 0.2s',
        }}>{dismissFeedback ? '✓ ok' : "pas aujourd'hui"}</button>
      </div>
    )

    if (item.kind === 'pending') {
      const p = item.item
      const day = new Date().getDate()
      const label = p.kind === 'charge' && day >= 14
        ? `Payé ce mois ? ${p.name}`
        : p.kind === 'charge' ? `Charge : ${p.name}` : `Prévu : ${p.name}`
      return (
        <div style={{ display:'flex', alignItems:'center', gap:6, width:'100%' }}>
          <span style={{ fontSize:10, flexShrink:0 }}>{p.kind === 'charge' ? '🔁' : '📌'}</span>
          <span style={{ ...s.text('#fca5a5'), flex:1 }}>{label}</span>
          <span style={{ fontSize:10, color:'#fca5a5', fontWeight:600, flexShrink:0 }}>
            {fmt(p.amount)}
          </span>
        </div>
      )
    }

    if (item.kind === 'tip') return <>
      <span style={{ fontSize:10, flexShrink:0 }}>{item.warn ? '⚠' : '💡'}</span>
      <span style={s.text(item.warn ? '#fcd34d' : 'rgba(255,255,255,0.6)')}>{item.text}</span>
    </>

    const tx = item.tx
    return <>
      <span style={{ width:5,height:5,borderRadius:'50%',flexShrink:0,background:tx.type==='income'?'#6ee7b7':'#fca5a5'}}/>
      <span style={{ fontSize:11,fontWeight:600,flexShrink:0,color:tx.type==='income'?'#6ee7b7':'#fca5a5'}}>
        {tx.type==='income'?'+':'−'}{fmt(tx.amount)}
      </span>
      <span style={s.text('rgba(255,255,255,0.3)')}>{tx.category} · {tx.wallet_name}</span>
    </>
  }

  return (
    <div style={{ position:'relative', zIndex:10 } as CSSProperties}>
      <div style={{
        width:'100%', boxSizing:'border-box',
        background:'rgba(14,14,18,0.98)',
        borderRadius:16, border:'1px solid rgba(255,255,255,0.08)',
        boxShadow:'0 6px 24px rgba(0,0,0,0.55),inset 0 1px 0 rgba(255,255,255,0.05)',
        fontFamily:'-apple-system,BlinkMacSystemFont,"SF Pro Display",sans-serif',
        overflow:'hidden',
      }}>
        {/* ── Notifications ── */}
        {view === 'notif' && <>
          <div style={{ display:'flex', alignItems:'center', height:36, padding:'0 10px', gap:6 }}>
            <div style={{ flex:1, minWidth:0, overflow:'hidden' }}>
              <div key={animKey} style={{ display:'flex', alignItems:'center', gap:7,
                animation:'slideUpIn 0.38s cubic-bezier(0.34,1.3,0.64,1)' as any }}>
                {renderNotif()}
              </div>
            </div>
            <button onClick={openSettings} style={{ background:'none',border:'none',cursor:'pointer',
              padding:2,color:'rgba(255,255,255,0.18)',flexShrink:0 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/>
              </svg>
            </button>
          </div>
          {items.length > 1 && (
            <div style={{ display:'flex', gap:3, justifyContent:'center', paddingBottom:5 }}>
              {items.map((_, i) => (
                <div key={i} onClick={() => { setNotifIdx(i); setAnimKey(k => k+1) }} style={{
                  height:2, width:i===notifIdx?10:3, borderRadius:2,
                  background:i===notifIdx?'#6ee7b7':'rgba(255,255,255,0.12)',
                  transition:'background 0.15s ease', cursor:'pointer',
                }}/>
              ))}
            </div>
          )}
        </>}

        {/* ── Formulaire salaire ── */}
        {view === 'salary_form' && (
          <div style={{ padding:'8px 12px 10px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <span style={{ fontSize:10, color:'#fcd34d', fontWeight:600 }}>💰 Paie reçue</span>
              <button onClick={() => setView('notif')} style={s.closeBtn}>✕</button>
            </div>
            <div style={{ display:'flex', gap:6, marginBottom:6 }}>
              <div style={{ flex:1 }}>
                <div style={s.label}>Salaire</div>
                <input value={salaryAmt}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setSalaryAmt(Number(e.target.value.replace(/\D/g,'')))}
                  style={s.input} inputMode="numeric"/>
              </div>
              <div style={{ flex:1 }}>
                <div style={s.label}>Prime</div>
                <input value={bonusAmt}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setBonusAmt(Number(e.target.value.replace(/\D/g,'')))}
                  style={s.input} inputMode="numeric"/>
              </div>
            </div>
            <button onClick={submitSalary} disabled={submitting} style={{
              width:'100%', padding:'6px', borderRadius:8, border:'1px solid rgba(110,231,183,0.3)',
              cursor:'pointer', background:'rgba(110,231,183,0.12)',
              color:'#6ee7b7', fontSize:11, fontWeight:600,
              fontFamily:'-apple-system,BlinkMacSystemFont,"SF Pro Display",sans-serif',
            }}>
              {submitting ? '…' : 'Confirmer'}
            </button>
          </div>
        )}

        {/* ── Settings ── */}
        {view === 'settings' && (
          <div style={{ padding:'8px 12px 10px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <span style={{ fontSize:10, color:'rgba(255,255,255,0.45)', fontWeight:600 }}>Salaire mensuel attendu</span>
              <button onClick={() => setView('notif')} style={s.closeBtn}>✕</button>
            </div>
            <div style={{ display:'flex', gap:6 }}>
              <input value={settingsSalary}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSettingsSalary(Number(e.target.value.replace(/\D/g,'')))}
                style={{ ...s.input, flex:1 }} inputMode="numeric"/>
              <button onClick={saveSettings} style={{
                padding:'4px 10px', borderRadius:8, border:'1px solid rgba(110,231,183,0.3)',
                background:'rgba(110,231,183,0.1)', color:'#6ee7b7', fontSize:10,
                cursor:'pointer', fontFamily:'-apple-system,BlinkMacSystemFont,"SF Pro Display",sans-serif',
              }}>OK</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const s = {
  text: (color: string): CSSProperties => ({
    fontSize:11, color, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
  }),
  pill: (color: string): CSSProperties => ({
    background:`${color}20`, border:`1px solid ${color}50`,
    borderRadius:6, padding:'2px 7px', cursor:'pointer',
    color, fontSize:10, fontWeight:600, flexShrink:0,
    fontFamily:'-apple-system,BlinkMacSystemFont,"SF Pro Display",sans-serif',
  }),
  label: { fontSize:8, color:'rgba(255,255,255,0.3)', marginBottom:2, textTransform:'uppercase' as const, letterSpacing:'0.5px' },
  input: {
    width:'100%', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)',
    borderRadius:8, padding:'5px 8px', color:'#fff', fontSize:11, outline:'none',
    fontFamily:'-apple-system,BlinkMacSystemFont,"SF Pro Display",sans-serif',
    boxSizing:'border-box',
  } as CSSProperties,
  closeBtn: {
    background:'none', border:'none', cursor:'pointer',
    color:'rgba(255,255,255,0.25)', fontSize:10, padding:0,
  } as CSSProperties,
}
