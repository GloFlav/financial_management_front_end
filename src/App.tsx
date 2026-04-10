import { useState, useEffect, useRef, useCallback } from 'react'
import type { WalletItem, VoiceResult } from './types'
import AccountWidget from './widgets/AccountWidget'
import FixedChargesSection from './widgets/FixedChargesSection'
import TrendChart from './widgets/TrendChart'
import WalletModal from './widgets/WalletModal'
import TransferModal from './widgets/TransferModal'
import HistoryModal from './widgets/HistoryModal'
import VoiceConfirmModal from './widgets/VoiceConfirmModal'
import { useWebSocket } from './useWebSocket'

const API = import.meta.env.VITE_API_URL

// ── Toast ────────────────────────────────────────────────────────────
function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4000)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div style={{
      position: 'fixed', top: 14, right: 14, zIndex: 99999,
      background: 'rgba(110,231,183,0.12)', border: '1px solid rgba(110,231,183,0.3)',
      borderRadius: 12, padding: '10px 16px', color: '#6ee7b7',
      fontSize: 12, fontWeight: 600, maxWidth: 260,
      boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
    }}>
      {message}
    </div>
  )
}

// ── DragHandle ────────────────────────────────────────────────────────
function DragHandle() {
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    let prevX = e.screenX, prevY = e.screenY
    const onMove = (me: MouseEvent) => {
      const dx = me.screenX - prevX, dy = me.screenY - prevY
      prevX = me.screenX; prevY = me.screenY
      try { ;(window as any).webkit?.messageHandlers?.drag?.postMessage?.({ dx, dy }) } catch {}
    }
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }
  return (
    <div onMouseDown={handleMouseDown}
      style={{ display:'flex', justifyContent:'center', alignItems:'center',
        height:22, cursor:'grab', flexShrink:0, marginBottom:2, userSelect:'none' }}>
      <div style={{ display:'flex', gap:3 }}>
        {[0,1,2,3,4].map(i => (
          <div key={i} style={{ width:3,height:3,borderRadius:'50%',background:'rgba(255,255,255,0.2)' }}/>
        ))}
      </div>
    </div>
  )
}

// ── SendIcon ──────────────────────────────────────────────────────────
const SendIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
)

interface FinSettings {
  monthly_salary: number
  monthly_savings_goal: number
  exceptional_savings_amount: number
  exceptional_savings_month: number
  savings_wallet_id: number
}

