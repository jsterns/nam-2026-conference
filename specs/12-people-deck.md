# Match buyers with sellers on a /people deck

## What this changes
A new **People** page (`/people`, in the nav) shows one card at a time: portrait or generated avatar, name, job title, company, a buyer or seller badge and the tracks they picked. The deck holds attendees of the opposite role who share at least one saved track with you, never you, and never anyone you already passed or liked. **Pass** and **Like** are stored on the server, so a decided card stays gone after a reload. When the person you like has already liked you, they appear under **Matches** at once; otherwise nothing changes there. Each of the six seeded attendees is liked by a few of the mock attendees, so a seeded attendee who picks a role and tracks can make a match straight away. An attendee with no role or no tracks sees a prompt linking to `/profile` instead of the deck. Changing role later keeps the matches already made.

## Where
- `server/db.js` — new table in `SCHEMA` next to `user_tracks`: `people_decisions (user_id, target_id, choice CHECK IN ('like','pass'), PRIMARY KEY (user_id, target_id))`, both columns referencing `users` with `ON DELETE CASCADE`; add it to the `DROP TABLE` list near line 279.
- `server/lib/people.js` — new, pure SQL over `db`: `deckFor(userId)` (opposite role, shares a track via `user_tracks`, not self, no row in `people_decisions` for this user, ordered by id), `matchesFor(userId)` (mutual likes, with no look at either side's current role or tracks, which is what keeps matches through a role change), `decide(userId, targetId, choice)` (`INSERT OR IGNORE`, so the first decision stands; returns `{ choice, matched }`). Rows go through `toUser` plus `trackSlugs`.
- `server/routes/users.js` — `GET /:id/people` returns `{ ready, deck, matches }` (`ready` false when the attendee has no role or no tracks, and the deck is then empty); `PUT /:id/people/:targetId { choice }` returns 404 for an unknown attendee or target, 400 for a choice other than `like` or `pass` or for a target equal to the attendee.
- `server/seed.js` — after the crowd block from #11, a hand written `LIKES` array of `[crowdEmail, seededUserId]` pairs inserted with `choice 'like'`: three likes for each of users 1 to 6, from crowd members of both roles, no PRNG use.
- `src/lib/api.js` — `getPeople(userId)` and `decidePerson(userId, targetId, choice)`, next to `setUserTracks`.
- `src/pages/PeoplePage.jsx` — new; `useFetch(() => getPeople(currentUserId), [currentUserId])` so switching attendee refetches; shows the first card with `Pass` and `Like`, removes the card on a click and, when `decidePerson` answers `matched`, adds that person to Matches without a refetch. Test ids: `people-prompt` (with a link to `/profile`), `people-card`, `people-pass`, `people-like`, `people-matches`, `match-item`.
- `src/App.jsx` — `<Route path="people">` inside the layout; `src/components/Layout.jsx` — `NAV` entry `{ to: '/people', label: 'People', icon: 'heart' }`. Home is untouched.
- Docs: new `context/engineering-context/people.md` with an entry in the engineering index, plus `data-model.md` (the table), `seed.md` (the likes) and `ui.md` (the nav item).
- Tests: `tests/api/people.test.js` (new, `startApi()` and `api.put`/`api.json` as in `tests/api/tracks.test.js`; sets role with `PUT /users/:id/role` from #10 and tracks with `PUT /users/:id/tracks`); entries for both routes in `tests/api/endpoints.test.js`; `tests/people.spec.js` (new) using `laneFor('people.deck', testInfo)` and `visit(page, '/people', { as: lane.user })`. New lane in `tests/helpers.js`: `'people.deck': { desktop: { user: marcus, day: 2, agenda: false }, mobile: { user: abraham, day: 1, agenda: false } }`; likes and role are permanent, so the builder greps `LANES` and #10's `profile.role` lane for both attendees and changes the pair if `tests/unit/lanes.test.js` or a role writer collides. `tests/smoke.spec.js` gets `/people` if it lists routes.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Deck is opposite role, shares a track, never self | user 1 as seller with one track: every `GET /users/1/people` card has `role === 'buyer'`, a `trackSlugs` entry in common, and `id !== 1`; the deck is non-empty and a crowd member sharing no track is absent (route absent today) | API |
| Pass or like removes the card, stays after reload | `PUT /users/1/people/:id {choice:'pass'}` then `GET` has no such id; same for `like`; a second `PUT` with the other choice leaves the first. In the page: click `people-like`, the name leaves, `reload`, still gone | API, spec |
| A returned like is a match at once, an unreturned one is not | liking a card that liked user 1 answers `matched: true` and appears in `matches`; liking one that did not answers `matched: false` and `matches` is unchanged. In the page: `match-item` appears after the click with no reload, and not after the other kind | API, spec |
| Each seeded attendee has a card who likes them | for users 1 to 6 and both roles, set the role, set all ten tracks, `PUT` a like on every card in the deck, and at least one answers `matched: true` (likers of both roles are seeded) | API |
| No role or no tracks gives prompt and no deck | `GET` for user 1 with no role, then with a role and no tracks, gives `ready: false` and an empty deck; in the page `people-prompt` shows with a link whose href is `/profile` and `people-card` is absent | API, spec |
| Switching attendee shows their own deck and matches | as the lane attendee, make a match and see it in `match-item`; switch to another attendee in the menu and that name is gone from Matches; API: two attendees' decks and matches differ | spec, API |
| Changing role keeps matches | after a match, `PUT /users/1/role` with the other role, then `GET /users/1/people` still lists the match in `matches` | API |

## Decisions
- "Given a role and a track" cannot hold for every one of the ten tracks with two or three likes each, so the build proves it as: a seeded attendee who picks either role and a track one of their likers has (all ten tracks in the test) finds that liker in the deck. Is that the reading you want?
- The prompt replaces only the deck; Matches still lists what the attendee already has. OK?
- A decision is final: the first of pass or like is kept, a repeat is ignored with a 200, and there is no undo. OK?
- The page never says who already likes you before you decide, and the deck is ordered by attendee id. OK?

## Out of scope
Messages between matches, undoing a pass, unliking, anything on Home.
