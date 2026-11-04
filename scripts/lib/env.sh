# Toolchain locations shared by the build scripts. Source this file; every value can be
# overridden from the environment.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export REPO_ROOT

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export ANDROID_NDK_VERSION="27.1.12297006"
export ANDROID_NDK_HOME="$ANDROID_HOME/ndk/$ANDROID_NDK_VERSION"
export ANDROID_NDK_ROOT="$ANDROID_NDK_HOME"

java_is_17() {
    [[ -x "$1/bin/java" ]] && "$1/bin/java" -version 2>&1 | grep -q 'version "17\.'
}
if ! java_is_17 "${JAVA_HOME:-}"; then
    export JAVA_HOME="$HOME/.local/jdk-17"
fi

export CARGO_HOME="${CARGO_HOME:-$HOME/.cargo}"
export PATH="$JAVA_HOME/bin:$CARGO_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$HOME/.maestro/bin:$PATH"
