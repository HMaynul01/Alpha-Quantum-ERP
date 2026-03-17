#!/data/data/com.termux/files/usr/bin/bash
# ╔══════════════════════════════════════════════════════════╗
# ║  Alpha Quantum ERP v18 — Deploy Script                   ║
# ║  Run: bash deploy-all.sh                                 ║
# ╚══════════════════════════════════════════════════════════╝
set -e
G='\033[0;32m';Y='\033[1;33m';CY='\033[0;36m';B='\033[1m';R='\033[0;31m';NC='\033[0m'
ok()  { echo -e " ${G}✓${NC} $1"; }
log() { echo -e " ${CY}→${NC} $1"; }
warn(){ echo -e " ${Y}!${NC} $1"; }
err() { echo -e "\n ${R}✗ $1${NC}\n"; exit 1; }
step(){ echo -e "\n${B}${CY}══════════════════════════════════════${NC}\n${B}  $1${NC}\n${B}${CY}══════════════════════════════════════${NC}"; }

REPO="https://github.com/yusrayaaf/Alpha-Quantum-ERP.git"
ERP="erp.alpha-01.info"
LANDING="alpha-01.info"
PROJ="alpha-quantum-erp"

clear
echo -e "${B}${CY}  Alpha Quantum ERP v18 — Deploy${NC}"
echo -e "${CY}  erp.alpha-01.info${NC}\n"

# ── Find project ──────────────────────────────────────────
step "1 — Locate Project"
for D in "." "$HOME/alpha-erp" "$HOME/downloads/alpha-erp" "$HOME/Downloads/alpha-erp"; do
  [ -f "$D/api/index.js" ] && [ -d "$D/src" ] && cd "$D" && break
done
[ ! -f "api/index.js" ] && err "Project not found. cd into alpha-erp folder first."
ok "Project: $(pwd)"

# ── Verify syntax ─────────────────────────────────────────
step "2 — Verify API Syntax"
ERR=0
for f in api/_auth.js api/_db.js api/_email.js api/_storage.js api/index.js; do
  if node --check "$f" 2>/dev/null; then ok "$f"; else warn "SYNTAX ERROR in $f"; ERR=1; fi
done
[ $ERR -eq 1 ] && err "Fix syntax errors before deploying"

# ── Database URL ──────────────────────────────────────────
step "3 — Database URL"
DB_URL=""
if [ -f ".env.local" ]; then
  DB_URL=$(grep "^DATABASE_URL=" .env.local | cut -d= -f2- | grep -v "user:pass" || true)
fi

if [ -z "$DB_URL" ]; then
  echo ""
  echo -e " ${B}Enter your NeonDB connection string:${NC}"
  echo -e " ${CY}Get from: console.neon.tech → Project → Connection Details${NC}"
  echo -e " ${Y}Format: postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require${NC}"
  echo ""
  read -rp " DATABASE_URL: " DB_URL
  [ -z "$DB_URL" ] && err "DATABASE_URL is required"
fi

# Build .env.local
JWT=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))" 2>/dev/null || openssl rand -hex 64)
CU="maynulshaon"; CP="Creator@2025!"
if [ -f ".env.local" ]; then
  CU=$(grep "^CREATOR_USERNAME=" .env.local | cut -d= -f2- || echo "maynulshaon")
  CP=$(grep "^CREATOR_PASSWORD=" .env.local | cut -d= -f2- || echo "Creator@2025!")
  EXISTING_JWT=$(grep "^JWT_SECRET=" .env.local | cut -d= -f2-)
  [ -n "$EXISTING_JWT" ] && JWT="$EXISTING_JWT"
fi

echo -e "\n ${B}Creator credentials:${NC}"
read -rp "  Username (Enter = $CU): " NCU; [ -n "$NCU" ] && CU="$NCU"
read -rsp "  Password (Enter = keep): " NCP; echo; [ -n "$NCP" ] && CP="$NCP"

echo ""
read -rsp " IONOS SMTP password for erp@alpha-01.info (Enter to skip): " SMTP_PW; echo

cat > .env.local << ENVEOF
DATABASE_URL=${DB_URL}
POSTGRES_URL=${DB_URL}
JWT_SECRET=${JWT}
CREATOR_USERNAME=${CU}
CREATOR_PASSWORD=${CP}
CREATOR_EMAIL=erp@alpha-01.info
CREATOR_FULL_NAME=System Creator
SMTP_HOST=smtp.ionos.com
SMTP_PORT=587
SMTP_USER=erp@alpha-01.info
SMTP_PASS=${SMTP_PW}
SMTP_FROM=Alpha Quantum ERP <erp@alpha-01.info>
SMTP_REPLY_TO=reply@alpha-01.info
ENVEOF
ok ".env.local saved"
echo -e "  DB: ${CY}$(echo "$DB_URL" | sed 's/:[^:@]*@/:***@/')${NC}"

# ── Install + Build ───────────────────────────────────────
step "4 — Install & Build"
log "npm install..."
npm install --legacy-peer-deps 2>&1 | tail -3
ok "Installed"
log "Building..."
npm run build && ok "Build complete" || err "Build failed"

