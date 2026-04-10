import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import type { CSSProperties, ChangeEvent } from 'react'
import { useWebSocket } from '../useWebSocket'
import { useWakeWord } from '../useWakeWord'

interface Transaction {
  id: number; type: string; amount: number; category: string
  description: string | null; wallet_name: string; date: string
}
interface PendingItem { id: number; name: string; amount: number; kind: 'charge' | 'provisional' }
interface BudgetAlert { category: string; spent: number; limit: number; ratio: number }

type NotifItem =
  | { kind: 'salary' }
  | { kind: 'pending'; item: PendingItem }
  | { kind: 'budget';  alert: BudgetAlert }
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

function SettingsPanel({ settingsSalary, setSettingsSalary, saveSettings, onClose }: {
  settingsSalary: number
  setSettingsSalary: (v: number) => void
  saveSettings: () => void
  onClose: () => void
}) {
  return (
    <div style={{ padding:'8px 12px 10px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <span style={{ fontSize:10, color:'rgba(255,255,255,0.45)', fontWeight:600 }}>Salaire mensuel attendu</span>
        <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.25)', fontSize:10, padding:0 }}>✕</button>
      </div>
      <div style={{ display:'flex', gap:6 }}>
        <input value={settingsSalary}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setSettingsSalary(Number(e.target.value.replace(/\D/g,'')))}
          style={{ width:'100%', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)',
            borderRadius:8, padding:'5px 8px', color:'#fff', fontSize:11, outline:'none',
            fontFamily:'-apple-system,BlinkMacSystemFont,"SF Pro Display",sans-serif',
            boxSizing:'border-box', flex:1 } as CSSProperties} inputMode="numeric"/>
        <button onClick={saveSettings} style={{
          padding:'4px 10px', borderRadius:8, border:'1px solid rgba(110,231,183,0.3)',
          background:'rgba(110,231,183,0.1)', color:'#6ee7b7', fontSize:10,
          cursor:'pointer', fontFamily:'-apple-system,BlinkMacSystemFont,"SF Pro Display",sans-serif',
        }}>OK</button>
      </div>
    </div>
  )
}

// ── Icones SVG ───────────────────────────────────────────────────────
const IcoMoney   = () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2M12 12v4M10 14h4"/></svg>
const IcoRepeat  = () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
const IcoPin     = () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
const IcoWarn    = () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
const IcoTip     = () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
const IcoMic     = () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
const IcoLoader  = () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
const IcoCheck   = () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
const IcoRefresh = () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.49-4.95"/></svg>

