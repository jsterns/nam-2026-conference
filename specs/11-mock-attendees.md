# Seed a crowd of mock attendees to match with

## What this changes
A fresh seed holds 20 more attendees after the six we have, at companies other than Equal Experts. Each has a buyer or seller role (both are used), two to four tracks and topic interests. They have no portrait file, so they show the generated avatar, and they hold no seats, waitlist places, follows, check-ins or ratings. The six existing attendees, every session's `seats_taken` and the attendee switcher look exactly as before. Nothing in the UI shows the crowd yet; `/bootstrap` and `/users` list them.

## Where
- `server/seed.js` — a new `CROWD` array of 20 hand written rows (name, email, job title, company, pronouns, city, timezone, bio, interests), and a block placed after the announcements (`ANN.forEach(...)`, just before the `SUMMARY` section). The block draws nothing from the PRNG (no `rnd`, `int`, `pickN`, `chance`) and never uses `Math.random()`, so nothing earlier shifts. It inserts each row into `users` with `image_url` NULL, `ticket_tier` `'Standard'`, accent `ACCENTS[i % ACCENTS.length]`, `speaker_id` NULL, and sets `role` (`'buyer'` or `'seller'`, from #10's column, alternating-ish) with `UPDATE users SET role = ?`. It adds `user_tracks` rows by looking up `tracks.slug`, 2 to 4 per attendee. Interests are only names from `TAGS.topic` (the existing invariant). The `users` const (`SELECT * FROM users`, line ~614) stays as read before the crowd exists, so waitlists and the promotion fixture never see them. Add a line to the summary `console.log` for the crowd count.
- `server/routes/meta.js`, `src/components/UserSwitcher.jsx` — no change: the switcher already filters on `HOST_COMPANY = 'Equal Experts'` (line 11, `choices` at line 28), so no crowd member may use that company.
- `context/engineering-context/seed.md` — the Seeded attendees section (the crowd, its ids 7 and up, why it is seeded last) and the Gotcha that `users.length` is no longer 6.
- `tests/api/seed.test.js` — the test that asserts `users.length === 6` becomes the new count, with the crowd checks below; uses `startApi()` and `api.json('/bootstrap')`, `/users/:id`, `/users/:id/schedule`. No change to `tests/helpers.js` (`ATTENDEES` stays the six; lanes use ids 1 to 6 and their own data).

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Mock attendees exist, each with a role and at least one track, both roles present | `/bootstrap` has 26 users; users 7 to 26 each have `role` in buyer/seller with at least one buyer and one seller, and `trackSlugs.length` between 2 and 4 (false today: 6 users) | API (`seed.test.js`) |
| Existing reservations, follows, check-ins, ratings and seats unchanged; crowd holds none | users 7 to 26 each have an empty `/users/:id/schedule` (no confirmed, no waitlisted); users 1 to 6 keep their ids and names (ids 1 to 6 in `ATTENDEES` order) with the same data. The unchanged-ness of `seats_taken`, bookings and the promotion fixture is shown by the existing suites (`tests/seats.spec.js` `findPromotionFixture`, lanes) staying green in `npm run verify`, and by the builder diffing a seed before and after | API, spec (existing) |
| Six existing attendees keep no tracks and no role | for ids 1 to 6, `trackSlugs` is `[]` and `role === null` (the `users.length` assertion in the same file is what fails first on main) | API (`seed.test.js`) |
| Attendee switcher lists the same attendees | `tests/profile.spec.js` or a switcher spec opens the menu for a lane user and the listed names are the six Equal Experts ones and no crowd name; crowd rows all have `company !== 'Equal Experts'` in the API test (false today: no crowd rows to check) | API, spec |
| `seed.test.js` checks the new count | the count assertion is 26 | API |

## Decisions
- Three of the Done-when lines (existing data unchanged, six keep no tracks or role, switcher unchanged) already hold on main, since nothing changes them yet. This build proves them as guards that fail if the crowd leaks in (crowd holds no bookings, first six untouched, switcher shows only the six), not as new behaviour. Is that the reading you want?
- Exactly 20 crowd attendees, with ids 7 to 26 and a roughly even buyer and seller split. OK?
- Crowd tier is Standard for all, with `@example.com` style emails that do not collide with `orbitconf.dev`. OK?
- Crowd interests are drawn from the topic tags only, per the seed invariant. OK?

## Out of scope
The `/people` page, likes and matches, messages, seats or agendas for the crowd, portraits.
