"use client";

import { useState } from "react";
import NavBar from "@/components/Layout/Header/NavBar";
import GeneralTab from "./GeneralTab";
import LoyaltyTab from "./LoyaltyTab";
import AccountTab from "./AccountTab";
import "./settings.css";

export default function Settings() {
  // Track which tab is currently active
  const [activeTab, setActiveTab] = useState<string>("general");

  return (
    <div className="page-wrapper">
      <NavBar />
      <div className="settings-content-wrapper">
        <div className="settings-container">
          <h1 className="settings-title">Settings</h1>
          <div className="settings-divider"></div>

          {/* Tab Navigation - handles switching between tabs */}
          <div className="settings-tabs">
            <button
              className={`settings-tab ${
                activeTab === "general" ? "active" : ""
              }`}
              onClick={() => setActiveTab("general")}
            >
              General
            </button>
            <button
              className={`settings-tab ${
                activeTab === "loyalty" ? "active" : ""
              }`}
              onClick={() => setActiveTab("loyalty")}
            >
              Loyalty Card
            </button>
            <button
              className={`settings-tab ${
                activeTab === "account" ? "active" : ""
              }`}
              onClick={() => setActiveTab("account")}
            >
              Account
            </button>
          </div>

          {/* General Tab */}
          {activeTab === "general" && (
            <div className="tab-content">
              <GeneralTab />
            </div>
          )}

          {/* Loyalty Card Tab */}
          {activeTab === "loyalty" && (
            <div className="tab-content">
              <LoyaltyTab />
            </div>
          )}

          {/* Account Tab */}
          {activeTab === "account" && (
            <div className="tab-content">
              <AccountTab />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
