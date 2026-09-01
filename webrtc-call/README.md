# WebRTC Call

Minimal 1:1 video calling: socket.io signaling server + vanilla JS PWA client.
No auth, no database — users pick an ID and call another ID.

## Run

```bash
npm install
npm start          # http://localhost:3000
```

Open two tabs, register as `alice` and `bob`, then call by ID.

## Notes

- `getUserMedia` requires HTTPS (or `localhost`). For phones on your LAN, put the
  server behind a TLS tunnel (e.g. `ngrok http 3000`) and open the HTTPS URL.
- NAT traversal uses `stun:stun.l.google.com:19302` only. Symmetric NATs will need
  a TURN server; add it to `ICE_SERVERS` in `public/app.js`.
- PWA: `manifest.webmanifest` + `sw.js` (network-first, offline shell). Installable
  from mobile browsers once served over HTTPS.

## Signaling protocol

Client → server: `register(userId, ack)`, then `{ to, payload }` for
`call` (offer), `answer`, `ice-candidate`, `reject`, `hangup`.
Server → client: same events with `{ from, payload }`, plus `peer-unavailable`
and `peer-disconnected`.
