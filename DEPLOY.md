# Deploy ASL Alphabet to your VPS (no domain)

**Server:** `deploy@94.156.189.5`  
**App name in PM2:** `asl-alphabet` (won’t touch `osonbotV3`)  
**Port:** `3010` (localhost only)  
**Public URL:** Cloudflare free tunnel → `https://….trycloudflare.com`

> Webcam APIs need **HTTPS**. Plain `http://IP:port` often blocks the camera in Chrome.

Alphabet mode needs **no `.env`** — config is inside `ecosystem.config.cjs`.

---

## One-time from your Mac

### 0) SSH works

```bash
ssh deploy@94.156.189.5
# exit when done
```

### 1) Deploy app (install + build + PM2)

On your Mac, in the project folder:

```bash
cd ~/Desktop/codes/sign
chmod +x scripts/deploy-vps.sh scripts/vps-tunnel.sh
./scripts/deploy-vps.sh
```

Enter the VPS password when asked (rsync + ssh).

### 2) Unique HTTPS URL (on the VPS)

```bash
ssh deploy@94.156.189.5
cd ~/asl-alphabet
bash scripts/vps-tunnel.sh
pm2 logs asl-alphabet-tunnel --lines 40
```

Copy the line like:

```text
https://random-words-here.trycloudflare.com
```

That is your **unique public URL**. Open it on your phone/laptop → Start camera.

### 3) Keep both apps forever

```bash
pm2 save
pm2 startup
# run the command it prints (sudo …)
```

---

## After code changes (redeploy)

On Mac:

```bash
cd ~/Desktop/codes/sign
./scripts/deploy-vps.sh
```

Tunnel keeps running; URL may change only if you restart the tunnel process.

---

## Useful PM2 commands (on VPS)

```bash
pm2 ls
pm2 logs asl-alphabet
pm2 restart asl-alphabet
pm2 logs asl-alphabet-tunnel
```

`osonbotV3` stays as-is.

---

## Optional: IP only (no tunnel)

If you only want a quick check (camera may fail):

```bash
# on VPS — temporarily bind public (edit ecosystem HOSTNAME to 0.0.0.0) OR:
sudo ufw allow 3010/tcp   # if firewall
```

Then open `http://94.156.189.5:3010` — prefer the Cloudflare HTTPS link for real use.

---

## What gets installed where

| Path | What |
|------|------|
| `/home/deploy/asl-alphabet` | This Next.js app |
| PM2 `asl-alphabet` | `next start` on `127.0.0.1:3010` |
| PM2 `asl-alphabet-tunnel` | Cloudflare → unique HTTPS URL |
| `/home/deploy/osonbotV3` | Untouched |
