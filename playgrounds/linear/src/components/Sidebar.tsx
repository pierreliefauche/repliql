/**
 * Sidebar Navigation Component
 */

import React from "react";
import { NavLink } from "react-router-dom";
import { useQuery } from "urql";
import { VIEWER_QUERY } from "../queries";
import { clearApiKey } from "../client";

interface SidebarProps {
  onLogout: () => void;
}

export function Sidebar({ onLogout }: SidebarProps): React.ReactElement {
  const [result] = useQuery({ query: VIEWER_QUERY });

  const { data, fetching, error } = result;

  const handleLogout = () => {
    clearApiKey();
    onLogout();
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-logo">Linear</h1>
        <span className="sidebar-subtitle">Playground</span>
      </div>

      <nav className="sidebar-nav">
        <NavLink
          to="/projects"
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
        >
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3h18v18H3zM3 9h18M9 3v18" />
          </svg>
          <span>Projects</span>
        </NavLink>

        <NavLink
          to="/issues"
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
        >
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <span>Issues</span>
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        {fetching && <p className="user-info">Loading...</p>}
        {error && <p className="user-info error">Error loading user</p>}
        {data?.viewer && (
          <div className="user-info">
            <span className="user-name">{data.viewer.name}</span>
            <span className="user-email">{data.viewer.email}</span>
          </div>
        )}
        <button className="logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </aside>
  );
}
