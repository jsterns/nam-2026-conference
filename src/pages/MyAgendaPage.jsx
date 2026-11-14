import { useDocumentTitle } from '../lib/useDocumentTitle.js';
import * as api from '../lib/api.js';
import { useConference, useFetch } from '../lib/store.jsx';
import { viewDays, hoursLabel } from '../lib/agendaView.js';
import { dayLabel, plural } from '../lib/format.js';
import { hasEnded } from '../lib/clock.js';
import { SessionCard } from '../components/SessionCard.jsx';
import { Button, EmptyState, SectionHeader, Stat } from '../components/ui.jsx';
import { Icon } from '../components/Icon.jsx';

export function MyAgendaPage() {
  useDocumentTitle('My Agenda');
  const { currentUserId, reservationFor, clock } = useConference();
  const { data, loading, error } = useFetch(() => api.getSchedule(currentUserId), [currentUserId]);
  const days = viewDays(data?.days ?? [], reservationFor);

  return (
    <div className="space-y-8">
      <SectionHeader eyebrow="Your conference" title="My Agenda" />

      {error && <p className="text-sm text-rose-300">Could not load your agenda: {error.message}</p>}
      {loading && !data && <p className="text-sm text-muted">Loading your agenda…</p>}

      {data && days.length === 0 && (
        <div data-testid="agenda-empty">
          <EmptyState
            icon="ticket"
            title="Nothing on your agenda yet"
            description="Add a session from the schedule and it will show up here."
            action={<Button to="/schedule" variant="primary" size="sm">Browse the schedule</Button>}
          />
        </div>
      )}

      {days.map((day) => {
        const clashing = new Set(day.conflicts.flatMap((c) => c.sessionIds));
        return (
          <section key={day.date} data-testid="agenda-day" data-date={day.date} className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h3 className="font-display text-xl">{dayLabel(day.date)}</h3>
              <div className="w-40">
                <Stat
                  value={hoursLabel(day.totalMinutes)}
                  label={`booked · ${plural(day.sessions.length, 'session')}`}
                  testId="agenda-booked-hours"
                  note={day.waitlistedMinutes > 0 ? `+${hoursLabel(day.waitlistedMinutes)} waitlisted` : null}
                />
              </div>
            </div>
            <ul className="space-y-2">
              {day.sessions.map((s) => (
                <li key={s.id} className="space-y-1">
                  <SessionCard
                    session={s}
                    variant="row"
                    attendance={s.reservation === 'confirmed'
                      ? { ended: hasEnded(s, clock), checkedIn: s.checkedIn, myStars: s.myStars }
                      : null}
                  />
                  {clashing.has(s.id) && (
                    <div data-testid="agenda-clash" className="flex items-center gap-1.5 px-1 text-[11px] font-semibold text-rose-300">
                      <Icon name="alert" className="size-3" /> Clashes with another session on your agenda
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
