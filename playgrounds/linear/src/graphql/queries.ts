import { gql } from 'urql'

const WORKFLOW_STATE_MIN_FRAGMENT = gql`
  fragment WorkflowStateMin on WorkflowState {
    id
    name
    color
  }
`

const ISSUE_ITEM_FRAGMENT = gql`
  fragment IssueItem on Issue {
    id
    identifier
    title
    priority
    state {
      ...WorkflowStateMin
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

  ${WORKFLOW_STATE_MIN_FRAGMENT}
`

const ISSUE_SEARCH_RESULT_ITEM_FRAGMENT = gql`
  fragment IssueSearchResultItem on IssueSearchResult {
    id
    identifier
    title
    priority
    state {
      ...WorkflowStateMin
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

  ${WORKFLOW_STATE_MIN_FRAGMENT}
`

const ISSUE_DETAIL_FRAGMENT = gql`
  fragment IssueDetail on Issue {
    id
    identifier
    title
    description
    priority
    estimate
    url
    state {
      ...WorkflowStateMin
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

  ${WORKFLOW_STATE_MIN_FRAGMENT}
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
      ...IssueDetail
    }
  }

  ${ISSUE_DETAIL_FRAGMENT}
`

export const WORKFLOW_STATES_QUERY = gql`
  query WorkflowStates($teamId: ID!) {
    workflowStates(filter: { team: { id: { eq: $teamId } } }) {
      nodes {
        ...WorkflowStateMin
        type
        team {
          id
        }
      }
    }
  }

  ${WORKFLOW_STATE_MIN_FRAGMENT}
`

export const UPDATE_ISSUE_STATE_MUTATION = gql`
  mutation UpdateIssueState($id: String!, $stateId: String!) {
    issueUpdate(id: $id, input: { stateId: $stateId }) {
      success
      issue {
        id
        state {
          ...WorkflowStateMin
        }
      }
    }
  }

  ${WORKFLOW_STATE_MIN_FRAGMENT}
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

export const UPDATE_ISSUE_TITLE_MUTATION = gql`
  mutation UpdateIssueTitle($id: String!, $title: String!) {
    issueUpdate(id: $id, input: { title: $title }) {
      success
      issue {
        id
        title
      }
    }
  }
`

export const UPDATE_ISSUE_DESCRIPTION_MUTATION = gql`
  mutation UpdateIssueDescription($id: String!, $description: String!) {
    issueUpdate(id: $id, input: { description: $description }) {
      success
      issue {
        id
        description
      }
    }
  }
`

export const SEARCH_ISSUES_QUERY = gql`
  query SearchIssues($term: String!, $first: Int) {
    searchIssues(term: $term, first: $first) {
      nodes {
        ...IssueSearchResultItem
      }
    }
  }

  ${ISSUE_SEARCH_RESULT_ITEM_FRAGMENT}
`
