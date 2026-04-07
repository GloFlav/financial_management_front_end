import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ChangeEvent } from 'react'
import type { WalletItem } from '../types'

interface Transaction {
  id: number; type: string; amount: number; category: string
  description: string | null; wallet_name: string; date: string
}

const API = import.meta.env.VITE_API_URL
const fmt = (n: number) => n.toLocaleString('fr-FR') + ' Ar'

const CATEGORIES = [
  'alimentation', 'transport', 'salaire', 'transfert', 'loyer',
  'santé', 'loisirs', 'mvola', 'orange_money', 'internet', 'autre'
]

// ── Mini-formulaire de génération de facture ───────────────────────
function InvoiceForm({ wallet, onClose }: { wallet: WalletItem; onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [client, setClient] = useState('')
  const [notes, setNotes] = useState('')
  const [docType, setDocType] = useState<'facture' | 'devis'>('facture')
  const [items, setItems] = useState([{ name: '', qty: 1, unit_price: 0 }])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const addItem = () => setItems(prev => [...prev, { name: '', qty: 1, unit_price: 0 }])
  const updateItem = (i: number, key: string, val: string | number) => {
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [key]: val } : item))
  }
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i))

  const generate = async () => {
    if (!title || !client || items.every(it => !it.name)) {
      setError('Titre, client et au moins un article requis')
      return
    }
    setLoading(true)
    setError('')
    try {
      const r = await fetch(`${API}/finance/generate-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, client, items, notes, type: docType }),
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const data = await r.json()
      // Télécharger le PDF
      const link = document.createElement('a')
      link.href = `data:application/pdf;base64,${data.pdf_base64}`
      link.download = data.filename
      link.click()
      onClose()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={onClose}>
      <div style={{
        width: '100%', maxWidth: 380, maxHeight: '90vh', overflowY: 'auto',
        background: 'rgba(18,18,24,0.99)', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 20, padding: 18, boxShadow: '0 32px 80px rgba(0,0,0,0.85)',
        color: '#fff', boxSizing: 'border-box',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
        animation: 'modalIn 0.35s cubic-bezier(0.34,1.4,0.64,1)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Générer un document</div>
          <button onClick={onClose} style={closeBtn}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Type */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {(['facture', 'devis'] as const).map(t => (
            <button key={t} onClick={() => setDocType(t)} style={{
              flex: 1, padding: '7px 0', borderRadius: 9, cursor: 'pointer',
              background: docType === t ? 'rgba(110,231,183,0.1)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${docType === t ? 'rgba(110,231,183,0.3)' : 'rgba(255,255,255,0.08)'}`,
              color: docType === t ? '#6ee7b7' : 'rgba(255,255,255,0.4)',
              fontSize: 12, fontWeight: 600, textTransform: 'capitalize',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
              transition: 'all 0.2s ease',
            }}>{t}</button>
          ))}
        </div>

        <input placeholder="Titre *" value={title} onChange={e => setTitle(e.target.value)}
          style={{ ...inp, marginBottom: 8 }} />
        <input placeholder="Client *" value={client} onChange={e => setClient(e.target.value)}
          style={{ ...inp, marginBottom: 12 }} />

        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 6 }}>Articles</div>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 50px 80px 28px', gap: 5, marginBottom: 6 }}>
            <input placeholder="Article" value={item.name} onChange={e => updateItem(i, 'name', e.target.value)} style={inp} />
            <input type="number" placeholder="Qté" value={item.qty} onChange={e => updateItem(i, 'qty', Number(e.target.value))} style={inp} />
            <input type="number" placeholder="Prix" value={item.unit_price || ''} onChange={e => updateItem(i, 'unit_price', Number(e.target.value))} style={inp} />
            <button onClick={() => removeItem(i)} style={{
              background: 'rgba(252,165,165,0.08)', border: '1px solid rgba(252,165,165,0.2)',
              borderRadius: 8, color: '#fca5a5', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>×</button>
          </div>
        ))}
        <button onClick={addItem} style={{
          width: '100%', padding: '7px', borderRadius: 9, cursor: 'pointer',
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 10,
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
        }}>+ Ajouter un article</button>

        <textarea placeholder="Notes (optionnel)" value={notes} onChange={e => setNotes(e.target.value)}
          rows={2} style={{ ...inp, resize: 'none', height: 50, marginBottom: 10 }} />

        {error && <div style={{ fontSize: 11, color: '#fca5a5', marginBottom: 8, padding: '6px 10px', background: 'rgba(252,165,165,0.08)', borderRadius: 8 }}>{error}</div>}

        <button onClick={generate} disabled={loading} style={{
          width: '100%', padding: '11px 0', borderRadius: 12, cursor: loading ? 'default' : 'pointer',
          background: 'rgba(110,231,183,0.12)', border: '1px solid rgba(110,231,183,0.3)',
          color: '#6ee7b7', fontSize: 13, fontWeight: 700,
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
        }}>
          {loading ? 'Génération…' : 'Générer et télécharger le PDF'}
        </button>
      </div>
