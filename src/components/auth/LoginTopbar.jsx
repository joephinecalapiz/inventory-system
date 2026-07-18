function LoginTopbar({ onLoginClick }) {
  return (
    <header className="login-topbar">
      <a className="login-brand" href="#home" aria-label="Inventory System home">
        <span className="login-brand-mark" aria-hidden="true"><span /></span>
        <span className="login-brand-text">
          <strong>INVENTORY</strong>
          <small>SYSTEM</small>
        </span>
      </a>

      <nav className="login-navigation" aria-label="Public navigation">
        <a href="#services">Services</a>
        <a href="#resources">Resources</a>
        <a href="#industries">Industries</a>
        <a href="#case-studies">Case Studies</a>
      </nav>

      <button type="button" className="login-topbar-button" onClick={onLoginClick}>
        <span>Log In</span>
        <span className="login-topbar-arrow" aria-hidden="true">↗</span>
      </button>
    </header>
  );
}

export default LoginTopbar;
