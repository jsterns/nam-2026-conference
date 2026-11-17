# ORBIT workshop side build

> **Historical artifact.** This report is a frozen snapshot tied to its journal entry. To update status, create a new journal entry with its own report.

**Date:** 2026-11-17 (work ran 2026-11-14 13:57 UTC to 2026-11-17 14:09 UTC; almost all of it on 2026-11-14)

## Context

The ORBIT '26 workshop (Equal Experts NAM 2026) had teams of four to five build features on a mock conference app using two harnesses: Winnow (transcript to tickets) and Ship (ticket to tested pull request). Jeremy's team ("Jungle Cats") had a primary developer, Daniel, working the personalization features (profile, My Agenda, people matching) in `DanielWillian/nam-2026-conference`. Jeremy ran a side session in VS Code to see whether a second Claude session could take a parallel feature area off the primary developer's plate. This report is about that side build and the attempt to fold it back into the team repo.

## Original state vs end state

| | Start | End |
| --- | --- | --- |
| Machine | Not set up for the workshop | Onboarded via `ONBOARD_CLAUDE.md`: fork `jsterns/nam-2026-conference` cloned at `~/nam-2026/nam-2026-conference`, Actions on, labels created, Node 22 via `~/.zshrc` |
| Side fork `main` | Workshop original | `f1539d5`: six features plus the team's `main` merged in, full browser suite green |
| Team repo | Personalization in flight | Five personalization features merged; none of the side build merged |

## What was built (all on the side fork, all merged there)

| Fork PR | Feature | Notes |
| --- | --- | --- |
| #2 | Multi-track filter on `/schedule` (`?track=a,b`) | Came from running `/winnow` on the workshop's demo transcript |
| #5 | Congestion model, `src/lib/congestion.js` | Deterministic estimates of shuttle queue, pickup wait, door and food waits from the simulated clock; no UI yet |
| #6 | "Getting there" notice on session pages | Uses the existing, previously unused `travel.js:assessTravel` for cross-venue hops between adjacent seats |
| #9 | Welcome card on first visit | New features only, per the simulated client |
| #10 | Guided tour from the welcome | Stacked on #9 |
| #12 | `?welcome` and `?tour` links | For presenters and demos |
| #13 | Merge of the team's `main` into the fork | Merge commit, deliberately not squashed |
| #15 | Full test suite green with both sides merged | Fixed the welcome covering pages in specs that skip `visit()`, re-laned the hop spec, updated the team's People spec for its own later crowd change |

Other artifacts, outside both repos:

- `~/nam-2026/orbit-handoff/` and `orbit-handoff.zip`: patches 01, 03 and 04 plus a README and `navigation-plan.md` (the Maps-style route, Navigate and Reroute model with draft tickets R1 to R5). Applied together, verified on workshop `main` (665 unit tests passing) before sending.
- `~/nam-2026/orbit-user-guide/ORBIT-user-guide.md`: attendee user guide covering both repos, each feature badged by where it lives (team main, side build on its way, side build only), with a presenter section and demo running order.
- Requirements rollups (in chat) of two Otter transcripts from the team's discussion, and an on-site navigation spec set.

## How the session ran

1. Onboarding with the workshop's own agent procedure. The one snag was Node: Jeremy said Node 22 came from a folder-scoped `~/.zshrc` line, but no such line existed and Homebrew's default Node 26 was broken (missing `libsimdjson`). A folder-scoped line was added, then made global, because Claude Code's session shell starts outside the project folder, so a `$PWD` check never matches.
2. Winnow on the demo transcript, then `/ship 1` as a first end-to-end run.
3. Rollups of two team transcripts into starter requirements; Jeremy then scoped the side session to on-site navigation, leaving personalization to the primary developer.
4. Two navigation features shipped in parallel, packaged as patches and a zip for the team channel.
5. A release-oriented welcome and tour, then presenter links, then the user guide.
6. An attempt to fold everything into the team repo: read-only clone, trial merge, sync PR, suite-fixing ticket.

Ship spend across the six runs was about $14 at notional API list price (roughly 20M tokens, mostly cached reads), and each fast run took 3 to 11 minutes.

## The integration attempt and why it did not land

- The first package (patches 01, 03, 04) reached the team as their PRs #2 and #23. Both were closed, not merged, at 20:45 UTC on 2026-11-14, a minute after the team's last merge. Daniel reported "all my PRs are merged", which was true of his own; the side build's were the closed ones. Whether the close was deliberate was never established.
- A trial merge of the side fork into the team's `main` had one textual conflict (a doc sentence: both sides now call `api.getSchedule`), all unit tests passing except a lane check, and three to four browser failures.
- Root causes: (a) the welcome opens on first visit and covered pages in team specs that call `page.goto` directly; the side fork's own fast runs never ran those specs, so the defect was latent there too. (b) The hop spec shared an attendee and day with the team's newer `profile.walk` lane. (c) The team's People spec was already failing on its own `main` after its mock-crowd change.
- These were fixed on the side fork (#13 sync, #15 fixes), and two full `npm run verify` runs gave 263/1 and 264/0 (the one failure an intermittent waitlist-position spec, untouched by the change). The exercise ended before the single PR to the team repo was opened.

## Key decisions and rationale

- **Side build stayed off the personalization pages** (My Agenda, profile) to avoid colliding with the primary developer; features that would naturally read from the profile take their own inputs first.
- **Simulated "traffic" is a deterministic model, labelled as an estimate.** The project rule "nothing may claim to be true when it is not" ruled out presenting it as live data; determinism keeps demos and tests reproducible with `?at=`.
- **Merge commit, not squash, for the sync PR (#13).** Squashing the team's 42 commits would have made the later PR to the team repo replay all their changes as new.
- **Patches over branch pulls for the second package**, because squash-merging on the fork gives it different commits from what the team received.
- **Jeremy chose Fast over the recommended Small for #14.** Claude compensated by running the full browser suite itself afterwards, which is how the intermittent spec was characterised.

## Lessons

- **Fast ship runs only exercise the browser specs near the change.** A feature that changes global behaviour (a first-visit modal) can pass its own run and break unrelated specs. The full suite has to run before anything crosses repos.
- **Test lanes are a shared resource across teams.** Two teams adding Playwright lanes independently will collide; the lane check catches attendee and day clashes but not two specs counting seats in the same session. Moving a lane needs the seat-counting slots in view.
- **Parallel side sessions work for building, not for integrating.** Building in parallel on a separate fork was fast and low-friction; the cost all landed at the end, in a merge across forks that had each moved on. Integrating early (or being a collaborator on the team repo from the start) would have avoided most of it.
- **A teammate's "all merged" is a claim about their PRs.** Checking the repo state directly found the side build's PRs closed rather than merged.

## Deferred topics with future relevance

- One PR from `jsterns/nam-2026-conference` `main` to `DanielWillian/nam-2026-conference` `main`; it should merge cleanly as of `f1539d5`, subject to whatever the team merged after 2026-11-14.
- Navigation tickets R1 to R5 (route overview, Navigate, Reroute, preferences, food in breaks) remain drafts in `navigation-plan.md`.
- The intermittent `seats.spec.js` waitlist-position spec.
- A styled "Jungle Cats" PDF edition of the user guide was offered as a nice-to-have and not made.
- Deployment of the side build for others to demo: Railway was tried and dropped when the domain setting could not be found; a Cloudflare quick tunnel was the fallback offered.
