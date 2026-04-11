# WhatsApp G2

Even Realities G2 glasses app that receives WhatsApp messages from your Windows 11 PC and lets you reply by voice.

Part of the **WhatsApp G2 Bridge** stack:

```
Win11 + WhatsApp Desktop → whatsapp-g2-win11 (.NET) → whatsapp-bridge-backend (Node) → [THIS APP] → G2 glasses
                                                                                            │
                                                                                            ▼
                                                                                     voice capture → Whisper
```

## What this app does

1. Connects to the bridge backend via SSE
2. Receives WhatsApp messages in real time
3. Shows them in a scrollable list on your glasses
4. Lets you tap a message to see the full content
5. **Tap to reply by voice** — records audio, sends to backend, Whisper transcribes, Win11 app types reply into WhatsApp

## Prerequisites

You need the full stack running:

1. **WhatsApp Desktop** on a Win11 PC, logged in and running
2. **whatsapp-g2-win11** (.NET app) — [install guide](https://github.com/aleapc/whatsapp-g2-win11)
3. **whatsapp-bridge-backend** (Node) — [install guide](https://github.com/aleapc/whatsapp-bridge-backend)
4. **speechcoach-backend** for Whisper STT — [install guide](https://github.com/aleapc/speechcoach-backend)
5. **Cloudflare Tunnel** (optional) for accessing the backend from anywhere

See `SETUP.md` for the complete end-to-end walkthrough.

## Dev workflow

```bash
npm install
npm run dev     # Vite on :5176
npx evenhub qr --ip [your-lan-ip] --port 5176
```

Scan the QR with the Even Realities phone app to sideload.

## Build for Hub

```bash
npm run pack    # produces whatsapp-v0.1.0.ehpk
```

Upload the `.ehpk` to [hub.evenrealities.com/hub](https://hub.evenrealities.com/hub).

## Screens

- **Idle**: shows connection status and message count
- **List**: scrollable list of recent messages (6 visible, scroll to navigate)
- **Detail**: full message text, tap to reply by voice
- **Recording**: live timer while capturing audio (textContainerUpgrade for flicker-free counter)
- **Reviewing**: transcribed text preview, auto-returns to list after 3s
- **Sending**: transient state while the backend is processing

## Interaction model

| Screen | Tap | Double-tap | Scroll |
|---|---|---|---|
| Idle | Open list | Graceful shutdown | — |
| List | Open selected message | Back to idle | Navigate |
| Detail | Start voice recording | Back to list | — |
| Recording | Stop and send | Cancel | — |
| Reviewing | Back to list | Back to detail | — |

## Configuration

Set the backend URL in the phone UI settings panel. Options:

- **Local Wi-Fi**: `http://[your-pc-lan-ip]:8787` (e.g. `http://192.168.1.100:8787`)
- **Cloudflare Tunnel**: `https://whatsapp-bridge.your-domain.com` (remote access)

Stored in `bridge.setLocalStorage('whatsapp_backend_url', ...)`.

## Security & privacy

- No third-party analytics
- Backend URL, message cache and all state stay local
- Voice audio goes from glasses → your backend → Whisper (OpenAI or local)
- **Nothing goes through Even Realities servers** except the standard G2 WebView hosting

## Limitations

- Requires your Win11 PC to be on with WhatsApp Desktop running
- Reply quality depends on STT accuracy
- Groups: replying identifies recipient by chat name — near-duplicate group names may misroute
- Attachments (images/voice/docs): only the caption/placeholder is shown

## License

MIT
