import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function Layout({ children, title }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <Link to={user?.role === 'admin' ? '/admin' : '/candidate'}>
            ProctorAssess
          </Link>
          {title ? <span className="page-title">{title}</span> : null}
        </div>
        <div className="topbar-right">
          <span className="user-chip">
            {user?.name} · {user?.role}
          </span>
          <button type="button" className="btn btn-ghost" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>
      <main className="main">{children}</main>
    </div>
  );
}
