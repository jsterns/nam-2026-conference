# Reopen the welcome or start the tour from a link

## What this changes
Opening any page with `?welcome` shows the welcome dialog, and `?tour` starts the guided tour at "1 of 2", whatever `orbit:welcomeSeen` says. Once acted on, the app removes that one parameter from the address bar (other parameters such as `at` stay), so a reload does not reopen it. Without either parameter nothing changes.

## Where
- `src/lib/welcome.js` — new pure `takeLaunchParams(search)` returning `{ welcome, tour, search }`: `welcome`/`tour` are true when the key is present (any value, or none), `search` is the query string with those two keys removed and every other key untouched; test in `tests/unit/welcome.test.js` (node:test, no lane).
- `src/components/Layout.jsx` — in the existing `ready` effect (next to the `hasSeenWelcome()` check) call `takeLaunchParams(window.location.search)` once (ref-guarded against StrictMode double effects). `tour` → `setTour(tourSteps(newEntries(), { days }))`, no welcome, and `markWelcomeSeen()`; else `welcome` → `setWelcomeOpen(true)`; else the first-visit rule as today. If anything was taken, `history.replaceState(history.state, '', pathname + search + hash)`.
- `tests/welcome.spec.js` — new spec, plain `page.goto` with `addInitScript` setting `orbit:welcomeSeen`; no seats booked so no data lane; clock pinned with `momentOn(0, '10:00')` from `tests/helpers.js`.
- `context/engineering-context/ui.md` — Layout paragraph and Guided tour section list `?welcome` and `?tour`; ownership list unchanged.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| `/?welcome` with welcome seen shows it; closing drops `welcome` from URL; reload does not reopen | spec: seen set, goto `/?welcome`, dialog visible, Escape, URL has no `welcome`, reload, dialog hidden | Playwright |
| `/schedule?tour` starts the tour at "1 of 2" | spec: seen set, goto `/schedule?tour`, `tour-callout` contains "1 of 2", welcome dialog absent, URL has no `tour` | Playwright |
| `?at=<day>T10:00&welcome` keeps `at` and the pinned clock | spec: goto with `at` and `welcome`, dialog visible, URL still has `at`, clock badge/state reflects 10:00 | Playwright |
| Without params, first visit opens, later visits do not | existing first-visit spec stays; unit: `takeLaunchParams('')` reports neither and leaves search as is | Unit + existing spec |
| Both parameters work, `welcome=1` works, other params survive | unit: `takeLaunchParams('?at=x&welcome=1&tour')` → both true, search `?at=x`; `?tour` alone → search `''` | Unit |

## Decisions
- If both `?welcome` and `?tour` are present, start the tour and skip the welcome — OK?
- `?tour` on a first visit also marks the welcome seen, as Take the tour does, so it does not appear after the tour — OK?
- Params are read once when the app has loaded (`ready`), and the tour's first step still navigates to `/schedule`, which drops `at` from the address bar only when the tour starts on another page — leave that as is — OK?

## Out of scope
Changing the welcome or tour content, and keeping other parameters through the tour's own navigation.
