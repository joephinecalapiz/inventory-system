import "../styles/Access.css";

function AccountStatus({ eyebrow, title, message, detail, onSignOut }) {
  return (
    <main className="access-page">
      <section className="access-card">
        <div className="access-icon">!</div>

        <p className="access-eyebrow">{eyebrow}</p>

        <h1>{title}</h1>

        <p className="access-message">{message}</p>

        {detail && <code className="access-detail">{detail}</code>}

        <button
          type="button"
          className="access-primary-button"
          onClick={onSignOut}
        >
          Sign Out
        </button>
      </section>
    </main>
  );
}

export default AccountStatus;
