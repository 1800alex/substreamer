#!/usr/bin/env bash
#
# Run react-native-queue-player's Android JVM unit tests (the patched
# node_modules copy) through the app's Gradle project, offline.
#
# Usage:
#   scripts/test-rnqp.sh                                   # the cast.direct tests
#   scripts/test-rnqp.sh 'com.margelo.nitro.queueplayer.*' # any --tests filter
#
# Needs `make prebuild` (the android/ project) and an Android SDK + NDK. Uses
# ANDROID_HOME, else /usr/local/share/android-sdk, else ~/.local/share/android-sdk.
# android/local.properties is pointed at that SDK for the run and restored after.
# Release variant: the offline Gradle cache holds react-android's release AAR only.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FILTER="${1:-com.margelo.nitro.queueplayer.cast.direct.*}"

SDK="${ANDROID_HOME:-}"
for candidate in "$SDK" /usr/local/share/android-sdk "$HOME/.local/share/android-sdk"; do
  if [[ -n "$candidate" && -d "$candidate/platforms" ]]; then SDK="$candidate"; break; fi
done
[[ -d "$SDK/platforms" ]] || { echo "No Android SDK found" >&2; exit 1; }
NDK="$(basename "$(ls -d "$SDK"/ndk/* | tail -n1)")"
BUILD_TOOLS="$(basename "$(ls -d "$SDK"/build-tools/* | tail -n1)")"
[[ -x "$REPO_ROOT/android/gradlew" ]] || { echo "android/ missing: run make prebuild" >&2; exit 1; }

PROPS="$REPO_ROOT/android/local.properties"
BACKUP="$(mktemp)"
[[ -f "$PROPS" ]] && cp "$PROPS" "$BACKUP"
restore() { if [[ -s "$BACKUP" ]]; then cp "$BACKUP" "$PROPS"; else rm -f "$PROPS"; fi; rm -f "$BACKUP"; }
trap restore EXIT
printf 'sdk.dir=%s\n' "$SDK" > "$PROPS"

export ANDROID_HOME="$SDK" JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-17-openjdk-amd64}"
RESULTS="$REPO_ROOT/node_modules/react-native-queue-player/android/build/test-results/testReleaseUnitTest"
rm -rf "$RESULTS"

status=0
(cd "$REPO_ROOT/android" && ./gradlew --offline --no-daemon -q \
  :react-native-queue-player:testReleaseUnitTest --tests "$FILTER" \
  -PreactNativeArchitectures=arm64-v8a -PndkVersion="$NDK" -PndkOverride="$NDK" \
  -PbuildToolsOverride="$BUILD_TOOLS" -PbuildToolsVersion="$BUILD_TOOLS" \
  --init-script ../scripts/ndk-override.init.gradle 2>&1 | grep -E '^e: |FAILED|What went wrong|^> ' ) || true
for f in "$RESULTS"/*.xml; do
  [[ -f "$f" ]] || { echo "No test results (compile failure?)" >&2; exit 1; }
  line="$(grep -o '<testsuite name="[^"]*" tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*" errors="[0-9]*"' "$f")"
  echo "${line#<testsuite }"
  [[ "$line" == *'failures="0" errors="0"'* ]] || status=1
done
exit "$status"
