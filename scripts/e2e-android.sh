#!/usr/bin/env bash
# Runs the Maestro flows in app/e2e/ against the release APK on a headless x86_64 emulator.
# Needs `scripts/bootstrap-android.sh --e2e` and a built APK (scripts/build-android.sh).
#   E2E_APK      APK to install (default: the release APK)
#   E2E_AVD      emulator name (default: home-inventory-e2e; created if missing)
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib/env.sh"

apk="${E2E_APK:-$REPO_ROOT/app/android/app/build/outputs/apk/release/app-release.apk}"
avd="${E2E_AVD:-home-inventory-e2e}"
system_image="system-images;android-36;google_apis;x86_64"

[[ -f "$apk" ]] || { echo "APK not found: $apk (run scripts/build-android.sh)" >&2; exit 1; }

if ! emulator -list-avds | grep -qx "$avd"; then
    echo no | avdmanager create avd --name "$avd" --package "$system_image" --device pixel_7
    # Room for the ~1 GB APK with bundled models.
    echo "disk.dataPartition.size=8G" >> "$HOME/.android/avd/$avd.avd/config.ini"
fi

emulator -avd "$avd" -no-window -no-audio -no-boot-anim -no-snapshot -gpu swiftshader_indirect \
    >"${TMPDIR:-/tmp}/$avd.log" 2>&1 &
emulator_pid=$!
trap 'adb emu kill >/dev/null 2>&1 || kill "$emulator_pid" 2>/dev/null || true' EXIT

adb wait-for-device
until [[ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]; do sleep 2; done
echo "emulator booted"

adb install -r "$apk"
maestro test "$REPO_ROOT/app/e2e"

# The app logs selfCheck() at startup; without it the native core never ran.
adb logcat -d -s ReactNativeJS:V | grep "core self-check" ||
    { echo "native self-check was not logged" >&2; exit 1; }
