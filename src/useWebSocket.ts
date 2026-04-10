import { useEffect, useRef } from 'react'

const WS_URL = (import.meta.env.VITE_API_URL as string || 'http://localhost:8001')
  .replace(/^http/, 'ws') + '/ws'

/**
 * Se connecte au WebSocket du backend et appelle `onRefresh` à chaque
 * message `{ type: "refresh" }`. Reconnexion automatique toutes les 3 s.
 */
export function useWebSocket(onRefresh: () => void) {
  const cbRef = useRef(onRefresh)
  cbRef.current = onRefresh

  useEffect(() => {
    let ws: WebSocket
    let retryTimeout: ReturnType<typeof setTimeout>
    let alive = true

    function connect() {
      ws = new WebSocket(WS_URL)

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          if (data?.type === 'refresh') cbRef.current()
        } catch {}
      }

      ws.onclose = () => {
        if (alive) retryTimeout = setTimeout(connect, 3000)
      }

      ws.onerror = () => ws.close()
    }

    connect()
    return () => {
      alive = false
      clearTimeout(retryTimeout)
      ws?.close()
    }
  }, [])
}
