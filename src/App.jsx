import { useEffect, useState } from "react";

import { Route, Routes } from "react-router-dom";

import AppLayout from "./components/layout/AppLayout";
import RequireRole from "./components/auth/RequireRole";
import RoleLanding from "./components/auth/RoleLanding";

import AccountStatus from "./pages/AccountStatus";
import AddProduct from "./pages/AddProduct";
import Categories from "./pages/Categories";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Login from "./pages/Login";
import RolePlaceholder from "./pages/RolePlaceholder";
import Unauthorized from "./pages/Unauthorized";
import Units from "./pages/Units";
import UserManagement from "./pages/UserManagement";

import { logoutAdmin, subscribeToAuthState } from "./services/authService";

import { subscribeToUserProfile } from "./services/userService";

import { isActiveUser, isValidUserRole, USER_ROLES } from "./constants/roles";

function App() {
  const [firebaseUser, setFirebaseUser] = useState(null);

  const [userProfile, setUserProfile] = useState(null);

  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  const [profileError, setProfileError] = useState("");

  useEffect(() => {
    let unsubscribeProfile = null;

    const unsubscribeAuth = subscribeToAuthState((currentUser) => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      setFirebaseUser(currentUser);
      setUserProfile(null);
      setProfileError("");

      if (!currentUser) {
        setIsCheckingAuth(false);
        setIsLoadingProfile(false);
        return;
      }

      setIsLoadingProfile(true);

      unsubscribeProfile = subscribeToUserProfile(
        currentUser.uid,

        (profile) => {
          console.log("Loaded Firestore profile:", profile);

          setUserProfile(profile);
          setIsLoadingProfile(false);
          setIsCheckingAuth(false);
        },

        (error) => {
          console.error("Unable to load profile:", error);

          setProfileError(
            error?.message || "Unable to load your account profile.",
          );

          setIsLoadingProfile(false);
          setIsCheckingAuth(false);
        },
      );
    });

    return () => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }

      unsubscribeAuth();
    };
  }, []);

  if (isCheckingAuth || isLoadingProfile) {
    return (
      <main className="auth-loading-page">
        <div className="auth-loading-content">
          <div className="auth-loading-spinner" />

          <h1>Loading your account...</h1>

          <p>Checking your Firebase session and assigned role.</p>
        </div>
      </main>
    );
  }

  if (!firebaseUser) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  if (profileError) {
    return (
      <AccountStatus
        eyebrow="Account error"
        title="Unable to load your account"
        message={profileError}
        onSignOut={logoutAdmin}
      />
    );
  }

  if (!userProfile) {
    return (
      <AccountStatus
        eyebrow="Profile required"
        title="User profile not found"
        message="Your Firebase login exists, but no matching Firestore user profile was found."
        detail={firebaseUser.uid}
        onSignOut={logoutAdmin}
      />
    );
  }

  if (!isValidUserRole(userProfile.role)) {
    return (
      <AccountStatus
        eyebrow="Invalid role"
        title="Your assigned role is not recognized"
        message="Ask the system administrator to assign a valid role to this account."
        detail={String(userProfile.role)}
        onSignOut={logoutAdmin}
      />
    );
  }

  if (!isActiveUser(userProfile.status)) {
    return (
      <AccountStatus
        eyebrow="Account unavailable"
        title="Your account is not active"
        message={`Your account currently has the status ${userProfile.status}. Contact the system administrator for assistance.`}
        onSignOut={logoutAdmin}
      />
    );
  }

  const layoutUser = {
    uid: firebaseUser.uid,

    email: userProfile.email || firebaseUser.email || "",

    displayName:
      userProfile.displayName ||
      firebaseUser.displayName ||
      firebaseUser.email ||
      "User",

    photoURL: userProfile.photoURL || firebaseUser.photoURL || "",

    role: userProfile.role,
    status: userProfile.status,
  };

  return (
    <Routes>
      <Route
        element={<AppLayout user={layoutUser} userProfile={userProfile} />}
      >
        <Route path="/" element={<RoleLanding role={userProfile.role} />} />

        <Route
          path="/dashboard"
          element={
            <RequireRole
              userProfile={userProfile}
              allowedRoles={[USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN]}
            >
              <Dashboard />
            </RequireRole>
          }
        />

        <Route
          path="/inventory"
          element={
            <RequireRole
              userProfile={userProfile}
              allowedRoles={[
                USER_ROLES.SUPERADMIN,
                USER_ROLES.ADMIN,
                USER_ROLES.INVENTORY_STAFF,
                USER_ROLES.AUDITOR,
              ]}
            >
              <Inventory currentUserRole={userProfile.role} />
            </RequireRole>
          }
        />

        <Route
          path="/categories"
          element={
            <RequireRole
              userProfile={userProfile}
              allowedRoles={[
                USER_ROLES.SUPERADMIN,
                USER_ROLES.ADMIN,
                USER_ROLES.INVENTORY_STAFF,
                USER_ROLES.AUDITOR,
              ]}
            >
              <Categories currentUserRole={userProfile.role} />
            </RequireRole>
          }
        />

        <Route
          path="/units"
          element={
            <RequireRole
              userProfile={userProfile}
              allowedRoles={[
                USER_ROLES.SUPERADMIN,
                USER_ROLES.ADMIN,
                USER_ROLES.INVENTORY_STAFF,
                USER_ROLES.AUDITOR,
              ]}
            >
              <Units currentUserRole={userProfile.role} />
            </RequireRole>
          }
        />

        <Route
          path="/add-products"
          element={
            <RequireRole
              userProfile={userProfile}
              allowedRoles={[
                USER_ROLES.SUPERADMIN,
                USER_ROLES.ADMIN,
                USER_ROLES.INVENTORY_STAFF,
              ]}
            >
              <AddProduct currentUserRole={userProfile.role} />
            </RequireRole>
          }
        />

        <Route
          path="/users"
          element={
            <RequireRole
              userProfile={userProfile}
              allowedRoles={[USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN]}
            >
              <UserManagement
                currentUserId={firebaseUser.uid}
                currentUserRole={userProfile.role}
              />
            </RequireRole>
          }
        />

        <Route
          path="/cashier"
          element={
            <RequireRole
              userProfile={userProfile}
              allowedRoles={[USER_ROLES.SUPERADMIN, USER_ROLES.CASHIER]}
            >
              <RolePlaceholder
                eyebrow="Cashier portal"
                title="Cashiering Module"
                description="The POS, payments, transaction history, void, and refund features will be developed after the inventory phases are complete."
              />
            </RequireRole>
          }
        />

        <Route
          path="/reports"
          element={
            <RequireRole
              userProfile={userProfile}
              allowedRoles={[
                USER_ROLES.SUPERADMIN,
                USER_ROLES.ADMIN,
                USER_ROLES.AUDITOR,
              ]}
            >
              <RolePlaceholder
                eyebrow="Reports portal"
                title="Reports and Audit"
                description="Inventory reports, sales reports, movement history, and audit records will be developed in later phases."
              />
            </RequireRole>
          }
        />

        <Route
          path="/unauthorized"
          element={<Unauthorized role={userProfile.role} />}
        />
      </Route>

      <Route path="*" element={<RoleLanding role={userProfile.role} />} />
    </Routes>
  );
}

export default App;
