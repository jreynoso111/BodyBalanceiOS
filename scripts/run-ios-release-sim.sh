#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WORKSPACE_PATH="$ROOT_DIR/ios/IGOTU.xcworkspace"
DERIVED_DATA_PATH="$ROOT_DIR/ios/build/release-sim"
APP_PATH="$DERIVED_DATA_PATH/Build/Products/Release-iphonesimulator/IGOTU.app"
SIMULATOR_NAME="${IOS_SIMULATOR:-${1:-iPhone 17}}"

if [ ! -d "$WORKSPACE_PATH" ]; then
  echo "Missing iOS workspace at $WORKSPACE_PATH"
  exit 1
fi

SIMULATOR_UDID="$(xcrun simctl list devices available | awk -F '[()]' -v name="$SIMULATOR_NAME" '$0 ~ name { print $2; exit }')"

if [ -z "$SIMULATOR_UDID" ]; then
  echo "Could not find an available simulator named '$SIMULATOR_NAME'"
  exit 1
fi

xcrun simctl boot "$SIMULATOR_UDID" >/dev/null 2>&1 || true
xcrun simctl bootstatus "$SIMULATOR_UDID" -b

xcodebuild \
  -workspace "$WORKSPACE_PATH" \
  -scheme IGOTU \
  -configuration Release \
  -sdk iphonesimulator \
  -destination "id=$SIMULATOR_UDID" \
  -derivedDataPath "$DERIVED_DATA_PATH" \
  build

if [ ! -d "$APP_PATH" ]; then
  echo "Release app not found at $APP_PATH"
  exit 1
fi

BUNDLE_IDENTIFIER="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP_PATH/Info.plist")"

xcrun simctl install "$SIMULATOR_UDID" "$APP_PATH"
xcrun simctl launch "$SIMULATOR_UDID" "$BUNDLE_IDENTIFIER"
