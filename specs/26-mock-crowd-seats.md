# Fill out the mock crowd so every like matches and coffee slots vary

## What this changes
A fresh seed has thirty mock attendees (ids 7 to 36) instead of twenty. All thirty like each of attendees 1 to 6, so as any of the six, liking anyone in the deck is a match. Each mock attendee also holds confirmed seats, so the coffee invite offered on a match depends on who you match: three seat groups are each free in a different third of the slot list, and the first free slot differs per group.

## Where
- `server/seed.js` `CROWD` (~line 922) — append ten hand-written tuples (ids 27 to 36, five buyers, five sellers, same shape, `@example.com`, a company other than Equal Experts, two to four tracks, topic-tag interests). No PRNG. Role stays `i % 2` (buyer on even index) so index parity is the role. Choose their tracks so every track has at least three buyers and three sellers, and so each of the six (role, group) pairs is present on every track, where group = `i % 3` and so (role, group) is `i % 6`.
- `server/seed.js` `LIKES` (~line 957) — replace the 18 hand-written rows with a loop: every crowd member likes each of users 1 to 6 (180 rows) into `people_decisions`.
- `server/seed.js` after the likes, before SUMMARY — new seat step. Build the slot list as `SELECT DISTINCT day, starts_at FROM sessions ORDER BY day, starts_at` (the same list `allSlots` in `server/lib/people.js` uses, keynotes and socials included). For each crowd member with group `g`, for each slot index `i` where `i % 3 != g`, insert a `confirmed` reservation (`resStmt`) in the session of that slot with the most free seats (`capacity - seats_taken`, ties by lowest id), then `bumpSeat`. Slots hold no overlapping sessions, so one per slot cannot clash. Then check in each crowd seat with `day = DAYS[0] AND ends_at <= MORNING_ENDS`, as the existing loop does for users 1 to 6 (`ciStmt`, at the start time), and write no rating. Keep the ratings rollup (`UPDATE sessions SET avg_rating`) where it is: the new check-ins add no ratings, so it stays correct. Update the summary line "no seats".
- `tests/api/seed.test.js` — `crowdIds` becomes 7 to 36; "none holds a seat or a waitlist place" becomes the seat-group test; add the count, track-coverage and checked-in tests. Uses `startApi` and `/users/:id/schedule`, `/sessions`, `/users/:id/people`.
- `tests/api/people-seed.test.js` — extend `the seeded likes` to every card matching; add the three-slot test. Uses `setUp`, `decide`, `people`.
- `tests/api/people.test.js` — the `26` in `Array.from({ length: 26 }...)` becomes 36; the #13 pairs (10/11, 12/13, 14/15, 16/17, 18/19, 20/21, 22/23) and `decide(4, 17)` now carry seats, so the coffee tests release those pairs' seats first (`DELETE /users/:id/reservations/:sessionId` from each `/users/:id/schedule`; a check-in does not block a release). `slots[0]` expectations then hold again.
- `context/engineering-context/seed.md` and `people.md` — update "The mock crowd", the invariants line "holds no seat", and the likes gotcha.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Thirty mock attendees; every track has at least three buyers and three sellers | `seed.test.js`: users 7 to 36 exist; per track slug from `/users/:id`, count buyers and sellers, each at least 3 (false today: 20 attendees) | API |
| As any of 1 to 6, liking anyone in the deck matches | `people-seed.test.js`: for each of 1 to 6 in each role on all tracks, every `decide` returns `matched: true` (today only 3 per attendee do) | API |
| A single-track attendee matching one opposite-role attendee per group is offered three different slots | `people-seed.test.js`: for a pinned clock and a track, an attendee with seats released matches one opposite-role crowd member per group; the three `invite` slots are pairwise different (today every invite is the same first free slot) | API |
| Mock attendees hold only confirmed seats, one per slot, in their group's slots | `seed.test.js`: for each of 7 to 36, no waitlisted entries, and the booked slots equal the slot list with `i % 3 != g` (today none held) | API |
| No session full, Day 1 morning seats checked in, no rating moves | `seed.test.js`: no session newly `isFull` (compare `isFull` to sessions no crowd seat touches: every session a crowd seat took has `seatsTaken < capacity`); every crowd Day 1 morning seat has `checkedIn`; the crowd has no ratings (`/sessions` `ratingCount` and `avgRating` equal the values from the six attendees' ratings alone, checked by the mock attendees' schedules showing no rating) | API |

## Decisions
- Is the crowd's group `i % 3` by position in `CROWD` (so role `i % 2` and group together give `i % 6`), rather than a stored column? No schema change is needed this way.
- Is "three different slots at any pinned clock" read as any clock with at least three slots left (the last two slots of Day 4 cannot offer three)?
- Is "the session with the most free seats" decided on free seats at the moment the member is seated, in `CROWD` order, so earlier members' seats count?
- Is the like list a loop over every crowd member rather than a hand-written array, since 180 rows by hand would be unreadable?

## Out of scope
Changing how the coffee slot is chosen; ratings or follows for mock attendees.
