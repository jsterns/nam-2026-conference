# Let attendees pick their tracks and get sessions suggested from them

## What this changes
The attendee menu gains a "Your profile" link to `/profile`. There the signed-in attendee ticks any of the 10 tracks and saves (at least one is needed; all ten are fine). The choice is stored per attendee and the six seeded attendees start with none. Below the tracks, a suggested list shows sessions in the chosen tracks that have not ended at the simulated clock and that the attendee holds no seat or waitlist place in, each with the normal seat button. Taking one behaves as on the schedule (seat, waitlist, `<ConflictDialog>`), and the session leaves the list at once. Unticking a track and saving removes its sessions from the list. Nothing is booked automatically.

## Where
- `server/db.js` — add `user_tracks (user_id → users ON DELETE CASCADE, track_id → tracks, PRIMARY KEY (user_id, track_id))` to `SCHEMA`, and `DROP TABLE IF EXISTS user_tracks` before `users` in the reset list (near line 272). `seed.js` is untouched, so every attendee starts with none; test in `tests/api/seed.test.js`.
- `server/routes/users.js` — `GET /:id` adds `trackSlugs` (sorted by track id) next to `reservations`; new `PUT /:id/tracks` taking `{ trackSlugs }`: 404 unknown attendee, 400 `{ error }` when the list is empty, not an array or names an unknown slug, otherwise replace the rows in one transaction and return `{ trackSlugs }`. Test in `tests/api/tracks.test.js` (new) with `startApi()` from `tests/api/harness.js`.
- `tests/api/endpoints.test.js` — add `/users/${ids.user}/tracks` to the route coverage list (it checks every route is exercised).
- `src/lib/api.js` — `setUserTracks(userId, trackSlugs)` (PUT); `getUser` already returns the new field.
- `src/pages/ProfilePage.jsx` (new) — `useConference()` supplies `tracks`, `currentUserId`, `clock`, `reservationFor`, `toggleSeat`; loads `getUser` for the saved slugs on `currentUserId`, checkboxes (`data-testid="track-<slug>"`), a Save button (`save-tracks`, disabled with an inline message while none is ticked) and the list (`suggested-list`) rendered with `SessionCard` (variant list), which already carries the seat button and `hasEnded`. The list is `getSessions()` filtered client side by saved track slug, `!hasEnded(s, clock)` and `!reservationFor(s.id)`; it filters on the saved selection, so unticking only takes effect on Save. `SessionCard` calls `toggleSeat`, so the clash dialog and the removal from the list come from the store.
- `src/App.jsx` — `<Route path="profile" element={<ProfilePage />} />`; `src/components/UserSwitcher.jsx` — a "Your profile" link (`own-profile`) beside the speaker link, closing the menu on click.
- Context docs: `context/engineering-context/data-model.md` (table), `agenda.md` or `ui.md` (page and endpoint), `architecture.md` route list.
- UI test `tests/profile.spec.js` (new) using `laneFor('profile.tracks' | 'profile.suggest', testInfo)`, `visit(page, '/profile', { as, at })`, `momentOn(0, '11:00')` to pin the clock, `bookableFor`; add both lanes to `LANES` in `tests/helpers.js` on attendee/day pairs no other lane uses (`tests/unit/lanes.test.js` checks this), release what is booked.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Tick/untick, save, kept after reload and after switching attendee and back | PUT two slugs, GET returns them; then PUT one, GET returns that one; another attendee's GET is unchanged. UI: tick, save, reload, switch via the menu and back, boxes still match | API (`tracks.test.js`) + spec (`profile.spec.js`) |
| Saving none is refused, API and UI | PUT `[]` and an unknown slug return 400 and leave the stored selection; UI: with all unticked Save is disabled and the message shows, no request sent | API + spec |
| Seeded attendees start with none | each of the six seeded ids has `trackSlugs: []` on a fresh DB; UI: no box ticked and the list asks for a track | API (`seed.test.js`) + spec |
| List shows only chosen tracks, nothing ended, nothing held | at a pinned clock mid Day 1 with one track saved, every row's track slug is that track, none ends before the clock, none is in the attendee's reservations (confirmed or waitlisted) | spec |
| Adding from the list: seat, waitlist, ConflictDialog, leaves list without refresh | take a bookable session, row disappears and `/users/:id` shows `confirmed`; a full session shows `waitlisted`; a clashing one opens the dialog and, on Swap, the list updates, with no reload | spec (seat and clash; waitlist covered by the same store path, asserted via a full session found with `/sessions`) |
| Unticking a track removes its sessions | save A and B, note a B row, save A only, no B row remains | spec |

## Decisions
- The suggested list follows the saved tracks, not the unsaved ticks, so it only changes on Save. Is that OK?
- Rows are filtered client side from `getSessions()` rather than adding a multi-track filter to `/api/sessions`. OK for ~140 sessions?
- Day 1 sessions that end before the pinned clock are hidden; sessions in progress stay (not "ended"). OK?
- The tracks endpoint takes slugs, since the UI and `trackBySlug` already use them. OK?

## Out of scope
`users.interests`, `server/lib/agenda.js:suggestionsFor`, Home, My Agenda, auto-booking, matching attendees.
