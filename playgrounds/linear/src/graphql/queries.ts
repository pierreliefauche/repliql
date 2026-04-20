import { gql } from 'urql'

const ISSUE_ITEM_FRAGMENT = gql`
  fragment IssueItem on Issue {
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
`

const ISSUE_DETAIL_FRAGMENT = gql`
  fragment IssueDetail on Issue {
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
`

export const ISSUES_QUERY = gql`
  query Issues($first: Int) {
    issues(first: $first, orderBy: updatedAt) {
      nodes {
        ...IssueItem
      }
    }
  }

  ${ISSUE_ITEM_FRAGMENT}
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
      ...IssueDetail
    }
  }

  ${ISSUE_DETAIL_FRAGMENT}
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
        team {
          __typename
          id
        }
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
