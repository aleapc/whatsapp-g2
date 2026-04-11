// WhatsApp G2 — backend client
// Connects to the whatsapp-bridge-backend via SSE, receives messages,
// POSTs voice replies.

import type { AppState, WhatsAppMessage } from './state'
import { addMessage, setMessages } from './state'

export interface BackendCallbacks {
  onNewMessage?: (msg: WhatsAppMessage) => void
  onSnapshot?: (messages: WhatsAppMessage[]) => void
  onConnected?: () => void
  onDisconnected?: () => void
}

export class BackendClient {
  private baseUrl: string
  private eventSource: EventSource | null = null
  private callbacks: BackendCallbacks = {}
  private state: AppState
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  constructor(baseUrl: string, state: AppState) {
    this.baseUrl = baseUrl
    this.state = state
  }

  setCallbacks(cb: BackendCallbacks): void {
    this.callbacks = cb
  }

  connect(): void {
    this.disconnect()
    try {
      this.eventSource = new EventSource(`${this.baseUrl}/stream`)

      this.eventSource.addEventListener('snapshot', (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data) as WhatsAppMessage[]
          setMessages(this.state, data)
          this.callbacks.onSnapshot?.(data)
        } catch (err) {
          console.error('[backend] snapshot parse error:', err)
        }
      })

      this.eventSource.addEventListener('message', (e) => {
        try {
          const msg = JSON.parse((e as MessageEvent).data) as WhatsAppMessage
          addMessage(this.state, msg)
          this.callbacks.onNewMessage?.(msg)
        } catch (err) {
          console.error('[backend] message parse error:', err)
        }
      })

      this.eventSource.onopen = () => {
        this.state.connected = true
        this.state.error = null
        console.log('[backend] SSE connected')
        this.callbacks.onConnected?.()
      }

      this.eventSource.onerror = (e) => {
        this.state.connected = false
        this.state.error = 'SSE error — retrying...'
        console.warn('[backend] SSE error', e)
        this.callbacks.onDisconnected?.()
        // EventSource auto-reconnects, but we back off if it keeps failing
        this.scheduleReconnect()
      }
    } catch (err) {
      console.error('[backend] connect failed:', err)
      this.state.error = 'Connection failed'
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (!this.state.connected) this.connect()
    }, 5000)
  }

  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.state.connected = false
  }

  updateBackendUrl(url: string): void {
    this.baseUrl = url
    this.state.backendUrl = url
    if (this.eventSource) {
      this.connect()  // reconnect with new URL
    }
  }

  /**
   * Send audio samples for transcription and reply.
   * Returns the transcribed text on success, or null on failure.
   */
  async sendReply(recipient: string, pcm: number[]): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseUrl}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient, pcm }),
      })
      if (!response.ok) {
        console.warn(`[backend] /reply ${response.status}`)
        return null
      }
      const data = (await response.json()) as { transcribed?: string }
      return data.transcribed ?? null
    } catch (err) {
      console.error('[backend] sendReply failed:', err)
      return null
    }
  }

  /**
   * Send a text-only reply (no transcription needed).
   */
  async sendTextReply(recipient: string, text: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient, text }),
      })
      return response.ok
    } catch {
      return false
    }
  }
}
