---
date: 2026-11-17
time: "1409"
time_source: header
started: 2026-11-14T13:57Z
env: mbp-host
env_source: prose
tags: ee-nam-2026, orbit-workshop, winnow, ship, claude-code, cross-fork-merge
header_shape: canonical
original_header: "### 2026-11-17 14:09 UTC: ORBIT workshop side build and cross-fork merge"
---

# ORBIT workshop side build and cross-fork merge

**Environment:** mbp-host, VS Code extension, working directory `~/nam-2026/nam-2026-conference`. **Session id:** 100241ee-4820-451e-9a40-c3fda43465bc. **Live audit:** OFF. **Engagement:** Equal Experts NAM 2026, ORBIT '26 workshop. **Branch / git:** work landed on the side fork `jsterns/nam-2026-conference` via PRs #2, #5, #6, #9, #10, #12, #13 and #15 (fork `main` at `f1539d5`, pushed). Nothing merged into the team repo `DanielWillian/nam-2026-conference`. This entry and its report live in this repo's own `_journal/`.

**Session metrics:** 2026-11-14 13:57 UTC → 2026-11-17 14:09 UTC (active work almost entirely on 2026-11-14; the span includes idle days)
- User messages: about 100
- Claude responses: not captured
- Decision points: about 15
- Tests: no test plans; six Ship runs gated their own changes, and two full `npm run verify` runs were made by hand at the end (263/1, then 264/0)

**Report:** [`_journal/reports/2026-11-17-orbit-workshop-side-build.md`](../reports/2026-11-17-orbit-workshop-side-build.md)

**Theme:** A side Claude session took the on-site navigation feature area off the team's primary developer during the ORBIT '26 workshop, shipping six features on a separate fork with Winnow and Ship. Building in parallel was fast. Folding the work back into the team repo was where the cost landed, and the exercise ended before it did.

**Accomplished:**
- Onboarded the laptop with the workshop's `ONBOARD_CLAUDE.md` agent procedure, including a fix for a broken Homebrew Node 26 by putting Homebrew `node@22` on PATH in `~/.zshrc`.
- Ran `/winnow` on the demo transcript and shipped the result (multi-track schedule filter).
- Rolled up two Otter transcripts of the team's discussion into starter requirements and an on-site navigation feature set (travel warnings, route planning across the two venues, simulated traffic and queues).
- Shipped a deterministic congestion model and a cross-venue "Getting there" notice in parallel, then packaged them as tested patches and a zip for the team channel.
- Shipped a release welcome card, a guided tour and `?welcome` / `?tour` presenter links.
- Wrote an attendee user guide at `~/nam-2026/orbit-user-guide/ORBIT-user-guide.md` covering both repos, badging each feature by where it lives.
- Trial-merged the side fork into the team's `main`, found and fixed what broke (a first-visit modal covering team specs, a test-lane clash, the team's own stale People spec), and got the full suite green on the fork.

**Collaboration dynamics:**
- Decision attribution: mostly Recommended (merge commit for the sync, patches for the second package, tracks-only scope, any-selected-track matching). One Proposed Alternative: Fast instead of the recommended Small for the suite-fix ticket. One Custom: skip the in-app "What's new" page and go straight to the welcome and tour.
- Course corrections: Assumption Fixed when the expected folder-scoped Node line in `~/.zshrc` turned out not to exist. Scope Adjusted when Jeremy pointed out that the zip offered was the package already sent. Assumption Fixed when "all PRs are merged" turned out to cover only the team's own PRs, with the side build's closed unmerged. Claude self-corrected the "Jungle Cats" label, which belongs to the whole team, not the side fork.
- Claude's mistakes: launched a shallow-clone trial merge that could not merge at all, and a zsh command that never ran (unsplit variable); moved a test lane onto the day where seat-counting specs run, which broke their counts; and relied on fast runs that skipped the specs the welcome card broke.

**Curiosities raised:**
- A Google Maps metaphor for conference navigation: multi-stop route, live mode with leave-by countdown, reroute when a leg becomes unreachable.
- Whether a parallel side session is worth it if integration is left to the end; the evidence here says integrate early, or be a collaborator on the team repo from the start.

**Next steps:**
- If revisited: open one PR from the side fork's `main` to the team's `main`, after checking what the team merged after 2026-11-14.
- Navigation drafts R1 to R5 in `~/nam-2026/orbit-handoff/navigation-plan.md` remain unbuilt.
- Optional: the styled "Jungle Cats" PDF edition of the user guide.

**Addendum, 2026-11-17 14:23 UTC: host Node environment restored.**
- What the session had changed: a single line in `~/.zshrc`, `export PATH="/opt/homebrew/opt/node@22/bin:$PATH"`, which put Homebrew `node@22` first on PATH for every shell. It began folder-scoped and was made global because Claude Code's session shell starts outside the project folder. Nothing was downgraded, uninstalled or relinked.
- What was already broken before the session: Homebrew `node` 26.7.0 failed to start, because it was built against `libsimdjson.33.dylib` and `simdjson` had since been upgraded to 5.1.1.
- Repair: `brew reinstall node` installed 26.13.1, which runs against the current simdjson; the `~/.zshrc` line was removed (backup at `~/.zshrc.bak-orbit-node22`). A clean login shell now resolves `/opt/homebrew/bin/node` v26.13.1 with npm 11.20.0.
- Still true: `node@22` remains installed but off PATH. This repo needs Node 22, so a return to it starts with `export PATH="$(brew --prefix node@22)/bin:$PATH"` in that terminal. Shells opened before the repair keep Node 22 until restarted.
- Claude's mistake: the first removal attempt used `grep -v -x` with the line as a regex, where `$PATH` did not match literally, so nothing was removed; caught by the diff and redone with `grep -F`.
