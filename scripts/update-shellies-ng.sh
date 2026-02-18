#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$ROOT/vendor/shellies-ng"
REPO="${SHELLIES_NG_REPO:-git@github.com:fluxgrid/node-shellies-ng.git}"
REF="${SHELLIES_NG_REF:-shelly-plus-uni}"
HTTPS_REPO="${SHELLIES_NG_REPO_HTTPS:-git+https://github.com/fluxgrid/node-shellies-ng.git}"

tmpdir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmpdir"
}
trap cleanup EXIT

echo "Cloning $REPO#$REF ..."
git clone "$REPO" "$tmpdir/repo" >/dev/null
pushd "$tmpdir/repo" >/dev/null
git checkout "$REF" >/dev/null

echo "Installing dependencies ..."
npm ci >/dev/null
echo "Building shellies-ng ..."
npm run build >/dev/null

UPSTREAM_VERSION="$(node -p "require('./package.json').version")"
REV="$(git rev-parse --short HEAD)"

popd >/dev/null

echo "Syncing built artifacts to vendor/shellies-ng ..."
rm -rf "$DEST"
mkdir -p "$DEST"
cp "$tmpdir/repo/LICENSE" "$DEST/"
cp "$tmpdir/repo/README.md" "$DEST/"
cp "$tmpdir/repo/package.json" "$DEST/"
cp -R "$tmpdir/repo/dist" "$DEST/dist"

export DEST HTTPS_REPO UPSTREAM_VERSION REV

node <<'NODE'
const fs = require('fs');
const path = process.env.DEST + '/package.json';
const repoUrl = process.env.HTTPS_REPO;
const upstreamVersion = process.env.UPSTREAM_VERSION;
const rev = process.env.REV;

const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
pkg.version = `${upstreamVersion}-fluxgrid.${rev}`;
pkg.description = 'Fluxgrid fork of shellies-ng that includes Shelly Plus Uni support.';
pkg.repository = { type: 'git', url: repoUrl };
pkg.bugs = { url: repoUrl.replace(/^git\+/, '').replace(/\.git$/, '') + '/issues' };
pkg.homepage = repoUrl.replace(/^git\+/, '').replace(/\.git$/, '#readme');

fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
NODE

UPDATED_VERSION=$(DEST="$DEST" node <<'NODE'
const path = process.env.DEST + '/package.json';
const pkg = require(path);
process.stdout.write(pkg.version);
NODE
)

echo "Done. Updated version ${UPDATED_VERSION}"
