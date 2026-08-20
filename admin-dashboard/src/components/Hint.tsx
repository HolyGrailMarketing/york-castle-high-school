import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { glossaryEntry } from '../help/content';
import './Hint.css';

/**
 * A small "?" beside a term on screen that explains it.
 *
 * `<Hint term="section-d" />` pulls the wording from the glossary so it matches
 * the Help page exactly; `<Hint>free text</Hint>` covers one-offs.
 *
 * Opens on hover for the mouse, on focus for the keyboard, and on click for
 * touch — where hover doesn't exist. Built plainly rather than with antd's
 * Tooltip: antd is used on only two admin pages, and this needs to sit on the
 * pages teachers actually use.
 */
const Hint = ({ term, children }: { term?: string; children?: React.ReactNode }) => {
  const entry = term ? glossaryEntry(term) : undefined;
  const text = children ?? entry?.definition;
  const label = entry?.label;
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const id = useId();

  // The bubble is centred on the "?", which clips at the edges of the window —
  // and these sit in table headers, so the first and last column always would.
  // Measure once on open and nudge it back inside.
  useLayoutEffect(() => {
    const bubble = bubbleRef.current;
    if (!open || !bubble) return;
    bubble.style.transform = 'translateX(-50%)';
    const rect = bubble.getBoundingClientRect();
    const margin = 8;
    let shift = 0;
    if (rect.left < margin) shift = margin - rect.left;
    else if (rect.right > window.innerWidth - margin) shift = window.innerWidth - margin - rect.right;
    if (shift) bubble.style.transform = `translateX(calc(-50% + ${Math.round(shift)}px))`;
  }, [open]);

  // Escape closes, and so does a click anywhere else — otherwise a tooltip
  // opened by tapping on a touch screen has no way to be dismissed.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  if (!text) return null;

  return (
    <span
      className="hint"
      ref={wrapRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="hint-btn"
        aria-label={label ? `What does "${label}" mean?` : 'More information'}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        ?
      </button>
      {open && (
        <span className="hint-bubble" role="tooltip" id={id} ref={bubbleRef}>
          {label && <strong className="hint-term">{label}</strong>}
          <span>{text}</span>
        </span>
      )}
    </span>
  );
};

export default Hint;
