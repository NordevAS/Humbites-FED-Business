"use client";

import { useState } from "react";

export default function GeneralTab() {
  // General settings state
  const [language, setLanguage] = useState<string>("English");
  const [region, setRegion] = useState<string>("USA");
  const [storeCategory, setStoreCategory] = useState<string>("Restaurant");
  const [timezone, setTimezone] = useState<string>("UTC-4 (New York)");

  return (
    <div className="settings-form vertical">
      {/* Language Selection */}
      <div className="general-form-row">
        <label>Language</label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="settings-select"
        >
          <option value="English">English</option>
          <option value="Spanish">Español</option>
          <option value="Norwegian">Norsk</option>
          <option value="Polish">Polski</option>
        </select>
      </div>

      {/* Region Selection */}
      <div className="general-form-row">
        <label>Region</label>
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="settings-select"
        >
          <option value="USA">USA</option>
          <option value="Norway">Norway</option>
          <option value="Spain">Spain</option>
          <option value="Poland">Poland</option>
        </select>
      </div>

      {/* Store Category Selection */}
      <div className="general-form-row">
        <label>Store Category</label>
        <select
          value={storeCategory}
          onChange={(e) => setStoreCategory(e.target.value)}
          className="settings-select"
        >
          <option value="Restaurant">Restaurant</option>
          <option value="Cafe">Cafe</option>
          <option value="Food Truck">Food Truck</option>
          <option value="Bar">Bar</option>
        </select>
      </div>

      {/* Timezone Input */}
      <div className="general-form-row">
        <label>Timezone</label>
        <input
          type="text"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="settings-input"
          placeholder="Enter timezone"
        />
      </div>
    </div>
  );
}
