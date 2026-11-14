import { useEffect, useState } from 'react';
import * as api from '../lib/api.js';
import { hasEnded } from '../lib/clock.js';
import { useConference, useFetch } from '../lib/store.jsx';
import { useDocumentTitle } from '../lib/useDocumentTitle.js';
import { SessionCard } from '../components/SessionCard.jsx';
import { Button, SectionHeader } from '../components/ui.jsx';

/**
 * The signed-in attendee's profile: the tracks they care about, and the
 * sessions in those tracks they could still take. Nothing is booked for them.
 * The list follows the *saved* tracks, so it only changes on Save.
 */
export function ProfilePage() {
  useDocumentTitle('Your profile');
  const { tracks = [], currentUserId, clock, reservationFor } = useConference();
  const [ticked, setTicked] = useState(null);
  const [saved, setSaved] = useState(null);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState(null);

  const [role, setRole] = useState(null);
  const [savedRole, setSavedRole] = useState(null);
  const [roleSaved, setRoleSaved] = useState(false);
  const [roleError, setRoleError] = useState(null);

  const sessions = useFetch(() => api.getSessions(), []);

  useEffect(() => {
    let active = true;
    setTicked(null);
    setSaved(null);
    setJustSaved(false);
    setRole(null);
    setSavedRole(null);
    setRoleSaved(false);
    setRoleError(null);
    api.getUser(currentUserId).then((u) => {
      if (!active) return;
      setRole(u.role);
      setSavedRole(u.role);
      setTicked(new Set(u.trackSlugs));
      setSaved(new Set(u.trackSlugs));
    }).catch(() => {});
    return () => { active = false; };
  }, [currentUserId]);

  if (!ticked) return <SectionHeader eyebrow="Your conference" title="Your profile" />;

  const toggle = (slug) => {
    setJustSaved(false);
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug); else next.add(slug);
      return next;
    });
  };

  const save = async () => {
    setError(null);
    try {
      const { trackSlugs } = await api.setUserTracks(currentUserId, [...ticked]);
      setSaved(new Set(trackSlugs));
      setJustSaved(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const saveRole = async () => {
    setRoleError(null);
    try {
      const res = await api.setUserRole(currentUserId, role);
      setSavedRole(res.role);
      setRoleSaved(true);
    } catch (err) {
      setRoleError(err.message);
    }
  };

  const suggested = (sessions.data ?? []).filter((s) =>
    saved.has(s.track.slug) && !hasEnded(s, clock) && !reservationFor(s.id));

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Your conference"
        title="Your profile"
        description="Pick the tracks you care about and we will suggest sessions from them."
      />

      <section className="space-y-4 rounded-2xl border border-hairline bg-surface p-5">
        <h3 className="font-display text-lg">Your role</h3>
        <div role="radiogroup" aria-label="You are a" className="grid gap-2 sm:grid-cols-2">
          {['buyer', 'seller'].map((r) => (
            <label key={r} className="flex cursor-pointer items-center gap-3 rounded-xl border border-hairline bg-raised px-3 py-2.5 text-sm">
              <input
                type="radio"
                name="role"
                className="size-4 accent-violet-500"
                checked={role === r}
                onChange={() => { setRole(r); setRoleSaved(false); }}
                data-testid={`role-${r}`}
              />
              <span className="font-semibold capitalize">{r}</span>
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" size="sm" onClick={saveRole} disabled={!role || role === savedRole} data-testid="save-role">
            Save role
          </Button>
          {roleSaved && <span className="text-xs text-emerald-300" data-testid="role-saved" role="status">Saved</span>}
          {roleError && <span className="text-xs text-rose-300" role="alert" data-testid="role-error">{roleError}</span>}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-hairline bg-surface p-5">
        <h3 className="font-display text-lg">Your tracks</h3>
        <ul className="grid gap-2 sm:grid-cols-2">
          {tracks.map((t) => (
            <li key={t.slug}>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-hairline bg-raised px-3 py-2.5 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-violet-500"
                  checked={ticked.has(t.slug)}
                  onChange={() => toggle(t.slug)}
                  data-testid={`track-${t.slug}`}
                />
                <span className="font-semibold">{t.name}</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" size="sm" onClick={save} disabled={ticked.size === 0} data-testid="save-tracks">
            Save tracks
          </Button>
          {ticked.size === 0 && (
            <span className="text-xs text-amber-300" data-testid="tracks-required">Choose at least one track to save.</span>
          )}
          {justSaved && <span className="text-xs text-emerald-300" data-testid="tracks-saved" role="status">Saved</span>}
          {error && <span className="text-xs text-rose-300" role="alert">{error}</span>}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-display text-lg">Suggested for you</h3>
        {saved.size === 0 ? (
          <p className="text-sm text-muted" data-testid="suggested-empty">Choose and save a track to see suggested sessions.</p>
        ) : sessions.loading ? (
          <p className="text-sm text-muted">Loading sessions...</p>
        ) : suggested.length === 0 ? (
          <p className="text-sm text-muted" data-testid="suggested-empty">Nothing left to suggest in these tracks.</p>
        ) : (
          <div className="space-y-2" data-testid="suggested-list">
            {suggested.map((s) => <SessionCard key={s.id} session={s} variant="row" showDay />)}
          </div>
        )}
      </section>
    </div>
  );
}
