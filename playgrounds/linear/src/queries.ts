/**
 * GraphQL Queries for Linear API
 */

import { gql } from "urql";

export const VIEWER_QUERY = gql`
  query Viewer {
    viewer {
      id
      name
      email
    }
  }
`;

export const PROJECTS_QUERY = gql`
  query Projects {
    projects(first: 50) {
      nodes {
        id
        name
        description
        state
        progress
        startDate
        targetDate
        createdAt
        updatedAt
        teams {
          nodes {
            id
            name
          }
        }
        lead {
          id
          name
          avatarUrl
        }
      }
    }
  }
`;

export const ISSUES_QUERY = gql`
  query Issues($first: Int, $filter: IssueFilter) {
    issues(first: $first, filter: $filter) {
      nodes {
        id
        identifier
        title
        description
        priority
        priorityLabel
        state {
          id
          name
          color
        }
        assignee {
          id
          name
          avatarUrl
        }
        project {
          id
          name
        }
        createdAt
        updatedAt
      }
    }
  }
`;

export const ISSUE_DETAIL_QUERY = gql`
  query IssueDetail($id: String!) {
    issue(id: $id) {
      id
      identifier
      title
      description
      priority
      priorityLabel
      state {
        id
        name
        color
      }
      assignee {
        id
        name
        avatarUrl
      }
      project {
        id
        name
      }
      labels {
        nodes {
          id
          name
          color
        }
      }
      comments {
        nodes {
          id
          body
          createdAt
          user {
            id
            name
            avatarUrl
          }
        }
      }
      createdAt
      updatedAt
    }
  }
`;
