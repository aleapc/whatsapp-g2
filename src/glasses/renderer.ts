// WhatsApp G2 — screen dispatcher

import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import type { AppState } from '../state'
import {
  renderIdle,
  renderList,
  renderDetail,
  renderRecording,
  renderReviewing,
  renderSending,
} from './screens'

export function renderScreen(bridge: EvenAppBridge, state: AppState): void {
  switch (state.screen) {
    case 'idle':
      renderIdle(bridge, state)
      break
    case 'list':
      renderList(bridge, state)
      break
    case 'detail':
      renderDetail(bridge, state)
      break
    case 'recording':
      renderRecording(bridge, state)
      break
    case 'reviewing':
      renderReviewing(bridge, state)
      break
    case 'sending':
      renderSending(bridge, state)
      break
  }
}

export function forceRender(bridge: EvenAppBridge, state: AppState): void {
  renderScreen(bridge, state)
}
