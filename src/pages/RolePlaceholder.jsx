import "../Access.css";

function RolePlaceholder({ eyebrow, title, description }) {
  return (
    <main className="role-placeholder-page">
      <section className="role-placeholder-card">
        <p className="access-eyebrow">{eyebrow}</p>

        <h1>{title}</h1>

        <p>{description}</p>

        <div className="role-placeholder-notice">
          This portal will be developed in a later phase.
        </div>
      </section>
    </main>
  );
}

export default RolePlaceholder;
