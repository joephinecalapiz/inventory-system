import { useState } from "react";
import { Outlet } from "react-router-dom";

import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

import "../../Layout.css";

function AppLayout({ user }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  function openSidebar() {
    setIsSidebarOpen(true);
  }

  function closeSidebar() {
    setIsSidebarOpen(false);
  }

  return (
    <div className="app-shell">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={closeSidebar}
        userRole={user?.role}
      />

      <div className="app-main">
        <Topbar user={user} onMenuClick={openSidebar} />

        <div className="app-page-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default AppLayout;
