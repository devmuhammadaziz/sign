# Deploy from GitHub (no rsync / no domain)

**Repo:** https://github.com/devmuhammadaziz/sign.git  
**VPS:** `deploy@94.156.189.5`  
**Folder:** `/home/deploy/asl-alphabet`  
**PM2 name:** `asl-alphabet` (does not touch `osonbotV3`)

No `.env` needed for alphabet mode.

---

## Option A — one command from your Mac

```bash
cd ~/Desktop/codes/sign
# push any local changes first
git add -A && git commit -m "deploy" && git push origin main   # if you have new commits

chmod +x scripts/deploy-vps.sh scripts/vps-tunnel.sh
./scripts/deploy-vps.sh
```

Enter VPS password when asked. It will **clone or pull** from GitHub, build, and start PM2.

---

## Option B — do everything on the VPS (clone yourself)

```bash
ssh deploy@94.156.189.5
```

Then:

```bash
# first time only if git/node missing
sudo apt-get update -y
sudo apt-get install -y git
# node/pm2 only if not already installed for osonbot

cd ~
git clone https://github.com/devmuhammadaziz/sign.git asl-alphabet
cd asl-alphabet

npm install
npm run build

# make sure cwd in ecosystem matches
sed -i 's|cwd: ".*"|cwd: "/home/deploy/asl-alphabet"|' ecosystem.config.cjs

pm2 delete asl-alphabet 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save
pm2 ls
```

**Later updates:**

```bash
cd ~/asl-alphabet
git pull origin main
npm install
npm run build
pm2 restart asl-alphabet
```

---

## Unique HTTPS URL (camera needs HTTPS)

On the VPS:

```bash
cd ~/asl-alphabet
bash scripts/vps-tunnel.sh
pm2 logs asl-alphabet-tunnel --lines 40
```

Copy `https://….trycloudflare.com` — that is your public link.

```bash
pm2 save
pm2 startup   # run the sudo command it prints once
```

---

## If the repo is private

On the VPS, clone with a token:

```bash
git clone https://YOUR_GITHUB_TOKEN@github.com/devmuhammadaziz/sign.git asl-alphabet
```

Or add a deploy key. Public repos need nothing extra.
