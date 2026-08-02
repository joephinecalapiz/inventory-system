import { USER_ROLES } from "../roles.js";
import { DASHBOARD_CHARTS } from "./dashboardCharts.js";
import { DASHBOARD_METRICS } from "./dashboardMetrics.js";

export const DASHBOARD_ACTIONS = Object.freeze({
  VIEW: "VIEW",
  VIEW_VALUATION: "VIEW_VALUATION",
  VIEW_OPERATIONAL_ANALYTICS: "VIEW_OPERATIONAL_ANALYTICS",
});

const DASHBOARD_ROLES = Object.freeze([
  USER_ROLES.SUPERADMIN,
  USER_ROLES.ADMIN,
  USER_ROLES.INVENTORY_STAFF,
  USER_ROLES.AUDITOR,
]);

const VALUATION_ROLES = Object.freeze([
  USER_ROLES.SUPERADMIN,
  USER_ROLES.ADMIN,
  USER_ROLES.AUDITOR,
]);

export const DASHBOARD_PERMISSIONS = Object.freeze({
  [DASHBOARD_ACTIONS.VIEW]: DASHBOARD_ROLES,
  [DASHBOARD_ACTIONS.VIEW_VALUATION]: VALUATION_ROLES,
  [DASHBOARD_ACTIONS.VIEW_OPERATIONAL_ANALYTICS]: DASHBOARD_ROLES,
});

export const DASHBOARD_METRIC_PERMISSIONS = Object.freeze({
  [DASHBOARD_METRICS.INVENTORY_VALUE]: VALUATION_ROLES,
});

export const DASHBOARD_CHART_PERMISSIONS = Object.freeze({
  [DASHBOARD_CHARTS.INVENTORY_VALUE_BY_CATEGORY]: VALUATION_ROLES,
});

export function canAccessDashboard(role, action = DASHBOARD_ACTIONS.VIEW) {
  return DASHBOARD_PERMISSIONS[action]?.includes(role) ?? false;
}

export function canViewDashboardMetric(role, metric) {
  const restrictedRoles = DASHBOARD_METRIC_PERMISSIONS[metric];

  if (!restrictedRoles) {
    return canAccessDashboard(role);
  }

  return restrictedRoles.includes(role);
}

export function canViewDashboardChart(role, chart) {
  const restrictedRoles = DASHBOARD_CHART_PERMISSIONS[chart];

  if (!restrictedRoles) {
    return canAccessDashboard(role);
  }

  return restrictedRoles.includes(role);
}