export default function DynamicIsland() {
  const [txs, setTxs]             = useState<Transaction[]>([])
  const [tip, setTip]             = useState<{ tip: string; type: string } | null>(null)
  const [pending, setPending]     = useState<PendingItem[]>([])
  const [budgetAlerts, setBudgetAlerts] = useState<BudgetAlert[]>([])
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

  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const bcRef       = useRef<BroadcastChannel | null>(null)
  const firstLoadRef = useRef(true)

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
    fetch(`${API}/finance/category-budgets`)
      .then(r => r.json())
      .then((data: Array<{ category: string; spent: number; effective_limit: number; ratio: number }>) => {
        setBudgetAlerts(data
          .filter(b => b.ratio >= 0.8)
          .map(b => ({ category: b.category, spent: b.spent, limit: b.effective_limit, ratio: b.ratio }))
        )
      }).catch(() => {})
  }

  useEffect(() => { loadAll() }, [])
  useWebSocket(loadAll)

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
      if (firstLoadRef.current) {
        // Premier chargement : afficher immédiatement sans vérifier le cooldown
        firstLoadRef.current = false
        localStorage.setItem('salary_notif_ts', String(Date.now()))
        setTimeout(() => {
          try { ;(window as any).webkit?.messageHandlers?.island?.postMessage?.({ show: true }) } catch {}
        }, 500)
      } else {
        const last = parseInt(localStorage.getItem('salary_notif_ts') || '0')
        if (Date.now() - last > 3 * 60 * 60 * 1000) {
          localStorage.setItem('salary_notif_ts', String(Date.now()))
          setTimeout(() => {
            try { ;(window as any).webkit?.messageHandlers?.island?.postMessage?.({ show: true }) } catch {}
          }, 2000)
        }
      }
    } else {
      firstLoadRef.current = false
    }
  }, [txs])

  const items: NotifItem[] = useMemo(() => {
    const now = new Date(), day = now.getDate()
    const list: NotifItem[] = []

    // Rappel salaire : tous les jours jusqu'à confirmation
    if (!salaryConfirmed && !salaryDismissedToday)
      list.push({ kind: 'salary' })

    // Alertes budget (≥ 80 %)
    budgetAlerts.forEach(alert => list.push({ kind: 'budget', alert }))

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
  }, [txs, tip, pending, budgetAlerts, salaryConfirmed, salaryDismissedToday])

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
    else if (view === 'settings')    sendIslandHeight(100)
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

  // ── Wake word ──────────────────────────────────────────────────
  const handleWakeResult = useCallback((userText: string, data: any) => {
    bcRef.current?.postMessage({ type: 'refresh' })
    // Toujours ouvrir le chat pour montrer le résultat
    bcRef.current?.postMessage({ type: 'chat_exchange', userText, result: data })
    try { ;(window as any).webkit?.messageHandlers?.chat?.postMessage?.('show') } catch {}
  }, [])

  const { state: wakeState, transcript: wakeTranscript, enable: enableWake, disable: disableWake } = useWakeWord(API, handleWakeResult)
  const wakeActive = wakeState !== 'off'

  const renderNotif = () => {
    const item = items[notifIdx]
    if (!item) return null

    if (item.kind === 'salary') return (
      <div style={{ display:'flex', alignItems:'center', gap:5, width:'100%' }}>
        <span style={{ flexShrink:0, color:'#fcd34d' }}><IcoMoney /></span>
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
          <span style={{ flexShrink:0, color:'#fca5a5' }}>{p.kind === 'charge' ? <IcoRepeat /> : <IcoPin />}</span>
          <span style={{ ...s.text('#fca5a5'), flex:1 }}>{label}</span>
          <span style={{ fontSize:10, color:'#fca5a5', fontWeight:600, flexShrink:0 }}>
            {fmt(p.amount)}
          </span>
        </div>
      )
    }

    if (item.kind === 'budget') {
      const { alert } = item
      const over = alert.ratio >= 1
      const pct  = Math.round(alert.ratio * 100)
      const cat  = alert.category.charAt(0).toUpperCase() + alert.category.slice(1)
      return (
        <div style={{ display:'flex', alignItems:'center', gap:6, width:'100%' }}>
          <span style={{ flexShrink:0, color: over ? '#fca5a5' : '#fcd34d' }}><IcoWarn /></span>
          <span style={{ ...s.text(over ? '#fca5a5' : '#fcd34d'), flex:1 }}>Budget {cat} : {pct}%</span>
          <span style={{ fontSize:10, color: over ? '#fca5a5' : '#fcd34d', fontWeight:600, flexShrink:0 }}>
            {alert.spent.toLocaleString('fr-FR')} Ar
          </span>
        </div>
      )
    }

    if (item.kind === 'tip') return <>
      <span style={{ flexShrink:0, color: item.warn ? '#fcd34d' : 'rgba(255,255,255,0.4)' }}>{item.warn ? <IcoWarn /> : <IcoTip />}</span>
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

  const handleBarDoubleClick = () => {
    try { ;(window as any).webkit?.messageHandlers?.island?.postMessage?.({ collapse: true }) } catch {}
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
          <div onDoubleClick={handleBarDoubleClick} style={{ display:'flex', alignItems:'center', height:36, padding:'0 10px', gap:6 }}>
            <div style={{ flex:1, minWidth:0, overflow:'hidden' }}>
              {/* Affichage état wake word en priorité */}
              {wakeState === 'recording' ? (
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ flexShrink:0, color:'#fca5a5' }}><IcoMic /></span>
                  <span style={{ fontSize:11, color:'#fca5a5', fontWeight:600 }}>Parle maintenant…</span>
                  <button onClick={() => { disableWake(); setTimeout(enableWake, 300) }} title="Recommencer" style={{ background:'none', border:'none', cursor:'pointer', padding:0, color:'rgba(252,165,165,0.5)', flexShrink:0, marginLeft:2 }}>
                    <IcoRefresh />
                  </button>
                </div>
              ) : wakeState === 'processing' ? (
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ flexShrink:0, color:'#fcd34d' }}><IcoLoader /></span>
                  <span style={{ fontSize:11, color:'#fcd34d' }}>Traitement…</span>
                </div>
              ) : wakeState === 'detected' ? (
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ flexShrink:0, color:'#6ee7b7' }}><IcoCheck /></span>
                  <span style={{ fontSize:11, color:'#6ee7b7', fontWeight:600 }}>Note pour compta detecte</span>
                </div>
              ) : wakeState === 'listening' && wakeTranscript ? (
                <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <span style={{ flexShrink:0, color:'rgba(110,231,183,0.5)' }}><IcoMic /></span>
                  <span style={{ fontSize:10, color:'rgba(255,255,255,0.35)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>
                    {wakeTranscript}
                  </span>
                  <button onClick={() => { disableWake(); setTimeout(enableWake, 300) }} title="Recommencer l'ecoute" style={{ background:'none', border:'none', cursor:'pointer', padding:0, color:'rgba(255,255,255,0.2)', flexShrink:0 }}>
                    <IcoRefresh />
                  </button>
                </div>
              ) : (
                <div key={animKey} style={{ display:'flex', alignItems:'center', gap:7,
                  animation:'slideUpIn 0.38s cubic-bezier(0.34,1.3,0.64,1)' as any }}>
                  {renderNotif()}
                </div>
              )}
            </div>
            {/* Indicateur wake word */}
            <button onClick={() => wakeActive ? disableWake() : enableWake()} style={{
              background:'none', border:'none', cursor:'pointer', padding:2, flexShrink:0,
              display:'flex', alignItems:'center', gap:3,
            }} title={wakeActive ? 'Wake word actif — cliquer pour désactiver' : 'Activer "note financière"'}>
              <div style={{
                width:5, height:5, borderRadius:'50%', flexShrink:0,
                background: wakeState==='recording' ? '#fca5a5'
                  : wakeState==='processing'  ? '#fcd34d'
                  : wakeState==='detected'    ? '#6ee7b7'
                  : wakeState==='listening'   ? '#6ee7b7'
                  : 'rgba(255,255,255,0.15)',
                boxShadow: wakeState==='listening' || wakeState==='recording'
                  ? '0 0 5px currentColor' : 'none',
                animation: wakeState==='listening' ? 'pulse 2s ease-in-out infinite'
                  : wakeState==='recording'  ? 'pulse 0.6s ease-in-out infinite' : 'none',
              }}/>
            </button>
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
              <span style={{ fontSize:10, color:'#fcd34d', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}><IcoMoney /> Paie recue</span>
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
          <SettingsPanel
            settingsSalary={settingsSalary}
            setSettingsSalary={setSettingsSalary}
            saveSettings={saveSettings}
            onClose={() => setView('notif')}
          />
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
