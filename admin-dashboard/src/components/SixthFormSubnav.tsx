import { NavLink } from 'react-router-dom';
import './SixthFormSubnav.css';

/**
 * The two halves of the sixth form office's work.
 *
 * Applicants is the admissions pipeline and runs for a few months a year.
 * Students is the cohort, and runs all year. They were one screen because
 * everyone started as an applicant, but an applicant and a student need
 * entirely different things done to them.
 */
const LINKS = [
  { to: '/sixth-form', label: 'Applicants', end: true },
  { to: '/sixth-form/students', label: 'Students', end: false },
];

const SixthFormSubnav = () => (
  <nav className="sf-subnav" aria-label="Sixth form sections">
    {LINKS.map((l) => (
      <NavLink
        key={l.to}
        to={l.to}
        end={l.end}
        className={({ isActive }) => `sf-subnav-link ${isActive ? 'is-active' : ''}`}
      >
        {l.label}
      </NavLink>
    ))}
  </nav>
);

export default SixthFormSubnav;
