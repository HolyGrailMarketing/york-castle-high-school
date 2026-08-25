import { useEffect, useState } from 'react';
import { PAGE_HELP } from '../help/content';
import './PageHelp.css';

/**
 * The "what you can do here" panel at the top of a page.
 *
 * Open the first time someone visits a page, so a teacher who has never seen
 * the portal gets the explanation without going looking for it. Once they
 * collapse it, it stays collapsed for them — but as a thin bar with a "?", not
 * gone, so it is always one click back.
 */

const storageKey = (key: string) => `ychs.help.${key}`;

const PageHelp = ({ pageKey }: { pageKey: string }) => {
  const help = PAGE_HELP[pageKey];

  // Read synchronously on mount so the panel doesn't flash open before we
  // discover it was collapsed. Private-mode browsers throw on localStorage.
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(storageKey(pageKey)) !== 'collapsed';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(pageKey), open ? 'open' : 'collapsed');
    } catch {
      /* no persistence available — the panel still works for this visit */
    }
  }, [pageKey, open]);

  // A page with no entry renders nothing rather than an empty box.
  if (!help) return null;

  return (
    <section className={`page-help ${open ? '' : 'page-help--collapsed'}`}>
      <button
        type="button"
        className="page-help-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={`page-help-body-${pageKey}`}
      >
        <span className="page-help-mark" aria-hidden="true">?</span>
        <span className="page-help-heading">{help.title}</span>
        <span className="page-help-chevron" aria-hidden="true">{open ? '▾' : '▸'}</span>
        <span className="sr-only">{open ? 'Hide guidance for this page' : 'Show guidance for this page'}</span>
      </button>

      <div id={`page-help-body-${pageKey}`} className="page-help-body" hidden={!open}>
        <p className="page-help-summary">{help.summary}</p>
        <ul className="page-help-actions">
          {help.actions.map((action) => (
            <li key={action.label}>
              <strong>{action.label}</strong>
              <span>{action.detail}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default PageHelp;
