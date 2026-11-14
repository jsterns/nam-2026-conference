# Guided tour of the new features from the welcome card

## What this changes
The welcome dialog (#7) gains a **Take the tour** button. It closes the dialog (marking it seen) and starts a tour over `newEntries()`, one step per entry, in order. Each step navigates to the entry's page, scrolls the `data-tour="<target>"` element into view, dims the rest of the page around it and shows a labelled callout beside it: the entry's title, a sentence, a counter ("1 of 2"), **Back**, **Next** (**Done** on the last step) and **Skip tour**. Escape ends it. Ending leaves the attendee where they are. A step whose target is missing shows the callout centred with no highlight and the tour carries on. On a phone the step first opens **Filters**. The tour never books a seat.

## Where
- `src/lib/welcome.js` (from #7) — entries gain `target` and `tourText` (the sentence). Add `tourSteps(entries, ctx)` returning `{ id, title, text, target, href, reveal }` from `newEntries()`, and `stepLabel(i, n)` -> `"1 of 2"`. Test in `tests/unit/tour.test.js`.
- `src/components/Tour.jsx` (new) — `<Tour steps onEnd />`: portalled to `document.body`, `role="dialog"` labelled by its title, `data-testid="tour-callout"`; `navigate(step.href)` on step change, then finds `[data-tour=target]` (waiting for it to mount, short bounded retry); if it is not visible and `step.reveal` names a `[data-tour-reveal]` control, clicks it once and looks again; `scrollIntoView({block:'center'})`; highlight is one fixed ring (`data-testid="tour-highlight"`) with a large `box-shadow` dim, re-measured on resize/scroll; callout placed below/above the target and clamped to the viewport, centred when there is no target. Focus moves to the callout each step and returns to the opener on end; Escape, Next/Back/Skip/Done as buttons. Copies `ConflictDialog`'s focus/Escape handling.
- `src/components/Layout.jsx` — `tour` state; `WelcomeDialog` gets `onTour`, which closes it and sets the steps (built with `conference.days` for the clock pin); renders `<Tour>`.
- `src/components/WelcomeDialog.jsx` (from #7) — **Take the tour** button, `data-testid="welcome-tour"`.
- `src/pages/SchedulePage.jsx` — `data-tour="schedule-tracks"` on the track chip row (line ~170); `data-tour-reveal="filters"` on the **Filters** button (line ~243).
- `src/components/SeatPanel.jsx` — `data-tour="seat-button"` on a wrapper around the reserve / release / ended button block.
- Tests: `tests/tour.spec.js` (new) — `visit` then click footer **What's new** then **Take the tour**; no seats are booked, so no lane. `tests/helpers.js` unchanged.
- Docs: `context/engineering-context/ui.md` (Tour, `data-tour`, how a feature joins it).

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Take the tour starts step 1 on `/schedule`, chips highlighted, callout beside them, desktop and phone (Filters opened) | spec: URL, `tour-highlight` box equals the chip row's box, callout visible and inside the viewport; on mobile the chips are visible | Playwright |
| Next goes to step 2 on the session page with the seat button highlighted; Back returns to step 1 | spec: URL is `/sessions/<id>` of the venue entry, highlight box equals `seat-panel` button; Back returns to `/schedule` | Playwright |
| Counter "1 of 2", "2 of 2"; last step shows Done | unit `stepLabel`, `tourSteps` length equals `newEntries()` length; spec reads the counter and the Done button | unit + Playwright |
| Skip, Done and Escape each end it, remove the highlight, return focus | spec runs the tour three times; asserts callout and highlight gone, `document.activeElement` is not `body` and the URL is unchanged | Playwright |
| A missing target shows the callout centred and the tour moves on | spec removes the target's `data-tour` attribute then re-enters the step; callout centred (box centre within a few px of the viewport centre), no highlight, Next works | Playwright |
| Never books, removes or changes a seat | spec records every request: none is a non-GET to `/api/users/` | Playwright |
| Existing specs unaffected; one spec covers the tour on both projects | `npm run verify` | Playwright |

## Decisions
- The step's sentence lives in the entry as `tourText`, separate from `description`, since the description reads as a feature blurb and the tour says what to do. OK?
- On a phone the tour opens Filters by clicking a `data-tour-reveal` control (generic, no page-specific code in `Tour`), and leaves it open when the tour ends. OK?
- Focus returns to the element focused when the tour began; the welcome dialog is closed by then, so if that element is gone it goes to the footer **What's new** button. OK?
- Taking the tour counts as seeing the welcome (`orbit:welcomeSeen` is written). OK?
- Resizing or rotating during a step re-measures the highlight but does not restart the step. OK?

## Out of scope
Steps for existing features or unmerged ones; a tour library; remembering tour progress across reloads (a reload ends the tour).

## Stacking
Depends on #7, whose code (`welcome.js`, `WelcomeDialog`, the footer button) is not on the base branch yet; the build merges `origin/issue-7-welcome-whats-new` as it lands, and this branch is retargeted to main once #7 merges.
