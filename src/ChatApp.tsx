import { useState, useEffect, useRef, useCallback } from 'react'
import type { CSSProperties } from 'react'

const API = import.meta.env.VITE_API_URL
const fmt = (n: number) => n.toLocaleString('fr-FR') + ' Ar'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  action?: ChatAction | null
  timestamp: number
}

interface ChatAction {
  action: string
  message: string
  requires_confirmation: boolean
  data?: Record<string, unknown> | null
  pdf_base64?: string
  filename?: string
}

// ── Icons ──────────────────────────────────────────────────────────
const SendIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
)

const DownloadIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)

const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

// ── Action Card ────────────────────────────────────────────────────
function ActionCard({ action, onConfirm, onDownload }: {
  action: ChatAction
  onConfirm: () => void
  onDownload?: () => void
}) {
  const needsPDF = action.action === 'generate_invoice' || action.action === 'generate_devis' || action.action === 'generate_report'
  const needsExcel = action.action === 'generate_excel'
  const needsConfirm = action.requires_confirmation &&
    (action.action === 'add_transaction' || action.action === 'add_multiple_transactions'
     || action.action === 'transfer' || action.action === 'create_wallet'
     || action.action === 'add_fixed_charge'
     || action.action === 'add_provisional_expense' || action.action === 'update_provisional_expense'
     || action.action === 'delete_provisional_expense' || action.action === 'update_settings')

  if (action.action === 'answer') return null

  const dataStr = action.data ? JSON.stringify(action.data, null, 2) : ''

  return (
    <div style={{
      marginTop: 8,
      background: 'rgba(110,231,183,0.07)',
      border: '1px solid rgba(110,231,183,0.2)',
      borderRadius: 12, padding: '10px 12px',
      fontSize: 11, color: 'rgba(255,255,255,0.7)',
    }}>
      <div style={{ fontSize: 10, color: '#6ee7b7', fontWeight: 700, letterSpacing: '0.5px', marginBottom: 6, textTransform: 'uppercase' }}>
        {action.action.replace(/_/g, ' ')}
      </div>
      {dataStr && (
        <pre style={{
          fontSize: 10, color: 'rgba(255,255,255,0.45)',
          background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '6px 8px',
          overflow: 'auto', maxHeight: 120, marginBottom: 8, whiteSpace: 'pre-wrap',
          fontFamily: 'SF Mono, Monaco, monospace',
        }}>{dataStr}</pre>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        {needsConfirm && (
          <button onClick={onConfirm} style={actionBtnStyle('#6ee7b7')}>
            <CheckIcon /> Confirmer
          </button>
        )}
        {needsPDF && onDownload && (
          <button onClick={onDownload} style={actionBtnStyle('#a78bfa')}>
            <DownloadIcon /> PDF
          </button>
        )}
        {needsExcel && onDownload && (
          <button onClick={onDownload} style={actionBtnStyle('#34d399')}>
            <DownloadIcon /> Excel
          </button>
        )}
      </div>
    </div>
  )
}

function actionBtnStyle(color: string): CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 5,
    background: `${color}15`, border: `1px solid ${color}35`,
    borderRadius: 8, padding: '5px 10px', cursor: 'pointer',
    color, fontSize: 11, fontWeight: 600,
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
    transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease',
  }
}

