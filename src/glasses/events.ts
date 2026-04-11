// WhatsApp G2 — event handler with robust SDK quirk handling
// Handles: sysEvent (real hardware), eventType 0 → undefined,
// scroll cooldown, lifecycle events.

import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import type { AppState } from '../state'
import { renderScreen } from './renderer'
import type { BackendClient } from '../backend'
import { startRecording, stopRecording } from '../audio'

const EVT_CLICK = 0
const EVT_SCROLL_TOP = 1
const EVT_SCROLL_BOTTOM = 2
const EVT_DOUBLE_CLICK = 3
const EVT_FOREGROUND_ENTER = 4
const EVT_FOREGROUND_EXIT = 5

const SCROLL_COOLDOWN_MS = 300

interface ParsedEvent {
  action: 'click' | 'doubleClick' | 'scrollUp' | 'scrollDown' | 'foregroundEnter' | 'foregroundExit' | 'unknown'
}

function normalizeEventType(raw: unknown): number {
  if (raw === undefined || raw === null) return EVT_CLICK
  if (typeof raw === 'number') return raw
  if (typeof raw === 'string') return parseInt(raw, 10) || 0
  return -1
}

function eventTypeToAction(t: number): ParsedEvent['action'] {
  switch (t) {
    case EVT_CLICK: return 'click'
    case EVT_SCROLL_TOP: return 'scrollUp'
    case EVT_SCROLL_BOTTOM: return 'scrollDown'
    case EVT_DOUBLE_CLICK: return 'doubleClick'
    case EVT_FOREGROUND_ENTER: return 'foregroundEnter'
    case EVT_FOREGROUND_EXIT: return 'foregroundExit'
    default: return 'unknown'
  }
}

function parseEvent(event: unknown): ParsedEvent | null {
  const e = event as Record<string, unknown>

  // Try listEvent
  const listEvt = e.listEvent as Record<string, unknown> | undefined
  if (listEvt && typeof listEvt === 'object') {
    return { action: eventTypeToAction(normalizeEventType(listEvt.eventType)) }
  }

  // Try textEvent (simulator)
  const textEvt = e.textEvent as Record<string, unknown> | undefined
  if (textEvt && typeof textEvt === 'object') {
    return { action: eventTypeToAction(normalizeEventType(textEvt.eventType)) }
  }

  // Try sysEvent (real hardware — CRITICAL)
  const sysEvt = e.sysEvent as Record<string, unknown> | undefined
  if (sysEvt && typeof sysEvt === 'object') {
    const evtType = normalizeEventType(sysEvt.eventType)
    if (evtType >= 0 && evtType <= 5) {
      return { action: eventTypeToAction(evtType) }
    }
  }

  // Fallback: jsonData
  const json = e.jsonData as Record<string, unknown> | undefined
  if (json && typeof json === 'object') {
    return { action: eventTypeToAction(normalizeEventType(json.eventType)) }
  }

  return null
}

export interface EventHandlerDeps {
  bridge: EvenAppBridge
  state: AppState
  backend: BackendClient
}

export function setupEventHandler(deps: EventHandlerDeps): void {
  const { bridge, state, backend } = deps
  let lastScrollTime = 0

  bridge.onEvenHubEvent((event: unknown) => {
    const parsed = parseEvent(event)
    if (!parsed || parsed.action === 'unknown') return

    // Lifecycle events
    if (parsed.action === 'foregroundExit') {
      // Stop recording + disable mic if active
      if (state.recording) {
        stopRecording(bridge, state)
      }
      backend.disconnect()
      return
    }
    if (parsed.action === 'foregroundEnter') {
      backend.connect()
      return
    }

    // Scroll events: throttled
    if (parsed.action === 'scrollUp' || parsed.action === 'scrollDown') {
      const now = Date.now()
      if (now - lastScrollTime < SCROLL_COOLDOWN_MS) return
      lastScrollTime = now
      handleScroll(bridge, state, parsed.action === 'scrollUp' ? -1 : 1)
      return
    }

    if (parsed.action === 'doubleClick') {
      handleDoubleTap(bridge, state, backend)
      return
    }

    if (parsed.action === 'click') {
      handleTap(bridge, state, backend)
    }
  })
}

