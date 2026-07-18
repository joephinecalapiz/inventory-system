import { useEffect, useMemo, useState } from "react";

import "../UserManagement.css";

import { ROLE_LABELS, USER_ROLES, USER_STATUSES } from "../constants/roles";

import { isCreateUserFunctionEnabled } from "../firebase/firebase";

import { subscribeToUsers, updateUserAccess } from "../services/userService";

import { createSystemUserAccount } from "../services/systemUserService";

const ALL_ROLE_OPTIONS = [
  USER_ROLES.SUPERADMIN,
  USER_ROLES.ADMIN,
  USER_ROLES.INVENTORY_STAFF,
  USER_ROLES.CASHIER,
  USER_ROLES.AUDITOR,
];

const OPERATIONAL_ROLE_OPTIONS = [
  USER_ROLES.INVENTORY_STAFF,
  USER_ROLES.CASHIER,
  USER_ROLES.AUDITOR,
];

const STATUS_OPTIONS = [
  USER_STATUSES.ACTIVE,
  USER_STATUSES.INACTIVE,
  USER_STATUSES.SUSPENDED,
];

const EMPTY_CREATE_USER_FORM = {
  displayName: "",
  email: "",
  password: "",
  role: USER_ROLES.CASHIER,
  status: USER_STATUSES.ACTIVE,
};