# ── Git ───────────────────────────────────────────────────
step "5 — Git Push"
rm -rf .git
git init -b main 2>/dev/null || (git init && git checkout -b main 2>/dev/null || true)
git config user.name "Alpha ERP"
git config user.email "erp@alpha-01.info"
git remote add origin "$REPO"
cat > .gitignore << 'GI'
node_modules/
dist/
.env
.env.local
.env.*.local
*.log
.DS_Store
.vercel
*.zip
GI
git add -A
git commit -m "deploy: Alpha ERP v18 $(date +%Y-%m-%d)" --quiet
ok "Committed"

echo ""
echo -e " ${B}GitHub Personal Access Token${NC}"
echo -e " ${CY}Get: github.com/settings/tokens → Generate new (classic) → check ☑ repo${NC}"
echo ""
read -rsp " Paste token: " GH_TOKEN; echo ""

if [ -n "$GH_TOKEN" ]; then
  git remote set-url origin "https://oauth2:${GH_TOKEN}@github.com/yusrayaaf/Alpha-Quantum-ERP.git"
  git push origin main --force && { git remote set-url origin "$REPO" 2>/dev/null || true; ok "Pushed to GitHub"; } || { git remote set-url origin "$REPO" 2>/dev/null || true; warn "Push failed — repo may not exist at github.com/new (name: Alpha-Quantum-ERP)"; }
else
  warn "No token — skipping git push"
fi

# ── Vercel Deploy ─────────────────────────────────────────
step "6 — Vercel Login"
log "Logging in..."
vercel login 2>/dev/null || true

step "7 — Deploy"
echo -e " ${Y}When Vercel asks:${NC}"
echo -e "   Set up and deploy? → ${G}Y${NC}"
echo -e "   Scope?             → your account"
echo -e "   Link to existing?  → ${G}N${NC} (first time) / Y if exists"
echo -e "   Name?              → ${G}${PROJ}${NC}"
echo -e "   Root dir?          → ${G}./${NC} (just Enter)"
echo ""
vercel --prod --yes 2>/dev/null || vercel --prod
ok "Deployed"

# ── Set env vars in Vercel ────────────────────────────────
step "8 — Set Environment Variables"
log "Setting vars in Vercel..."

# DATABASE_URL first — most important
for VAR in DATABASE_URL POSTGRES_URL; do
  printf '%s' "$DB_URL" | vercel env add "$VAR" production --force 2>/dev/null \
    && ok "$VAR" \
    || { vercel env rm "$VAR" production --yes 2>/dev/null || true
         printf '%s' "$DB_URL" | vercel env add "$VAR" production 2>/dev/null && ok "$VAR (retry)" || warn "Could not set $VAR — set manually in Vercel dashboard"; }
done

# All other vars from .env.local
while IFS= read -r line || [ -n "$line" ]; do
  [[ "$line" =~ ^[[:space:]]*# || -z "${line//[[:space:]]/}" ]] && continue
  K="${line%%=*}"; V="${line#*=}"
  K=$(echo "$K" | tr -d '[:space:]')
  [[ "$K" == "DATABASE_URL" || "$K" == "POSTGRES_URL" || -z "$K" || -z "$V" ]] && continue
  printf '%s' "$V" | vercel env add "$K" production --force 2>/dev/null && log "  ✓ $K" || true
done < .env.local
ok "Environment variables set"

# ── Domains ───────────────────────────────────────────────
step "9 — Domains"
printf 'y\n' | vercel domains add "$ERP"     2>/dev/null && ok "$ERP"     || warn "$ERP already added"
printf 'y\n' | vercel domains add "$LANDING" 2>/dev/null && ok "$LANDING" || warn "$LANDING already added"

# ── Final redeploy ────────────────────────────────────────
step "10 — Final Redeploy"
vercel --prod --yes 2>/dev/null || vercel --prod
ok "Final deploy done"

# ── Test ─────────────────────────────────────────────────
step "11 — Test"
log "Waiting 10s for Vercel propagation..."
sleep 10
RESULT=$(curl -s "https://${ERP}/api?r=health" 2>/dev/null || echo '{}')
echo -e " Response: ${CY}${RESULT}${NC}"

if echo "$RESULT" | grep -q '"status":"ok"'; then
  echo -e "\n${G}${B}  ✅ ERP IS LIVE!${NC}"
elif echo "$RESULT" | grep -q 'DATABASE_URL\|degraded'; then
  echo -e "\n${Y}  API works but DATABASE_URL not in Vercel yet.${NC}"
  echo -e "  Go to: vercel.com/dashboard → alpha-quantum-erp → Settings → Environment Variables"
  echo -e "  Add: DATABASE_URL = ${DB_URL}"
else
  echo -e "\n${Y}  Still propagating — test in 30s:${NC}"
  echo -e "  ${CY}curl https://${ERP}/api?r=health${NC}"
fi

echo ""
echo -e "${B}${G}╔══════════════════════════════════════════╗${NC}"
echo -e "${B}${G}║  ✅ DEPLOYMENT COMPLETE                  ║${NC}"
echo -e "${B}${G}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ERP:   ${G}https://$ERP${NC}"
echo -e "  Login: ${G}$CU${NC} / ${G}$CP${NC}"
echo ""
echo -e "  IONOS DNS (my.ionos.com → Domains → DNS):"
echo -e "  ${G}CNAME${NC}  erp  →  cname.vercel-dns.com"
echo -e "  ${G}A    ${NC}  @    →  76.76.21.21"
echo -e "  ${G}MX   ${NC}  @    →  mx00.ionos.com  (10)"
echo -e "  ${G}MX   ${NC}  @    →  mx01.ionos.com  (20)"
echo ""
