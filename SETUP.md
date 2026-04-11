# WhatsApp G2 Bridge — Complete Setup Guide

End-to-end setup for the WhatsApp G2 Bridge stack. After following this guide, WhatsApp messages will appear on your Even Realities G2 glasses and you'll be able to reply by voice from anywhere in the world.

## Architecture overview

```
┌─────────────────────────────────┐
│ Windows 11 PC                    │
│ ┌─────────────────────────────┐  │
│ │ WhatsApp Desktop             │  │
│ └─────────────────────────────┘  │
│              │ notifications     │
│              ▼                    │
│ ┌─────────────────────────────┐  │
│ │ whatsapp-g2-win11 (.NET)     │  │
│ │ UserNotificationListener     │  │
│ │ + WebSocket server :8788     │  │
│ └─────────────────────────────┘  │
│              │                    │
│              ▼ ws://localhost:8788│
│ ┌─────────────────────────────┐  │
│ │ whatsapp-bridge-backend      │  │
│ │ Express + SSE :8787          │  │
│ └─────────────────────────────┘  │
│              │                    │
│              │ (optional)         │
│              ▼                    │
│ ┌─────────────────────────────┐  │
│ │ Cloudflare Tunnel (cloudflared)
│ └─────────────────────────────┘  │
└──────────────┬───────────────────┘
               │
               │ HTTPS
               ▼
┌─────────────────────────────────┐
│ iPhone (Even Realities app)      │
│ ┌─────────────────────────────┐  │
│ │ whatsapp-g2 WebView app      │  │
│ └─────────────────────────────┘  │
└──────────────┬───────────────────┘
               │ BLE
               ▼
        Even Realities G2
```

## Prerequisites

- **Windows 11** PC (24/7 or running during usage)
- **Node.js 20+**
- **.NET 9 SDK**
- **WhatsApp Desktop** installed and logged in
- **Even Realities G2 glasses** paired to your iPhone
- **(Optional)** A Cloudflare account for remote access

## Step 1 — Install and run the Win11 app

```bash
cd whatsapp-g2-win11\WhatsAppG2Bridge
dotnet build
dotnet run
```

On first run, Windows prompts for notification access. Grant it via:

**Settings → Privacy & security → Notifications → Let apps access your notifications**

Expected output:
```
[Main] Notification access granted
[BridgeServer] Listening on http://localhost:8788/
[Main] Ready. Listening for WhatsApp notifications.
```

Leave this running. Now send yourself a WhatsApp message from another phone — you should see it logged:

```
[WhatsApp] Me: Test message
```

## Step 2 — Run the bridge backend

In a new terminal:

```bash
cd whatsapp-bridge-backend
npm install
cp .env.example .env
npm run dev
```

Expected output:
```
  WhatsApp G2 Bridge Backend v0.1.0
  HTTP:           http://localhost:8787
  SSE stream:     http://localhost:8787/stream
[win11] Connecting to ws://localhost:8788/...
[win11] Connected
```

Verify: open `http://localhost:8787/health` in your browser. You should see `"win11Connected": true`.

## Step 3 — (Optional but recommended) Run speechcoach-backend for STT

If you want voice reply:

```bash
cd speechcoach-backend
npm install
cp .env.example .env
# Edit .env and set OPENAI_API_KEY or DEEPGRAM_API_KEY
npm run dev
```

The whatsapp-bridge-backend forwards voice samples to this service.

## Step 4 — Set up Cloudflare Tunnel (for remote access)

Without Cloudflare Tunnel, the G2 app can only connect when your iPhone is on the same Wi-Fi as your PC. With Cloudflare Tunnel, it works from anywhere.

### 4.1 Install cloudflared

Download from https://github.com/cloudflare/cloudflared/releases (Windows `.msi`).

Or via winget:
```bash
winget install --id Cloudflare.cloudflared
```

### 4.2 Authenticate

```bash
cloudflared tunnel login
```

Opens a browser. Log in to your Cloudflare account and authorize a domain. Cloudflare saves credentials to `%USERPROFILE%\.cloudflared\cert.pem`.

### 4.3 Create a named tunnel

```bash
cloudflared tunnel create whatsapp-g2
```

