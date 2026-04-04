/**
 * Projects View Component
 */

import React from "react";
import { useQuery } from "urql";
import { PROJECTS_QUERY } from "../queries";

interface Project {
  id: string;
  name: string;
  description: string | null;
  state: string;
  progress: number;
  startDate: string | null;
  targetDate: string | null;
  createdAt: string;
  teams: {
    nodes: Array<{ id: string; name: string }>;
  };
  lead: {
    id: string;
    name: string;
    avatarUrl: string | null;
  } | null;
}

function getStateColor(state: string): string {
  switch (state) {
    case "planned":
      return "#94a3b8";
    case "started":
      return "#3b82f6";
    case "paused":
      return "#f59e0b";
    case "completed":
      return "#22c55e";
    case "canceled":
      return "#ef4444";
    default:
      return "#6b7280";
  }
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function Projects(): React.ReactElement {
  const [result] = useQuery({ query: PROJECTS_QUERY });
  const { data, fetching, error } = result;

  if (fetching) {
    return (
      <div className="view-container">
        <div className="view-header">
          <h2>Projects</h2>
        </div>
        <div className="loading-state">Loading projects...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="view-container">
        <div className="view-header">
          <h2>Projects</h2>
        </div>
        <div className="error-state">
          <p>Error loading projects</p>
          <code>{error.message}</code>
        </div>
      </div>
    );
  }

  const projects: Project[] = data?.projects?.nodes || [];

  return (
    <div className="view-container">
      <div className="view-header">
        <h2>Projects</h2>
        <span className="count-badge">{projects.length}</span>
      </div>

      {projects.length === 0 ? (
        <div className="empty-state">
          <p>No projects found</p>
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map((project) => (
            <div key={project.id} className="project-card">
              <div className="project-header">
                <h3 className="project-name">{project.name}</h3>
                <span
                  className="project-state"
                  style={{ backgroundColor: getStateColor(project.state) }}
                >
                  {project.state}
                </span>
              </div>

              {project.description && (
                <p className="project-description">{project.description}</p>
              )}

              <div className="project-progress">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${project.progress * 100}%` }}
                  />
                </div>
                <span className="progress-text">
                  {Math.round(project.progress * 100)}%
                </span>
              </div>

              <div className="project-meta">
                {project.lead && (
                  <div className="project-lead">
                    {project.lead.avatarUrl && (
                      <img
                        src={project.lead.avatarUrl}
                        alt={project.lead.name}
                        className="avatar"
                      />
                    )}
                    <span>{project.lead.name}</span>
                  </div>
                )}

                <div className="project-dates">
                  <span>Target: {formatDate(project.targetDate)}</span>
                </div>
              </div>

              {project.teams.nodes.length > 0 && (
                <div className="project-teams">
                  {project.teams.nodes.map((team) => (
                    <span key={team.id} className="team-badge">
                      {team.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
