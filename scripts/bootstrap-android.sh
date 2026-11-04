#!/usr/bin/env bash
# Installs everything needed to build the Android app, without sudo:
# JDK 17, Android SDK/NDK packages, the pinned Rust toolchain, cargo-ndk and JS dependencies.
#   --e2e   also install the emulator, an x86_64 system image and the Maestro CLI.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib/env.sh"

CMDLINE_TOOLS_BUILD="16111833"
CARGO_NDK_VERSION="4.1.2"
MAESTRO_VERSION="2.12.1"
SYSTEM_IMAGE="system-images;android-36;google_apis;x86_64"
SDK_PACKAGES=(
    "platform-tools"
    "platforms;android-36"
    "build-tools;36.0.0"
    "ndk;$ANDROID_NDK_VERSION"
    "cmake;3.22.1"
)

WITH_E2E=false
[[ "${1:-}" == "--e2e" ]] && WITH_E2E=true

case "$(uname -s)" in
    Linux) HOST_OS=linux; ADOPTIUM_OS=linux ;;
    Darwin) HOST_OS=mac; ADOPTIUM_OS=mac ;;
    *) echo "Unsupported host OS: $(uname -s)" >&2; exit 1 ;;
esac
case "$(uname -m)" in
    x86_64) ADOPTIUM_ARCH=x64 ;;
    arm64 | aarch64) ADOPTIUM_ARCH=aarch64 ;;
    *) echo "Unsupported host architecture: $(uname -m)" >&2; exit 1 ;;
esac

step() { printf '\n==> %s\n' "$*"; }

step "JDK 17"
if java_is_17 "$JAVA_HOME"; then
    echo "using $JAVA_HOME"
else
    tmp="$(mktemp -d)"
    curl -fL --retry 3 -o "$tmp/jdk.tar.gz" \
        "https://api.adoptium.net/v3/binary/latest/17/ga/$ADOPTIUM_OS/$ADOPTIUM_ARCH/jdk/hotspot/normal/eclipse"
    tar -xzf "$tmp/jdk.tar.gz" -C "$tmp"
    jdk_dir="$(find "$tmp" -maxdepth 1 -type d -name 'jdk-17*' | head -1)"
    [[ -d "$jdk_dir/Contents/Home" ]] && jdk_dir="$jdk_dir/Contents/Home"
    mkdir -p "$(dirname "$JAVA_HOME")"
    rm -rf "$JAVA_HOME"
    mv "$jdk_dir" "$JAVA_HOME"
    rm -rf "$tmp"
    echo "installed $("$JAVA_HOME/bin/java" -version 2>&1 | head -1)"
fi

step "Android command-line tools"
if [[ -x "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" ]]; then
    echo "using $ANDROID_HOME"
else
    tmp="$(mktemp -d)"
    curl -fL --retry 3 -o "$tmp/tools.zip" \
        "https://dl.google.com/android/repository/commandlinetools-$HOST_OS-${CMDLINE_TOOLS_BUILD}_latest.zip"
    unzip -q "$tmp/tools.zip" -d "$tmp"
    mkdir -p "$ANDROID_HOME/cmdline-tools"
    rm -rf "$ANDROID_HOME/cmdline-tools/latest"
    mv "$tmp/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
    rm -rf "$tmp"
fi

step "Android SDK packages"
packages=("${SDK_PACKAGES[@]}")
$WITH_E2E && packages+=("emulator" "$SYSTEM_IMAGE")
# Command-line tools 23+ record license acceptance and use $https_proxy on their own.
sdkmanager "${packages[@]}" </dev/null

step "Rust toolchain (rust-toolchain.toml)"
if ! command -v rustup >/dev/null; then
    curl -fsSL --proto '=https' --tlsv1.2 https://sh.rustup.rs |
        sh -s -- -y --no-modify-path --profile minimal --default-toolchain none
fi
(cd "$REPO_ROOT" && rustup toolchain install && rustc --version)

step "cargo-ndk $CARGO_NDK_VERSION"
if ! cargo ndk --version 2>/dev/null | grep -q "$CARGO_NDK_VERSION"; then
    cargo install cargo-ndk --version "$CARGO_NDK_VERSION" --locked
fi

if $WITH_E2E; then
    step "Maestro $MAESTRO_VERSION"
    if ! maestro --version 2>/dev/null | grep -q "$MAESTRO_VERSION"; then
        tmp="$(mktemp -d)"
        curl -fL --retry 3 -o "$tmp/maestro.zip" \
            "https://github.com/mobile-dev-inc/Maestro/releases/download/cli-$MAESTRO_VERSION/maestro.zip"
        unzip -q "$tmp/maestro.zip" -d "$tmp"
        rm -rf "$HOME/.maestro"
        mv "$tmp/maestro" "$HOME/.maestro"
        rm -rf "$tmp"
    fi
fi

step "JavaScript dependencies"
(cd "$REPO_ROOT" && yarn install --immutable)

step "Done"
echo "Toolchain environment: source scripts/lib/env.sh"
