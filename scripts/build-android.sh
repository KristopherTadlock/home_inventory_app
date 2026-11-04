#!/usr/bin/env bash
# Builds the Android app: fetches models, builds the Rust core and regenerates the
# Turbo Module with uniffi-bindgen-react-native, then assembles debug and release APKs.
#   --no-models   skip model download and leave the models out of the APKs
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib/env.sh"

gradle_args=()
if [[ "${1:-}" == "--no-models" ]]; then
    gradle_args+=("-PbundleModels=false")
else
    "$REPO_ROOT/scripts/fetch-models.sh"
fi

if [[ ! -f "$REPO_ROOT/third_party/llama.cpp/CMakeLists.txt" ]]; then
    git -C "$REPO_ROOT" submodule update --init --depth 1
fi

(cd "$REPO_ROOT" && yarn install --immutable)
(cd "$REPO_ROOT/packages/core-bridge" && yarn ubrn:android)
(cd "$REPO_ROOT/app/android" && ./gradlew assembleDebug assembleRelease "${gradle_args[@]}")

echo
ls -lh "$REPO_ROOT"/app/android/app/build/outputs/apk/{debug,release}/*.apk
