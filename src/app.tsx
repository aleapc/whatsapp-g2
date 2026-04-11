// WhatsApp G2 — React phone UI (settings + backend URL + connection status)

import { useState, useEffect, useCallback } from 'react'
import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import type { AppState } from './state'
import type { BackendClient } from './backend'

interface AppProps {
  bridge: EvenAppBridge
  state: AppState
  backend: BackendClient
}

export function App({ bridge, state, backend }: AppProps) {
  const [, setTick] = useState(0)
  const rerender = useCallback(() => setTick((n) => n + 1), [])
  const [url, setUrl] = useState(state.backendUrl)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')

  useEffect(() => {
    const interval = setInterval(rerender, 1000)
    return () => clearInterval(interval)
  }, [rerender])

  const handleSaveUrl = useCallback(async () => {
    state.backendUrl = url
    try {
      await bridge.setLocalStorage('whatsapp_backend_url', url)
    } catch { /* no-op */ }
    backend.updateBackendUrl(url)
  }, [url, bridge, state, backend])

  const handleTest = useCallback(async () => {
    setTestStatus('testing')
    try {
      const response = await fetch(`${url}/health`)
      if (response.ok) {
        const data = (await response.json()) as { win11Connected?: boolean }
        setTestStatus(data.win11Connected ? 'ok' : 'fail')
      } else {
        setTestStatus('fail')
      }
    } catch {
      setTestStatus('fail')
    }
  }, [url])

  const styles: Record<string, React.CSSProperties> = {
    container: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      background: '#0a0a0a',
      color: '#eee',
      minHeight: '100vh',
      padding: 16,
      maxWidth: 480,
      margin: '0 auto',
    },
    title: { fontSize: 28, fontWeight: 700, color: '#25D366', marginBottom: 4 },
    tagline: { fontSize: 14, color: '#888', marginBottom: 24 },
    section: {
      background: '#1a1a1a',
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: 600,
      color: '#888',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 12,
    },
    label: { fontSize: 14, color: '#ccc', marginBottom: 6 },
    input: {
      width: '100%',
      padding: 10,
      fontSize: 14,
      background: '#2a2a2a',
      color: '#fff',
      border: '1px solid #444',
      borderRadius: 8,
      boxSizing: 'border-box',
    },
    btnPrimary: {
      background: '#25D366',
      color: '#000',
      border: 'none',
      borderRadius: 8,
      padding: '10px 16px',
      fontSize: 14,
      fontWeight: 600,
      cursor: 'pointer',
      marginRight: 8,
    },
    btnSecondary: {
      background: '#333',
      color: '#fff',
      border: 'none',
      borderRadius: 8,
      padding: '10px 16px',
      fontSize: 14,
      cursor: 'pointer',
    },
    statusOk: { color: '#25D366', fontSize: 13 },
    statusFail: { color: '#ff6b6b', fontSize: 13 },
    statusIdle: { color: '#888', fontSize: 13 },
    msgRow: {
      borderTop: '1px solid #2a2a2a',
      padding: '8px 0',
      fontSize: 13,
    },
    msgSender: { color: '#25D366', fontWeight: 600 },
    msgText: { color: '#ccc', marginTop: 2 },
    msgTime: { color: '#555', fontSize: 11, marginTop: 2 },
  }

  return (
    <div style={styles.container}>
      <div style={styles.title}>WhatsApp Bridge</div>
      <div style={styles.tagline}>Win11 → Backend → Even Realities G2</div>

      {/* Connection status */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Connection</div>
        <div style={state.connected ? styles.statusOk : styles.statusFail}>
          {state.connected ? '● Connected to backend' : '○ Disconnected'}
        </div>
        {state.error && <div style={styles.statusFail}>{state.error}</div>}
      </div>

      {/* Backend URL */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Backend URL</div>
        <div style={styles.label}>
          http://[your-machine]:8787 (local) or Cloudflare Tunnel URL
        </div>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          style={styles.input}
          placeholder="http://192.168.1.100:8787"
        />
        <div style={{ marginTop: 12 }}>
          <button style={styles.btnPrimary} onClick={handleSaveUrl}>
            Save & reconnect
          </button>
          <button style={styles.btnSecondary} onClick={handleTest}>
            Test
          </button>
        </div>
        <div style={{ marginTop: 8 }}>
          {testStatus === 'testing' && <span style={styles.statusIdle}>Testing...</span>}
          {testStatus === 'ok' && <span style={styles.statusOk}>✓ Backend + Win11 OK</span>}
          {testStatus === 'fail' && <span style={styles.statusFail}>✗ Unreachable or Win11 offline</span>}
        </div>
      </div>

      {/* Recent messages */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Recent messages ({state.messages.length})</div>
        {state.messages.length === 0 && (
          <div style={styles.statusIdle}>No messages yet. Make sure WhatsApp Desktop is open on your Win11 PC.</div>
        )}
        {state.messages.slice(0, 10).map((m) => (
          <div key={m.id} style={styles.msgRow}>
            <div style={styles.msgSender}>{m.sender}</div>
            <div style={styles.msgText}>{m.text}</div>
            <div style={styles.msgTime}>{new Date(m.timestamp).toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* Setup instructions */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Setup</div>
        <div style={{ fontSize: 13, color: '#bbb', lineHeight: 1.5 }}>
          1. Install WhatsApp Desktop on your Win11 PC and stay logged in<br />
          2. Run <code style={{ background: '#2a2a2a', padding: '1px 4px' }}>whatsapp-g2-bridge.exe</code> (grant notification access when prompted)<br />
          3. Run the backend: <code style={{ background: '#2a2a2a', padding: '1px 4px' }}>npm run dev</code> in whatsapp-bridge-backend<br />
          4. Set the backend URL above (your LAN IP or Cloudflare Tunnel)<br />
          5. Open this app on your G2 glasses
        </div>
      </div>

      <div style={{ textAlign: 'center', padding: 16, color: '#444', fontSize: 12 }}>
        WhatsApp Bridge v0.1.0
      </div>
    </div>
  )
}
