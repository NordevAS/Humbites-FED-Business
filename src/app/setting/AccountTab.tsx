"use client";

import { useState } from "react";

export default function AccountTab() {
  // Account information state
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean>(false);

  // Handle account update
  const handleUpdateAccount = () => {
    // TODO: Implement account update logic
    console.log("Updating account:", { firstName, lastName, email, phone });
  };

  // Handle two-factor toggle
  const handleToggleTwoFactor = () => {
    setTwoFactorEnabled(!twoFactorEnabled);
    // TODO: Implement 2FA logic
    console.log("Two-factor:", !twoFactorEnabled ? "enabled" : "disabled");
  };

  // Handle password change
  const handleChangePassword = () => {
    // TODO: Implement password change modal/logic
    console.log("Change password clicked");
  };

  // Handle account deletion
  const handleDeleteAccount = () => {
    const confirmed = confirm(
      "Are you sure you want to delete your company account? This action cannot be undone."
    );
    if (confirmed) {
      // TODO: Implement account deletion logic
      console.log("Account deletion confirmed");
    }
  };

  return (
    <div className="account-form">
      {/* Account Information Section */}
      <div className="account-info-section">
        <div className="account-form-row">
          <input
            type="text"
            placeholder="First Name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="account-input"
          />
          <input
            type="text"
            placeholder="Last Name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="account-input"
          />
        </div>
        <div className="account-form-row">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="account-input"
          />
          <input
            type="tel"
            placeholder="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="account-input"
          />
        </div>
        <button className="update-btn" onClick={handleUpdateAccount}>
          Update
        </button>
      </div>

      {/* Security Section */}
      <div className="security-section">
        <div className="two-factor">
          <div>
            <h4>Two-Factor Authentication</h4>
            <p>Add an extra layer of security to your account</p>
          </div>
          <button className="enable-btn" onClick={handleToggleTwoFactor}>
            {twoFactorEnabled ? "Disable" : "Enable"}
          </button>
        </div>
        <button className="change-password-btn" onClick={handleChangePassword}>
          Change Password
        </button>
      </div>

      {/* Danger Zone */}
      <div className="danger-zone">
        <button className="delete-account-btn" onClick={handleDeleteAccount}>
          Delete Company Account
        </button>
      </div>
    </div>
  );
}
