import { NavLink } from 'react-router-dom';
import './FeeSubnav.css';

/**
 * The three fee screens, tied together.
 *
 * A strip of links rather than a fourth layout shell like LibraryLayout: the
 * library needs its own chrome because the person at the counter has no use for
 * Applications or Blog Posts, whereas fees are office work done alongside
 * everything else in the main sidebar.
 */
const LINKS = [
  { to: '/fees/balances', label: 'Balances' },
  { to: '/fees/schedules', label: 'What we charge' },
  { to: '/fees/payments', label: 'Payments' },
];

const FeeSubnav = () => (
  <nav className="fee-subnav" aria-label="School fees sections">
    {LINKS.map((l) => (
      <NavLink key={l.to} to={l.to} className={({ isActive }) => `fee-subnav-link ${isActive ? 'is-active' : ''}`}>
        {l.label}
      </NavLink>
    ))}
  </nav>
);

export default FeeSubnav;