function handleScroll(bridge: EvenAppBridge, state: AppState, direction: number): void {
  if (state.screen !== 'list') return
  const max = state.messages.length - 1
  state.selectedIndex = Math.max(0, Math.min(max, state.selectedIndex + direction))
  renderScreen(bridge, state)
}

function handleTap(bridge: EvenAppBridge, state: AppState, backend: BackendClient): void {
  switch (state.screen) {
    case 'idle':
      state.screen = 'list'
      state.selectedIndex = 0
      renderScreen(bridge, state)
      break

    case 'list':
      if (state.messages.length === 0) return
      state.selectedMessage = state.messages[state.selectedIndex]
      state.screen = 'detail'
      renderScreen(bridge, state)
      break

    case 'detail':
      // Start voice recording for reply
      startRecording(bridge, state)
      break

    case 'recording':
      // Stop recording and transcribe
      void handleStopRecording(bridge, state, backend)
      break

    case 'reviewing':
      // Confirm and send
      void handleSendReply(bridge, state, backend)
      break

    case 'sending':
      // Wait — don't interrupt
      break
  }
}

function handleDoubleTap(bridge: EvenAppBridge, state: AppState, backend: BackendClient): void {
  switch (state.screen) {
    case 'idle':
      // Graceful shutdown
      try {
        bridge.shutDownPageContainer(0)
      } catch { /* ignore */ }
      break

    case 'list':
      state.screen = 'idle'
      renderScreen(bridge, state)
      break

    case 'detail':
      state.screen = 'list'
      state.selectedMessage = null
      renderScreen(bridge, state)
      break

    case 'recording':
      // Cancel recording
      stopRecording(bridge, state)
      state.audioBuffer = []
      state.screen = 'detail'
      renderScreen(bridge, state)
      break

    case 'reviewing':
      // Cancel reply
      state.replyText = ''
      state.audioBuffer = []
      state.screen = 'detail'
      renderScreen(bridge, state)
      break

    case 'sending':
      break
  }
}

async function handleStopRecording(bridge: EvenAppBridge, state: AppState, backend: BackendClient): Promise<void> {
  stopRecording(bridge, state)
  if (state.audioBuffer.length === 0) {
    state.screen = 'detail'
    renderScreen(bridge, state)
    return
  }

  // Send audio to backend for transcription
  state.screen = 'sending'
  renderScreen(bridge, state)

  const msg = state.selectedMessage
  if (!msg) {
    state.screen = 'detail'
    renderScreen(bridge, state)
    return
  }

  const transcribed = await backend.sendReply(msg.sender, state.audioBuffer)
  state.audioBuffer = []

  if (transcribed) {
    // Show review screen — one tap to confirm send, double-tap to cancel
    // Note: `/reply` already sent it; the review screen confirms what was sent
    state.replyText = transcribed
    state.screen = 'reviewing'
    renderScreen(bridge, state)

    // Auto-return to list after 3s
    setTimeout(() => {
      if (state.screen === 'reviewing') {
        state.replyText = ''
        state.selectedMessage = null
        state.screen = 'list'
        renderScreen(bridge, state)
      }
    }, 3000)
  } else {
    state.screen = 'detail'
    renderScreen(bridge, state)
  }
}

async function handleSendReply(bridge: EvenAppBridge, state: AppState, _backend: BackendClient): Promise<void> {
  // Reply was already sent by the /reply endpoint during transcription.
  // This tap just confirms and returns to list.
  state.replyText = ''
  state.selectedMessage = null
  state.screen = 'list'
  renderScreen(bridge, state)
}
