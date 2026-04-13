// ── Types d'occupation — partagé entre ProScheduler et SchedulerExpanded ──

export type Occupation = { id: string; name: string; color: string }

export const DEFAULT_OCCUPATIONS: Occupation[] = [
  { id: 'perso',        name: 'Projet perso',  color: '#60a5fa' },
  { id: 'enseignement', name: 'Enseignement',  color: '#c084fc' },
  { id: 'hello-soins',  name: 'Hello Soins',   color: '#34d399' },
  { id: 'rh-auto',      name: 'RH Automation', color: '#fbbf24' },
]

const LS_KEY = 'my_life_occupations_v1'

export function loadOccupations(): Occupation[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return JSON.parse(raw) as Occupation[]
  } catch {}
  return [...DEFAULT_OCCUPATIONS]
}

export function saveOccupations(occs: Occupation[]): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(occs)) } catch {}
}
