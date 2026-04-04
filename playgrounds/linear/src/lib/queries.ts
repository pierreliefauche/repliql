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
      team {
        id
      }
      createdAt
      updatedAt
    }
  }
`

export const WORKFLOW_STATES_QUERY = gql`
  query WorkflowStates($teamId: ID!) {
    workflowStates(filter: { team: { id: { eq: $teamId } } }) {
      nodes {
        id
        name
        color
        type
      }
    }
  }
`

export const UPDATE_ISSUE_STATE_MUTATION = gql`
  mutation UpdateIssueState($id: String!, $stateId: String!) {
    issueUpdate(id: $id, input: { stateId: $stateId }) {
      success
      issue {
        id
        state {
          id
          name
          color
        }
      }
    }
  }
`

export const UPDATE_ISSUE_PRIORITY_MUTATION = gql`
  mutation UpdateIssuePriority($id: String!, $priority: Int!) {
    issueUpdate(id: $id, input: { priority: $priority }) {
      success
      issue {
        id
        priority
      }
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
