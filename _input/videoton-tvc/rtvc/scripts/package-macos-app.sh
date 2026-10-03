#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "usage: $0 <target-triple> <binary-path> <package-dir>" >&2
  exit 2
fi

target_triple="$1"
binary_path="$2"
package_dir="$3"
binary_dir="$(dirname "$binary_path")"
app_name="RTVC.app"
bundle_id="one.teki.rtvc"
bundle_version="$(awk -F'"' '/^version =/ { print $2; exit }' Cargo.toml)"

cli_tools=(rtvc-dsk rtvc-asm rtvc-basic rtvc-tocas rtvc-disasm rtvc-cas2wav rtvc-tap2toml)

if [[ ! -f "$binary_path" ]]; then
  echo "missing binary: $binary_path" >&2
  exit 1
fi

for cli_tool in "${cli_tools[@]}"; do
  if [[ ! -f "$binary_dir/$cli_tool" ]]; then
    echo "missing binary: $binary_dir/$cli_tool" >&2
    exit 1
  fi
done

mkdir -p "$package_dir"
rm -rf "$package_dir/$app_name" "$package_dir/bin" "$package_dir/info" "$package_dir/info.hu"
mkdir -p "$package_dir/$app_name/Contents/MacOS"
mkdir -p "$package_dir/$app_name/Contents/Resources"
mkdir -p "$package_dir/bin"

cp "$binary_path" "$package_dir/$app_name/Contents/MacOS/rtvc"
chmod +x "$package_dir/$app_name/Contents/MacOS/rtvc"
cp assets/rtvc-app-icon.icns "$package_dir/$app_name/Contents/Resources/rtvc-app-icon.icns"

# The native app searches for these directories in the current working
# directory and beside the executable. Finder launches do not set the extracted
# archive as cwd, so keep runtime assets beside Contents/MacOS/rtvc.
cp -R roms "$package_dir/$app_name/Contents/MacOS/roms"
cp -R progs "$package_dir/$app_name/Contents/MacOS/progs"
mv "$package_dir/web" "$package_dir/$app_name/Contents/MacOS/web"
cp README.md "$package_dir/"
cp README.hu.md "$package_dir/"
cp LICENSE "$package_dir/"
cp -R info info.hu "$package_dir/"

for cli_tool in "${cli_tools[@]}"; do
  cp "$binary_dir/$cli_tool" "$package_dir/bin/$cli_tool"
  chmod +x "$package_dir/bin/$cli_tool"
  codesign --force --options runtime --sign - "$package_dir/bin/$cli_tool"
  codesign --verify --strict --verbose=2 "$package_dir/bin/$cli_tool"
done

cat > "$package_dir/$app_name/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleDisplayName</key>
  <string>RTVC</string>
  <key>CFBundleExecutable</key>
  <string>rtvc</string>
  <key>CFBundleIdentifier</key>
  <string>${bundle_id}</string>
  <key>CFBundleIconFile</key>
  <string>rtvc-app-icon.icns</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>RTVC</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>${bundle_version}</string>
  <key>CFBundleSupportedPlatforms</key>
  <array>
    <string>MacOSX</string>
  </array>
  <key>CFBundleVersion</key>
  <string>${GITHUB_RUN_NUMBER:-0}</string>
  <key>LSMinimumSystemVersion</key>
  <string>11.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
EOF

# Keep local Finder metadata out of archives as well as clean CI packages.
find "$package_dir" -name .DS_Store -delete

codesign --force --deep --options runtime --sign - "$package_dir/$app_name"
codesign --verify --deep --strict --verbose=2 "$package_dir/$app_name"
