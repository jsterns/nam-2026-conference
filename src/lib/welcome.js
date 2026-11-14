/**
 * What the welcome dialog shows. An entry is "new" while it is worth pointing
 * a first-time visitor at; flip `isNew` off (or delete it) when it is not.
 *
 * `to` is a path, or a function of `{ days }` so a link that needs a date is
 * built from the conference's own days, never hard-coded. `target` is reserved
 * for a later guided tour and is not used by the UI yet.
 */
export const WELCOME_ENTRIES = [
  {
    id: 'tracks',
    title: 'Pick several tracks at once',
    description: 'Press more than one track chip on the schedule to see those tracks side by side.',
    isNew: true,
    to: '/schedule?track=agents-tool-use,rag-retrieval',
  },
  {
    id: 'venues',
    title: "Know when you can't get there in time",
    description: 'This Foundry session is followed by one at Aurora, 6 miles away. Add both and see the travel warning.',
    isNew: true,
    to: '/sessions/68',
    hint: 'Add this session, then the Aurora one in the next slot.',
  },
];

export const newEntries = () => WELCOME_ENTRIES.filter((e) => e.isNew);

export const welcomeHref = (entry, ctx = {}) => (typeof entry.to === 'function' ? entry.to(ctx) : entry.to);

const KEY = 'orbit:welcomeSeen';

export function hasSeenWelcome() {
  try { return globalThis.localStorage?.getItem(KEY) === '1'; } catch { return false; }
}

export function markWelcomeSeen() {
  try { globalThis.localStorage?.setItem(KEY, '1'); } catch { /* storage unavailable: it just opens next visit */ }
}
