import { Navigate } from "react-router-dom";

import {
  getRoleHomeRoute,
} from "../../constants/roles";

function RoleLanding({ role }) {
  const homeRoute = getRoleHomeRoute(role);

  return (
    <Navigate
      to={homeRoute}
      replace
    />
  );
}

export default RoleLanding;