import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import type { WalletItem } from '../types'

interface FixedCharge {
  id: number; name: string; amount: number; wallet_id: number; wallet_name: string
  day_of_month: number; category: string; active: boolean
}
interface ProvisionalExpense {
  id: number; description: string; amount: number; wallet_id: number; wallet_name: string
  month: string; category: string
}

const API = import.meta.env.VITE_API_URL
const fmt = (n: number) => n.toLocaleString('fr-FR') + ' Ar'

const CHARGE_CATS = ['loyer', 'abonnement', 'assurance', 'eau', 'électricité', 'internet', 'transport', 'santé', 'autre']
const PREV_CATS   = ['alimentation', 'transport', 'santé', 'loisirs', 'vêtements', 'électronique', 'voyage', 'autre']

const now = new Date()
const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
const nextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`
const monthLabel = (m: string) => {
  const [y, mo] = m.split('-')
  return new Date(Number(y), Number(mo) - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

/* ── Icônes ── */
const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" strokeLinecap="round"
    style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s ease' }}>
    <polyline points="6 9 12 15 18 9"/>
  </svg>
)
const TrashIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
    stroke="rgba(252,165,165,0.55)" strokeWidth="2" strokeLinecap="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14H6L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/>
    <path d="M9 6V4h6v2"/>
  </svg>
)
const EditIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
    stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)
const PlusIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
    stroke="rgba(255,255,255,0.45)" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)

/* ── Formulaire générique ── */
function ChargeForm({ wallets, initial, onSave, onCancel, cats }: {
  wallets: WalletItem[]
  initial: { name: string; amount: string; wallet_id: string; day: string; category: string } | null
  onSave: (v: { name: string; amount: string; wallet_id: string; day: string; category: string }) => void
  onCancel: () => void
  cats: string[]
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [amount, setAmount] = useState(initial?.amount ?? '')
  const [walletId, setWalletId] = useState(initial?.wallet_id ?? '')
  const [day, setDay] = useState(initial?.day ?? '1')
  const [category, setCategory] = useState(initial?.category ?? cats[0])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 0 4px' }}>
      <input placeholder="Nom" value={name} onChange={e => setName(e.target.value)} style={fi} />
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{ position: 'relative', flex: 2 }}>
          <input type="number" placeholder="Montant" value={amount} onChange={e => setAmount(e.target.value)} style={{ ...fi, paddingRight: 28 }} />
          <span style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Ar</span>
        </div>
        <input type="number" min="1" max="31" placeholder="Jour" value={day} onChange={e => setDay(e.target.value)}
          style={{ ...fi, flex: 1, textAlign: 'center' }} />
      </div>
      <select value={walletId} onChange={e => setWalletId(e.target.value)} style={fi}>
        <option value="">Portefeuille…</option>
        {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>
      <select value={category} onChange={e => setCategory(e.target.value)} style={fi}>
        {cats.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
      </select>
      <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
        <button onClick={onCancel} style={{ ...rowBtn, flex: 1, color: 'rgba(255,255,255,0.28)' }}>Annuler</button>
        <button onClick={() => onSave({ name, amount, wallet_id: walletId, day, category })} style={{ ...rowBtn, flex: 2, color: '#fff' }}>
          {initial ? 'Mettre à jour' : 'Ajouter'}
        </button>
      </div>
    </div>
  )
}

/* ── Formulaire dépense prévisionnelle ── */
function ProvForm({ wallets, initial, onSave, onCancel }: {
  wallets: WalletItem[]
  initial: { description: string; amount: string; wallet_id: string; category: string } | null
  onSave: (v: { description: string; amount: string; wallet_id: string; category: string }) => void
  onCancel: () => void
}) {
  const [desc, setDesc] = useState(initial?.description ?? '')
  const [amount, setAmount] = useState(initial?.amount ?? '')
  const [walletId, setWalletId] = useState(initial?.wallet_id ?? '')
  const [category, setCategory] = useState(initial?.category ?? PREV_CATS[0])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 0 4px' }}>
      <input placeholder="Description" value={desc} onChange={e => setDesc(e.target.value)} style={fi} />
      <div style={{ position: 'relative' }}>
        <input type="number" placeholder="Montant estimé" value={amount} onChange={e => setAmount(e.target.value)} style={{ ...fi, paddingRight: 28 }} />
        <span style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Ar</span>
      </div>
      <select value={walletId} onChange={e => setWalletId(e.target.value)} style={fi}>
        <option value="">Portefeuille…</option>
        {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>
      <select value={category} onChange={e => setCategory(e.target.value)} style={fi}>
        {PREV_CATS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
      </select>
      <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
        <button onClick={onCancel} style={{ ...rowBtn, flex: 1, color: 'rgba(255,255,255,0.28)' }}>Annuler</button>
        <button onClick={() => onSave({ description: desc, amount, wallet_id: walletId, category })} style={{ ...rowBtn, flex: 2, color: '#fff' }}>
          {initial ? 'Mettre à jour' : 'Ajouter'}
        </button>
      </div>
    </div>
  )
}

/* ── Composant principal ── */
export default function FixedChargesSection({ wallets, refreshKey }: { wallets: WalletItem[]; refreshKey?: number }) {
  const [open, setOpen]     = useState(false)
  const [tab, setTab]       = useState<'charges' | 'prevision'>('charges')
  const [selMonth, setSelMonth] = useState(thisMonth)

  // Charges fixes
  const [charges, setCharges]     = useState<FixedCharge[]>([])
  const [editingCharge, setEditingCharge] = useState<FixedCharge | null>(null)
  const [addingCharge, setAddingCharge] = useState(false)

  // Provisionnelles
  const [provisionals, setProvisionals] = useState<ProvisionalExpense[]>([])
  const [editingProv, setEditingProv] = useState<ProvisionalExpense | null>(null)
  const [addingProv, setAddingProv] = useState(false)

  const loadCharges = () =>
    fetch(`${API}/finance/fixed-charges`).then(r => r.json()).then(setCharges).catch(() => {})
  const loadProv = () =>
    fetch(`${API}/finance/provisional-expenses?month=${selMonth}`)
      .then(r => r.json()).then(setProvisionals).catch(() => {})

  useEffect(() => { if (open) loadCharges() }, [open])
  useEffect(() => { if (open) loadProv() }, [open, selMonth])
  useEffect(() => { if (refreshKey !== undefined) { loadCharges(); loadProv() } }, [refreshKey])

  /* Charges fixes CRUD */
  const saveCharge = async (v: { name: string; amount: string; wallet_id: string; day: string; category: string }, id?: number) => {
    if (!v.name || !v.amount || !v.wallet_id) return
    if (id) {
      // Supprimer + recréer (pas de PATCH défini, mais suffisant)
      await fetch(`${API}/finance/fixed-charges/${id}`, { method: 'DELETE' })
    }
    await fetch(`${API}/finance/fixed-charges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: v.name, amount: Number(v.amount), wallet_id: Number(v.wallet_id), day_of_month: Number(v.day), category: v.category })
    })
    setAddingCharge(false); setEditingCharge(null)
    loadCharges()
  }

  const deleteCharge = async (id: number) => {
    await fetch(`${API}/finance/fixed-charges/${id}`, { method: 'DELETE' })
    loadCharges()
  }

  /* Provisionnelles CRUD */
  const saveProv = async (v: { description: string; amount: string; wallet_id: string; category: string }, id?: number) => {
    if (!v.description || !v.amount || !v.wallet_id) return
    if (id) {
      await fetch(`${API}/finance/provisional-expenses/${id}`, { method: 'DELETE' })
    }
    await fetch(`${API}/finance/provisional-expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: v.description, amount: Number(v.amount), wallet_id: Number(v.wallet_id), month: selMonth, category: v.category })
    })
    setAddingProv(false); setEditingProv(null)
    loadProv()
  }

  const deleteProv = async (id: number) => {
    await fetch(`${API}/finance/provisional-expenses/${id}`, { method: 'DELETE' })
    loadProv()
  }

  const totalCharges = charges.reduce((s, c) => s + c.amount, 0)
  const totalProv    = provisionals.reduce((s, p) => s + p.amount, 0)

  return (
    <div style={{
      borderTop: '1px solid rgba(255,255,255,0.06)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
      color: '#fff',
    }}>
      {/* Toggle header */}
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '11px 16px', background: 'none', border: 'none', cursor: 'pointer',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.2px' }}>
            Charges & Prévisions
          </span>
          {totalCharges > 0 && (
            <span style={{
              fontSize: 10, color: '#fca5a5', background: 'rgba(252,165,165,0.1)',
              border: '1px solid rgba(252,165,165,0.18)', borderRadius: 6, padding: '1px 7px',
            }}>
              {fmt(totalCharges)}/mois
            </span>
          )}
        </div>
        <ChevronIcon open={open} />
      </button>

      {/* Contenu animé */}
      <div style={{
        maxHeight: open ? 700 : 0, overflow: 'hidden',
        transition: 'max-height 0.28s ease',
      }}>
        <div style={{ padding: '4px 14px 16px' }}>

          {/* Onglets */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: 11, padding: 3, marginBottom: 14, gap: 3 }}>
            {([['charges', 'Charges fixes'], ['prevision', 'Prévisionnelles']] as const).map(([t, label]) => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: '7px 0', borderRadius: 9, cursor: 'pointer',
                background: tab === t ? 'rgba(255,255,255,0.09)' : 'transparent',
                border: tab === t ? '1px solid rgba(255,255,255,0.14)' : '1px solid transparent',
                color: tab === t ? '#fff' : 'rgba(255,255,255,0.32)',
                fontSize: 11, fontWeight: 600, transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease',
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
              }}>{label}</button>
            ))}
          </div>

          {/* ── Charges fixes ── */}
          {tab === 'charges' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {charges.map(c => (
                  <div key={c.id}>
                    {editingCharge?.id === c.id ? (
                      <ChargeForm
                        wallets={wallets}
                        cats={CHARGE_CATS}
                        initial={{ name: c.name, amount: String(c.amount), wallet_id: String(c.wallet_id), day: String(c.day_of_month), category: c.category }}
                        onSave={v => saveCharge(v, c.id)}
                        onCancel={() => setEditingCharge(null)}
                      />
                    ) : (
                      <div style={itemRow}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', fontWeight: 500 }}>{c.name}</div>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', marginTop: 1 }}>
                            {c.wallet_name} · le {c.day_of_month}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#fca5a5' }}>−{fmt(c.amount)}</span>
                          <button onClick={() => { setEditingCharge(c); setAddingCharge(false) }} style={iconBtn}><EditIcon /></button>
                          <button onClick={() => deleteCharge(c.id)} style={iconBtn}><TrashIcon /></button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {charges.length > 0 && !addingCharge && !editingCharge && (
                <div style={{ textAlign: 'right', fontSize: 10, color: 'rgba(255,255,255,0.28)', marginTop: 6, marginBottom: 4 }}>
                  Total mensuel : <span style={{ color: '#fca5a5', fontWeight: 600 }}>{fmt(totalCharges)}</span>
                </div>
              )}

              {addingCharge ? (
                <ChargeForm
                  wallets={wallets} cats={CHARGE_CATS}
                  initial={null}
                  onSave={v => saveCharge(v)}
                  onCancel={() => setAddingCharge(false)}
                />
              ) : !editingCharge && (
                <button onClick={() => { setAddingCharge(true); setEditingCharge(null) }} style={addBtn}>
                  <PlusIcon /><span>Ajouter une charge fixe</span>
                </button>
              )}
            </>
          )}

          {/* ── Provisionnelles ── */}
          {tab === 'prevision' && (
            <>
              {/* Sélecteur mois */}
              <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
                {[thisMonth, nextMonth].map(m => (
                  <button key={m} onClick={() => setSelMonth(m)} style={{
                    flex: 1, padding: '6px 0', borderRadius: 9, cursor: 'pointer',
                    background: selMonth === m ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                    border: selMonth === m ? '1px solid rgba(255,255,255,0.18)' : '1px solid rgba(255,255,255,0.07)',
                    color: selMonth === m ? '#fff' : 'rgba(255,255,255,0.3)',
                    fontSize: 10, fontWeight: 600, transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                  }}>{monthLabel(m)}</button>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {provisionals.map(p => (
                  <div key={p.id}>
                    {editingProv?.id === p.id ? (
                      <ProvForm
                        wallets={wallets}
                        initial={{ description: p.description, amount: String(p.amount), wallet_id: String(p.wallet_id), category: p.category }}
                        onSave={v => saveProv(v, p.id)}
                        onCancel={() => setEditingProv(null)}
                      />
                    ) : (
                      <div style={itemRow}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', fontWeight: 500 }}>{p.description}</div>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', marginTop: 1 }}>
                            {p.wallet_name} · {p.category}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(253,211,77,0.9)' }}>{fmt(p.amount)}</span>
                          <button onClick={() => { setEditingProv(p); setAddingProv(false) }} style={iconBtn}><EditIcon /></button>
                          <button onClick={() => deleteProv(p.id)} style={iconBtn}><TrashIcon /></button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {provisionals.length > 0 && !addingProv && !editingProv && (
                <div style={{ textAlign: 'right', fontSize: 10, color: 'rgba(255,255,255,0.28)', marginTop: 6, marginBottom: 4 }}>
                  Total prévu : <span style={{ color: 'rgba(253,211,77,0.9)', fontWeight: 600 }}>{fmt(totalProv)}</span>
                </div>
              )}

              {addingProv ? (
                <ProvForm
                  wallets={wallets}
                  initial={null}
                  onSave={v => saveProv(v)}
                  onCancel={() => setAddingProv(false)}
                />
              ) : !editingProv && (
                <button onClick={() => { setAddingProv(true); setEditingProv(null) }} style={addBtn}>
                  <PlusIcon /><span>Ajouter une dépense prévisionnelle</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const fi: CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.09)', borderRadius: 9,
  color: '#fff', fontSize: 12, padding: '7px 10px',
  outline: 'none', boxSizing: 'border-box',
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
}
const rowBtn: CSSProperties = {
  padding: '8px 0', borderRadius: 9, cursor: 'pointer',
  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
  fontSize: 11, fontWeight: 600,
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
}
const addBtn: CSSProperties = {
  width: '100%', marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)',
  borderRadius: 9, padding: '8px 0', cursor: 'pointer',
  color: 'rgba(255,255,255,0.32)', fontSize: 11, fontWeight: 500,
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
}
const itemRow: CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  background: 'rgba(255,255,255,0.04)', borderRadius: 9, padding: '7px 9px',
}
const iconBtn: CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', padding: 3,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
