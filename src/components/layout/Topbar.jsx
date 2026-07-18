import { useLocation } from "react-router-dom";
import { MenuIcon } from "./LayoutIcons";

const PAGE_TITLES = {
  "/dashboard": "Dashboard",
  "/inventory": "Inventory List",
  "/add-products": "New Products",
};

function getInitials(value) {
  return String(value || "Admin")
    .trim()
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function Topbar({ user, onMenuClick }) {
  const location = useLocation();

  const pageTitle = PAGE_TITLES[location.pathname] || "Inventory System";

  const displayName = user?.displayName || user?.email || "Administrator";

  return (
    <header className="app-topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="topbar-menu-button"
          onClick={onMenuClick}
          aria-label="Open sidebar"
        >
          <MenuIcon />
        </button>

        <h1>{pageTitle}</h1>
      </div>

      <div className="topbar-account">
        <div className="topbar-account-text">
          <strong title={displayName}>{displayName}</strong>

          <span>Head of Administrator</span>
        </div>

        {user?.photoURL ? (
          <img
            className="topbar-avatar"
            src={user.photoURL}
            alt={displayName}
          />
        ) : (
          <div className="topbar-avatar topbar-avatar-fallback">
            {getInitials(displayName)}
          </div>
        )}
      </div>
    </header>
  );
}

export default Topbar;
