import {
  isUsingFirebaseEmulators,
} from "../../firebase/firebase";

import "./EnvironmentBanner.css";

function EnvironmentBanner() {
  if (!isUsingFirebaseEmulators) {
    return null;
  }

  return (
    <aside
      className="environment-banner"
      aria-label="Firebase environment"
    >
      <div className="environment-banner-indicator">
        <span />
      </div>

      <div className="environment-banner-content">
        <strong>
          Local Firebase Emulators
        </strong>

        <span>
          Test data only — production Firebase is
          not being used.
        </span>

        <small>
          Auth 9099 · Firestore 8080 · Functions
          5001
        </small>
      </div>

      <a
        href="http://127.0.0.1:4000"
        target="_blank"
        rel="noreferrer"
      >
        Open Emulator UI
      </a>
    </aside>
  );
}

export default EnvironmentBanner;