## Vendored dependencies

This branch ships a local copy of [`shellies-ng`](https://github.com/fluxgrid/node-shellies-ng) so Homebridge installs do not need to patch `node_modules` manually. The vendored tree lives in `vendor/shellies-ng` and is published with the plugin (see the `"files"` entry in `package.json`).

### Refresh workflow

1. Run `./scripts/update-shellies-ng.sh` (passes through to the Fluxgrid fork and rebuilds `shellies-ng`).
2. Inspect the staged changes under `vendor/shellies-ng`.
3. Commit and push the updated vendor tree together with any plugin changes that require it.

If you need a different fork or branch, update the script before running it so the provenance stays documented.