This creates a tunnel and a credentials file `<tunnel-id>.json`. Note the tunnel ID.

### 4.4 Route a subdomain to the tunnel

```bash
cloudflared tunnel route dns whatsapp-g2 whatsapp.yourdomain.com
```

(replace `yourdomain.com` with the domain you authorized)

### 4.5 Create config file

Create `%USERPROFILE%\.cloudflared\config.yml`:

```yaml
tunnel: whatsapp-g2
credentials-file: C:\Users\YOU\.cloudflared\<tunnel-id>.json

ingress:
  - hostname: whatsapp.yourdomain.com
    service: http://localhost:8787
  - service: http_status:404
```

### 4.6 Run the tunnel

```bash
cloudflared tunnel run whatsapp-g2
```

Now `https://whatsapp.yourdomain.com/health` should return the backend health.

### 4.7 (Optional) Install as Windows service

So the tunnel starts automatically at boot:

```bash
cloudflared service install
```

## Step 5 — Deploy the G2 app

### Option A: Quick test via QR sideload

```bash
cd whatsapp-g2
npm install
npm run dev           # Vite on :5176
npx evenhub qr --ip [your-lan-ip] --port 5176
```

Scan the QR with the Even Realities phone app (Plugins → Scan QR). The app loads on your glasses with hot reload for development.

### Option B: Production pack for Even Hub

```bash
cd whatsapp-g2
npm run pack          # produces whatsapp-v0.1.0.ehpk
```

Upload the `.ehpk` to [hub.evenrealities.com/hub](https://hub.evenrealities.com/hub) under a new project (or upload as a new build to an existing project).

## Step 6 — Configure the G2 app

1. Open the WhatsApp G2 app on your iPhone from the Even Realities app
2. Go to the settings panel (phone UI)
3. Set the backend URL to either:
   - **Local Wi-Fi**: `http://192.168.1.100:8787` (replace with your PC's LAN IP)
   - **Cloudflare Tunnel**: `https://whatsapp.yourdomain.com` (works from anywhere)
4. Click **Save & reconnect**
5. Click **Test** to verify — should show `✓ Backend + Win11 OK`

## Step 7 — Test end-to-end

1. On another phone, send yourself a WhatsApp message
2. Within 1 second, the message appears on your G2 glasses
3. Tap the glasses touchpad to open the list
4. Scroll to the message, tap to view details
5. Tap again to start voice recording
6. Say your reply aloud
7. Tap to stop recording
8. Whisper transcribes → Win11 app types into WhatsApp Desktop → reply sent

## Troubleshooting

### Win11 app reports "Notification access DENIED"
Go to Windows Settings → Privacy & security → Notifications → scroll to "Let apps access your notifications" and turn ON.

### Backend shows `win11Connected: false`
The Win11 app isn't running, or is running on a different port. Verify `http://localhost:8788/health` returns 200.

### G2 app shows "Disconnected"
- Check the backend URL is correct (include `http://` and port)
- If using LAN, ensure the iPhone is on the same Wi-Fi as the PC
- If using Cloudflare Tunnel, verify `cloudflared` is running and the DNS record exists
- Check Windows firewall isn't blocking port 8787

### Voice reply doesn't work
- speechcoach-backend must be running with a valid `OPENAI_API_KEY` or `DEEPGRAM_API_KEY`
- G2 microphone permission is declared in `app.json` but you may need to grant it in the Even Realities app on first use

### WhatsApp reply fails
- WhatsApp Desktop must be open (minimized is OK, closed is not)
- Windows must be unlocked when the reply is sent (SendInput requirement)
- If the recipient match fails, the search may open the wrong chat — check Win11 app logs

### Messages don't appear
- Enable **notification previews** for WhatsApp Desktop in Windows Settings — the notification toast must show message content, not just "New message"

## Running at boot

For unattended 24/7 operation:

### Win11 app
- Use Task Scheduler to run `WhatsAppG2Bridge.exe` at user login (not system boot — notifications need an interactive session)

### Backend
- Use `pm2` or NSSM to keep the Node backend alive, or wrap in a Task Scheduler entry

### Cloudflare Tunnel
- Already covered by `cloudflared service install`

## License

MIT
