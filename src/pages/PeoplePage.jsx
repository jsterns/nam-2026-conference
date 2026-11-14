import { useEffect, useState } from 'react';
import * as api from '../lib/api.js';
import { useConference, useFetch } from '../lib/store.jsx';
import { useDocumentTitle } from '../lib/useDocumentTitle.js';
import { dayLabel, time } from '../lib/format.js';
import { Avatar, Button, EmptyState, ErrorState, SectionHeader, Skeleton } from '../components/ui.jsx';

/**
 * Buyers meet sellers: one card at a time, from attendees of the opposite role
 * who share a track. A pass or a like is stored on the server; a like someone
 * already returned lands under Matches at once, with no refetch.
 */
export function PeoplePage() {
  useDocumentTitle('People');
  const { currentUserId, tracks = [], clock } = useConference();
  const { data, loading, error, reload } = useFetch(() => api.getPeople(currentUserId), [currentUserId]);
  const [deck, setDeck] = useState([]);
  const [matches, setMatches] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDeck(data?.deck ?? []);
    setMatches(data?.matches ?? []);
  }, [data]);

  const trackName = (slug) => tracks.find((t) => t.slug === slug)?.name ?? slug;
  const [card] = deck;

  const decide = async (choice) => {
    if (!card || busy) return;
    setBusy(true);
    try {
      const res = await api.decidePerson(currentUserId, card.id, choice, clock);
      setDeck((d) => d.filter((c) => c.id !== card.id));
      if (res.matched) setMatches((m) => [...m, { ...card, invite: res.invite }]);
    } catch {
      /* the card stays, so the attendee can try again */
    } finally {
      setBusy(false);
    }
  };

  const header = (
    <SectionHeader eyebrow="Meet" title="People" description="Buyers and sellers who share a track with you." />
  );

  if (error) return <>{header}<ErrorState error={error} onRetry={reload} /></>;
  if (loading || !data) return <>{header}<Skeleton className="h-72 w-full max-w-md" /></>;

  return (
    <>
      {header}
      {!data.ready ? (
        <div data-testid="people-prompt">
          <EmptyState
            icon="users"
            title="Tell us who you are first"
            description="Pick a role and at least one track on your profile and the deck fills with people to meet."
            action={<Button variant="primary" to="/profile">Go to your profile</Button>}
          />
        </div>
      ) : card ? (
        <article data-testid="people-card" className="mx-auto w-full max-w-md rounded-2xl border border-hairline bg-surface p-6">
          <div className="flex items-center gap-4">
            <Avatar name={card.name} initials={card.initials} accent={card.accent} imageUrl={card.imageUrl} size="lg" />
            <div className="min-w-0">
              <h2 className="font-display text-xl">{card.name}</h2>
              <p className="text-sm text-muted">{card.jobTitle}</p>
              <p className="text-sm text-muted">{card.company}</p>
            </div>
          </div>
          <p className="mt-4 inline-block rounded-full border border-hairline px-3 py-1 text-xs font-semibold capitalize">{card.role}</p>
          <p className="mt-3 text-sm text-muted">{card.trackSlugs.map(trackName).join(' · ')}</p>
          <div className="mt-6 flex gap-3">
            <Button onClick={() => decide('pass')} disabled={busy} data-testid="people-pass" className="flex-1">Pass</Button>
            <Button variant="primary" onClick={() => decide('like')} disabled={busy} data-testid="people-like" className="flex-1">Like</Button>
          </div>
        </article>
      ) : (
        <EmptyState icon="users" title="You have seen everyone for now" description="New people appear when they pick a role and a track." />
      )}

      <section className="mt-10" data-testid="people-matches">
        <h2 className="font-display text-lg">Matches</h2>
        {matches.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No matches yet. A match appears when someone you like has liked you too.</p>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {matches.map((m) => (
              <li key={m.id} data-testid="match-item" className="flex items-center gap-3 rounded-xl border border-hairline bg-surface p-3">
                <Avatar name={m.name} initials={m.initials} accent={m.accent} imageUrl={m.imageUrl} size="md" />
                <div className="min-w-0">
                  <p className="font-semibold">{m.name}</p>
                  <p className="text-xs text-muted">{m.jobTitle}, {m.company}</p>
                  {m.invite && (
                    <p data-testid="match-invite" className="mt-1 text-xs">
                      {m.invite.message}
                      {m.invite.day && ` ${dayLabel(m.invite.day)}, ${time(m.invite.startsAt)}`}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
