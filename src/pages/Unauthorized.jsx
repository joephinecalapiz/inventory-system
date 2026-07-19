import { useLocation, useNavigate } from "react-router-dom";

import "../styles/Access.css";
import { getRoleHomeRoute, ROLE_LABELS } from "../constants/roles";

function Unauthorized({ role }) {
  const navigate = useNavigate();
  const location = useLocation();

  const roleLabel = ROLE_LABELS[role] ?? role ?? "Unknown role";

  const attemptedPath = location.state?.attemptedPath;

  function returnToPortal() {
    navigate(getRoleHomeRoute(role), {
      replace: true,
    });
  }

  return (
    <main className="access-page access-page-inside">
      <section className="access-card">
        <div className="access-icon">×</div>

        <p className="access-eyebrow">Access denied</p>

        <h1>You cannot open this page</h1>

        <p className="access-message">
          Your current role is <strong>{roleLabel}</strong>. This role does not
          have permission to open the requested page.
        </p>

        {attemptedPath && (
          <code className="access-detail">{attemptedPath}</code>
        )}

        <button
          type="button"
          className="access-primary-button"
          onClick={returnToPortal}
        >
          Return to My Portal
        </button>
      </section>
    </main>
  );
}

export default Unauthorized;
