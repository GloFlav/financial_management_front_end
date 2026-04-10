import { useState } from 'react'
import type { CSSProperties } from 'react'
import type { WalletItem } from '../types'

const API = import.meta.env.VITE_API_URL
const fmt = (n: number) => n.toLocaleString('fr-FR') + ' Ar'

export default function TransferModal({ wallets, onClose, onSuccess }: {
  wallets: WalletItem[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [fromId, setFromId]       = useState(wallets[0]?.id ? String(wallets[0].id) : '')
  const [toId, setToId]           = useState(wallets[1]?.id ? String(wallets[1].id) : '')
  const [amount, setAmount]       = useState('')
  const [fee, setFee]             = useState('')
  const [description, setDesc]    = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  const fromWallet = wallets.find(w => String(w.id) === fromId)
  const toWallet   = wallets.find(w => String(w.id) === toId)
  const amtNum     = Number(amount) || 0
  const feeNum     = Number(fee) || 0
  const total      = amtNum + feeNum

  const submit = async () => {
    if (!fromId || !toId) { setError('Sélectionne les deux wallets'); return }
    if (fromId === toId)  { setError('Source et destination identiques'); return }
    if (amtNum <= 0)      { setError('Montant invalide'); return }
    if (fromWallet && total > fromWallet.balance) {
      setError(`Solde insuffisant (${fmt(fromWallet.balance)} disponible)`); return
    }
    setLoading(true); setError('')
    try {
      const r = await fetch(`${API}/finance/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_wallet_id: Number(fromId),
          to_wallet_id:   Number(toId),
          amount:         Math.round(amtNum),
          fee:            Math.round(feeNum),
          description:    description || null,
        }),
      })
      if (!r.ok) { const d = await r.json(); throw new Error(d.detail || 'Erreur') }
      onSuccess(); onClose()
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Transfert</div>
          <button onClick={onClose} style={closeBtn}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* De → Vers avec flèche */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 28px 1fr', gap: 6, alignItems: 'center', marginBottom: 10 }}>
          <div>
            <div style={label}>De</div>
            <select value={fromId} onChange={e => setFromId(e.target.value)} style={inp}>
              {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            {fromWallet && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4, textAlign: 'right' }}>
                {fmt(fromWallet.balance)}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 14 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round">
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12 5 19 12 12 19"/>
            </svg>
          </div>

          <div>
            <div style={label}>Vers</div>
            <select value={toId} onChange={e => setToId(e.target.value)} style={inp}>
              {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            {toWallet && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
                {fmt(toWallet.balance)}
              </div>
            )}
          </div>
        </div>

        {/* Montant */}
        <div style={label}>Montant transféré</div>
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <input
            type="number" placeholder="0" value={amount}
            onChange={e => setAmount(e.target.value)}
            autoFocus
            style={{ ...inp, paddingRight: 36, fontSize: 20, fontWeight: 700, color: '#6ee7b7' }}
          />
          <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>Ar</span>
        </div>

        {/* Frais */}
        <div style={label}>Frais de transaction <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 400 }}>(optionnel)</span></div>
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <input
            type="number" placeholder="0" value={fee}
            onChange={e => setFee(e.target.value)}
            style={{ ...inp, paddingRight: 36, color: feeNum > 0 ? '#fca5a5' : 'rgba(255,255,255,0.5)' }}
          />
          <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>Ar</span>
        </div>

        {/* Récapitulatif si frais */}
        {feeNum > 0 && amtNum > 0 && (
          <div style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10, padding: '8px 12px', marginBottom: 10, fontSize: 11,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
              <span>Transféré</span><span style={{ color: '#6ee7b7' }}>+{fmt(amtNum)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
              <span>Frais</span><span style={{ color: '#fca5a5' }}>−{fmt(feeNum)}</span>
            </div>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '5px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
              <span style={{ color: 'rgba(255,255,255,0.7)' }}>Débité de {fromWallet?.name}</span>
              <span style={{ color: '#fca5a5' }}>−{fmt(total)}</span>
            </div>
          </div>
        )}

        {/* Description */}
        <input
          placeholder="Description (optionnel)"
          value={description} onChange={e => setDesc(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          style={{ ...inp, marginBottom: 12 }}
        />

        {error && (
          <div style={{ fontSize: 11, color: '#fca5a5', marginBottom: 8, padding: '6px 10px', background: 'rgba(252,165,165,0.08)', borderRadius: 8 }}>
            {error}
          </div>
        )}

        <button onClick={submit} disabled={loading} style={{
          width: '100%', padding: '11px 0', borderRadius: 12,
          cursor: loading ? 'default' : 'pointer',
          background: 'rgba(147,197,253,0.1)', border: '1px solid rgba(147,197,253,0.25)',
          color: '#93c5fd', fontSize: 13, fontWeight: 700,
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
        }}>
          {loading ? 'Envoi…' : 'Effectuer le transfert'}
        </button>
      </div>
    </div>
  )
}

const overlay: CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 9999,
  background: 'rgba(0,0,0,0.65)',
  backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
}
const modal: CSSProperties = {
  width: '100%', maxWidth: 340,
  background: 'rgba(20,20,26,0.98)',
  border: '1px solid rgba(255,255,255,0.13)', borderRadius: 22, padding: 18,
  boxShadow: '0 40px 90px rgba(0,0,0,0.85)',
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
const label: CSSProperties = {
  fontSize: 10, color: 'rgba(255,255,255,0.3)',
  letterSpacing: '0.5px', marginBottom: 5, fontWeight: 600,
}
const closeBtn: CSSProperties = {
  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
}
