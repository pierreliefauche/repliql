import { gql } from 'urql'

export const ISSUES_QUERY = gql`
  query Issues($first: Int) {
    issues(first: $first, orderBy: updatedAt) {
      nodes {
        id
        identifier
        title
        priority
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
        createdAt
        updatedAt
      }
    }
  }
`

export const PROJECTS_QUERY = gql`
  query Projects($first: Int) {
    projects(first: $first, orderBy: updatedAt) {
      nodes {
        id
        name
        description
        state
        progress
        startDate
        targetDate
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
        createdAt
        updatedAt
      }
    }
  }
`

export const ISSUE_DETAIL_QUERY = gql`
  query IssueDetail($id: String!) {
    issue(id: $id) {
      id
      identifier
      title
      description
      priority
      estimate
      url
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
      labels {
        nodes {
          id
          name
          color
        }
      }
      project {
        id
        name
      }
      createdAt
      updatedAt
    }
  }
`

export const VIEWER_QUERY = gql`
  query Viewer {
    viewer {
      id
      name
      email
      avatarUrl
    }
  }
`
