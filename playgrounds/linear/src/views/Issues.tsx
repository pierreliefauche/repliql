/**
 * Issues View Component
 */

import React, { useState } from "react";
import { useQuery } from "urql";
import { ISSUES_QUERY } from "../queries";

interface Issue {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  priority: number;
  priorityLabel: string;
  state: {
    id: string;
    name: string;
    color: string;
  };
  assignee: {
    id: string;
    name: string;
    avatarUrl: string | null;
  } | null;
  project: {
    id: string;
    name: string;
  } | null;
  createdAt: string;
}

function getPriorityIcon(priority: number): string {
  switch (priority) {
    case 1:
      return "🔴";
    case 2:
      return "🟠";
    case 3:
      return "🟡";
    case 4:
      return "🟢";
    default:
      return "⚪";
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function Issues(): React.ReactElement {
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

  const [result] = useQuery({
    query: ISSUES_QUERY,
    variables: { first: 50 },
  });

  const { data, fetching, error } = result;

  if (fetching) {
    return (
      <div className="view-container">
        <div className="view-header">
          <h2>Issues</h2>
        </div>
        <div className="loading-state">Loading issues...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="view-container">
        <div className="view-header">
          <h2>Issues</h2>
        </div>
        <div className="error-state">
          <p>Error loading issues</p>
          <code>{error.message}</code>
        </div>
      </div>
    );
  }

  const issues: Issue[] = data?.issues?.nodes || [];

  return (
    <div className="view-container issues-view">
      <div className="view-header">
        <h2>Issues</h2>
        <span className="count-badge">{issues.length}</span>
      </div>

      <div className="issues-layout">
        <div className="issues-list">
          {issues.length === 0 ? (
            <div className="empty-state">
              <p>No issues found</p>
            </div>
          ) : (
            issues.map((issue) => (
              <div
                key={issue.id}
                className={`issue-row ${selectedIssue?.id === issue.id ? "selected" : ""}`}
                onClick={() => setSelectedIssue(issue)}
              >
                <div className="issue-priority" title={issue.priorityLabel}>
                  {getPriorityIcon(issue.priority)}
                </div>

                <div className="issue-info">
                  <div className="issue-header">
                    <span className="issue-identifier">{issue.identifier}</span>
                    <span
                      className="issue-state"
                      style={{ backgroundColor: issue.state.color }}
                    >
                      {issue.state.name}
                    </span>
                  </div>
                  <h4 className="issue-title">{issue.title}</h4>
                  {issue.project && (
                    <span className="issue-project">{issue.project.name}</span>
                  )}
                </div>

                <div className="issue-meta">
                  {issue.assignee && (
                    <div className="issue-assignee" title={issue.assignee.name}>
                      {issue.assignee.avatarUrl ? (
                        <img
                          src={issue.assignee.avatarUrl}
                          alt={issue.assignee.name}
                          className="avatar-sm"
                        />
                      ) : (
                        <span className="avatar-placeholder">
                          {issue.assignee.name.charAt(0)}
                        </span>
                      )}
                    </div>
                  )}
                  <span className="issue-date">{formatDate(issue.createdAt)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {selectedIssue && (
          <div className="issue-detail-panel">
            <div className="detail-header">
              <span className="detail-identifier">{selectedIssue.identifier}</span>
              <button
                className="close-btn"
                onClick={() => setSelectedIssue(null)}
              >
                ×
              </button>
            </div>

            <h3 className="detail-title">{selectedIssue.title}</h3>

            <div className="detail-section">
              <label>Status</label>
              <span
                className="status-badge"
                style={{ backgroundColor: selectedIssue.state.color }}
              >
                {selectedIssue.state.name}
              </span>
            </div>

            <div className="detail-section">
              <label>Priority</label>
              <span>
                {getPriorityIcon(selectedIssue.priority)} {selectedIssue.priorityLabel}
              </span>
            </div>

            {selectedIssue.assignee && (
              <div className="detail-section">
                <label>Assignee</label>
                <div className="assignee-info">
                  {selectedIssue.assignee.avatarUrl && (
                    <img
                      src={selectedIssue.assignee.avatarUrl}
                      alt={selectedIssue.assignee.name}
                      className="avatar"
                    />
                  )}
                  <span>{selectedIssue.assignee.name}</span>
                </div>
              </div>
            )}

            {selectedIssue.project && (
              <div className="detail-section">
                <label>Project</label>
                <span>{selectedIssue.project.name}</span>
              </div>
            )}

            {selectedIssue.description && (
              <div className="detail-section">
                <label>Description</label>
                <p className="detail-description">{selectedIssue.description}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
