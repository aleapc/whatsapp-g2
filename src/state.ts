// WhatsApp G2 — state and types

export interface WhatsAppMessage {
  id: number
  sender: string
  text: string
  timestamp: number
  isGroup: boolean
}

export type Screen = 'idle' | 'list' | 'detail' | 'recording' | 'reviewing' | 'sending'

export interface AppState {
  screen: Screen
  messages: WhatsAppMessage[]    // most recent first
  selectedIndex: number
  selectedMessage: WhatsAppMessage | null
  replyText: string              // transcribed text waiting for confirmation
  recording: boolean
  audioBuffer: number[]          // PCM samples accumulated during recording
  backendUrl: string
  connected: boolean
  error: string | null
}

export function createDefaultState(): AppState {
  return {
    screen: 'idle',
    messages: [],
    selectedIndex: 0,
    selectedMessage: null,
    replyText: '',
    recording: false,
    audioBuffer: [],
    backendUrl: 'http://localhost:8787',
    connected: false,
    error: null,
  }
}

export function addMessage(state: AppState, msg: WhatsAppMessage): void {
  // Dedup by id
  if (state.messages.find((m) => m.id === msg.id)) return
  state.messages.unshift(msg)  // most recent first
  if (state.messages.length > 30) state.messages.pop()
}

export function setMessages(state: AppState, msgs: WhatsAppMessage[]): void {
  // API sends oldest-first; we want newest-first
  state.messages = [...msgs].reverse().slice(0, 30)
}

export function formatTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  if (sameDay) return `${hh}:${mm}`
  const dd = String(d.getDate()).padStart(2, '0')
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mo} ${hh}:${mm}`
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.substring(0, max - 1) + '…'
}
