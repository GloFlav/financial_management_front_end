import { useCallback, useEffect, useRef, useState } from 'react'

export type WakeState = 'off' | 'listening' | 'detected' | 'recording' | 'processing'

// Actions auto-exécutables sans confirmation
const AUTO_ENDPOINTS: Record<string, string> = {
  add_transaction:          '/finance/transactions',
  add_multiple_transactions: '/finance/transactions',
  transfer:                 '/finance/transfer',
  add_fixed_charge:         '/finance/fixed-charges',
  add_provisional_expense:  '/finance/provisional-expenses',
}

export function useWakeWord(
  apiBase: string,
  onResult: (userText: string, data: any) => void,
) {
  const [state, setState]           = useState<WakeState>('off')
  const [transcript, setTranscript] = useState('')
  const enabledRef = useRef(false)

  // ── Callback global appelé par Swift ────────────────────────────
  useEffect(() => {
    (window as any).__wakeCallback = (event: string, data: string) => {
      switch (event) {
        case 'state':
          setState(data as WakeState)
          if (data !== 'listening') setTranscript('')
          if (data === 'listening') enabledRef.current = true
          break
        case 'transcript':
          setTranscript(data.slice(-60))
          break
        case 'command':
          handleCommand(data)
          break
        case 'error':
          console.warn('[wake]', data)
          setState('off')
          break
      }
    }
    return () => { delete (window as any).__wakeCallback }
  }, []) // eslint-disable-line

  const handleCommand = async (text: string) => {
    setState('processing')
    try {
      const r = await fetch(`${apiBase}/finance/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: [] }),
      })
      const data = await r.json()

      // Auto-exécution si le LLM est confiant (requires_confirmation = false)
      if (!data.requires_confirmation && data.action && data.action !== 'answer' && data.data) {
        const endpoint = AUTO_ENDPOINTS[data.action]
        if (endpoint) {
          try {
            const items: any[] = Array.isArray(data.data) ? data.data : [data.data]
            for (const item of items) {
              await fetch(`${apiBase}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item),
              })
            }
            data._executed = true
          } catch (e) {
            console.warn('[wake] auto-exec failed', e)
          }
        }
      }

      onResult(text, data)
    } catch {
      console.warn('[wake] API error')
    }
    // Swift reprend automatiquement, mais on s'assure côté JS aussi
    if (enabledRef.current) {
      const wk = (window as any).webkit?.messageHandlers?.wake
      if (wk) wk.postMessage('start')
    }
  }

  const swiftWake = (window as any).webkit?.messageHandlers?.wake

  const enable = useCallback(() => {
    enabledRef.current = true
    const wk = (window as any).webkit?.messageHandlers?.wake
    if (wk) wk.postMessage('start')
    else    setState('off')   // hors widget, désactivé silencieusement
  }, [])

  const disable = useCallback(() => {
    enabledRef.current = false
    const wk = (window as any).webkit?.messageHandlers?.wake
    if (wk) wk.postMessage('stop')
    setState('off')
  }, [])

  useEffect(() => () => { disable() }, [disable])

  return { state, transcript, enable, disable, available: !!swiftWake }
}
