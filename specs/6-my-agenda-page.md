# Build the My Agenda page

## What this changes
`/my-agenda` stops being a "Coming soon" panel. It lists every session the signed-in attendee holds, grouped by day, from `api.getSchedule`. A waitlisted session is marked Waitlisted. Each day shows its booked hours (confirmed seats only), with waitlisted time apart (`+Nh waitlisted`). Overlapping sessions are marked as clashes. Removing a session on the page drops it and updates totals and clashes at once. With nothing booked there is an empty state linking to `/schedule`.

## Where
- `src/lib/agendaView.js` (new, pure) — `viewDays(days, reservationFor)`: drops sessions where `reservationFor(id)` is null, recomputes `conflicts` (pairwise overlap, both statuses), `totalMinutes` (confirmed only), `waitlistedMinutes`, drops empty days. Test in `tests/unit/agendaView.test.js`.
- `src/pages/MyAgendaPage.jsx` — fetch with `useFetch(() => api.getSchedule(currentUserId))` keyed on the attendee, pass through `viewDays` with `useConference().reservationFor`; render each day with `SessionCard variant="row"` (its `attendance` prop only for confirmed seats), a clash marker per conflicting session, `Stat` for booked hours with `note="+Nh waitlisted"`, remove via `toggleSeat`. Empty state: `EmptyState` with a `Button to="/schedule"`. Test ids: `agenda-day`, `agenda-booked-hours`, `agenda-clash`, `agenda-empty`.
- `tests/home.spec.js` — replace "My Agenda is a blank canvas" with a nav and `/my-plan` redirect check that no longer expects the placeholder.
- `tests/agenda.spec.js` (new) — a new lane `agenda.page` in `LANES` in `tests/helpers.js` (check the whole table first, per the testing doc), `laneFor`, `bookableFor`, pinned clock; releases what it books.
- `context/engineering-context/agenda.md` — replace the placeholder section; drop "no UI yet".

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| No coming-soon placeholder | `agenda-coming-soon` absent, `agenda-day` present on `/my-agenda` | spec |
| Sessions grouped by day, waitlisted marked | `viewDays` keeps both statuses grouped by day; page shows Waitlisted on a queued session | unit + spec |
| Booked hours confirmed only, waitlisted apart | `viewDays` totals with a mixed day; tile shows the note | unit + spec |
| Overlaps shown as clashes | `viewDays` returns a conflict for two overlapping sessions; `agenda-clash` visible | unit + spec |
| Removing updates list and totals without refresh | click remove: row gone, hours tile drops, no reload | spec |
| Empty state points to schedule | attendee with nothing booked sees `agenda-empty` with a link to `/schedule` | spec |

## Decisions
- Is the page driven by the signed-in attendee from the switcher, with no per-user URL — OK?
- Are clashes marked on both sessions of a pair with a badge, rather than a separate list — OK?
- Does a day that becomes empty after removal disappear, and the whole page fall to the empty state — OK?

## Out of scope
Suggestions, the `.ics` export button, anything on Home.
