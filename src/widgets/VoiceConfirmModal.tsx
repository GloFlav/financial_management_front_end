import { useState } from 'react'
import type { CSSProperties } from 'react'
import type { WalletItem, VoiceResult } from '../types'

const API = import.meta.env.VITE_API_URL

const CATEGORIES = [
  'alimentation', 'transport', 'salaire', 'transfert', 'loyer',
  'santé', 'loisirs', 'mvola', 'orange_money', 'internet', 'autre'
]

export default function VoiceConfirmModal({ result, wallets, onClose, onSuccess }: {
  result: VoiceResult
  wallets: WalletItem[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [txType, setTxType] = useState<'income' | 'expense'>(result.type === 'income' ? 'income' : 'expense')
  const [amount, setAmount] = useState(result.amount != null ? String(result.amount) : '')
  const [category, setCategory] = useState(result.category || 'autre')
  const [walletId, setWalletId] = useState(result.wallet_id != null ? String(result.wallet_id) : '')
  const [description, setDescription] = useState(result.description || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const confidenceColor = result.confidence === 'high' ? '#6ee7b7' : result.confidence === 'medium' ? '#fcd34d' : '#fca5a5'

  const confirm = async () => {
    const n = Number(amount)
    if (!amount || isNaN(n) || n <= 0) { setError('Montant invalide'); return }
    if (!walletId) { setError('Choisir un portefeuille'); return }
    setLoading(true); setError('')
    try {
      const r = await fetch(`${API}/finance/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: txType, amount: Math.round(n), category,
          description: description || null, wallet_id: Number(walletId),
        })
      })
      if (!r.ok) { const d = await r.json(); throw new Error(d.detail || 'Erreur') }
      onSuccess()
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Confirmation vocale</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>
              Confiance :{' '}
              <span style={{ color: confidenceColor, fontWeight: 600 }}>{result.confidence}</span>
              {result.description && (
                <span style={{ color: 'rgba(255,255,255,0.3)' }}> · «{result.description}»</span>
              )}
            </div>
          </div>
          <button onClick={onClose} style={closeBtn}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="rgba(255,255,255,0.45)" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Toggle */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: 11, padding: 3, marginBottom: 10, gap: 3 }}>
          {([['expense', '↓ Débit', '#fca5a5'], ['income', '↑ Crédit', '#6ee7b7']] as const).map(([t, label, col]) => (
            <button key={t} onClick={() => setTxType(t)} style={{
              flex: 1, padding: '7px 0', borderRadius: 9, cursor: 'pointer',
              background: txType === t ? 'rgba(255,255,255,0.09)' : 'transparent',
              border: txType === t ? `1px solid ${col}30` : '1px solid transparent',
              color: txType === t ? col : 'rgba(255,255,255,0.35)',
              fontSize: 12, fontWeight: 600, transition: 'all 0.22s ease',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
            }}>{label}</button>
          ))}
        </div>

        {/* Montant */}
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="0" autoFocus
            style={{ ...inp, fontSize: 22, fontWeight: 700, paddingRight: 36, color: txType === 'income' ? '#6ee7b7' : '#fca5a5' }} />
          <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>Ar</span>
        </div>

        <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inp, marginBottom: 8 }}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1).replace('_', ' ')}</option>)}
        </select>

        <select value={walletId} onChange={e => setWalletId(e.target.value)} style={{ ...inp, marginBottom: 8 }}>
          <option value="">Portefeuille…</option>
          {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>

        <input value={description} onChange={e => setDescription(e.target.value)}
          placeholder="Description (optionnel)" style={{ ...inp, marginBottom: 8 }} />

        {error && (
          <div style={{ fontSize: 11, color: '#fca5a5', marginBottom: 8, padding: '6px 10px', background: 'rgba(252,165,165,0.08)', borderRadius: 8 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ ...btn, flex: 1, color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            Annuler
          </button>
          <button onClick={confirm} disabled={loading} style={{
            ...btn, flex: 2,
            background: txType === 'income' ? 'rgba(110,231,183,0.12)' : 'rgba(252,165,165,0.1)',
            border: `1px solid ${txType === 'income' ? 'rgba(110,231,183,0.3)' : 'rgba(252,165,165,0.25)'}`,
            color: txType === 'income' ? '#6ee7b7' : '#fca5a5',
          }}>
            {loading ? 'Envoi…' : 'Confirmer'}
          </button>
        </div>
      </div>
</div>
  )
}

const overlay: CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 9999,
  background: 'rgba(0,0,0,0.65)',
  backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
  animation: 'modalIn 0.35s cubic-bezier(0.34,1.4,0.64,1)',
}
const modal: CSSProperties = {
  width: '100%', maxWidth: 340,
  background: 'rgba(20,20,26,0.99)',
  border: '1px solid rgba(255,255,255,0.11)', borderRadius: 20, padding: 18,
  boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
  color: '#fff', boxSizing: 'border-box',
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
}
const inp: CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 11,
  color: '#fff', fontSize: 13, padding: '9px 12px', outline: 'none',
  boxSizing: 'border-box',
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
}
const btn: CSSProperties = {
  padding: '11px 0', borderRadius: 12, cursor: 'pointer',
  fontSize: 13, fontWeight: 700, transition: 'all 0.2s ease',
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
}
const closeBtn: CSSProperties = {
  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
}
