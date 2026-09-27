#!/usr/bin/env bash
# Builds upload-ready zips for Hostinger hPanel "Node.js app" deploys:
#   deploy/billnova-api.zip  -> api.billcrafts.com (preset: NestJS, entry dist/main.js)
#   deploy/billnova-web.zip  -> billcrafts.com     (preset: Next.js)
# Usage: scripts/package-hostinger.sh [api_url]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/deploy"
API_URL="${1:-https://api.billcrafts.com/api/v1}"

rm -rf "$OUT/api" "$OUT/web" "$OUT"/*.zip
mkdir -p "$OUT/api/prisma" "$OUT/web"

# --- API: plain NestJS project (no pnpm workspace deps), built on the server ---
cd "$ROOT/apps/api"
cp -r src nest-cli.json tsconfig.json tsconfig.build.json "$OUT/api/"
find "$OUT/api/src" -name '*.spec.ts' -delete
cp ../../packages/database/prisma/schema.prisma "$OUT/api/prisma/"
cp -r ../../packages/database/prisma/migrations "$OUT/api/prisma/"
cat > "$OUT/api/server.js" <<'JS'
// Alternate entry for presets that expect a root file (e.g. Express).
require('./dist/main.js');
JS
node - "$OUT/api/package.json" <<'JS'
const fs = require('fs');
const api = require('./package.json');
const db = require('../../packages/database/package.json');
const deps = { ...api.dependencies };
delete deps['@billnova/database'];
deps['@prisma/client'] = db.dependencies['@prisma/client'];
deps.prisma = db.devDependencies.prisma;
// Build tools live in dependencies: hPanel installs with NODE_ENV=production,
// which skips devDependencies.
for (const d of ['@nestjs/cli', 'typescript', '@types/node', '@types/express',
  '@types/compression', '@types/passport-jwt']) deps[d] = api.devDependencies[d];
fs.writeFileSync(process.argv[2], JSON.stringify({
  name: 'billnova-api', version: api.version, private: true,
  main: 'dist/main.js', engines: { node: '>=20' },
  scripts: {
    build: 'prisma generate && nest build',
    start: 'node dist/main.js',
    'db:migrate': 'prisma migrate deploy',
  },
  dependencies: deps,
}, null, 2));
JS

# --- WEB: Next.js source; hPanel builds it ---
cd "$ROOT/apps/web"
rsync -a --exclude node_modules --exclude .next --exclude tsconfig.tsbuildinfo \
  --exclude AGENTS.md --exclude CLAUDE.md --exclude '.env*' ./ "$OUT/web/"
echo "NEXT_PUBLIC_API_URL=$API_URL" > "$OUT/web/.env.production"
# Live site is branded "BillCraft"; the repo stays "BillNova". Only display text
# changes here — storage keys, UPI id and contact emails are left alone.
grep -rlE 'BillNova|BILLNOVA|support@billnova\.io' "$OUT/web/app" | xargs sed -i.bak \
  -e 's/BillNova/BillCraft/g' -e 's/BILLNOVA/BILLCRAFT/g' \
  -e 's/support@billnova\.io/support@billcrafts.com/g'
find "$OUT/web/app" -name '*.bak' -delete

cd "$OUT/api" && zip -qr ../billnova-api.zip .
cd "$OUT/web" && zip -qr ../billnova-web.zip .
ls -lh "$OUT"/*.zip
