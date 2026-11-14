---
area: people
summary: The People deck at /people, where a buyer meets sellers (and the reverse) who share a track, with pass, like and Matches.
read_when: touching /people, the deck, passing or liking someone, matches, people_decisions, or the seeded likes
files:
  - server/lib/people.js
  - src/pages/PeoplePage.jsx
tests:
  - tests/api/people.test.js
  - tests/api/people-seed.test.js
  - tests/people.spec.js
related: [data-model, seed, ui]
---

# People

## How it works

**`server/lib/people.js`** is plain SQL over `db`, and the routes in `server/routes/users.js` stay thin.

- `deckFor(userId)` is attendees of the opposite role who share at least one `user_tracks` row with the
  attendee, are not the attendee, and have no `people_decisions` row from them, ordered by id. Empty
  unless `isReady(user)`: a role and at least one saved track.
- `matchesFor(userId)` is mutual likes. It never looks at either side's current role or tracks, which is
  what keeps a match through a role change.
- `decide(userId, targetId, choice, now)` is `INSERT OR IGNORE`, so the first choice stands and a repeat answers
  with it. Returns `{ choice, matched }`; `matched` is true when the target already liked back, and then
  also `invite`. `now` is `{ day, time }`, the clock of whoever made the match.
- The coffee invite: on a match, `inviteFor` picks the first session slot (distinct `day`, `starts_at`) not
  before `now` (a slot starting exactly at `now` stays; no `now`, no lower bound) where neither attendee holds
  a `confirmed` reservation starting at that exact time. A waitlist place does not block a slot. It is stored
  once in `match_invites` (`INSERT OR IGNORE`), with `COFFEE_MESSAGE` or, with no slot, `NO_TIME_MESSAGE` and a
  null day and time. `matchesFor` adds `invite: { message, day, startsAt } | null` to each card (`toInvite`).
- Cards are `toUser` rows plus `trackSlugs`.

**Routes.** `GET /api/users/:id/people` returns `{ ready, deck, matches }`. `PUT /api/users/:id/people/:targetId`
`{ choice: 'like' | 'pass', day?, time? }` is 404 for an unknown attendee or target, 400 for another choice or for yourself.

**Page.** `PeoplePage` fetches `api.getPeople(currentUserId)` with `useFetch`, so switching attendee refetches.
It shows the first card; a click calls `api.decidePerson`, drops the card and, when `matched`, adds the
person to Matches without a refetch, sending `clock` from `useConference()` so the invite slot follows the
simulated time; each match shows its invite. Test ids: `match-invite` (message, then day and time), `people-prompt` (link to `/profile`), `people-card`,
`people-pass`, `people-like`, `people-matches`, `match-item`.

## Gotchas

- Likes and roles are permanent, so a spec that writes them takes its own lane (`people.deck`) and reads the
  deck from the API rather than assuming where it starts.
- The seed has every crowd member (ids 7 to 36) like each of users 1 to 6, so any like an attendee makes on a
  crowd card is a match; only another attendee (1 to 6) has not liked back. The crowd also holds seats in
  three groups, so the coffee slot offered depends on who you match (see `seed.md`).
