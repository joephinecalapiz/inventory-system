import { NavLink } from "react-router-dom";

import { ROLE_LABELS, USER_ROLES } from "../../constants/roles";

import { logoutAdmin } from "../../services/authService";

import {
  AddProductIcon,
  CashierIcon,
  CategoryIcon,
  CloseIcon,
  DashboardIcon,
  GoodsReceivingIcon,
  GoodsReceiptHistoryIcon,
  ProductsIcon,
  InventoryIcon,
  LogoutIcon,
  PurchaseOrderIcon,
  ReportsIcon,
  StockInIcon,
  SupplierIcon,
  UnitIcon,
  UserIcon,
} from "./LayoutIcons";

import logo from "../../assets/logo.png";

const NAVIGATION_ITEMS = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: DashboardIcon,
    allowedRoles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN],
  },
  {
    label: "Inventory",
    path: "/inventory",
    icon: InventoryIcon,
    allowedRoles: [
      USER_ROLES.SUPERADMIN,
      USER_ROLES.ADMIN,
      USER_ROLES.INVENTORY_STAFF,
      USER_ROLES.AUDITOR,
    ],
  },

  {
    label: "Stock In",
    path: "/stock-in",
    icon: StockInIcon,
    allowedRoles: [
      USER_ROLES.SUPERADMIN,
      USER_ROLES.ADMIN,
      USER_ROLES.INVENTORY_STAFF,
      USER_ROLES.AUDITOR,
    ],
  },

  {
    label: "Suppliers",
    path: "/suppliers",
    icon: SupplierIcon,
    allowedRoles: [
      USER_ROLES.SUPERADMIN,
      USER_ROLES.ADMIN,
      USER_ROLES.INVENTORY_STAFF,
      USER_ROLES.AUDITOR,
    ],
  },

  {
    label: "Purchase Orders",
    path: "/purchase-orders",
    icon: PurchaseOrderIcon,
    allowedRoles: [
      USER_ROLES.SUPERADMIN,
      USER_ROLES.ADMIN,
      USER_ROLES.INVENTORY_STAFF,
      USER_ROLES.AUDITOR,
    ],
  },

  {
    label: "Goods Receiving",
    path: "/goods-receiving",
    icon: GoodsReceivingIcon,
    allowedRoles: [
      USER_ROLES.SUPERADMIN,
      USER_ROLES.ADMIN,
      USER_ROLES.INVENTORY_STAFF,
      USER_ROLES.AUDITOR,
    ],
  },

  {
    label: "Goods Receipt History",
    path: "/goods-receipt-history",
    icon: GoodsReceiptHistoryIcon,
    allowedRoles: [
      USER_ROLES.SUPERADMIN,
      USER_ROLES.ADMIN,
      USER_ROLES.INVENTORY_STAFF,
      USER_ROLES.AUDITOR,
    ],
  },
  {
    label: "Product Management",
    path: "/products",
    icon: ProductsIcon,
    allowedRoles: [
      USER_ROLES.SUPERADMIN,
      USER_ROLES.ADMIN,
      USER_ROLES.INVENTORY_STAFF,
      USER_ROLES.AUDITOR,
    ],
  },
  {
    label: "Categories",
    path: "/categories",
    icon: CategoryIcon,
    allowedRoles: [
      USER_ROLES.SUPERADMIN,
      USER_ROLES.ADMIN,
      USER_ROLES.INVENTORY_STAFF,
      USER_ROLES.AUDITOR,
    ],
  },

  {
    label: "Units",
    path: "/units",
    icon: UnitIcon,
    allowedRoles: [
      USER_ROLES.SUPERADMIN,
      USER_ROLES.ADMIN,
      USER_ROLES.INVENTORY_STAFF,
      USER_ROLES.AUDITOR,
    ],
  },
  {
    label: "Add Products",
    path: "/add-products",
    icon: AddProductIcon,
    allowedRoles: [
      USER_ROLES.SUPERADMIN,
      USER_ROLES.ADMIN,
      USER_ROLES.INVENTORY_STAFF,
    ],
  },
  {
    label: "User Management",
    path: "/users",
    icon: UserIcon,
    allowedRoles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN],
  },
  {
    label: "Cashier Portal",
    path: "/cashier",
    icon: CashierIcon,
    allowedRoles: [USER_ROLES.SUPERADMIN, USER_ROLES.CASHIER],
  },
  {
    label: "Reports",
    path: "/reports",
    icon: ReportsIcon,
    allowedRoles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.AUDITOR],
  },
];

function Sidebar({ isOpen, onClose, userRole }) {
  const roleLabel = ROLE_LABELS[userRole] ?? "Unknown Role";

  const visibleNavigationItems = NAVIGATION_ITEMS.filter((item) =>
    item.allowedRoles.includes(userRole),
  );

  function getNavClass({ isActive }) {
    return ["sidebar-link", isActive ? "sidebar-link-active" : ""]
      .filter(Boolean)
      .join(" ");
  }

  async function handleLogout() {
    const shouldLogout = window.confirm("Are you sure you want to sign out?");

    if (!shouldLogout) {
      return;
    }

    try {
      await logoutAdmin();
    } catch (error) {
      console.error("Unable to sign out:", error);

      alert("Unable to sign out. Please try again.");
    }
  }

  return (
    <>
      <aside className={`app-sidebar ${isOpen ? "app-sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark">
            <img src={logo} alt="Inventory Management System logo" />
          </div>

          <div className="sidebar-brand-text">
            <strong>INVENTORY</strong>
            <span>MANAGEMENT</span>
          </div>

          <button
            type="button"
            className="sidebar-close-button"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="sidebar-role-badge">
          <span>Signed in as</span>
          <strong>{roleLabel}</strong>
        </div>

        <nav className="sidebar-navigation" aria-label="Main navigation">
          {visibleNavigationItems.map((item) => {
            const NavigationIcon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={getNavClass}
                onClick={onClose}
              >
                <span className="sidebar-link-icon">
                  <NavigationIcon />
                </span>

                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <button
            type="button"
            className="sidebar-action-button"
            onClick={handleLogout}
          >
            <span className="sidebar-link-icon">
              <LogoutIcon />
            </span>
            Log Out
          </button>
        </div>
      </aside>

      {isOpen && (
        <button
          type="button"
          className="sidebar-overlay"
          onClick={onClose}
          aria-label="Close sidebar"
        />
      )}
    </>
  );
}

export default Sidebar;