// ── Chat Bubble ────────────────────────────────────────────────────
function Bubble({ msg, onConfirm, onDownload }: {
  msg: ChatMessage
  onConfirm: (msg: ChatMessage) => void
  onDownload: (msg: ChatMessage) => void
}) {
  const isUser = msg.role === 'user'
  return (
    <div style={{
      display: 'flex',
      flexDirection: isUser ? 'row-reverse' : 'row',
      alignItems: 'flex-start', gap: 8, marginBottom: 10,
    }}>
      {/* Avatar */}
      <div style={{
        width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
        background: isUser ? 'rgba(110,231,183,0.2)' : 'rgba(167,139,250,0.2)',
        border: `1px solid ${isUser ? 'rgba(110,231,183,0.3)' : 'rgba(167,139,250,0.3)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, color: isUser ? '#6ee7b7' : '#a78bfa', fontWeight: 700,
      }}>
        {isUser ? 'G' : 'ZK'}
      </div>

      {/* Bubble */}
      <div style={{ maxWidth: '78%' }}>
        <div style={{
          background: isUser ? 'rgba(110,231,183,0.1)' : 'rgba(255,255,255,0.06)',
          border: `1px solid ${isUser ? 'rgba(110,231,183,0.2)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: isUser ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
          padding: '9px 12px',
          fontSize: 12, color: isUser ? '#e2f9f0' : 'rgba(255,255,255,0.85)',
          lineHeight: 1.6,
        }}>
          {msg.content.split('\n\n').map((para, i) => (
            <p key={i} style={{ margin: i > 0 ? '8px 0 0' : 0 }}>{para}</p>
          ))}
          {msg.action && msg.action.action !== 'answer' && (
            <ActionCard
              action={msg.action}
              onConfirm={() => onConfirm(msg)}
              onDownload={() => onDownload(msg)}
            />
          )}
        </div>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', marginTop: 3, textAlign: isUser ? 'right' : 'left', paddingInline: 4 }}>
          {new Date(msg.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}

const HISTORY_KEY = 'zoky_conversations'

interface SavedConversation {
  id: number
  date: string
  messages: ChatMessage[]
}

function loadConversations(): SavedConversation[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') } catch { return [] }
}
function saveConversation(msgs: ChatMessage[]) {
  if (msgs.length === 0) return
  const convs = loadConversations()
  convs.unshift({ id: Date.now(), date: new Date().toLocaleString('fr-FR'), messages: msgs })
  localStorage.setItem(HISTORY_KEY, JSON.stringify(convs.slice(0, 20))) // max 20 conversations
}

// ── Main ChatApp ───────────────────────────────────────────────────
const SENSITIVE_ACTIONS = new Set([
  'update_settings', 'create_wallet', 'add_fixed_charge', 'transfer',
])

export default function ChatApp() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [conversations, setConversations] = useState<SavedConversation[]>(loadConversations)
  const [passwordPending, setPasswordPending] = useState<ChatMessage | null>(null)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState(false)
  const [passwordAttempts, setPasswordAttempts] = useState(0)
  const [passwordLocked, setPasswordLocked] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const bcRef = useRef<BroadcastChannel | null>(null)
  const historyRef = useRef<{ role: string; content: string }[]>([])
  const passwordInputRef = useRef<HTMLInputElement>(null)

  const handleReload = () => {
    if (messages.length > 0) {
      saveConversation(messages)
      setConversations(loadConversations())
    }
    setMessages([])
    historyRef.current = []
  }

  const handleClearAll = () => {
    localStorage.removeItem(HISTORY_KEY)
    setMessages([])
    setConversations([])
    historyRef.current = []
    setShowHistory(false)
  }

  // ── webkit bridge helper ─────────────────────────────────────────
  const showChatWindow = () => {
    const wk = (window as any).webkit
    wk?.messageHandlers?.chat?.postMessage?.('show')
    setVisible(true)
  }

  const hideChatWindow = () => {
    const wk = (window as any).webkit
    wk?.messageHandlers?.chat?.postMessage?.('hide')
    setVisible(false)
  }

  // ── BroadcastChannel ────────────────────────────────────────────
  useEffect(() => {
    const bc = new BroadcastChannel('mylife')
    bcRef.current = bc
    bc.onmessage = (e) => {
      if (e.data?.type === 'show_chat') {
        showChatWindow()
      }
      if (e.data?.type === 'salary_prompt') {
        showChatWindow()
        sendMessage('As-tu reçu ta paie ce mois ? Quel montant et sur quel compte ?')
      }
      // chat_exchange: island already called the API, we just display the result
      if (e.data?.type === 'chat_exchange' && e.data.userText) {
        const { userText, result } = e.data
        const userMsg: ChatMessage = { role: 'user', content: userText, timestamp: Date.now() }
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: result.message,
          action: result,
          timestamp: Date.now() + 1,
        }
        setMessages(prev => [...prev, userMsg, assistantMsg])
        historyRef.current = [
          ...historyRef.current,
          { role: 'user', content: userText },
          { role: 'assistant', content: result.message },
        ]
        showChatWindow()
      }
    }
    return () => bc.close()
  }, [])

  // ── Scroll to bottom ────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: Date.now() }
    setMessages(prev => [...prev, userMsg])
    historyRef.current = [...historyRef.current, { role: 'user', content: text }]
    setLoading(true)
    setInput('')

    try {
      const r = await fetch(`${API}/finance/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: historyRef.current.slice(-10) }),
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const data: ChatAction = await r.json()

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.message,
        action: data,
        timestamp: Date.now(),
      }
      setMessages(prev => [...prev, assistantMsg])
      historyRef.current = [...historyRef.current, { role: 'assistant', content: data.message }]

      // Si pas de confirmation requise → notifier l'App principale de se rafraîchir
      if (!data.requires_confirmation && data.action !== 'answer') {
        bcRef.current?.postMessage({ type: 'refresh' })
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Désolé, une erreur est survenue. Réessaie.',
        timestamp: Date.now(),
      }])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSend = () => {
    const t = input.trim()
    if (!t || loading) return
    sendMessage(t)
  }

  const handleConfirm = (msg: ChatMessage) => {
    if (SENSITIVE_ACTIONS.has(msg.action?.action ?? '')) {
      setPasswordPending(msg)
      setPasswordInput('')
      setPasswordError(false)
      setPasswordAttempts(0)
      setPasswordLocked(false)
      setTimeout(() => passwordInputRef.current?.focus(), 80)
    } else {
      executeConfirm(msg)
    }
  }

  const handlePasswordSubmit = () => {
    if (passwordLocked) return
    if (passwordInput.trim() === 'STP') {
      const msg = passwordPending!
      setPasswordPending(null)
      setPasswordInput('')
      setPasswordError(false)
      setPasswordAttempts(0)
      executeConfirm(msg)
    } else {
      const next = passwordAttempts + 1
      setPasswordAttempts(next)
      setPasswordError(true)
      setPasswordInput('')
      if (next >= 3) {
        setPasswordLocked(true)
        setTimeout(() => {
          setPasswordLocked(false)
          setPasswordAttempts(0)
          setPasswordError(false)
          setPasswordPending(null)
        }, 30_000) // bloqué 30s
      } else {
        setTimeout(() => passwordInputRef.current?.focus(), 50)
      }
    }
  }

  const executeConfirm = async (msg: ChatMessage) => {
    if (!msg.action?.data) return
    const action = msg.action.action
    try {
      if (action === 'add_multiple_transactions') {
        const txs = (msg.action.data as any).transactions || []
        for (const tx of txs) {
          await fetch(`${API}/finance/transactions`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tx),
          })
        }
      } else {
        const confirmEndpoint = (msg.action as any).confirm_endpoint
        const endpointMap: Record<string, string> = {
          add_transaction: '/finance/transactions',
          transfer: '/finance/transfer',
          create_wallet: '/finance/wallets',
          add_fixed_charge: '/finance/fixed-charges',
          add_provisional_expense: '/finance/provisional-expenses',
        }

        if (confirmEndpoint === '__update_provisional__') {
          const d = msg.action.data as any
          const r = await fetch(`${API}/finance/provisional-expenses/${d.id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(d),
          })
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
        } else if (confirmEndpoint === '__delete_provisional__') {
          const d = msg.action.data as any
          const r = await fetch(`${API}/finance/provisional-expenses/${d.id}`, { method: 'DELETE' })
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
        } else if (confirmEndpoint === '__update_settings__') {
          const r = await fetch(`${API}/finance/settings`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(msg.action.data),
          })
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
        } else {
          const endpoint = confirmEndpoint || endpointMap[action]
          if (endpoint) {
            // Si le LLM a retourné un tableau (plusieurs items d'un coup), on itère
            const items: any[] = Array.isArray(msg.action.data)
              ? msg.action.data
              : [msg.action.data]
            for (const item of items) {
              const r = await fetch(`${API}${endpoint}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item),
              })
              if (!r.ok) {
                const d = await r.json().catch(() => ({}))
                const detail = typeof d.detail === 'string' ? d.detail : JSON.stringify(d.detail)
                throw new Error(detail || `HTTP ${r.status}`)
              }
            }
          }
        }
      }

      bcRef.current?.postMessage({ type: 'refresh' })
      const confirmMsg = action === 'transfer'
        ? 'Transfert effectué.'
        : action === 'add_fixed_charge'
        ? 'Charges fixes ajoutées — prélevées automatiquement chaque mois.'
        : action === 'add_provisional_expense'
        ? 'Dépense prévisionnelle enregistrée.'
        : action === 'update_settings'
        ? 'Paramètres mis à jour.'
        : 'Opération enregistrée.'
      setMessages(prev => [...prev, { role: 'assistant', content: confirmMsg, timestamp: Date.now() }])
    } catch (e: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Erreur : ${e.message}`,
        timestamp: Date.now(),
      }])
    }
  }

  const handleDownload = (msg: ChatMessage) => {
    const a = msg.action as any
    if (a?.excel_base64 && a?.filename) {
      const link = document.createElement('a')
      link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${a.excel_base64}`
      link.download = a.filename
      link.click()
    } else if (a?.pdf_base64 && a?.filename) {
      const link = document.createElement('a')
      link.href = `data:application/pdf;base64,${a.pdf_base64}`
      link.download = a.filename
      link.click()
    }
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', position: 'relative',
      height: '100vh', padding: 12, boxSizing: 'border-box',
      background: 'rgba(0,0,0,0.15)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 10, WebkitAppRegion: 'drag', paddingBottom: 8,
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      } as CSSProperties}>
        <div style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '-0.2px' }}>
            Zoky kiontabla
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>
            gestionnaire de compte
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, WebkitAppRegion: 'no-drag' } as CSSProperties}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: loading ? '#fbbf24' : '#6ee7b7',
            transition: 'background 0.3s ease',
          }} title={loading ? 'En cours...' : 'Connecté'} />
          {/* History button */}
          <button
            onClick={() => setShowHistory(h => !h)}
            title="Historique"
            style={{
              width: 24, height: 24, borderRadius: 7, cursor: 'pointer',
              background: showHistory ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${showHistory ? 'rgba(167,139,250,0.35)' : 'rgba(255,255,255,0.09)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: showHistory ? '#a78bfa' : 'rgba(255,255,255,0.35)',
              WebkitAppRegion: 'no-drag',
            } as CSSProperties}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/>
            </svg>
          </button>
          {/* Clear all button */}
          <button
            onClick={handleClearAll}
            title="Effacer tout l'historique"
            style={{
              width: 24, height: 24, borderRadius: 7, cursor: 'pointer',
              background: 'rgba(252,165,165,0.07)', border: '1px solid rgba(252,165,165,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(252,165,165,0.45)',
              WebkitAppRegion: 'no-drag',
            } as CSSProperties}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4h6v2"/>
            </svg>
          </button>
          {/* Reload button */}
          <button
            onClick={handleReload}
            title="Nouvelle discussion"
            style={{
              width: 24, height: 24, borderRadius: 7, cursor: 'pointer',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(255,255,255,0.35)',
              WebkitAppRegion: 'no-drag',
            } as CSSProperties}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-.49-4.95"/>
            </svg>
          </button>
          {/* Close button */}
          <button
            onClick={hideChatWindow}
            title="Fermer"
            style={{
              width: 24, height: 24, borderRadius: 7, cursor: 'pointer',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(255,255,255,0.35)',
              WebkitAppRegion: 'no-drag',
            } as CSSProperties}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {/* History panel */}
      {showHistory && (
        <div style={{
          flex: 1, overflowY: 'auto', WebkitAppRegion: 'no-drag',
        } as CSSProperties}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 10, fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase' }}>
            Conversations archivées
          </div>
          {conversations.length === 0 ? (
            <div style={{ textAlign: 'center', paddingTop: 30, fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>
              Aucun historique
            </div>
          ) : conversations.map(conv => (
            <button key={conv.id} onClick={() => {
              setMessages(conv.messages)
              historyRef.current = conv.messages.map(m => ({ role: m.role, content: m.content }))
              setShowHistory(false)
            }} style={{
              width: '100%', textAlign: 'left', background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
              padding: '8px 10px', marginBottom: 6, cursor: 'pointer',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
            }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>{conv.date}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {conv.messages.find(m => m.role === 'user')?.content ?? '…'}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>
                {conv.messages.length} message{conv.messages.length > 1 ? 's' : ''}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      {!showHistory && <div style={{
        flex: 1, overflowY: 'auto', paddingRight: 4,
        WebkitAppRegion: 'no-drag',
      } as CSSProperties}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 40 }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>💬</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', lineHeight: 1.6 }}>
              Bonjour ! Je peux t'aider à<br/>
              enregistrer des transactions,<br/>
              créer des wallets, générer des factures...
            </div>
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                'Ajoute 50000 Ar de dépense alimentaire',
                'Quel est mon solde total ?',
                'Génère une facture pour client X',
              ].map(s => (
                <button key={s} onClick={() => sendMessage(s)} style={{
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10, padding: '7px 12px', cursor: 'pointer',
                  color: 'rgba(255,255,255,0.5)', fontSize: 11,
                  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                  transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease',
                }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <Bubble
            key={i}
            msg={msg}
            onConfirm={handleConfirm}
            onDownload={handleDownload}
          />
        ))}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingLeft: 32 }}>
            <div style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '4px 14px 14px 14px', padding: '9px 14px',
              fontSize: 12, color: 'rgba(255,255,255,0.4)', display: 'flex', gap: 3,
            }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{
                  width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.4)',
                  display: 'inline-block',
                  animation: `dot 1.4s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>}

      {/* Modal mot de passe */}
      {passwordPending && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 999,
          background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          WebkitAppRegion: 'no-drag',
        } as CSSProperties}>
          <div style={{
            background: 'rgba(18,18,28,0.98)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16, padding: '20px 18px', width: 240, boxSizing: 'border-box',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
            boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
              Action sensible
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 14, lineHeight: 1.5 }}>
              Confirme avec le mot de passe pour continuer.
            </div>
            <input
              ref={passwordInputRef}
              type="text"
              value={passwordInput}
              disabled={passwordLocked}
              onChange={e => { setPasswordInput(e.target.value); setPasswordError(false) }}
              onKeyDown={e => { if (e.key === 'Enter') handlePasswordSubmit() }}
              placeholder="MOT DE PASSE"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: passwordLocked ? 'rgba(252,165,165,0.05)' : passwordError ? 'rgba(252,165,165,0.08)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${passwordError || passwordLocked ? 'rgba(252,165,165,0.4)' : 'rgba(255,255,255,0.12)'}`,
                borderRadius: 9, padding: '8px 10px', color: '#fff', fontSize: 14,
                outline: 'none', letterSpacing: '4px', textAlign: 'center',
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                fontWeight: 700,
                marginBottom: 8,
                opacity: passwordLocked ? 0.5 : 1,
              }}
            />
            {passwordLocked ? (
              <div style={{ fontSize: 10, color: '#fca5a5', textAlign: 'center', marginBottom: 10, lineHeight: 1.5 }}>
                Trop de tentatives. Accès bloqué 30 secondes.
              </div>
            ) : passwordError ? (
              <div style={{ fontSize: 10, color: '#fca5a5', textAlign: 'center', marginBottom: 10 }}>
                Mot de passe incorrect — {3 - passwordAttempts} tentative{3 - passwordAttempts > 1 ? 's' : ''} restante{3 - passwordAttempts > 1 ? 's' : ''}
              </div>
            ) : (
              <div style={{ marginBottom: 4 }} />
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setPasswordPending(null); setPasswordInput(''); setPasswordError(false) }} style={{
                flex: 1, padding: '8px 0', borderRadius: 9, cursor: 'pointer',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 600,
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
              }}>Annuler</button>
              <button onClick={handlePasswordSubmit} disabled={passwordLocked} style={{
                flex: 2, padding: '8px 0', borderRadius: 9,
                cursor: passwordLocked ? 'default' : 'pointer',
                background: passwordLocked ? 'rgba(255,255,255,0.04)' : 'rgba(110,231,183,0.12)',
                border: `1px solid ${passwordLocked ? 'rgba(255,255,255,0.07)' : 'rgba(110,231,183,0.3)'}`,
                color: passwordLocked ? 'rgba(255,255,255,0.2)' : '#6ee7b7',
                fontSize: 11, fontWeight: 700,
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
              }}>Confirmer</button>
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      {!showHistory && <div style={{
        display: 'flex', gap: 8, alignItems: 'flex-end',
        paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.07)',
        WebkitAppRegion: 'no-drag',
      } as CSSProperties}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder="Écris un message..."
          rows={1}
          style={{
            flex: 1, resize: 'none', background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
            color: '#fff', fontSize: 12, padding: '9px 12px', outline: 'none',
            maxHeight: 100, overflowY: 'auto', lineHeight: 1.4,
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || loading}
          style={{
            width: 36, height: 36, borderRadius: 11, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: input.trim() && !loading ? 'rgba(110,231,183,0.15)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${input.trim() && !loading ? 'rgba(110,231,183,0.35)' : 'rgba(255,255,255,0.08)'}`,
            cursor: input.trim() && !loading ? 'pointer' : 'default',
            color: input.trim() && !loading ? '#6ee7b7' : 'rgba(255,255,255,0.25)',
            transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease',
          }}
        >
          <SendIcon />
        </button>
      </div>}

</div>
  )
}
