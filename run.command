#!/bin/zsh
set -eu
cd -- "${0:A:h}"
if [[ -x /opt/homebrew/bin/node ]]; then
  export PATH="/opt/homebrew/bin:$PATH"
fi
if ! command -v node >/dev/null || ! node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 20 || (major === 20 && minor >= 9) ? 0 : 1)'; then
  print '需要 Node.js 20.9 或以上。安装后请重新打开此文件。'
  exit 1
fi
if [[ ! -x node_modules/.bin/next ]]; then
  npm ci
fi
export NEXT_TELEMETRY_DISABLED=1
print '启动完成后，请在浏览器打开下方显示的 Local 地址。'
exec npm run dev -- --webpack
