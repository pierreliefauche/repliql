/**
 * API Key Setup Component
 */

import React, { useState } from "react";
import { setApiKey } from "../client";

interface ApiKeySetupProps {
  onApiKeySet: () => void;
}

export function ApiKeySetup({ onApiKeySet }: ApiKeySetupProps): React.ReactElement {
  const [apiKey, setApiKeyValue] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setError("Please enter your Linear API key");
      return;
    }
    setApiKey(apiKey.trim());
    onApiKeySet();
  };

  return (
    <div className="setup-container">
      <div className="setup-card">
        <div className="setup-header">
          <h1>Linear Playground</h1>
          <p>Connect to your Linear workspace</p>
        </div>

        <form onSubmit={handleSubmit} className="setup-form">
          <div className="form-group">
            <label htmlFor="apiKey">Linear API Key</label>
            <input
              type="password"
              id="apiKey"
              value={apiKey}
              onChange={(e) => {
                setApiKeyValue(e.target.value);
                setError("");
              }}
              placeholder="lin_api_..."
              className="form-input"
            />
            {error && <span className="form-error">{error}</span>}
          </div>

          <button type="submit" className="submit-btn">
            Connect to Linear
          </button>
        </form>

        <div className="setup-help">
          <p>
            To get your API key, go to{" "}
            <a href="https://linear.app/settings/api" target="_blank" rel="noopener noreferrer">
              Linear Settings → API
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
