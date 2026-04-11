// WhatsApp G2 — screen renderers

import {
  TextContainerProperty,
  CreateStartUpPageContainer,
  RebuildPageContainer,
  TextContainerUpgrade,
} from '@evenrealities/even_hub_sdk'
import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import type { AppState, WhatsAppMessage } from '../state'
import { formatTime, truncate } from '../state'
import { DISPLAY_WIDTH, DISPLAY_HEIGHT, PADDING, BORDER_RADIUS, BORDER_WIDTH } from './layout'

let isFirstSend = true

function makeText(content: string, opts?: { borderWidth?: number; borderColor?: number }): TextContainerProperty {
  return new TextContainerProperty({
    xPosition: PADDING,
    yPosition: PADDING,
    width: DISPLAY_WIDTH - PADDING * 2,
    height: DISPLAY_HEIGHT - PADDING * 2,
    borderWidth: opts?.borderWidth ?? 0,
    borderColor: opts?.borderColor ?? 0,
    borderRadius: opts?.borderWidth ? BORDER_RADIUS : 0,
    paddingLength: PADDING + 2,
    containerID: 0,
    containerName: 'main',
    isEventCapture: 1,
    content,
  })
}

function sendPage(bridge: EvenAppBridge, text: TextContainerProperty): void {
  const payload = { containerTotalNum: 1, textObject: [text] }
  if (isFirstSend) {
    isFirstSend = false
    bridge.createStartUpPageContainer(new CreateStartUpPageContainer(payload))
  } else {
    bridge.rebuildPageContainer(new RebuildPageContainer(payload))
  }
}

function upgradeText(bridge: EvenAppBridge, content: string): void {
  bridge.textContainerUpgrade(
    new TextContainerUpgrade({ containerID: 0, containerName: 'main', content }),
  )
}

// ---- Idle Screen ----

export function renderIdle(bridge: EvenAppBridge, state: AppState): void {
  const status = state.connected ? 'Connected' : (state.error ?? 'Connecting...')
  const content = [
    'WhatsApp Bridge',
    '________________________',
    '',
    status,
    '',
    `${state.messages.length} messages`,
    '',
    'Tap = open list',
    'Dbl = exit',
  ].join('\n')

  sendPage(bridge, makeText(content))
}

// ---- Message List Screen ----

export function renderList(bridge: EvenAppBridge, state: AppState): void {
  if (state.messages.length === 0) {
    const content = [
      'WhatsApp',
      '________________________',
      '',
      'No messages yet.',
      '',
      'New messages from',
      'WhatsApp Desktop will',
      'appear here.',
      '',
      'Dbl = back',
    ].join('\n')
    sendPage(bridge, makeText(content))
    return
  }

  const total = state.messages.length
  const maxVisible = 6
  // Keep cursor centered
  let start = Math.max(0, state.selectedIndex - Math.floor(maxVisible / 2))
  if (start + maxVisible > total) start = Math.max(0, total - maxVisible)
  const end = Math.min(total, start + maxVisible)

  const lines: string[] = [`WhatsApp  ${state.selectedIndex + 1}/${total}`, '________________________', '']

  for (let i = start; i < end; i++) {
    const msg = state.messages[i]
    const prefix = i === state.selectedIndex ? '> ' : '  '
    const sender = truncate(msg.sender, 16)
    const text = truncate(msg.text, 28)
    lines.push(`${prefix}${sender}`)
    lines.push(`  ${text}`)
  }

  lines.push('')
  lines.push('Tap=open Scr=nav Dbl=back')

  sendPage(bridge, makeText(lines.join('\n')))
}

// ---- Message Detail Screen ----

export function renderDetail(bridge: EvenAppBridge, state: AppState): void {
  const msg = state.selectedMessage
  if (!msg) {
    renderList(bridge, state)
    return
  }

  const time = formatTime(msg.timestamp)
  const content = [
    `${msg.sender}`,
    `  ${time}`,
    '________________________',
    '',
    msg.text,
    '',
    '',
    'Tap  = reply (voice)',
    'Dbl  = back',
  ].join('\n')

  sendPage(bridge, makeText(content, { borderWidth: BORDER_WIDTH, borderColor: 10 }))
}

// ---- Recording Screen ----

export function renderRecording(bridge: EvenAppBridge, state: AppState): void {
  const msg = state.selectedMessage
  const sender = msg?.sender ?? '?'
  const content = [
    `Replying to ${truncate(sender, 20)}`,
    '________________________',
    '',
    '    (mic) RECORDING',
    '',
    '    Speak your reply...',
    '',
    '',
    'Tap = stop & send',
    'Dbl = cancel',
  ].join('\n')

  sendPage(bridge, makeText(content, { borderWidth: BORDER_WIDTH, borderColor: 6 }))
}

export function upgradeRecordingTimer(bridge: EvenAppBridge, state: AppState, seconds: number): void {
  const msg = state.selectedMessage
  const sender = msg?.sender ?? '?'
  const content = [
    `Replying to ${truncate(sender, 20)}`,
    '________________________',
    '',
    `    (mic) RECORDING ${seconds}s`,
    '',
    '    Speak your reply...',
    '',
    '',
    'Tap = stop & send',
    'Dbl = cancel',
  ].join('\n')
  upgradeText(bridge, content)
}

// ---- Reviewing Screen (shows transcribed text) ----

export function renderReviewing(bridge: EvenAppBridge, state: AppState): void {
  const msg = state.selectedMessage
  const sender = msg?.sender ?? '?'
  const content = [
    `Reply to ${truncate(sender, 20)}`,
    '________________________',
    '',
    'Transcription:',
    '',
    `"${state.replyText}"`,
    '',
    'Tap = send',
    'Dbl = cancel',
  ].join('\n')

  sendPage(bridge, makeText(content, { borderWidth: BORDER_WIDTH, borderColor: 12 }))
}

// ---- Sending Screen ----

export function renderSending(bridge: EvenAppBridge, state: AppState): void {
  const msg = state.selectedMessage
  const sender = msg?.sender ?? '?'
  const content = [
    `Sending to ${truncate(sender, 20)}`,
    '________________________',
    '',
    '',
    '   Sending...',
    '',
    '',
    '',
  ].join('\n')

  sendPage(bridge, makeText(content))
}

export function renderSent(bridge: EvenAppBridge, state: AppState): void {
  const msg = state.selectedMessage
  const sender = msg?.sender ?? '?'
  const content = [
    `Sent to ${truncate(sender, 20)}`,
    '________________________',
    '',
    '',
    '   Reply sent!',
    '',
    '',
    'Tap = continue',
  ].join('\n')

  sendPage(bridge, makeText(content))
}
