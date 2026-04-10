import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

interface Budget {
  category:        string
  default_amount:  number
  override_amount: number | null
  override_month:  number | null
  effective_limit: number
  spent:           number
  ratio:           number
}

const API = import.meta.env.VITE_API_URL
const fmt = (n: number) => n.toLocaleString('fr-FR') + ' Ar'

const ALL_CATS = [
  'alimentation', 'transport', 'santé', 'loisirs',
  'vêtements', 'électronique', 'voyage', 'restauration', 'autre',
]

function ratioColor(r: number) {
  if (r >= 1)   return { bar: '#fca5a5', text: '#fca5a5' }
  if (r >= 0.8) return { bar: '#fcd34d', text: '#fcd34d' }
  return              { bar: '#6ee7b7', text: '#6ee7b7' }
}

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

function EditForm({ budget, onSave, onCancel }: {
  budget: Budget
  onSave: (defaultAmt: number, overrideAmt: number, overrideMonth: number | null) => void
  onCancel: () => void
}) {
  const now = new Date()
  const currentYYYYMM = now.getFullYear() * 100 + now.getMonth() + 1
  const [defaultAmt, setDefaultAmt] = useState(String(budget.default_amount))
  const [useOverride, setUseOverride] = useState(
    budget.override_month === currentYYYYMM && !!budget.override_amount
  )
  const [overrideAmt, setOverrideAmt] = useState(
    String(budget.override_month === currentYYYYMM && budget.override_amount ? budget.override_amount : '')
  )
  const submit = () => {
    const da = parseInt(defaultAmt) || 0
    const oa = useOverride ? (parseInt(overrideAmt) || 0) : 0
    onSave(da, oa, useOverride ? currentYYYYMM : null)
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0 4px' }}>
      <div>
        <div style={lbl}>Plafond mensuel normal</div>
        <div style={{ position: 'relative' }}>
          <input type="number" value={defaultAmt} onChange={e => setDefaultAmt(e.target.value)}
            style={{ ...fi, paddingRight: 28 }} />
          <span style={arSuffix}>Ar</span>
        </div>
      </div>
      <div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={useOverride} onChange={e => setUseOverride(e.target.checked)}
            style={{ accentColor: '#a78bfa' }} />
          <span style={{ fontSize: 10, color: '#a78bfa', fontWeight: 600 }}>Override ce mois uniquement</span>
        </label>
        {useOverride && (
          <div style={{ position: 'relative', marginTop: 4 }}>
            <input type="number" value={overrideAmt} placeholder="Montant exceptionnel…"
              onChange={e => setOverrideAmt(e.target.value)} style={{ ...fi, paddingRight: 28 }} />
            <span style={arSuffix}>Ar</span>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
        <button onClick={onCancel} style={{ ...rowBtn, flex: 1, color: 'rgba(255,255,255,0.28)' }}>Annuler</button>
        <button onClick={submit} style={{ ...rowBtn, flex: 2, color: '#fff' }}>Enregistrer</button>
      </div>
    </div>
  )
}

// Contenu plat — s'intègre directement dans un onglet de FixedChargesSection
export default function BudgetWidget({ refreshKey }: { refreshKey?: number }) {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [newCat, setNewCat] = useState(ALL_CATS[0])
  const [newAmt, setNewAmt] = useState('')

  const load = () =>
    fetch(`${API}/finance/category-budgets`).then(r => r.json()).then(setBudgets).catch(() => {})

  useEffect(() => { load() }, [])
  useEffect(() => { if (refreshKey !== undefined) load() }, [refreshKey])

  const handleSave = async (b: Budget, defaultAmt: number, overrideAmt: number, overrideMonth: number | null) => {
    await fetch(`${API}/finance/category-budgets/${b.category}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ default_amount: defaultAmt, override_amount: overrideAmt, override_month: overrideMonth }),
    })
    setEditing(null); load()
  }

  const handleDelete = async (category: string) => {
    await fetch(`${API}/finance/category-budgets/${category}`, { method: 'DELETE' })
    load()
  }

  const handleAdd = async () => {
    const amt = parseInt(newAmt)
    if (!amt) return
    await fetch(`${API}/finance/category-budgets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: newCat, default_amount: amt }),
    })
    setAdding(false); setNewAmt(''); load()
  }

  const available = ALL_CATS.filter(c => !budgets.find(b => b.category === c))
  const now = new Date()
  const currentYYYYMM = now.getFullYear() * 100 + now.getMonth() + 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {budgets.map(b => {
        const col = ratioColor(b.ratio)
        const pct = Math.min(b.ratio * 100, 100)
        const hasOverride = b.override_month === currentYYYYMM && !!b.override_amount
        return (
          <div key={b.category}>
            {editing === b.category ? (
              <EditForm budget={b}
                onSave={(da, oa, om) => handleSave(b, da, oa, om)}
                onCancel={() => setEditing(null)} />
            ) : (
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 9, padding: '7px 9px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', fontWeight: 500 }}>
                      {b.category.charAt(0).toUpperCase() + b.category.slice(1)}
                    </span>
                    {hasOverride && (
                      <span style={{ fontSize: 9, color: '#a78bfa', marginLeft: 5 }}>exc.</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, color: col.text, fontWeight: 600 }}>{fmt(b.spent)}</span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>/ {fmt(b.effective_limit)}</span>
                    <button onClick={() => { setEditing(b.category); setAdding(false) }} style={iconBtn}><EditIcon /></button>
                    <button onClick={() => handleDelete(b.category)} style={iconBtn}><TrashIcon /></button>
                  </div>
                </div>
                <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }}>
                  <div style={{ height: '100%', borderRadius: 2, width: `${pct}%`, background: col.bar, transition: 'width 0.4s ease' }} />
                </div>
              </div>
            )}
          </div>
        )
      })}

      {adding ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0 4px' }}>
          <select value={newCat} onChange={e => setNewCat(e.target.value)} style={fi}>
            {available.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </select>
          <div style={{ position: 'relative' }}>
            <input type="number" placeholder="Plafond mensuel…" value={newAmt}
              onChange={e => setNewAmt(e.target.value)} style={{ ...fi, paddingRight: 28 }} />
            <span style={arSuffix}>Ar</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => { setAdding(false); setNewAmt('') }}
              style={{ ...rowBtn, flex: 1, color: 'rgba(255,255,255,0.28)' }}>Annuler</button>
            <button onClick={handleAdd} style={{ ...rowBtn, flex: 2, color: '#fff' }}>Ajouter</button>
          </div>
        </div>
      ) : !editing && available.length > 0 && (
        <button onClick={() => { setAdding(true); setNewCat(available[0]) }} style={addBtn}>
          <PlusIcon /><span>Ajouter un budget</span>
        </button>
      )}
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
const lbl: CSSProperties = {
  fontSize: 9, color: 'rgba(255,255,255,0.35)', marginBottom: 4,
  textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600,
}
const arSuffix: CSSProperties = {
  position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)',
  fontSize: 10, color: 'rgba(255,255,255,0.3)',
}
const rowBtn: CSSProperties = {
  padding: '8px 0', borderRadius: 9, cursor: 'pointer',
  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
  fontSize: 11, fontWeight: 600,
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
}
const addBtn: CSSProperties = {
  width: '100%', marginTop: 4, display: 'flex', alignItems: 'center',
  justifyContent: 'center', gap: 6,
  background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)',
  borderRadius: 9, padding: '8px 0', cursor: 'pointer',
  color: 'rgba(255,255,255,0.32)', fontSize: 11, fontWeight: 500,
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
}
const iconBtn: CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', padding: 3,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
