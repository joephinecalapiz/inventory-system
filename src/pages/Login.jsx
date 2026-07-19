import { useRef, useState } from "react";
import "../styles/Auth.css";
import FloatingOrb from "../components/auth/FloatingOrb";
import LoginTopbar from "../components/auth/LoginTopbar";
import { loginAdmin } from "../services/authService";

function getReadableAuthError(error) {
  switch (error?.code) {
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Incorrect email address or password.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/too-many-requests":
      return "Too many failed attempts. Please try again later.";
    case "auth/network-request-failed":
      return "Network error. Please check your internet connection.";
    case "auth/user-disabled":
      return "This administrator account has been disabled.";
    default:
      return "Unable to sign in. Please try again.";
  }
}

function Login() {
  const emailInputRef = useRef(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function scrollToLoginForm() {
    document.getElementById("admin-sign-in")?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    window.setTimeout(() => {
      emailInputRef.current?.focus();
    }, 450);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!email.trim() || !password) {
      setErrorMessage("Please enter your email address and password.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage("");
      await loginAdmin(email, password);
    } catch (error) {
      console.error("Unable to sign in:", error);
      setErrorMessage(getReadableAuthError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page" id="home">
      <div className="login-page-frame">
        <LoginTopbar onLoginClick={scrollToLoginForm} />

        <section className="login-hero">
          <div className="login-hero-copy">
          </div>

          <div className="login-orb-column">
            <FloatingOrb />
            <div className="login-satisfaction">
              <div className="login-satisfaction-score">
                <strong>4.8/5</strong>
                <span>Client satisfaction</span>
              </div>
              <div className="login-client-stack" aria-label="Client avatars">
                <span>JC</span>
                <span>PR</span>
                <span>AM</span>
                <span className="login-client-more">+</span>
              </div>
            </div>
          </div>

          <section className="login-card" id="admin-sign-in" aria-labelledby="admin-sign-in-title">
            <div className="login-card-heading">
              <p>Inventory System</p>
              <h2 id="admin-sign-in-title">Admin Sign In</h2>
              <span>
                Enter your Firebase administrator credentials to open the inventory dashboard.
              </span>
            </div>

            {errorMessage && <div className="login-error" role="alert">{errorMessage}</div>}

            <form className="login-form" onSubmit={handleSubmit}>
              <label>
                Email address
                <input
                  ref={emailInputRef}
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@example.com"
                  autoComplete="email"
                  disabled={isSubmitting}
                />
              </label>

              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  disabled={isSubmitting}
                />
              </label>

              <button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Signing In..." : "Sign In"}
              </button>
            </form>

            <p className="login-card-note">
              Administrator accounts are managed in Firebase Authentication.
            </p>
          </section>
        </section>



        <footer className="login-footer">
          <span>Copyright © 2026 Inventory Management System | JOEPHINE NILLAS CALAPIZ</span>
      
        </footer>
      </div>
    </main>
  );
}

export default Login;
