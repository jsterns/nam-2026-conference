# Welcome first-time visitors with a tour of what's new

## What this changes
A first-time visitor (empty `localStorage`) sees a **Welcome to ORBIT** dialog on whatever page they land on. Under *New in this update* it lists only the two new features, each with a one-line description and a **Try it** link: *Pick several tracks at once* (`/schedule?track=<a>,<b>`) and *Know when you can't get there in time* (a Foundry session on Day 3 whose next slot has an Aurora session, with a hint to add both). Close, Escape, the backdrop and Try it dismiss it and write `orbit:welcomeSeen`, so it does not reopen by itself. A **What's new** button in the footer reopens it any time. Storage that throws just means it opens each visit.

## Where
- `src/lib/welcome.js` (new) — `WELCOME_ENTRIES` (`id`, `title`, `description`, `isNew`, `to`, optional `target`, optional `hint`), `newEntries()` (the `isNew` ones), `welcomeHref(entry, ctx)` (`to` may be a string or `({ days }) => string`, so a clock pin is built from `conference.days`), and `hasSeenWelcome()` / `markWelcomeSeen()` reading and writing `orbit:welcomeSeen` inside `try/catch`. Test in `tests/unit/welcome.test.js`.
- `src/components/WelcomeDialog.jsx` (new) — copies `ConflictDialog`: portalled to `document.body`, backdrop `<button aria-label="Close">`, focus in and handed back, Escape, `max-h-[85dvh]` panel scrolling on a phone, `role="dialog"` named "Welcome to ORBIT", heading "New in this update", `data-testid="welcome-dialog"`, one `Link` per entry (`data-testid="welcome-try-<id>"`) that closes it.
- `src/components/Layout.jsx` — `welcomeOpen` state, initialised to open once `ready` when `!hasSeenWelcome()`; close calls `markWelcomeSeen()`; a **What's new** `<button>` (not a link) in the footer's bottom row reopens it. Only `Layout` pages are affected, not the decks.
- `tests/helpers.js` — `visit` also sets `orbit:welcomeSeen` in its init script, so every existing spec starts with it dismissed.
- `tests/welcome.spec.js` (new) — plain `page.goto` (no `visit`, so storage starts empty); reads `/api/sessions` and `/api/bootstrap` to assert against the API. No seats are booked, so no lane is needed.
- Docs: `context/engineering-context/ui.md` (Layout, welcome, `visit` marks it seen), `testing.md` (`visit` helper).

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| First visit opens it listing only the new entries under *New in this update* | spec: empty storage, dialog visible, heading, exactly two `welcome-try-*` links, titles | Playwright |
| `newEntries()` returns only `isNew` entries; ids unique; every entry has a title, description and `to` | unit | unit |
| Close, Escape, backdrop and Try it each dismiss; no auto-open on reload; `orbit:welcomeSeen` stored | spec walks each close, reloads, asserts hidden | Playwright |
| What's new reopens it | spec clicks the footer button after dismissing | Playwright |
| Tracks Try it: `/schedule`, exactly two chips pressed, `result-count` matches API | spec clicks it, counts `aria-pressed=true` chips excluding "All", compares count text with `/api/sessions?track=a,b` length | Playwright |
| Venue Try it: Foundry session page whose next slot has an Aurora session | spec follows it, reads the session id from the URL, asserts via the API that it is at the Foundry and an Aurora session starts 30 min after it ends the same day | Playwright |
| No Try it link has a hard-coded date | unit: `welcomeHref` for each entry matches no `\d{4}-\d{2}-\d{2}` and no `at=` unless built from the days passed in | unit |
| With storage unavailable the app works and the welcome opens | spec stubs `Storage.prototype.getItem/setItem` to throw, asserts the dialog opens, closes, page usable | Playwright |
| Existing specs unaffected; one spec covers the welcome on desktop and mobile | `visit` marks it seen; `npm run verify` on both projects | Playwright |

## Decisions
- Put **What's new** as a button in the footer (not the attendee menu), so the footer's "every link resolves" smoke test is untouched. OK?
- Link the venue entry to a fixed Day 3 Foundry session id rather than computing one, since Day 3 is always in the future (no clock pin, no ended-session 409) and the Playwright spec fails if the seed ever stops matching. OK?
- `target` is only a documented optional field on entries for the later tour; nothing in the UI is tagged with it yet. OK?
- Dismissing by the backdrop counts as seen, like Close and Escape. OK?

## Out of scope
The guided tour, a release-notes page, any entry for existing features or My Agenda.
