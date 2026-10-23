#!/usr/bin/env bash
# Builds the MercuReal Assistant APK (WebView shell over the deployed web app).
# Usage: ANDROID_HOME=/path/to/sdk ./build.sh
# Requires: JDK 17+, Android SDK with platforms;android-35 and build-tools;35.0.0 (or 36.1.0).
# Signing: debug keystore by default (~/.android/debug.keystore, created if missing).
# Set SIGN_KEYSTORE / SIGN_ALIAS / SIGN_PASS to sign with a release key instead.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SDK="${ANDROID_HOME:?set ANDROID_HOME to the Android SDK path}"
PLATFORM="$(ls -d "$SDK"/platforms/android-* | sort -V | tail -1)"
BT="$(ls -d "$SDK"/build-tools/* | sort -V | tail -1)"
OUT="$HERE/build"
rm -rf "$OUT" && mkdir -p "$OUT/gen" "$OUT/classes" "$OUT/obj"

echo "platform: $PLATFORM"
echo "build-tools: $BT"

# 1. Resources -> R.java
"$BT/aapt2" compile --dir "$HERE/res" -o "$OUT/res.zip"
"$BT/aapt2" link -o "$OUT/base.apk" -I "$PLATFORM/android.jar" \
  --manifest "$HERE/AndroidManifest.xml" --java "$OUT/gen" \
  --min-sdk-version 24 --target-sdk-version 35 \
  --version-code 1 --version-name 1.0.0 \
  "$OUT/res.zip"

# 2. Compile Java -> classes
javac -encoding UTF-8 -source 8 -target 8 -Xlint:-options \
  -bootclasspath "$PLATFORM/android.jar" -d "$OUT/classes" \
  $(find "$OUT/gen" "$HERE/src" -name '*.java')

# 3. Dex
"$BT/d8" --min-api 24 --lib "$PLATFORM/android.jar" \
  --output "$OUT/" $(find "$OUT/classes" -name '*.class')

# 4. Add dex to the apk
cp "$OUT/base.apk" "$OUT/unsigned.apk"
(cd "$OUT" && zip -q -j unsigned.apk classes.dex)

# 5. Align
"$BT/zipalign" -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"

# 6. Sign
if [ -n "${SIGN_KEYSTORE:-}" ]; then
  KS="$SIGN_KEYSTORE"; ALIAS="${SIGN_ALIAS:?}"; PASS="${SIGN_PASS:?}"
else
  KS="$HOME/.android/debug.keystore"; ALIAS="androiddebugkey"; PASS="android"
  if [ ! -f "$KS" ]; then
    mkdir -p "$HOME/.android"
    keytool -genkeypair -keystore "$KS" -storepass android -keypass android \
      -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 \
      -dname "CN=Android Debug,O=Android,C=US"
  fi
fi
"$BT/apksigner" sign --ks "$KS" --ks-key-alias "$ALIAS" \
  --ks-pass "pass:$PASS" --key-pass "pass:$PASS" \
  --out "$OUT/mercureal-assistant-1.0.0.apk" "$OUT/aligned.apk"
"$BT/apksigner" verify --verbose "$OUT/mercureal-assistant-1.0.0.apk"

echo "built: $OUT/mercureal-assistant-1.0.0.apk"
