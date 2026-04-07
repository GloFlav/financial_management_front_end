import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

interface Transaction {
  id: number; type: string; amount: number; category: string
  description: string | null; wallet_name: string; date: string
}

const API = import.meta.env.VITE_API_URL
const fmt = (n: number) => n.toLocaleString('fr-FR') + ' Ar'

export default function HistoryModal({ onClose }: { onClose: () => void }) {
  const [txs, setTxs] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/finance/transactions?limit=50`)
      .then(r => r.json()).then(setTxs).catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Historique</span>
          <button onClick={onClose} style={closeBtn}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="rgba(255,255,255,0.45)" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 'calc(80vh - 60px)' }}>
          {loading ? (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)', padding: '8px 0' }}>Chargement…</div>
          ) : txs.length === 0 ? (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', padding: '8px 0' }}>Aucune transaction</div>
          ) : txs.map(tx => (
            <div key={tx.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '8px 10px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: tx.type === 'income' ? '#6ee7b7' : '#fca5a5' }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
                    {tx.category}
                    {tx.description && <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}> · {tx.description}</span>}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', marginTop: 1 }}>
                    {tx.wallet_name} · {new Date(tx.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: tx.type === 'income' ? '#6ee7b7' : '#fca5a5', flexShrink: 0, marginLeft: 12 }}>
                {tx.type === 'income' ? '+' : '−'}{fmt(tx.amount)}
              </span>
            </div>
          ))}
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
  width: '100%', maxWidth: 360, maxHeight: '80vh',
  background: 'rgba(20,20,26,0.99)',
  border: '1px solid rgba(255,255,255,0.11)', borderRadius: 20, padding: 18,
  boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
  color: '#fff', boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
}
const closeBtn: CSSProperties = {
  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
}
