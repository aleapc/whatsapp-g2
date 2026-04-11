// WhatsApp G2 — entry point

import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk'
import { createDefaultState } from './state'
import { BackendClient } from './backend'
import { setupEventHandler } from './glasses/events'
import { renderScreen } from './glasses/renderer'
import { createRoot } from 'react-dom/client'
import { createElement } from 'react'
import { App } from './app'

async function init() {
  const bridge = await waitForEvenAppBridge()
  const state = createDefaultState()

  // Load saved backend URL
  try {
    const saved = await bridge.getLocalStorage('whatsapp_backend_url')
    if (saved) state.backendUrl = saved
  } catch { /* no-op */ }

  const backend = new BackendClient(state.backendUrl, state)
  backend.setCallbacks({
    onSnapshot: () => renderScreen(bridge, state),
    onNewMessage: () => renderScreen(bridge, state),
    onConnected: () => renderScreen(bridge, state),
    onDisconnected: () => renderScreen(bridge, state),
  })

  setupEventHandler({ bridge, state, backend })

  // Render initial screen
  renderScreen(bridge, state)

  // Connect to backend
  backend.connect()

  // Mount React phone UI
  const appEl = document.getElementById('app')
  if (appEl) {
    const root = createRoot(appEl)
    root.render(createElement(App, { bridge, state, backend }))
  }
}

init().catch((e) => {
  console.error('[main] init failed:', e)
})
