import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { newEntries, welcomeHref } from '../lib/welcome.js';
import { Icon } from './Icon.jsx';
import { Button } from './ui.jsx';

/** First-visit tour of what is new. Close, Escape, the backdrop and Try it all dismiss it. */
export function WelcomeDialog({ open, onClose, days }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement;
    ref.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') closeRef.current(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] grid place-items-end sm:place-items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
      data-testid="welcome-dialog"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        data-testid="welcome-backdrop"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div
        ref={ref}
        tabIndex={-1}
        className="glass relative max-h-[85dvh] w-full max-w-lg animate-rise overflow-y-auto rounded-t-2xl border border-hairline p-6 shadow-2xl shadow-black/70 focus:outline-none sm:rounded-2xl"
      >
        <h2 id="welcome-title" className="font-display text-2xl leading-tight">Welcome to ORBIT</h2>
        <h3 className="mt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-faint">New in this update</h3>
        <ul className="mt-3 space-y-3">
          {newEntries().map((e) => (
            <li key={e.id} className="rounded-xl border border-hairline p-4">
              <p className="text-sm font-semibold">{e.title}</p>
              <p className="mt-1 text-[13px] text-muted">{e.description}</p>
              {e.hint && <p className="mt-1 text-[12px] text-faint">{e.hint}</p>}
              <Link
                to={welcomeHref(e, { days })}
                onClick={onClose}
                data-testid={`welcome-try-${e.id}`}
                className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-violet-300 hover:text-violet-200"
              >
                Try it <Icon name="route" className="size-3.5" />
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex justify-end">
          <Button variant="primary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
