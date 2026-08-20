import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { GLOSSARY, helpForRole } from '../help/content';
import './Help.css';

/**
 * Help & Guide — the reference for someone who is stuck.
 *
 * Lists only the areas this user's role can actually open, taken from the same
 * `roles` field the sidebar uses, so it can never offer a teacher a page that
 * would bounce them back to the dashboard.
 */
const Help = () => {
  const { user } = useAuth();
  const pages = helpForRole(user?.role);

  return (
    <div className="help-page">
      <div className="page-header">
        <h1>Help &amp; Guide</h1>
      </div>

      <p className="help-intro">
        What each part of the portal is for, and how to do the things you are most likely
        to need. You are signed in as <strong>{user?.role?.toLowerCase() || 'a staff member'}</strong>,
        so this shows the areas available to you.
      </p>

      <section className="help-section">
        <h2 className="help-section-title">Your areas</h2>
        <div className="help-areas">
          {pages.map((page) => (
            <article key={page.key} className="help-area">
              <h3>
                <Link to={`/${page.key}`}>{page.title}</Link>
              </h3>
              <p className="help-area-summary">{page.summary}</p>
              <ul>
                {page.actions.map((action) => (
                  <li key={action.label}>
                    <strong>{action.label}</strong>
                    <span>{action.detail}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="help-section">
        <h2 className="help-section-title">What the words mean</h2>
        <dl className="help-glossary">
          {GLOSSARY.map((entry) => (
            <div key={entry.term} className="help-glossary-item">
              <dt>{entry.label}</dt>
              <dd>{entry.definition}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="help-section">
        <h2 className="help-section-title">Still stuck?</h2>
        <p className="help-contact">
          Contact the school office on{' '}
          <a href="tel:+18769752217">+1 876 975-2217</a> or{' '}
          <a href="mailto:yorkcastle.high.san@moey.gov.jm">yorkcastle.high.san@moey.gov.jm</a>.
        </p>
      </section>
    </div>
  );
};

export default Help;
