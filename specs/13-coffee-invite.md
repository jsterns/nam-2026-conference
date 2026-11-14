# Send a coffee invite with a free slot when two attendees match
## What this changes
When the second like of a pair makes a match on `/people`, the app records one fixed message on that match:
"Up for a coffee and a chill?", with a suggested slot (day and start time). The slot is the first upcoming
session slot in which neither attendee holds a confirmed seat. Waitlist places do not block a slot. If no shared
free slot is left, the message is "No time is available for a coffee." and there is no slot. It is stored once,
so both attendees see the same message under Matches (a card shows the message and the slot). No free text,
reply, accept, decline, notification or booking.

## Where
- `server/db.js` — new table `match_invites (user_a, user_b, message, day, starts_at, PRIMARY KEY (user_a, user_b))`
  with `user_a < user_b`, in `SCHEMA` and in `dropAll()`.
- `server/lib/people.js` — `decide(userId, targetId, choice, now)`: when the like completes a match, call a new
  `inviteFor(a, b, now)` and `INSERT OR IGNORE` the row (a repeat PUT never rewrites it); it returns
  `{ choice, matched, invite }`. `inviteFor` takes distinct `(day, starts_at)` from `sessions` ordered by day then
  start, drops slots before `now` (a slot starting exactly at `now` stays; no `now` means no lower bound, as in
  `reserveSeat`), drops any slot where either attendee has a `confirmed` reservation starting at that exact
  `starts_at` (same exact-start rule as `todayFor`'s `openSlot` in `server/lib/agenda.js`), and takes the first.
  `matchesFor` joins the stored invite so each card carries `invite: { message, day, startsAt } | null`
  (`startsAt`/`day` null when no time). The message strings are two constants in this file.
- `server/lib/query.js` — snake to camel for `starts_at` goes in a `toInvite()` mapper beside `toUser`.
- `server/routes/users.js` — `PUT /:id/people/:targetId` passes `{ day, time }` from `req.body` to `decide`
  (as the reservations route does).
- `src/lib/api.js` — `decidePerson(userId, targetId, choice, now)` sends `{ choice, ...now }`.
- `src/pages/PeoplePage.jsx` — pass `clock` from `useConference()`; on `matched`, add `{ ...card, invite: res.invite }`;
  in the `match-item` render `data-testid="match-invite"` with the message and, when there is a slot,
  `dayLabel`/`time` from `src/lib/format.js`.
- Docs: `context/engineering-context/people.md` (decide signature, `invite`, table, test id) and `data-model.md`.
- Tests: `tests/api/people.test.js` (throwaway DB via `startApi`, no lane; attendees 1 and 4 match through seeded
  likes from 8 and 17, seats via `PUT /users/:id/reservations/:sessionId`, days and sessions from `/bootstrap`
  and `/sessions`); `tests/people.spec.js` extended in the existing `people.deck` lane (`laneFor`), clock pinned
  with `visit(..., { at })`.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| A new match carries the coffee message and a suggested slot | the matching `PUT` returns `invite` with the fixed message and a day and start; `GET people` returns the same on the match (both are undefined on main) | API |
| Slot holds no confirmed seat for either attendee and is not before the pinned clock | both attendees hold confirmed seats in the early slots, clock pinned mid-day; the slot is the first later one with neither booked, and not before the clock | API |
| A waitlist place does not stop a slot | one attendee waitlisted (full session) in the otherwise first free slot; that slot is the one suggested | API |
| Both attendees see the same message | `GET people` for each side returns an identical `invite` | API, and the spec reads `match-invite` as the matching attendee |
| No free slot left in common | clock pinned after the last slot of the last day: `invite.message` is the no-time text and the slot is null; the page shows it | API, and `tests/people.spec.js` |

## Decisions
- Is a slot "free" when no confirmed seat starts at that exact start time (the `openSlot` convention), rather than when no confirmed seat overlaps it?
- Is a slot starting exactly at the pinned clock still eligible (not before the clock)?
- Is the clock taken from the attendee who completes the match, and the invite fixed from then on (not recalculated on each read)?
- When the PUT carries no clock, is every slot eligible (as `reserveSeat` treats a missing clock)?
- Do matches made before this change (none are seeded) show no invite rather than a computed one?

## Out of scope
Replying, accepting or declining; notifications or email; booking anything.
