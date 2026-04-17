import { gql } from 'urql'

export const ISSUES_QUERY = gql`
  query Issues($first: Int) {
    issues(first: $first, orderBy: updatedAt) {
      nodes {
        __typename
        id
        identifier
        title
        priority
        state {
          __typename
          id
          name
          color
        }
        assignee {
          __typename
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
        __typename
        id
        name
        description
        state
        progress
        startDate
        targetDate
        teams {
          nodes {
            __typename
            id
            name
          }
        }
        lead {
          __typename
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
      __typename
      id
      identifier
      title
      description
      priority
      estimate
      url
      state {
        __typename
        id
        name
        color
      }
      assignee {
        __typename
        id
        name
        avatarUrl
      }
      labels {
        nodes {
          __typename
          id
          name
          color
        }
      }
      project {
        __typename
        id
        name
      }
      team {
        __typename
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
        __typename
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
        __typename
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
        __typename
        id
        priority
      }
    }
  }
`

export const VIEWER_QUERY = gql`
  query Viewer {
    viewer {
      __typename
      id
      name
      email
      avatarUrl
    }
  }
`