</div>
  )
}

// ── WalletModal principal ──────────────────────────────────────────
export default function WalletModal({ wallet, onClose, onSuccess }: {
  wallet: WalletItem
  onClose: () => void
  onSuccess: () => void
}) {
  const [txType, setTxType] = useState<'expense' | 'income'>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('autre')
  const [description, setDescription] = useState('')
  const [attachment, setAttachment] = useState<string | null>(null)
  const [attachmentName, setAttachmentName] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [txs, setTxs] = useState<Transaction[]>([])
  const [txLoading, setTxLoading] = useState(true)
  const [showInvoiceForm, setShowInvoiceForm] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`${API}/finance/transactions?wallet_id=${wallet.id}&limit=20`)
      .then(r => r.json()).then(setTxs).catch(() => {})
      .finally(() => setTxLoading(false))
  }, [wallet.id])

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAttachmentName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = ev.target?.result as string
      // Enlever le préfixe data:...;base64,
      const b64 = result.split(',')[1] || result
      setAttachment(b64)
    }
    reader.readAsDataURL(file)
  }

  const submit = async () => {
    const n = Number(amount)
    if (!amount || isNaN(n) || n <= 0) { setError('Montant invalide'); return }
    setLoading(true); setError('')
    try {
      const r = await fetch(`${API}/finance/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: txType, amount: Math.round(n), category,
          description: description || null,
          wallet_id: wallet.id,
          attachment: attachment || null,
        })
      })
      if (!r.ok) { const d = await r.json(); throw new Error(d.detail || 'Erreur') }
      onSuccess(); onClose()
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <>
      <div style={overlay} onClick={onClose}>
        <div style={modal} onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: '-0.2px' }}>{wallet.name}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 3 }}>
                Solde actuel :{' '}
                <span style={{ color: wallet.balance >= 0 ? '#6ee7b7' : '#fca5a5', fontWeight: 600 }}>
                  {fmt(wallet.balance)}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => setShowInvoiceForm(true)}
                title="Générer une facture PDF"
                style={{
                  ...closeBtn,
                  width: 'auto', padding: '0 10px', gap: 5, fontSize: 10,
                  color: 'rgba(255,255,255,0.55)', display: 'flex', alignItems: 'center',
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
                Facture
              </button>
              <button onClick={onClose} style={closeBtn}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="rgba(255,255,255,0.45)" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Toggle Crédit / Débit */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: 11, padding: 3, marginBottom: 12, gap: 3 }}>
            {([['expense', '↓ Débit', '#fca5a5'], ['income', '↑ Crédit', '#6ee7b7']] as const).map(([t, label, col]) => (
              <button key={t} onClick={() => setTxType(t)} style={{
                flex: 1, padding: '7px 0', borderRadius: 9, cursor: 'pointer',
                background: txType === t ? 'rgba(255,255,255,0.09)' : 'transparent',
                border: txType === t ? `1px solid ${col}30` : '1px solid transparent',
                color: txType === t ? col : 'rgba(255,255,255,0.35)',
                fontSize: 12, fontWeight: 600,
                transition: 'all 0.22s cubic-bezier(0.34,1.3,0.64,1)',
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
              }}>{label}</button>
            ))}
          </div>

          {/* Montant */}
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <input
              type="number" placeholder="0" value={amount}
              onChange={e => setAmount(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
              autoFocus
              style={{ ...inp, paddingRight: 36, fontSize: 22, fontWeight: 700, color: txType === 'income' ? '#6ee7b7' : '#fca5a5' }}
            />
            <span style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: 500,
            }}>Ar</span>
          </div>

          {/* Catégorie */}
          <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inp, marginBottom: 8 }}>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1).replace('_', ' ')}</option>
            ))}
          </select>

          {/* Description */}
          <textarea
            placeholder="Raison (optionnel)"
            value={description} onChange={e => setDescription(e.target.value)}
            rows={2} style={{ ...inp, resize: 'none', height: 52, marginBottom: 8 }}
          />

          {/* Pièce jointe */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.5px', marginBottom: 5 }}>
              Pièce jointe (facture / reçu)
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: 10, cursor: 'pointer',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                  color: attachmentName ? '#6ee7b7' : 'rgba(255,255,255,0.35)',
                  fontSize: 11, textAlign: 'left',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {attachmentName || 'Choisir un fichier (PDF, image, doc)…'}
              </button>
              {attachment && (
                <button onClick={() => { setAttachment(null); setAttachmentName('') }} style={{
                  width: 28, height: 28, borderRadius: 8, cursor: 'pointer', flexShrink: 0,
                  background: 'rgba(252,165,165,0.08)', border: '1px solid rgba(252,165,165,0.2)',
                  color: '#fca5a5', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>×</button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>

          {error && (
            <div style={{ fontSize: 11, color: '#fca5a5', marginBottom: 8, padding: '6px 10px', background: 'rgba(252,165,165,0.08)', borderRadius: 8 }}>
              {error}
            </div>
          )}

          <button onClick={submit} disabled={loading} style={{
            width: '100%', padding: '11px 0', borderRadius: 12, cursor: loading ? 'default' : 'pointer',
            background: txType === 'income' ? 'rgba(110,231,183,0.12)' : 'rgba(252,165,165,0.1)',
            border: `1px solid ${txType === 'income' ? 'rgba(110,231,183,0.3)' : 'rgba(252,165,165,0.25)'}`,
            color: txType === 'income' ? '#6ee7b7' : '#fca5a5',
            fontSize: 13, fontWeight: 700,
            transition: 'all 0.2s ease',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
          }}>
            {loading ? 'Envoi…' : txType === 'income' ? 'Enregistrer le crédit' : 'Enregistrer le débit'}
          </button>

          {/* Séparateur */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '14px 0 12px' }} />

          {/* Historique */}
          <div style={{ fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)', marginBottom: 8 }}>
            Historique
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
            {txLoading ? (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', padding: '4px 0' }}>Chargement…</div>
            ) : txs.length === 0 ? (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)', padding: '4px 0' }}>Aucune transaction</div>
            ) : txs.map(tx => (
              <div key={tx.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '6px 9px', borderRadius: 9, background: 'rgba(255,255,255,0.03)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0, background: tx.type === 'income' ? '#6ee7b7' : '#fca5a5' }} />
                  <div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
                      {tx.category}
                      {tx.description && <span style={{ color: 'rgba(255,255,255,0.28)', fontWeight: 400 }}> · {tx.description}</span>}
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', marginTop: 1 }}>
                      {new Date(tx.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: tx.type === 'income' ? '#6ee7b7' : '#fca5a5', marginLeft: 10, flexShrink: 0 }}>
                  {tx.type === 'income' ? '+' : '−'}{fmt(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showInvoiceForm && (
        <InvoiceForm wallet={wallet} onClose={() => setShowInvoiceForm(false)} />
      )}

</>
  )
}

const overlay: CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 9999,
  background: 'rgba(0,0,0,0.65)',
  backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
  animation: 'overlayIn 0.28s ease forwards',
}
const modal: CSSProperties = {
  width: '100%', maxWidth: 340, maxHeight: '90vh', overflowY: 'auto',
  background: 'rgba(20,20,26,0.98)',
  border: '1px solid rgba(255,255,255,0.13)', borderRadius: 22, padding: 18,
  boxShadow: '0 40px 90px rgba(0,0,0,0.85), 0 0 0 0.5px rgba(255,255,255,0.06) inset',
  color: '#fff', boxSizing: 'border-box',
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
  animation: 'liquidIn 0.48s cubic-bezier(0.34,1.3,0.64,1) forwards',
}
const inp: CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 11,
  color: '#fff', fontSize: 13, padding: '9px 12px', outline: 'none',
  boxSizing: 'border-box',
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
}
const closeBtn: CSSProperties = {
  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
}
