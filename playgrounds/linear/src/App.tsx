/**
 * Main App Component with Layout
 */

import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { Projects } from "./views/Projects";
import { Issues } from "./views/Issues";
import { ApiKeySetup } from "./components/ApiKeySetup";
import { hasApiKey } from "./client";

export function App(): React.ReactElement {
  const [isAuthenticated, setIsAuthenticated] = useState(hasApiKey());

  useEffect(() => {
    // Check for API key on mount
    setIsAuthenticated(hasApiKey());
  }, []);

  const handleApiKeySet = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <ApiKeySetup onApiKeySet={handleApiKeySet} />;
  }

  return (
    <div className="app-layout">
      <Sidebar onLogout={handleLogout} />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/projects" replace />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/issues" element={<Issues />} />
        </Routes>
      </main>
    </div>
  );
}
