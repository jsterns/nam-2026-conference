import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { stepLabel } from '../lib/welcome.js';
import { Button } from './ui.jsx';

const PAD = 6;
const GAP = 12;
const MARGIN = 12;

const visible = (el) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
};
const find = (target) => {
  const el = document.querySelector(`[data-tour="${target}"]`);
  return el && visible(el) ? el : null;
};

/**
 * A guided tour: one step per entry, each on its own page. It only points —
 * it never clicks anything but the control a step names to reveal its target.
 * A step whose target never appears is shown centred and the tour carries on.
 */
export function Tour({ steps, onEnd }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const navigate = useNavigate();
  const location = useLocation();
  const ref = useRef(null);
  const elRef = useRef(null);
  const openerRef = useRef(document.activeElement);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;
  const step = steps[i];
  const last = i === steps.length - 1;

  const end = useCallback(() => {
    const opener = openerRef.current;
    endRef.current();
    // Wait until the callout is gone, then hand focus back.
    setTimeout(() => {
      const back = opener instanceof HTMLElement && opener.isConnected && opener !== document.body
        ? opener
        : [...document.querySelectorAll('footer button')].find((b) => /what.s new/i.test(b.textContent));
      back?.focus();
    }, 50);
  }, []);

  const measure = useCallback(() => {
    const el = elRef.current;
    if (!el || !el.isConnected) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    setRect({ x: r.x, y: r.y, w: r.width, h: r.height });
  }, []);

  // Go to the step's page, find its target, bring it into view.
  useEffect(() => {
    let cancelled = false;
    elRef.current = null;
    setRect(null);
    const here = location.pathname + location.search;
    if (here !== step.href) navigate(step.href);
    let tries = 0;
    let revealed = false;
    const look = () => {
      if (cancelled) return;
      let el = step.target ? find(step.target) : null;
      if (!el && step.target && step.reveal && !revealed) {
        const control = document.querySelector(`[data-tour-reveal="${step.reveal}"]`);
        // Only on a page that has the target mounted but hidden (a phone).
        if (control && visible(control) && document.querySelector(`[data-tour="${step.target}"]`)) {
          revealed = true;
          control.click();
        }
      }
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'instant' });
        elRef.current = el;
        measure();
        return;
      }
      if (++tries < 20) setTimeout(look, 100);
    };
    look();
    return () => { cancelled = true; };
    // Only a step change restarts the walk; navigating is part of it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  useEffect(() => {
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [measure]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') end(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [end]);

  useLayoutEffect(() => {
    if (ref.current) setSize({ w: ref.current.offsetWidth, h: ref.current.offsetHeight });
  }, [i, rect]);

  useEffect(() => { ref.current?.focus(); }, [i]);

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let style;
  if (rect && size.w) {
    const below = rect.y + rect.h + PAD + GAP + size.h <= vh - MARGIN;
    const top = below ? rect.y + rect.h + PAD + GAP : Math.max(MARGIN, rect.y - PAD - GAP - size.h);
    const left = Math.min(Math.max(MARGIN, rect.x), Math.max(MARGIN, vw - size.w - MARGIN));
    style = { top, left };
  } else {
    style = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }

  return createPortal(
    <div className="fixed inset-0 z-[80]" data-testid="tour">
      {rect ? (
        <div
          data-testid="tour-highlight"
          className="pointer-events-none fixed rounded-xl ring-2 ring-violet-300"
          style={{
            left: rect.x - PAD, top: rect.y - PAD, width: rect.w + PAD * 2, height: rect.h + PAD * 2,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.7)',
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-black/70" />
      )}
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-labelledby="tour-title"
        data-testid="tour-callout"
        className="glass fixed w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-hairline p-4 shadow-2xl shadow-black/70 focus:outline-none"
        style={style}
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint" data-testid="tour-counter">
          {stepLabel(i, steps.length)}
        </p>
        <h2 id="tour-title" className="mt-1 text-base font-semibold leading-snug">{step.title}</h2>
        <p className="mt-1.5 text-[13px] text-muted">{step.text}</p>
        <div className="mt-4 flex items-center gap-2">
          <button type="button" onClick={end} className="mr-auto text-[12px] text-faint underline underline-offset-2 hover:text-ink">
            Skip tour
          </button>
          {i > 0 && <Button size="sm" onClick={() => setI(i - 1)}>Back</Button>}
          <Button size="sm" variant="primary" onClick={() => (last ? end() : setI(i + 1))}>
            {last ? 'Done' : 'Next'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