function UserManagement({ currentUserId, currentUserRole }) {
  const [users, setUsers] = useState([]);

  const [searchText, setSearchText] = useState("");

  const [selectedRole, setSelectedRole] = useState("ALL");

  const [selectedStatus, setSelectedStatus] = useState("ALL");

  const [isLoading, setIsLoading] = useState(true);

  const [errorMessage, setErrorMessage] = useState("");

  const [successMessage, setSuccessMessage] = useState("");

  const [selectedUser, setSelectedUser] = useState(null);

  const [editRole, setEditRole] = useState("");

  const [editStatus, setEditStatus] = useState("");

  const [modalError, setModalError] = useState("");

  const [isSaving, setIsSaving] = useState(false);

  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);

  const [createUserForm, setCreateUserForm] = useState({
    ...EMPTY_CREATE_USER_FORM,
  });

  const [createUserError, setCreateUserError] = useState("");

  const [isCreatingUser, setIsCreatingUser] = useState(false);

  const [showTemporaryPassword, setShowTemporaryPassword] = useState(false);

  useEffect(() => {
    const unsubscribeUsers = subscribeToUsers(
      (firebaseUsers) => {
        setUsers(firebaseUsers);
        setIsLoading(false);
        setErrorMessage("");
      },

      (error) => {
        setErrorMessage(error?.message || "Unable to load system users.");

        setIsLoading(false);
      },
    );

    return unsubscribeUsers;
  }, []);

  useEffect(() => {
    if (!successMessage) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setSuccessMessage("");
    }, 5000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [successMessage]);

  const filteredUsers = useMemo(() => {
    const normalizedSearchText = searchText.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !normalizedSearchText ||
        String(user.displayName || "")
          .toLowerCase()
          .includes(normalizedSearchText) ||
        String(user.email || "")
          .toLowerCase()
          .includes(normalizedSearchText);

      const matchesRole = selectedRole === "ALL" || user.role === selectedRole;

      const matchesStatus =
        selectedStatus === "ALL" || user.status === selectedStatus;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchText, selectedRole, selectedStatus]);

  const activeUsersCount = useMemo(
    () => users.filter((user) => user.status === USER_STATUSES.ACTIVE).length,
    [users],
  );

  const inactiveUsersCount = useMemo(
    () => users.filter((user) => user.status !== USER_STATUSES.ACTIVE).length,
    [users],
  );

  const editableRoleOptions =
    currentUserRole === USER_ROLES.SUPERADMIN
      ? ALL_ROLE_OPTIONS
      : OPERATIONAL_ROLE_OPTIONS;

  function clearFilters() {
    setSearchText("");
    setSelectedRole("ALL");
    setSelectedStatus("ALL");
  }

  function openCreateUserModal() {
    setCreateUserForm({
      ...EMPTY_CREATE_USER_FORM,
    });

    setCreateUserError("");
    setSuccessMessage("");
    setShowTemporaryPassword(false);
    setIsCreateUserModalOpen(true);
  }

  function closeCreateUserModal() {
    if (isCreatingUser) {
      return;
    }

    setIsCreateUserModalOpen(false);

    setCreateUserForm({
      ...EMPTY_CREATE_USER_FORM,
    });

    setCreateUserError("");
    setShowTemporaryPassword(false);
  }

  function handleCreateUserFieldChange(event) {
    const { name, value } = event.target;

    setCreateUserForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  async function handleCreateUser(event) {
    event.preventDefault();

    if (!isCreateUserFunctionEnabled) {
      setCreateUserError(
        "The Create User function is not available in this environment.",
      );

      return;
    }

    setCreateUserError("");
    setSuccessMessage("");

    const accountName =
      createUserForm.displayName.trim() ||
      createUserForm.email.trim() ||
      "The user";

    const shouldCreateUser = window.confirm(
      `Create a new system account for ${accountName}?`,
    );

    if (!shouldCreateUser) {
      return;
    }

    try {
      setIsCreatingUser(true);

      const result = await createSystemUserAccount({
        displayName: createUserForm.displayName,

        email: createUserForm.email,

        password: createUserForm.password,

        role: createUserForm.role,

        status: createUserForm.status,
      });

      setSuccessMessage(
        result?.message || `${accountName}'s account was created successfully.`,
      );

      setIsCreateUserModalOpen(false);

      setCreateUserForm({
        ...EMPTY_CREATE_USER_FORM,
      });

      setCreateUserError("");
      setShowTemporaryPassword(false);
    } catch (error) {
      console.error("Unable to create the system user:", error);

      setCreateUserError(error?.message || "Unable to create the system user.");
    } finally {
      setIsCreatingUser(false);
    }
  }

  function canEditUser(user) {
    if (!user) {
      return false;
    }

    // Nobody may edit their own role or status.
    if (user.id === currentUserId) {
      return false;
    }

    // Superadmin may manage any other account.
    if (currentUserRole === USER_ROLES.SUPERADMIN) {
      return true;
    }

    // Admin may manage operational accounts only.
    if (currentUserRole === USER_ROLES.ADMIN) {
      return OPERATIONAL_ROLE_OPTIONS.includes(user.role);
    }

    return false;
  }

  function getRestrictionLabel(user) {
    if (user.id === currentUserId) {
      return "Current account";
    }

    if (
      currentUserRole === USER_ROLES.ADMIN &&
      [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN].includes(user.role)
    ) {
      return "Protected account";
    }

    return "Not allowed";
  }

  function openEditModal(user) {
    if (!canEditUser(user)) {
      return;
    }

    setSelectedUser(user);
    setEditRole(user.role);
    setEditStatus(user.status);
    setModalError("");
    setSuccessMessage("");
  }

  function closeEditModal() {
    if (isSaving) {
      return;
    }

    setSelectedUser(null);
    setEditRole("");
    setEditStatus("");
    setModalError("");
  }

  async function handleUpdateAccess(event) {
    event.preventDefault();

    if (!selectedUser) {
      return;
    }

    setModalError("");
    setSuccessMessage("");

    const hasRoleChanged = editRole !== selectedUser.role;

    const hasStatusChanged = editStatus !== selectedUser.status;

    if (!hasRoleChanged && !hasStatusChanged) {
      setModalError("No changes were made to the user's access.");

      return;
    }

    const userName =
      selectedUser.displayName || selectedUser.email || "this user";

    const shouldContinue = window.confirm(
      `Update the role or account status of ${userName}?`,
    );

    if (!shouldContinue) {
      return;
    }

    try {
      setIsSaving(true);

      await updateUserAccess({
        userId: selectedUser.id,
        role: editRole,
        status: editStatus,
        updatedBy: currentUserId,
      });

      setSuccessMessage(`${userName}'s access was updated successfully.`);

      setSelectedUser(null);
      setEditRole("");
      setEditStatus("");
      setModalError("");
    } catch (error) {
      console.error("Unable to update user access:", error);

      setModalError(error?.message || "Unable to update the user's access.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="user-management-page">
      <section className="user-management-heading">
        <div>
          <p className="user-management-eyebrow">Access control</p>

          <h2>User Management</h2>

          <span>
            View users and manage their assigned roles and account statuses.
          </span>
        </div>

        <div className="user-management-heading-actions">
          <div className="user-management-phase-notice">
            <strong>Access management enabled</strong>

            <span>Create accounts and manage assigned roles and statuses.</span>
          </div>

          {isCreateUserFunctionEnabled && (
            <button
              type="button"
              className="user-create-button"
              onClick={openCreateUserModal}
            >
              <span>+</span>
              Create User
            </button>
          )}
        </div>
      </section>

      {!isCreateUserFunctionEnabled && (
        <div className="user-production-function-notice">
          <strong>Automated user creation is unavailable</strong>

          <span>
            This Firebase project currently has no deployed Create User
            function. Create the Authentication account and matching Firestore
            profile manually.
          </span>
        </div>
      )}

      {successMessage && (
        <div className="user-management-success" role="status">
          <div>
            <strong>Changes saved</strong>
            <span>{successMessage}</span>
          </div>

          <button
            type="button"
            onClick={() => setSuccessMessage("")}
            aria-label="Close success message"
          >
            ×
          </button>
        </div>
      )}

      <section className="user-summary-grid">
        <SummaryCard
          label="Total Users"
          value={users.length}
          description="Registered system accounts"
        />

        <SummaryCard
          label="Active Users"
          value={activeUsersCount}
          description="Accounts allowed to log in"
        />

        <SummaryCard
          label="Inactive or Suspended"
          value={inactiveUsersCount}
          description="Accounts with restricted access"
        />
      </section>

      <section className="user-management-panel">
        <div className="user-filter-row">
          <label className="user-search-field">
            <span>Search users</span>

            <input
              type="search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search name or email"
            />
          </label>

          <label className="user-filter-field">
            <span>Role</span>

            <select
              value={selectedRole}
              onChange={(event) => setSelectedRole(event.target.value)}
            >
              <option value="ALL">All roles</option>

              {ALL_ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </label>

          <label className="user-filter-field">
            <span>Status</span>

            <select
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value)}
            >
              <option value="ALL">All statuses</option>

              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {formatStatus(status)}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="user-clear-filter-button"
            onClick={clearFilters}
          >
            Clear Filters
          </button>
        </div>

        {errorMessage && (
          <div className="user-management-error" role="alert">
            {errorMessage}
          </div>
        )}

        {isLoading ? (
          <UserLoadingState />
        ) : filteredUsers.length === 0 ? (
          <UserEmptyState
            hasFilters={
              Boolean(searchText) ||
              selectedRole !== "ALL" ||
              selectedStatus !== "ALL"
            }
          />
        ) : (
          <div className="user-table-wrapper">
            <table className="user-management-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>User ID</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map((user) => {
                  const isEditable = canEditUser(user);

                  return (
                    <tr key={user.id}>
                      <td>
                        <div className="user-identity">
                          <div className="user-avatar">
                            {getInitials(user.displayName || user.email)}
                          </div>

                          <div>
                            <strong>
                              {user.displayName || "Unnamed User"}
                            </strong>

                            <span>{user.email || "No email address"}</span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="user-role-badge">
                          {ROLE_LABELS[user.role] || user.role || "No Role"}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`user-status-badge user-status-${String(
                            user.status,
                          ).toLowerCase()}`}
                        >
                          {formatStatus(user.status)}
                        </span>
                      </td>

                      <td>{formatDate(user.createdAt)}</td>

                      <td>
                        <code className="user-id-code">
                          {shortenUserId(user.id)}
                        </code>
                      </td>

                      <td>
                        {isEditable ? (
                          <button
                            type="button"
                            className="user-table-action-button"
                            onClick={() => openEditModal(user)}
                          >
                            Edit Access
                          </button>
                        ) : (
                          <span className="user-action-restriction">
                            {getRestrictionLabel(user)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && (
          <div className="user-table-footer">
            Showing <strong>{filteredUsers.length}</strong> of{" "}
            <strong>{users.length}</strong> users
          </div>
        )}
      </section>

      {isCreateUserModalOpen && (
        <div
          className="user-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeCreateUserModal();
            }
          }}
        >
          <section
            className="user-edit-modal user-create-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-user-title"
          >
            <div className="user-edit-modal-heading">
              <div>
                <p className="user-management-eyebrow">System account</p>

                <h3 id="create-user-title">Create User</h3>

                <span>
                  Create a Firebase login account and assign its system access.
                </span>
              </div>

              <button
                type="button"
                className="user-modal-close-button"
                onClick={closeCreateUserModal}
                disabled={isCreatingUser}
                aria-label="Close Create User modal"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateUser}>
              <div className="user-create-form-grid">
                <label className="user-edit-field user-create-field-full">
                  <span>Display Name</span>

                  <input
                    type="text"
                    name="displayName"
                    value={createUserForm.displayName}
                    onChange={handleCreateUserFieldChange}
                    placeholder="Enter the user's full name"
                    minLength={2}
                    maxLength={80}
                    disabled={isCreatingUser}
                    autoComplete="name"
                    required
                  />
                </label>

                <label className="user-edit-field user-create-field-full">
                  <span>Email Address</span>

                  <input
                    type="email"
                    name="email"
                    value={createUserForm.email}
                    onChange={handleCreateUserFieldChange}
                    placeholder="user@example.com"
                    disabled={isCreatingUser}
                    autoComplete="email"
                    required
                  />
                </label>

                <label className="user-edit-field user-create-field-full">
                  <span>Temporary Password</span>

                  <div className="user-password-input">
                    <input
                      type={showTemporaryPassword ? "text" : "password"}
                      name="password"
                      value={createUserForm.password}
                      onChange={handleCreateUserFieldChange}
                      placeholder="Minimum of 8 characters"
                      minLength={8}
                      maxLength={128}
                      disabled={isCreatingUser}
                      autoComplete="new-password"
                      required
                    />

                    <button
                      type="button"
                      className="user-password-toggle"
                      onClick={() =>
                        setShowTemporaryPassword(
                          (currentValue) => !currentValue,
                        )
                      }
                      disabled={isCreatingUser}
                    >
                      {showTemporaryPassword ? "Hide" : "Show"}
                    </button>
                  </div>

                  <small>
                    Give this temporary password directly to the user. It will
                    not be stored in Firestore.
                  </small>
                </label>

                <label className="user-edit-field">
                  <span>Assigned Role</span>

                  <select
                    name="role"
                    value={createUserForm.role}
                    onChange={handleCreateUserFieldChange}
                    disabled={isCreatingUser}
                    required
                  >
                    {editableRoleOptions.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="user-edit-field">
                  <span>Account Status</span>

                  <select
                    name="status"
                    value={createUserForm.status}
                    onChange={handleCreateUserFieldChange}
                    disabled={isCreatingUser}
                    required
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {formatStatus(status)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <AccessStatusExplanation status={createUserForm.status} />

              {createUserError && (
                <div className="user-modal-error" role="alert">
                  {createUserError}
                </div>
              )}

              <div className="user-edit-warning">
                <strong>The account will be created immediately</strong>

                <span>
                  The system will create a Firebase Authentication account and a
                  matching Firestore user profile.
                </span>
              </div>

              <div className="user-modal-actions">
                <button
                  type="button"
                  className="user-modal-secondary-button"
                  onClick={closeCreateUserModal}
                  disabled={isCreatingUser}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="user-modal-primary-button"
                  disabled={isCreatingUser}
                >
                  {isCreatingUser ? "Creating User..." : "Create User"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {selectedUser && (
        <div
          className="user-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeEditModal();
            }
          }}
        >
          <section
            className="user-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-user-title"
          >
            <div className="user-edit-modal-heading">
              <div>
                <p className="user-management-eyebrow">User access</p>

                <h3 id="edit-user-title">Edit User Access</h3>

                <span>Change the assigned role or account status.</span>
              </div>

              <button
                type="button"
                className="user-modal-close-button"
                onClick={closeEditModal}
                disabled={isSaving}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            <div className="user-edit-identity">
              <div className="user-avatar">
                {getInitials(selectedUser.displayName || selectedUser.email)}
              </div>

              <div>
                <strong>{selectedUser.displayName || "Unnamed User"}</strong>

                <span>{selectedUser.email || "No email address"}</span>
              </div>
            </div>

            <form onSubmit={handleUpdateAccess}>
              <div className="user-edit-form-grid">
                <label className="user-edit-field">
                  <span>Assigned Role</span>

                  <select
                    value={editRole}
                    onChange={(event) => setEditRole(event.target.value)}
                    disabled={isSaving}
                    required
                  >
                    {editableRoleOptions.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="user-edit-field">
                  <span>Account Status</span>

                  <select
                    value={editStatus}
                    onChange={(event) => setEditStatus(event.target.value)}
                    disabled={isSaving}
                    required
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {formatStatus(status)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <AccessStatusExplanation status={editStatus} />

              {modalError && (
                <div className="user-modal-error" role="alert">
                  {modalError}
                </div>
              )}

              <div className="user-edit-warning">
                <strong>Confirm access changes carefully</strong>

                <span>
                  Changing the role affects which pages and Firestore operations
                  this user can access.
                </span>
              </div>

              <div className="user-modal-actions">
                <button
                  type="button"
                  className="user-modal-secondary-button"
                  onClick={closeEditModal}
                  disabled={isSaving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="user-modal-primary-button"
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

function SummaryCard({ label, value, description }) {
  return (
    <article className="user-summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{description}</p>
    </article>
  );
}

function UserLoadingState() {
  return (
    <div className="user-loading-state">
      <div className="user-loading-spinner" />

      <strong>Loading users...</strong>

      <span>Reading account profiles from Firestore.</span>
    </div>
  );
}

function UserEmptyState({ hasFilters }) {
  return (
    <div className="user-empty-state">
      <div>—</div>

      <strong>{hasFilters ? "No matching users" : "No users found"}</strong>

      <span>
        {hasFilters
          ? "Try changing or clearing the filters."
          : "User profiles will appear here."}
      </span>
    </div>
  );
}

function AccessStatusExplanation({ status }) {
  const explanations = {
    ACTIVE: "The user can sign in and use features allowed by their role.",

    INACTIVE:
      "The account remains stored, but access to protected system features is blocked.",

    SUSPENDED:
      "The account is blocked because of an administrative or security restriction.",
  };

  return (
    <div className="user-status-explanation">
      <strong>{formatStatus(status)}</strong>

      <span>{explanations[status] || "No status description available."}</span>
    </div>
  );
}

function getInitials(value) {
  if (!value) {
    return "U";
  }

  const words = String(value).trim().split(/\s+/).filter(Boolean);

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

function formatStatus(status) {
  if (!status) {
    return "Unknown";
  }

  return String(status)
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value) {
  const date = convertToDate(value);

  if (!date) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function convertToDate(value) {
  if (!value) {
    return null;
  }

  if (typeof value.toDate === "function") {
    return value.toDate();
  }

  if (typeof value.seconds === "number") {
    return new Date(value.seconds * 1000);
  }

  const parsedDate = new Date(value);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function shortenUserId(userId) {
  if (!userId) {
    return "No ID";
  }

  if (userId.length <= 14) {
    return userId;
  }

  return `${userId.slice(0, 7)}...${userId.slice(-5)}`;
}

export default UserManagement;
