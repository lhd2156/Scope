#!/usr/bin/env bash
set -euo pipefail

if ! command -v buf &>/dev/null; then
  echo "Installing buf..."
  curl -sSL https://github.com/bufbuild/buf/releases/latest/download/buf-$(uname -s)-$(uname -m) -o /usr/local/bin/buf
  chmod +x /usr/local/bin/buf
fi

cd "$(dirname "$0")"

rm -rf gen/

buf generate

echo "Generated code in gen/"
ls -la gen/
