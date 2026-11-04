#!/usr/bin/env bash
# Downloads the models listed in models/models.lock.json into models/ and verifies their
# sha256. Resumes partial downloads; files that already verify are skipped.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib/env.sh"

models_dir="$REPO_ROOT/models"

sha256() {
    if command -v sha256sum >/dev/null; then sha256sum "$1"; else shasum -a 256 "$1"; fi | cut -d' ' -f1
}

node -e '
for (const m of require(process.argv[1]).models) console.log([m.file, m.url, m.sha256].join("\t"));
' "$models_dir/models.lock.json" | while IFS=$'\t' read -r file url expected; do
    target="$models_dir/$file"
    if [[ -f "$target" && "$(sha256 "$target")" == "$expected" ]]; then
        echo "ok        $file"
        continue
    fi
    echo "download  $file"
    curl -fL --progress-bar --retry 3 -C - -o "$target.part" "$url"
    actual="$(sha256 "$target.part")"
    if [[ "$actual" != "$expected" ]]; then
        rm -f "$target.part"
        echo "sha256 mismatch for $file: expected $expected, got $actual" >&2
        exit 1
    fi
    mv "$target.part" "$target"
    echo "ok        $file"
done
