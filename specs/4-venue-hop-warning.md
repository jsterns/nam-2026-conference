# Warn when two of your sessions are at different venues

## What this changes
On `/sessions/:id`, when you hold a confirmed seat in this session and in the
confirmed session immediately before or after it that day, and the two are at
different venues, the page shows a **Getting there** notice for that hop. It
names the other session (linked), the gap, and each travel option with its time
(+ walk) and cost, and says plainly one of: the free shuttle works, the shuttle
is too slow but a named paid option fits (with cost), or you will not make it.
Same-venue neighbours show nothing. Dropping either seat removes it with no refresh.

## Where
- `src/lib/travel.js` — add pure `hopsFor({ session, schedule, travel, reservationFor })` returning `{ direction, other, assessment }` for the nearest confirmed neighbour before (latest `endsAt <= startsAt`) and after (earliest `startsAt >= endsAt`) on the same day, only when the venue differs (`assessTravel` returns `null` otherwise), plus `hopSummary(assessment)` building the sentence. Gap = minutes between end of the first and start of the second (`toMinutes`-style on `HH:MM`). Test in `tests/unit/travel.test.js`.
- `src/pages/SessionPage.jsx` — `TravelNotice`: keep the existing "across town" block (still only for non-primary venues) and add the hop blocks, `data-testid="getting-there"`, so Aurora sessions get the notice too. Fetch `api.getSchedule(currentUserId)` inside `TravelNotice` via `useFetch` keyed on `[currentUserId, reservations]` (a child, so the page-level skeleton never flashes; `useFetch` keeps old data while reloading). Filter every schedule session through `reservationFor(id) === 'confirmed'` and require `reservationFor(session.id) === 'confirmed'` for the page's own session, so removals update at once.
- `tests/session.spec.js` — new test using a new lane `session.hop` added to `LANES` in `tests/helpers.js` (check `tests/unit/lanes.test.js`), `laneFor`, `bookableFor`, `momentOn(0, '07:00')` pin via `visit(..., { at })`; finds consecutive sessions at different venues 30 min apart from `/api/sessions`, books both via `PUT /users/:id/reservations/:sid`, releases in `finally`.
- Docs: `context/engineering-context/venues.md` (assessTravel "No UI calls it yet" line), `schedule.md` (SessionPage), `agenda.md` (`getSchedule` "no UI calls it yet").

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Two consecutive seats, different venues, 30 min apart: notice on both pages naming the other | spec books both, visits each page, asserts `getting-there` contains the other's title and link | Playwright |
| Nothing fits: "will not make it" | `hopSummary` of an assessment with `impossible` | unit |
| Only paid fits: shuttle too slow, names paid option and cost | `hopSummary` with `freeTooSlow`, text includes mode and `$` cost | unit |
| Lunch gap 12:15 to 13:30: shuttle works | `hopsFor` gap 75 yields `free.fits`, summary says shuttle works | unit |
| Same venue: no notice | `hopsFor` returns `[]` | unit |
| Removing a seat removes notice without reload | spec clicks the seat button on the page and asserts `getting-there` hidden | Playwright |
| Spec has pinned clock, own lane, releases seats | the spec itself | Playwright |

## Decisions
- Require a confirmed seat in the page's own session as well as the neighbour, so "removing one of the two seats" works from either page. OK?
- Only the nearest neighbour in each direction counts, even if it is the same venue (a same-venue session in between hides a farther cross-venue one). OK?
- Waitlisted seats never trigger the notice (confirmed only, as everywhere hours are counted). OK?

## Out of scope
My Agenda, the schedule grid, live wait estimates.