export default function App() {
  const [wallets, setWallets] = useState<WalletItem[]>([])
  const [selectedWallet, setSelectedWallet] = useState<WalletItem | null>(null)
  const [showTransfer, setShowTransfer] = useState(false)
  const [voiceResult, setVoiceResult] = useState<VoiceResult | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<FinSettings | null>(null)
  const [settingsForm, setSettingsForm] = useState<FinSettings | null>(null)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const [footerText, setFooterText] = useState('')
  const [footerLoading, setFooterLoading] = useState(false)
  const bcRef = useRef<BroadcastChannel | null>(null)

  // ── WebSocket — refresh temps réel depuis le backend ─────────────
  useWebSocket(() => setRefreshKey(k => k + 1))

  // ── BroadcastChannel ─────────────────────────────────────────────
  useEffect(() => {
    const bc = new BroadcastChannel('mylife')
    bcRef.current = bc
    bc.onmessage = (e) => {
      if (e.data?.type === 'refresh') setRefreshKey(k => k + 1)
      if (e.data?.type === 'open_history') setShowHistory(true)
    }
    return () => bc.close()
  }, [])

  // ── Load settings ───────────────────────────────────────────────
  const loadSettings = () => {
    fetch(`${API}/finance/settings`)
      .then(r => r.json())
      .then((d: FinSettings) => { setSettings(d); setSettingsForm(d) })
      .catch(() => {})
  }
  useEffect(loadSettings, [])

  const saveSettings = async () => {
    if (!settingsForm) return
    setSettingsSaving(true)
    try {
      const r = await fetch(`${API}/finance/settings`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsForm),
      })
      if (!r.ok) throw new Error()
      const updated: FinSettings = await r.json()
      setSettings(updated); setSettingsForm(updated)
      setShowSettings(false)
      setToast('Paramètres enregistrés')
      setRefreshKey(k => k + 1)
    } catch { setToast('Erreur de sauvegarde') }
    finally { setSettingsSaving(false) }
  }

  // ── Auto-apply fixed charges ─────────────────────────────────────
  useEffect(() => {
    fetch(`${API}/finance/apply-fixed-charges`)
      .then(r => r.json())
      .then(data => {
        if (data.applied && data.applied > 0)
          setToast(`${data.applied} charge(s) fixe(s) appliquée(s) : ${data.charges?.join(', ') || ''}`)
      })
      .catch(() => {})
  }, [])

  // ── Footer send ──────────────────────────────────────────────────
  const sendFooter = useCallback(async (text: string) => {
    if (!text.trim() || footerLoading) return
    setFooterLoading(true)
    setFooterText('')
    try {
      const r = await fetch(`${API}/finance/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim(), history: [] }),
      })
      if (!r.ok) throw new Error()
      const data = await r.json()
      const isConversational = data.action === 'answer' || data.requires_confirmation === true
        || data.action === 'generate_excel' || data.action === 'generate_invoice'
        || data.action === 'generate_devis' || data.action === 'generate_report'
      if (isConversational) {
        bcRef.current?.postMessage({ type: 'chat_exchange', userText: text.trim(), result: data })
        try { ;(window as any).webkit?.messageHandlers?.chat?.postMessage?.('show') } catch {}
      } else {
        setRefreshKey(k => k + 1)
        setToast(data.message || 'Opération effectuée')
      }
    } catch {
      setToast('Erreur de connexion')
    } finally {
      setFooterLoading(false)
    }
  }, [footerLoading])

  const openChat = () => {
    bcRef.current?.postMessage({ type: 'show_chat' })
    try { ;(window as any).webkit?.messageHandlers?.chat?.postMessage?.('show') } catch {}
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      padding: '12px 12px 0', minHeight: '100vh', boxSizing: 'border-box',
      background: 'rgba(0,0,0,0.18)',
    }}>
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      <DragHandle />

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', marginBottom:6, gap:6 }}>
        <div style={{ position:'relative' }}>
          <button onClick={() => setShowExportMenu(m => !m)} style={{
            display:'flex', alignItems:'center', justifyContent:'center',
            width:28, height:28,
            background: showExportMenu ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.06)',
            border:`1px solid ${showExportMenu ? 'rgba(167,139,250,0.3)' : 'rgba(255,255,255,0.12)'}`,
            borderRadius:9, cursor:'pointer',
            color: showExportMenu ? '#a78bfa' : 'rgba(255,255,255,0.5)',
          }} title="Exporter">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
          {showExportMenu && (
            <div style={{
              position:'absolute', top:34, right:0, zIndex:9999,
              background:'rgba(20,20,28,0.98)', border:'1px solid rgba(255,255,255,0.12)',
              borderRadius:10, padding:5, minWidth:110,
              boxShadow:'0 8px 24px rgba(0,0,0,0.6)',
              fontFamily:'-apple-system,BlinkMacSystemFont,"SF Pro Display",sans-serif',
            }}>
              {[
                { label:'📄 PDF', url:`${API}/finance/transactions/export/pdf` },
                { label:'📊 CSV', url:`${API}/finance/transactions/export` },
              ].map(({ label, url }) => (
                <button key={url} onClick={() => {
                  setShowExportMenu(false)
                  const wk = (window as any).webkit?.messageHandlers?.download
                  if (wk) wk.postMessage(url)
                  else window.open(url, '_blank')
                }} style={{
                  display:'block', width:'100%', textAlign:'left',
                  padding:'7px 10px', borderRadius:7, cursor:'pointer',
                  background:'none', border:'none',
                  color:'rgba(255,255,255,0.72)', fontSize:11, fontWeight:500,
                  fontFamily:'inherit',
                }}
                onMouseEnter={e => (e.currentTarget.style.background='rgba(255,255,255,0.07)')}
                onMouseLeave={e => (e.currentTarget.style.background='none')}
                >{label}</button>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => { setShowSettings(true); loadSettings() }} style={{
          display:'flex', alignItems:'center', justifyContent:'center',
          width:28, height:28,
          background: showSettings ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.06)',
          border: `1px solid ${showSettings ? 'rgba(167,139,250,0.3)' : 'rgba(255,255,255,0.12)'}`,
          borderRadius:9, cursor:'pointer',
          color: showSettings ? '#a78bfa' : 'rgba(255,255,255,0.5)',
          transition:'background 0.15s ease, border-color 0.15s ease, color 0.15s ease',
        }} title="Paramètres financiers">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
        <button onClick={openChat} style={{
          display:'flex', alignItems:'center', gap:5,
          background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)',
          borderRadius:10, padding:'6px 12px', cursor:'pointer',
          color:'rgba(255,255,255,0.65)', fontSize:11, fontWeight:600,
          fontFamily:'-apple-system,BlinkMacSystemFont,"SF Pro Display",sans-serif',
          transition:'background 0.15s ease, border-color 0.15s ease, color 0.15s ease',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          Chat
        </button>
      </div>

      {/* Content */}
      <div style={{ flex:1 }}>
        <AccountWidget
          refreshKey={refreshKey}
          onDataLoaded={(ws: WalletItem[]) => setWallets(ws)}
          onWalletClick={(w: WalletItem) => setSelectedWallet(w)}
          onTransferClick={() => setShowTransfer(true)}
        />
        <TrendChart refreshKey={refreshKey} />
        <FixedChargesSection wallets={wallets} refreshKey={refreshKey} />
      </div>

      {/* Footer sticky — champ de saisie rapide */}
      <div style={{
        position: 'sticky', bottom: 0,
        padding: '8px 0 12px',
        background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.11)',
          borderRadius: 14, padding: '6px 8px 6px 12px',
        }}>
          <input
            value={footerText}
            onChange={e => setFooterText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && footerText.trim()) sendFooter(footerText) }}
            placeholder={footerLoading ? 'Envoi…' : 'Demande quelque chose…'}
            disabled={footerLoading}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: '#fff', fontSize: 11,
              fontFamily: '-apple-system,BlinkMacSystemFont,"SF Pro Display",sans-serif',
            }}
          />
          <button
            onClick={() => footerText.trim() && sendFooter(footerText)}
            disabled={!footerText.trim() || footerLoading}
            style={{
              width: 26, height: 26, borderRadius: 8, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: footerText.trim() && !footerLoading ? 'rgba(110,231,183,0.15)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${footerText.trim() && !footerLoading ? 'rgba(110,231,183,0.3)' : 'rgba(255,255,255,0.07)'}`,
              cursor: footerText.trim() && !footerLoading ? 'pointer' : 'default',
              color: footerText.trim() && !footerLoading ? '#6ee7b7' : 'rgba(255,255,255,0.2)',
              transition: 'all 0.2s ease',
            }}
          >
            <SendIcon />
          </button>
        </div>
      </div>

      {showTransfer && (
        <TransferModal wallets={wallets}
          onClose={() => setShowTransfer(false)}
          onSuccess={() => { setShowTransfer(false); setRefreshKey(k => k + 1) }}
        />
      )}
      {selectedWallet !== null && (
        <WalletModal wallet={selectedWallet}
          onClose={() => setSelectedWallet(null)}
          onSuccess={() => { setSelectedWallet(null); setRefreshKey(k => k + 1) }}
        />
      )}
      {showHistory && <HistoryModal onClose={() => setShowHistory(false)} />}
      {voiceResult !== null && (
        <VoiceConfirmModal result={voiceResult} wallets={wallets}
          onClose={() => setVoiceResult(null)}
          onSuccess={() => { setVoiceResult(null); setRefreshKey(k => k + 1) }}
        />
      )}

      {/* Settings modal */}
      {showSettings && settingsForm && (
        <div style={{
          position:'fixed', inset:0, zIndex:9999,
          background:'rgba(0,0,0,0.75)',
          display:'flex', alignItems:'center', justifyContent:'center',
        }} onClick={() => setShowSettings(false)}>
          <div style={{
            background:'rgba(18,18,28,0.97)', border:'1px solid rgba(255,255,255,0.1)',
            borderRadius:18, padding:'20px 20px 16px', width:280, boxSizing:'border-box',
            boxShadow:'0 24px 64px rgba(0,0,0,0.7)',
            fontFamily:'-apple-system,BlinkMacSystemFont,"SF Pro Display",sans-serif',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#fff' }}>Paramètres financiers</div>
              <button onClick={() => setShowSettings(false)} style={{
                width:22, height:22, borderRadius:6, border:'1px solid rgba(255,255,255,0.1)',
                background:'rgba(255,255,255,0.05)', cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'center',
                color:'rgba(255,255,255,0.4)',
              }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Épargne actuelle (virtuelle dans compte bancaire) */}
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:10, color:'#a78bfa', marginBottom:4, fontWeight:600, letterSpacing:'0.3px', textTransform:'uppercase' }}>Épargne actuelle</div>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.25)', marginBottom:6 }}>Montant épargné dans ton compte bancaire (virtuel — pas un wallet séparé)</div>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <input
                  type="number"
                  value={(settingsForm as any).current_savings_balance ?? 0}
                  onChange={e => setSettingsForm(f => f ? { ...f, current_savings_balance: Number(e.target.value) } : f)}
                  style={{
                    flex:1, background:'rgba(167,139,250,0.07)', border:'1px solid rgba(167,139,250,0.2)',
                    borderRadius:8, padding:'7px 10px', color:'#fff', fontSize:12, outline:'none',
                    fontFamily:'-apple-system,BlinkMacSystemFont,"SF Pro Display",sans-serif',
                  }}
                />
                <span style={{ fontSize:11, color:'rgba(255,255,255,0.3)', flexShrink:0 }}>Ar</span>
              </div>
            </div>

            {[
              { key:'monthly_salary', label:'Salaire mensuel', hint:'Ton revenu mensuel net' },
              { key:'monthly_savings_goal', label:'Épargne mensuelle (défaut)', hint:'Minimum NON NÉGOCIABLE chaque mois' },
            ].map(({ key, label, hint }) => (
              <div key={key} style={{ marginBottom:12 }}>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)', marginBottom:4, fontWeight:600, letterSpacing:'0.3px', textTransform:'uppercase' }}>{label}</div>
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.25)', marginBottom:6 }}>{hint}</div>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <input
                    type="number"
                    value={(settingsForm as any)[key]}
                    onChange={e => setSettingsForm(f => f ? { ...f, [key]: Number(e.target.value) } : f)}
                    style={{
                      flex:1, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)',
                      borderRadius:8, padding:'7px 10px', color:'#fff', fontSize:12, outline:'none',
                      fontFamily:'-apple-system,BlinkMacSystemFont,"SF Pro Display",sans-serif',
                    }}
                  />
                  <span style={{ fontSize:11, color:'rgba(255,255,255,0.3)', flexShrink:0 }}>Ar</span>
                </div>
              </div>
            ))}

            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:10, color:'#a78bfa', marginBottom:4, fontWeight:600, letterSpacing:'0.3px', textTransform:'uppercase' }}>Épargne exceptionnelle ce mois</div>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.25)', marginBottom:6 }}>Override ponctuel — 0 = utiliser le défaut</div>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <input
                  type="number"
                  value={settingsForm.exceptional_savings_amount}
                  onChange={e => {
                    const v = Number(e.target.value)
                    const now = new Date()
                    const yyyymm = now.getFullYear() * 100 + now.getMonth() + 1
                    setSettingsForm(f => f ? { ...f, exceptional_savings_amount: v, exceptional_savings_month: v > 0 ? yyyymm : 0 } : f)
                  }}
                  style={{
                    flex:1, background:'rgba(167,139,250,0.07)', border:'1px solid rgba(167,139,250,0.2)',
                    borderRadius:8, padding:'7px 10px', color:'#fff', fontSize:12, outline:'none',
                    fontFamily:'-apple-system,BlinkMacSystemFont,"SF Pro Display",sans-serif',
                  }}
                />
                <span style={{ fontSize:11, color:'rgba(255,255,255,0.3)', flexShrink:0 }}>Ar</span>
              </div>
              {settingsForm.exceptional_savings_amount > 0 && (
                <div style={{ fontSize:10, color:'#a78bfa', marginTop:5 }}>
                  +{(settingsForm.exceptional_savings_amount - (settings?.monthly_savings_goal ?? 1_000_000)).toLocaleString('fr-FR')} Ar vs défaut — s'applique uniquement ce mois
                </div>
              )}
            </div>

            <button onClick={saveSettings} disabled={settingsSaving} style={{
              width:'100%', padding:'9px 0', borderRadius:10, cursor:settingsSaving ? 'default' : 'pointer',
              background: settingsSaving ? 'rgba(255,255,255,0.05)' : 'rgba(110,231,183,0.12)',
              border:`1px solid ${settingsSaving ? 'rgba(255,255,255,0.08)' : 'rgba(110,231,183,0.3)'}`,
              color: settingsSaving ? 'rgba(255,255,255,0.3)' : '#6ee7b7',
              fontSize:12, fontWeight:700,
              fontFamily:'-apple-system,BlinkMacSystemFont,"SF Pro Display",sans-serif',
              transition:'background 0.15s ease, border-color 0.15s ease, color 0.15s ease',
            }}>
              {settingsSaving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
