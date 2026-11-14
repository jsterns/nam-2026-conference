# Let attendees say whether they are buyers or sellers

## What this changes
`/profile` gets a "You are a" choice, buyer or seller, with its own Save button. The choice is stored per attendee, so it is still there after a reload and after switching attendee and back. Nobody has a role on a fresh seed and neither option is chosen. The API refuses any other role with a 400 and keeps what was stored.

## Where
- `server/db.js` — `users` table in `SCHEMA`: add `role TEXT CHECK (role IN ('buyer','seller'))`, nullable, so the seed (which inserts named columns) leaves it NULL.
- `server/lib/query.js` — `toUser`: add `role: row.role ?? null` (the one snake to camel place; `/users`, `/users/:id` and `/bootstrap` all go through it).
- `server/routes/users.js` — new `PUT /:id/role { role }` beside `PUT /:id/tracks`: 404 for an unknown attendee, 400 `{ error }` unless role is exactly `'buyer'` or `'seller'`, then `UPDATE users SET role = ? WHERE id = ?` and respond `{ role }`.
- `src/lib/api.js` — `setUserRole(userId, role)`, next to `setUserTracks`.
- `src/pages/ProfilePage.jsx` — a "Your role" section of two radios (`role-buyer`, `role-seller`) loaded from `getUser(currentUserId).role`, a `save-role` button (disabled until one is picked and different from saved), a `role-saved` status, and the error shown in a `role-error` alert. Independent of the track state.
- Docs: `context/engineering-context/data-model.md` (`users.role`) and `ui.md` (ProfilePage paragraph).
- Tests: `tests/api/role.test.js` (new, modelled on `tests/api/tracks.test.js`, using `startApi()`); one added assertion in `tests/api/seed.test.js` beside the `trackSlugs` seed check; `tests/profile.spec.js` gets one test using `laneFor('profile.role', testInfo)`, `visit(page, '/profile', { as: lane.user })`, and `request` to read `${API}/users/:id`.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Choice survives reload and switching attendee | `PUT /users/1/role {role:'seller'}` returns 200 `{role:'seller'}` and `GET /users/1` then shows `seller` (false today: no route, no field) | API |
| Same, through the page | pick `role-seller`, `save-role`, see `role-saved`, reload, `role-seller` is checked; switch attendee and back, still checked | spec |
| Another attendee unchanged | after saving for user 1, `GET /users/2` has `role === null` | API |
| Other role refused with 400, value kept | after storing `buyer` for user 4, bodies `{role:'organiser'}`, `{role:''}`, `{role:42}`, `{}` each give 400 with a string `error`, and `GET /users/4` still says `buyer` | API |
| Fresh seed: six attendees, no role, neither chosen | every `/users/:id` has `role === null` (undefined today); on `/profile` for a lane attendee never saved, neither radio is checked | API (seed.test.js), spec |

## Decisions
- A role can be changed from buyer to seller but not cleared back to none, as tracks cannot be emptied once saved — OK?
- The page saves the role with its own button rather than sharing the tracks Save — OK?

## Out of scope
Anything that uses the role (matching, filtering, badges on other pages).
