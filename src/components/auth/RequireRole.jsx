import { Navigate, useLocation } from "react-router-dom";

function RequireRole({ userProfile, allowedRoles, children }) {
  const location = useLocation();

  if (!userProfile) {
    return <Navigate to="/" replace />;
  }

  const hasPermission = allowedRoles.includes(userProfile.role);

  if (!hasPermission) {
    return (
      <Navigate
        to="/unauthorized"
        replace
        state={{
          attemptedPath: location.pathname,
        }}
      />
    );
  }

  return children;
}

export default RequireRole;
