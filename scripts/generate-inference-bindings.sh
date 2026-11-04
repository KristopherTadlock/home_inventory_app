#!/usr/bin/env bash
# Regenerates core/crates/inference-sys/src/bindings.rs from the pinned llama.cpp and
# whisper.cpp headers. Run after bumping either submodule.
# Requires bindgen-cli (`cargo install bindgen-cli --version 0.73.2`) and libclang
# (set LIBCLANG_PATH if it is not found).
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib/env.sh"

crate="$REPO_ROOT/core/crates/inference-sys"
third_party="$REPO_ROOT/third_party"

bindgen "$crate/wrapper.h" \
    --allowlist-function '(llama|whisper)_.*' \
    --allowlist-type '(llama|whisper)_.*' \
    --allowlist-var '(LLAMA|WHISPER)_.*' \
    --output "$crate/src/bindings.rs" \
    -- \
    -I"$third_party/llama.cpp/include" \
    -I"$third_party/llama.cpp/ggml/include" \
    -I"$third_party/whisper.cpp/include"

echo "wrote $crate/src/bindings.rs"
