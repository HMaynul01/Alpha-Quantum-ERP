#!/data/data/com.termux/files/usr/bin/bash
# Quick update push — run when you already deployed once
# bash push-update.sh
set -e
G='\033[0;32m';CY='\033[0;36m';B='\033[1m';NC='\033[0m'
ok() { echo -e " ${G}✓${NC} $1"; }; log() { echo -e " ${CY}→${NC} $1"; }

for D in "." "$HOME/alpha-erp" "$HOME/erp-clean" "$HOME/downloads/erp-clean"; do
  [ -f "$D/api/index.js" ] && [ -d "$D/src" ] && cd "$D" && break
done

echo -e "${B}${CY}  Alpha ERP — Push Update${NC}\n"

log "Verifying syntax..."
for f in api/*.js; do node --check "$f" 2>/dev/null && ok "$f" || { echo "✗ SYNTAX ERROR: $f"; exit 1; }; done

log "Building..."
npm run build >/dev/null 2>&1 && ok "Build done"

log "Git commit..."
git add -A
git commit -m "update: $(date '+%Y-%m-%d %H:%M')" --quiet 2>/dev/null || ok "Nothing to commit"

read -rsp " GitHub token: " T; echo ""
[ -n "$T" ] && {
  git remote set-url origin "https://oauth2:${T}@github.com/yusrayaaf/Alpha-Quantum-ERP.git"
  git push origin main --force && ok "Pushed"
  git remote set-url origin "https://github.com/yusrayaaf/Alpha-Quantum-ERP.git" 2>/dev/null || true
}

log "Deploying..."
vercel --prod --yes 2>/dev/null || vercel --prod
ok "Deployed!"
echo ""
echo -e " Test: ${CY}curl https://erp.alpha-01.info/api?r=health${NC}"
