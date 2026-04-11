// WhatsApp G2 — audio capture for voice reply
// Uses bridge.audioControl(true) to enable mic, captures PCM via the
// 'audioEvent' window callback the SDK injects.

import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import type { AppState } from './state'
import { renderScreen } from './glasses/renderer'
import { upgradeRecordingTimer } from './glasses/screens'

let recordingTimer: ReturnType<typeof setInterval> | null = null
let recordingStartMs = 0

// Install audio callback on window (SDK calls this with Int16Array PCM samples)
function installAudioCallback(state: AppState): void {
  const w = window as unknown as Record<string, unknown>
  w.audioEvent = (data: ArrayBuffer | Int16Array | number[]) => {
    if (!state.recording) return
    try {
      let samples: number[]
      if (Array.isArray(data)) {
        samples = data
      } else if (data instanceof Int16Array) {
        samples = Array.from(data)
      } else if (data instanceof ArrayBuffer) {
        samples = Array.from(new Int16Array(data))
      } else {
        return
      }
      // Cap total buffer at ~30s (30 * 16000 = 480000 samples)
      if (state.audioBuffer.length < 480000) {
        state.audioBuffer.push(...samples)
      }
    } catch (e) {
      console.error('[audio] callback error:', e)
    }
  }
}

export function startRecording(bridge: EvenAppBridge, state: AppState): void {
  if (state.recording) return
  installAudioCallback(state)
  state.audioBuffer = []
  state.recording = true
  state.screen = 'recording'
  recordingStartMs = Date.now()

  try {
    bridge.audioControl(true)
  } catch (e) {
    console.error('[audio] audioControl(true) failed:', e)
  }

  renderScreen(bridge, state)

  // Live timer update via textContainerUpgrade (no rebuild)
  recordingTimer = setInterval(() => {
    if (!state.recording) {
      if (recordingTimer) { clearInterval(recordingTimer); recordingTimer = null }
      return
    }
    const elapsed = Math.floor((Date.now() - recordingStartMs) / 1000)
    upgradeRecordingTimer(bridge, state, elapsed)
    // Auto-stop at 30s
    if (elapsed >= 30) {
      stopRecording(bridge, state)
    }
  }, 1000)
}

export function stopRecording(bridge: EvenAppBridge, state: AppState): void {
  if (!state.recording) return
  state.recording = false

  if (recordingTimer) {
    clearInterval(recordingTimer)
    recordingTimer = null
  }

  try {
    bridge.audioControl(false)
  } catch (e) {
    console.error('[audio] audioControl(false) failed:', e)
  }
}
