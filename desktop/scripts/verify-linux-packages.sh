#!/usr/bin/env bash
# Verifies Linux artifacts without installing packages or touching user data.
# Run from desktop/: bash scripts/verify-linux-packages.sh
set -euo pipefail
shopt -s nullglob

appimages=(release/*.AppImage)
debs=(release/*.deb)
if (( ${#appimages[@]} != 1 || ${#debs[@]} != 1 )); then
  echo "Expected exactly one .AppImage and one .deb in desktop/release/" >&2
  exit 1
fi

for artifact in "${appimages[0]}" "${debs[0]}"; do
  test -s "$artifact" || { echo "Empty artifact: $artifact" >&2; exit 1; }
  printf 'Artifact: %s (%s bytes)\n' "$artifact" "$(stat -c %s "$artifact")"
done

# Basic ELF header validation: no dependency on FUSE or executing an AppImage.
elf_magic="$(od -An -tx1 -N4 "${appimages[0]}" | tr -d ' \n')"
test "$elf_magic" = "7f454c46" || {
  echo "AppImage has no ELF executable header" >&2; exit 1;
}

package_name="$(dpkg-deb --field "${debs[0]}" Package)"
version="$(dpkg-deb --field "${debs[0]}" Version)"
architecture="$(dpkg-deb --field "${debs[0]}" Architecture)"
test -n "$package_name" &&
  test "$version" = "$(node -p "require('./package.json').version")" &&
  test "$architecture" = "amd64" || {
  echo "Unexpected Debian package metadata: $package_name / $version / $architecture" >&2
  exit 1
}

temp="$(mktemp -d)"
trap 'rm -rf "$temp"' EXIT
dpkg-deb --extract "${debs[0]}" "$temp"
launcher="$(find "$temp/usr/share/applications" -type f -name '*.desktop' -print -quit)"
test -f "$launcher" || { echo "No .desktop launcher in Debian package" >&2; exit 1; }
grep -q '^\[Desktop Entry\]' "$launcher"
grep -Fxq 'Name=Reader Desktop' "$launcher"
grep -q '^Exec=' "$launcher"
grep -q '^Icon=' "$launcher"
# A visible launcher and the running Chromium window must share their ID.
# Otherwise GNOME/Mint can show a generic/duplicated taskbar entry.
desktop_name="$(node -p "require('./package.json').desktopName")"
test -n "$desktop_name"
grep -Fxq "StartupWMClass=$desktop_name" "$launcher" || {
  echo "Linux launcher WM_CLASS does not match desktopName: $desktop_name" >&2
  exit 1
}
find "$temp/usr/share/icons" -type f -name '*.png' | grep -q . || {
  echo "Linux icon PNG missing from Debian package" >&2; exit 1;
}
find "$temp/opt" -type f -name 'app.asar' | grep -q . || {
  echo "Electron application resources are missing" >&2; exit 1;
}
echo "PASS: Linux AppImage and Debian package, desktop launcher, icon and app resources."
