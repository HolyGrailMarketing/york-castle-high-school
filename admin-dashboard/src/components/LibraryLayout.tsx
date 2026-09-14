import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import logo from '../assets/logo.png';
import './LibraryLayout.css';

/**
 * The library's own chrome.
 *
 * Kept separate from the admin portal's shell on purpose. The person at the
 * counter spends the whole of registration week on one screen and has no use
 * for Applications, Blog Posts, Events or Sixth Form; putting the book system
 * inside that sidebar buries the thing they actually need behind ten things
 * they do not. The admin portal links here, and this links back.
 *
 * A horizontal bar rather than a sidebar: the counter screen wants the width,
 * and there are only five places to go.
 */

const NAV = [
  { path: '/library/desk', label: 'Issue & Return', icon: '🔁', roles: ['ADMIN', 'STAFF'] },
  { path: '/library/books', label: 'Textbooks', icon: '📕', roles: ['ADMIN', 'STAFF', 'TEACHER'] },
  { path: '/library/loans', label: 'Book Loans', icon: '🔖', roles: ['ADMIN', 'STAFF', 'TEACHER'] },
  { path: '/library/charges', label: 'Book Charges', icon: '💰', roles: ['ADMIN', 'STAFF'] },
  { path: '/library/students', label: 'Students', icon: '🧑‍🎓', roles: ['ADMIN', 'STAFF'] },
];

const LibraryLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const items = NAV.filter((item) => (user ? item.roles.includes(user.role) : false));

  const signOut = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="liblayout">
      <header className="liblayout-bar">
        <div className="liblayout-brand">
          <img src={logo} alt="" className="liblayout-logo" />
          <div>
            <h1>Book Rental</h1>
            <p>York Castle High School library</p>
          </div>
        </div>

        <nav className="liblayout-nav" aria-label="Book rental">
          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `liblayout-link ${isActive ? 'is-active' : ''}`}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="liblayout-actions">
          {/* The way back. Without this the librarian is stuck in here. */}
          <NavLink to="/dashboard" className="liblayout-back">← Admin portal</NavLink>
          <span className="liblayout-user" title={user?.role}>{user?.name}</span>
          <button className="liblayout-signout" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <main className="liblayout-main">
        <Outlet />
      </main>
    </div>
  );
};

export default LibraryLayout;
