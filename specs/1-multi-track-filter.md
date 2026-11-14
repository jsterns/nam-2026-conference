# Filter the schedule by several tracks at once

## What this changes
On `/schedule` the track chips become a multi-select. Tapping a chip adds or removes that track; **All** clears the selection (empty means All). A session shows when it is in any selected track. The selection lives in the URL as `?track=a,b` and goes to the API as `trackSlug=a,b`. Each track chip exposes `aria-pressed`, and **All** is pressed only when nothing is selected.

## Where
- `server/routes/sessions.js` — the `trackSlug` line in `GET /`: split on `,`, drop empties, push `t.slug IN (?, ?)`. One value stays the same query as today.
- `src/pages/SchedulePage.jsx` — track chip block (~line 163): derive `selected = filters.track.split(',')` (ALL gives none), toggle a slug by rebuilding the comma-joined string via `set('track', …)`, add `aria-pressed` to **All** and each chip. Everything else (`BLOCKERS`, `activeKeys`, `useFetch` deps, `qs()` pass-through) already handles the string.
- Tests: API in `tests/api/endpoints.test.js` (existing harness); browser in `tests/schedule.spec.js` using `visit`, `waitForResults`, `API`, `conferenceDays` from `tests/helpers.js`; click `Filters` first on mobile.
- Docs: `context/engineering-context/schedule.md` mentions track filter behaviour if it describes the chips; update it.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Two or more tracks show only those tracks and `result-count` matches the API | `trackSlug=a,b` returns exactly the union of `a` and `b` (false today: matches nothing); spec clicks two chips and compares `result-count` to the API count | API + spec |
| Removing one narrows the list again | spec clicks a selected chip off, `result-count` equals the API count for the remaining track | spec |
| **All** resets, no chip pressed | spec clicks All; count equals the unfiltered count, every track chip `aria-pressed=false`, URL has no `track` | spec |
| `?track=<one-slug>` unchanged | API single slug count equals today's (existing endpoints test) and spec loads the link: that chip pressed, count matches API | API + spec |
| `aria-pressed` reflects selection | spec asserts true/false after each click | spec |

## Decisions
- Should **All** itself expose `aria-pressed` (true when no track is selected)? The ticket only requires that no track chip is pressed under All.

## Out of scope
Venue, level, format and tag filters stay single-choice.
