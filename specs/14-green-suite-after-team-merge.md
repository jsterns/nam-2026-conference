# Make the full test suite pass with the team's main merged in

## What this changes
Test plumbing only; no attendee sees a difference. Every browser spec starts with the welcome already seen, `session.hop` gets a lane no other pane touches, and the failing `people.spec.js` test is either corrected or parked as `test.fixme` with a comment on #14.

## Where
- `playwright.config.js` — `use.storageState` with `origins: [{ origin: 'http://localhost:${WEB_PORT ?? 5173}', localStorage: [{ name: 'orbit:welcomeSeen', value: '1' }] }]`, using the same port expression as `baseURL`.
- `tests/helpers.js` — `visit()`: drop the `orbit:welcomeSeen` line (the config now does it). `LANES['session.hop']`: move to day index 0, pinned slots, e.g. `desktop: { user: abraham, day: 0, slot: '14:45' }`, `mobile: { user: marcus, day: 0, slot: '16:00' }`. Those slots start the two pairs (14:45 and 16:00 each have a session 30 minutes later, 15:30 to 16:00 and 16:45 to 17:15). The pairs differ so the two projects share no session. Both attendees' other day 0 panes pin 10:15 and 13:30 or are read-only, which `lanes.test.js` allows. Update the lane's comment. Days 1 and 3 have every attendee taken, and day 2's slots belong to the seat-count lanes, so day 0 with a pinned slot is the only room left.
- `tests/session.spec.js` — the hop test (line 39): choose `pair` from `free` with `a.startsAt.slice(11, 16) === lane.slot` (check the `startsAt` format) instead of the first pair anywhere on the day.
- `tests/welcome.spec.js` — `test.use({ storageState: { cookies: [], origins: [] } })` at the top; the `?welcome` test's own `addInitScript` stays (it is the "has seen it" case).
- `tests/people.spec.js` line 12 — find why it fails on the team's main. Suspect: the `likers` ids `{ 5: [19, 21], 4: [17] }` and the "none first in the deck" assumption against the mock crowd (`server/seed.js` ~956-975, where every crowd member likes attendees 1 to 6). If the spec is stale, fix it. If the app is wrong, change no app code: `test.fixme` with the reason and `gh issue comment 14`.
- `context/engineering-context/testing.md` — Browser part and the `visit` / Gotchas text: every spec starts with the welcome seen via the config's `storageState`; opt out with `test.use({ storageState: { cookies: [], origins: [] } })`. Update the `session.hop` mention if any.
- Day 0 booking check: confirm the hop test's PUTs are not refused as "ended" at the hour it runs (the clock on the request); if they are, pass the pinned clock as `session.add` does.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| `npm test` passes incl. `lanes.test.js` | `lanes.test.js` clash list is empty (red today: `session.hop` vs `profile.walk`) | unit |
| `npm run verify` passes on both projects, bar any `test.fixme` | full `npm run verify`; `presentation.spec.js` attendee-menu test no longer blocked by `welcome-backdrop` | browser |
| No spec calls `visit()` or sets `orbit:welcomeSeen` to avoid the welcome; `welcome.spec.js` starts with empty storage | `presentation.spec.js` menu test passes via `page.goto` alone, and `welcome.spec.js` first test still sees `welcome-dialog`; grep of `tests/` (excluding `specs/`) for `welcomeSeen` finds only the welcome spec's "has seen it" case | browser |
| `session.hop`'s pair is not one any slot-pinned or seat-counting lane books | `seats.spec.js` "releasing gives the seat back" and the waitlist-position test pass; `lanes.test.js` is green | unit and browser |
| `testing.md` documents the default and the opt-out | the doc is read in review; `node scripts/context.mjs for tests/helpers.js playwright.config.js` lists it | docs |

## Decisions
- Is moving `session.hop` to day 0 with slots 14:45 (desktop) and 16:00 (mobile) OK, given days 1 and 3 have every attendee taken and day 2's slots belong to the seat-count lanes?
- Should the welcome-seen default live only in `playwright.config.js` and `visit()` stop setting it, as the ticket's "No spec has to call visit() or set welcomeSeen" implies?

## Out of scope
App behaviour and any feature work.
