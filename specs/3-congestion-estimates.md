# Estimate travel and queue times from the conference clock

## What this changes
No attendee sees anything yet. A new pure module, `src/lib/congestion.js`, turns the simulated time (`HH:MM`) and the app's own data into estimates of shuttle waits, rideshare pickups, door arrival advice, food waits and whole legs between venues. Later pages (route view, leave-by card) read it instead of inventing numbers. Every estimate carries a `label` worded as an estimate, never as live data.

## Where
- `src/lib/congestion.js` (new) — named tuning constants at the top; `shuttleEstimate`, `pickupEstimate`, `doorEstimate`, `foodEstimate`, `estimateLeg` (wraps `travel.js:assessTravel`, adds `wait`, `totalNow`, `fitsNow` per option). Uses `toMinutes` from `src/lib/clock.js`. No `Math.random()`, no `new Date()`.
- `tests/unit/congestion.test.js` (new) — plain `node:test` unit tests in the style of `tests/unit/travel.test.js` (inline `travel` fixture); no lane, no database, no browser.
- `context/engineering-context/venues.md` — add a section documenting the module (inputs, outputs, shape of the peaks); update `context/engineering-context/index.md` description only if `node scripts/context.mjs for` asks.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| 09:30 shuttle is next-departure wait only, no queue | `shuttleEstimate` at 09:30 has `queue === 0` and `wait` equal to minutes to the next :00/:20/:40 | unit |
| Queue peaks in the 10 min after sessions end, gone by ~20 min after | 10:50 with end 10:45 gives the peak; 11:05 gives 0 | unit |
| Boundaries: 0 at a departure, 19 one minute after | 09:20 -> 0, 09:21 -> 19 | unit |
| Aurora -> Foundry and Foundry -> Aurora from their own rows | `estimateLeg` each way uses its own `minutes` (25 vs 27) | unit |
| Rideshare longer at a slot change than when quiet | `pickupEstimate` 10:50 (after end) > 09:30 | unit |
| >=90% full: arrive 10 min early; full: waitlist only; half empty: no advice | `doorEstimate` three sessions | unit |
| Food wait higher at 12:30 than 10:00 | `foodEstimate` same vendor | unit |
| `estimateLeg` flips `fits` true to `fitsNow` false when the wait pushes past the gap | leg with gap that fits by `total` but not `total + wait` | unit |
| Never negative, deterministic, labels read as estimates | sweep every minute 00:00-23:59 for every function; repeat calls deep-equal; labels match /usually|about|~|estimate/ | unit |

## Decisions
- Shuttle service window: treat departures as every 20 minutes from 07:00 with no end (the ticket says only "from 07:00"); outside service hours is not modelled. OK?
- `pickupEstimate` and queue size apply the same "after a session ends" window as the shuttle (peak for 10 min, decaying to 0 by 20 min), with an evening (after 18:00) uplift. OK?
- `estimateLeg` takes `time` as the departure time and `sessionEnds` for the departure venue, and its per-option wait uses the shuttle estimate for Shuttle and the pickup estimate for Rideshare/Taxi; other modes get a wait of 0. OK?

## Out of scope
Any page or component using the estimates, any API endpoint, real traffic data.
