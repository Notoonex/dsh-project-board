# Changelog

## 0.1.1

- Allow the DSH Desktop `dsh-app://` origin (the board fetch was 403 on 0.2.1).
- Adapt the client entry to DSH 0.2.1: `ui-slots`/`modules` injection and a `ctx.get` service fallback.
- Fix sidebar tab registration fields (`patterns`, `canOpen`, `priority`).

## 0.1.0 — 2026-10-24

- Initial public release.
- Node-based progress board and flat decision ledger.
- DSH right-sidebar plugin: index chips, exclusive accordion, search, filters, decision groups, bottom-sheet detail.
- Skill: init / operate / schema / domain packs / lint / legacy scan.
- Local board server with CORS allowlist, project whitelist and auto-generated API token.
- `/api/health` for port probing; token injected into the client on first run.
- Bundled skill updates incrementally; local edits and added files are preserved.
- Task markdown (links, code spans, bold) is preserved when toggling done.
- Light/dark theme follows DSH tokens.
