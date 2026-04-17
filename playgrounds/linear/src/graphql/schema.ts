import { buildSchema } from 'graphql'

export const schema = buildSchema(`
input ActivityCollectionFilter {
  and: [ActivityCollectionFilter!]
  createdAt: DateComparator
  every: ActivityFilter
  id: IDComparator
  length: NumberComparator
  or: [ActivityCollectionFilter!]
  some: ActivityFilter
  updatedAt: DateComparator
  user: UserFilter
}

input ActivityFilter {
  and: [ActivityFilter!]
  createdAt: DateComparator
  id: IDComparator
  or: [ActivityFilter!]
  updatedAt: DateComparator
  user: UserFilter
}

type ActorBot {
  avatarUrl: String
  id: ID
  name: String
  subType: String
  type: String!
  userDisplayName: String
}

type AgentActivity implements Node {
  agentSession: AgentSession!
  archivedAt: DateTime
  content: AgentActivityContent!
  contextualMetadata: JSON
  createdAt: DateTime!
  ephemeral: Boolean!
  id: ID!
  signal: AgentActivitySignal
  signalMetadata: JSON
  sourceComment: Comment
  sourceMetadata: JSON
  updatedAt: DateTime!
  user: User!
}

type AgentActivityActionContent {
  action: String!
  parameter: String!
  result: String
  resultData: JSONObject
  type: AgentActivityType!
}

type AgentActivityConnection {
  edges: [AgentActivityEdge!]!
  nodes: [AgentActivity!]!
  pageInfo: PageInfo!
}

union AgentActivityContent = AgentActivityActionContent | AgentActivityElicitationContent | AgentActivityErrorContent | AgentActivityPromptContent | AgentActivityResponseContent | AgentActivityThoughtContent

input AgentActivityCreateInput {
  agentSessionId: String!
  content: JSONObject!
  contextualMetadata: JSONObject
  ephemeral: Boolean
  id: String
  signal: AgentActivitySignal
  signalMetadata: JSONObject
}

input AgentActivityCreatePromptInput {
  agentSessionId: String!
  content: AgentActivityPromptCreateInputContent!
  contextualMetadata: JSONObject
  id: String
  signal: AgentActivitySignal
  signalMetadata: JSONObject
  sourceCommentId: String
}

type AgentActivityEdge {
  cursor: String!
  node: AgentActivity!
}

type AgentActivityElicitationContent {
  body: String!
  bodyData: JSONObject!
  type: AgentActivityType!
}

type AgentActivityErrorContent {
  body: String!
  bodyData: JSONObject!
  type: AgentActivityType!
}

input AgentActivityFilter {
  agentSessionId: StringComparator
  and: [AgentActivityFilter!]
  createdAt: DateComparator
  id: IDComparator
  or: [AgentActivityFilter!]
  sourceComment: NullableCommentFilter
  type: StringComparator
  updatedAt: DateComparator
}

type AgentActivityPayload {
  agentActivity: AgentActivity!
  lastSyncId: Float!
  success: Boolean!
}

type AgentActivityPromptContent {
  body: String!
  bodyData: JSONObject!
  type: AgentActivityType!
}

input AgentActivityPromptCreateInputContent {
  body: String
  bodyData: JSON
  type: AgentActivityType! = prompt
}

type AgentActivityResponseContent {
  body: String!
  bodyData: JSONObject!
  type: AgentActivityType!
}

enum AgentActivitySignal {
  auth
  continue
  select
  stop
}

type AgentActivityThoughtContent {
  body: String!
  bodyData: JSONObject!
  type: AgentActivityType!
}

enum AgentActivityType {
  action
  elicitation
  error
  prompt
  response
  thought
}

type AgentSession implements Node {
  activities(after: String, before: String, filter: AgentActivityFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): AgentActivityConnection!
  appUser: User!
  archivedAt: DateTime
  comment: Comment
  context: JSON!
  createdAt: DateTime!
  creator: User
  dismissedAt: DateTime
  dismissedBy: User
  endedAt: DateTime
  externalLink: String @deprecated(reason: "Use externalUrls instead.")
  externalLinks: [AgentSessionExternalLink!]!
  externalUrls: JSON! @deprecated(reason: "Use externalLinks instead.")
  id: ID!
  issue: Issue
  plan: JSON
  pullRequests(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): AgentSessionToPullRequestConnection!
  slugId: String!
  sourceComment: Comment
  sourceMetadata: JSON
  startedAt: DateTime
  status: AgentSessionStatus!
  summary: String
  type: AgentSessionType @deprecated(reason: "This field is slated for removal.")
  updatedAt: DateTime!
  url: String
}

type AgentSessionConnection {
  edges: [AgentSessionEdge!]!
  nodes: [AgentSession!]!
  pageInfo: PageInfo!
}

input AgentSessionCreateInput {
  appUserId: String!
  context: JSONObject
  id: String
  issueId: String
}

input AgentSessionCreateOnComment {
  commentId: String!
  externalLink: String
  externalUrls: [AgentSessionExternalUrlInput!]
}

input AgentSessionCreateOnIssue {
  externalLink: String
  externalUrls: [AgentSessionExternalUrlInput!]
  issueId: String!
}

type AgentSessionEdge {
  cursor: String!
  node: AgentSession!
}

type AgentSessionExternalLink {
  label: String!
  url: String!
}

input AgentSessionExternalUrlInput {
  label: String!
  url: String!
}

type AgentSessionPayload {
  agentSession: AgentSession!
  lastSyncId: Float!
  success: Boolean!
}

enum AgentSessionStatus {
  active
  awaitingInput
  complete
  error
  pending
  stale
}

type AgentSessionToPullRequest implements Node {
  agentSession: AgentSession!
  archivedAt: DateTime
  createdAt: DateTime!
  id: ID!
  pullRequest: PullRequest!
  updatedAt: DateTime!
}

type AgentSessionToPullRequestConnection {
  edges: [AgentSessionToPullRequestEdge!]!
  nodes: [AgentSessionToPullRequest!]!
  pageInfo: PageInfo!
}

type AgentSessionToPullRequestEdge {
  cursor: String!
  node: AgentSessionToPullRequest!
}

enum AgentSessionType {
  commentThread
}

input AgentSessionUpdateExternalUrlInput {
  addedExternalUrls: [AgentSessionExternalUrlInput!]
  externalLink: String
  externalUrls: [AgentSessionExternalUrlInput!]
  removedExternalUrls: [String!]
}

input AgentSessionUpdateInput {
  addedExternalUrls: [AgentSessionExternalUrlInput!]
  dismissedAt: DateTime
  externalLink: String
  externalUrls: [AgentSessionExternalUrlInput!]
  plan: JSONObject
  removedExternalUrls: [String!]
  userState: [AgentSessionUserStateInput!]
}

input AgentSessionUserStateInput {
  lastReadAt: DateTime
  userId: String!
}

type AiConversation implements Node {
  archivedAt: DateTime
  context: JSONObject!
  createdAt: DateTime!
  evalLogId: String
  id: ID!
  initialSource: AiConversationInitialSource!
  iterationId: String
  parts: [AiConversationPart!]
  readAt: DateTime
  slugId: String!
  status: AiConversationStatus!
  summary: String
  updatedAt: DateTime!
  user: User
  workflowDefinition: WorkflowDefinition
}

interface AiConversationBasePart {
  id: String!
  metadata: AiConversationPartMetadata!
  type: AiConversationPartType!
}

interface AiConversationBaseToolCall {
  displayInfo: AiConversationToolDisplayInfo!
  name: AiConversationTool!
  rawArgs: JSON
  rawResult: JSON
}

interface AiConversationBaseWidget {
  displayInfo: AiConversationWidgetDisplayInfo
  name: AiConversationWidgetName!
  rawArgs: JSON
}

type AiConversationCodeIntelligenceToolCall implements AiConversationBaseToolCall {
  args: AiConversationCodeIntelligenceToolCallArgs
  displayInfo: AiConversationToolDisplayInfo!
  name: AiConversationTool!
  rawArgs: JSON
  rawResult: JSON
}

type AiConversationCodeIntelligenceToolCallArgs {
  question: String!
}

type AiConversationCreateEntityToolCall implements AiConversationBaseToolCall {
  args: AiConversationCreateEntityToolCallArgs
  displayInfo: AiConversationToolDisplayInfo!
  name: AiConversationTool!
  rawArgs: JSON
  rawResult: JSON
}

type AiConversationCreateEntityToolCallArgs {
  count: Float
  type: String!
}

type AiConversationDeleteEntityToolCall implements AiConversationBaseToolCall {
  args: AiConversationDeleteEntityToolCallArgs
  displayInfo: AiConversationToolDisplayInfo!
  name: AiConversationTool!
  rawArgs: JSON
  rawResult: JSON
}

type AiConversationDeleteEntityToolCallArgs {
  entity: AiConversationSearchEntitiesToolCallResultEntities!
}

type AiConversationEntityCardWidget implements AiConversationBaseWidget {
  args: AiConversationEntityCardWidgetArgs
  displayInfo: AiConversationWidgetDisplayInfo
  name: AiConversationWidgetName!
  rawArgs: JSON
}

type AiConversationEntityCardWidgetArgs {
  action: AiConversationEntityCardWidgetArgsAction
  id: String!
  note: String @deprecated(reason: "Optional note to display about the entity")
  type: AiConversationEntityCardWidgetArgsType!
}

enum AiConversationEntityCardWidgetArgsAction {
  created
  updated
}

enum AiConversationEntityCardWidgetArgsType {
  AiPrompt
  CustomView
  Customer
  CustomerNeed
  Dashboard
  Document
  Initiative
  InitiativeUpdate
  Issue
  Project
  ProjectUpdate
  PullRequest
  Release
  ReleasePipeline
  Team
  Template
  WorkflowDefinition
}

type AiConversationEntityListWidget implements AiConversationBaseWidget {
  args: AiConversationEntityListWidgetArgs
  displayInfo: AiConversationWidgetDisplayInfo
  name: AiConversationWidgetName!
  rawArgs: JSON
}

type AiConversationEntityListWidgetArgs {
  action: AiConversationEntityListWidgetArgsAction
  count: Float
  entities: [AiConversationEntityListWidgetArgsEntities!]!
}

enum AiConversationEntityListWidgetArgsAction {
  created
  updated
}

type AiConversationEntityListWidgetArgsEntities {
  id: String!
  note: String @deprecated(reason: "Optional note to display about the entity")
  type: AiConversationEntityListWidgetArgsEntitiesType!
}

enum AiConversationEntityListWidgetArgsEntitiesType {
  AiPrompt
  CustomView
  Customer
  CustomerNeed
  Dashboard
  Document
  Initiative
  InitiativeUpdate
  Issue
  Project
  ProjectUpdate
  PullRequest
  Release
  ReleasePipeline
  Team
  Template
  WorkflowDefinition
}

type AiConversationGetMicrosoftTeamsConversationHistoryToolCall implements AiConversationBaseToolCall {
  displayInfo: AiConversationToolDisplayInfo!
  name: AiConversationTool!
  rawArgs: JSON
  rawResult: JSON
}

type AiConversationGetPullRequestDiffToolCall implements AiConversationBaseToolCall {
  args: AiConversationGetPullRequestDiffToolCallArgs
  displayInfo: AiConversationToolDisplayInfo!
  name: AiConversationTool!
  rawArgs: JSON
  rawResult: JSON
}

type AiConversationGetPullRequestDiffToolCallArgs {
  entity: AiConversationSearchEntitiesToolCallResultEntities!
}

type AiConversationGetPullRequestFileToolCall implements AiConversationBaseToolCall {
  args: AiConversationGetPullRequestFileToolCallArgs
  displayInfo: AiConversationToolDisplayInfo!
  name: AiConversationTool!
  rawArgs: JSON
  rawResult: JSON
}

type AiConversationGetPullRequestFileToolCallArgs {
  entity: AiConversationSearchEntitiesToolCallResultEntities!
  path: String!
}

type AiConversationGetSlackConversationHistoryToolCall implements AiConversationBaseToolCall {
  displayInfo: AiConversationToolDisplayInfo!
  name: AiConversationTool!
  rawArgs: JSON
  rawResult: JSON
}

type AiConversationHandoffToCodingSessionToolCall implements AiConversationBaseToolCall {
  args: AiConversationHandoffToCodingSessionToolCallArgs
  displayInfo: AiConversationToolDisplayInfo!
  name: AiConversationTool!
  rawArgs: JSON
  rawResult: JSON
}

type AiConversationHandoffToCodingSessionToolCallArgs {
  entity: AiConversationSearchEntitiesToolCallResultEntities!
  instructions: String
}

enum AiConversationInitialSource {
  comment
  directChat
  mcp
  microsoftTeams
  pullRequestComment
  slack
  workflow
}

type AiConversationInvokeMcpToolToolCall implements AiConversationBaseToolCall {
  args: AiConversationInvokeMcpToolToolCallArgs
  displayInfo: AiConversationToolDisplayInfo!
  name: AiConversationTool!
  rawArgs: JSON
  rawResult: JSON
}

type AiConversationInvokeMcpToolToolCallArgs {
  server: AiConversationInvokeMcpToolToolCallArgsServer!
  tool: AiConversationInvokeMcpToolToolCallArgsTool!
}

type AiConversationInvokeMcpToolToolCallArgsServer {
  integrationId: String!
  name: String!
  title: String
}

type AiConversationInvokeMcpToolToolCallArgsTool {
  name: String!
  title: String
}

type AiConversationNavigateToPageToolCall implements AiConversationBaseToolCall {
  args: AiConversationNavigateToPageToolCallArgs
  displayInfo: AiConversationToolDisplayInfo!
  name: AiConversationTool!
  rawArgs: JSON
  rawResult: JSON
  result: AiConversationNavigateToPageToolCallResult
}

type AiConversationNavigateToPageToolCallArgs {
  entityType: String
  identifier: String
}

type AiConversationNavigateToPageToolCallResult {
  newTab: Boolean
  url: String!
}

union AiConversationPart = AiConversationPromptPart | AiConversationReasoningPart | AiConversationTextPart | AiConversationToolCallPart | AiConversationWidgetPart

type AiConversationPartMetadata {
  endedAt: String
  evalLogId: String
  feedback: JSONObject
  phase: AiConversationPartPhase
  startedAt: String
  turnId: String!
}

enum AiConversationPartPhase {
  answer
  commentary
}

enum AiConversationPartType {
  prompt
  reasoning
  text
  toolCall
  widget
  widgetPlaceholder
}

type AiConversationPromptPart implements AiConversationBasePart {
  body: String!
  bodyData: JSONObject!
  id: String!
  metadata: AiConversationPartMetadata!
  type: AiConversationPartType!
  user: User
}

type AiConversationQueryActivityToolCall implements AiConversationBaseToolCall {
  args: AiConversationQueryActivityToolCallArgs
  displayInfo: AiConversationToolDisplayInfo!
  name: AiConversationTool!
  rawArgs: JSON
  rawResult: JSON
}

type AiConversationQueryActivityToolCallArgs {
  entities: [AiConversationSearchEntitiesToolCallResultEntities!]
}

type AiConversationQueryUpdatesToolCall implements AiConversationBaseToolCall {
  args: AiConversationQueryUpdatesToolCallArgs
  displayInfo: AiConversationToolDisplayInfo!
  name: AiConversationTool!
  rawArgs: JSON
  rawResult: JSON
}

type AiConversationQueryUpdatesToolCallArgs {
  entity: AiConversationSearchEntitiesToolCallResultEntities
  updateType: AiConversationQueryUpdatesToolCallArgsUpdateType!
}

enum AiConversationQueryUpdatesToolCallArgsUpdateType {
  InitiativeUpdate
  ProjectUpdate
}

type AiConversationQueryViewToolCall implements AiConversationBaseToolCall {
  args: AiConversationQueryViewToolCallArgs
  displayInfo: AiConversationToolDisplayInfo!
  name: AiConversationTool!
  rawArgs: JSON
  rawResult: JSON
}

type AiConversationQueryViewToolCallArgs {
  filter: String
  mode: AiConversationQueryViewToolCallArgsMode!
  view: AiConversationQueryViewToolCallArgsView!
}

enum AiConversationQueryViewToolCallArgsMode {
  insight
  list
}

type AiConversationQueryViewToolCallArgsView {
  group: AiConversationSearchEntitiesToolCallResultEntities
  predefinedView: String
  type: String!
}

type AiConversationReasoningPart implements AiConversationBasePart {
  body: String!
  bodyData: JSONObject!
  id: String!
  metadata: AiConversationPartMetadata!
  title: String
  type: AiConversationPartType!
}

type AiConversationResearchToolCall implements AiConversationBaseToolCall {
  args: AiConversationResearchToolCallArgs
  displayInfo: AiConversationToolDisplayInfo!
  name: AiConversationTool!
  rawArgs: JSON
  rawResult: JSON
  result: AiConversationResearchToolCallResult
}

type AiConversationResearchToolCallArgs {
  context: String!
  query: String!
  subjects: [AiConversationSearchEntitiesToolCallResultEntities!]
}

type AiConversationResearchToolCallResult {
  progressId: String
}

type AiConversationRestoreEntityToolCall implements AiConversationBaseToolCall {
  args: AiConversationRestoreEntityToolCallArgs
  displayInfo: AiConversationToolDisplayInfo!
  name: AiConversationTool!
  rawArgs: JSON
  rawResult: JSON
}

type AiConversationRestoreEntityToolCallArgs {
  entity: AiConversationSearchEntitiesToolCallResultEntities!
}

type AiConversationRetrieveEntitiesToolCall implements AiConversationBaseToolCall {
  args: AiConversationRetrieveEntitiesToolCallArgs
  displayInfo: AiConversationToolDisplayInfo!
  name: AiConversationTool!
  rawArgs: JSON
  rawResult: JSON
}

type AiConversationRetrieveEntitiesToolCallArgs {
  entities: [AiConversationSearchEntitiesToolCallResultEntities!]!
}

type AiConversationSearchDocumentationToolCall implements AiConversationBaseToolCall {
  displayInfo: AiConversationToolDisplayInfo!
  name: AiConversationTool!
  rawArgs: JSON
  rawResult: JSON
}

type AiConversationSearchEntitiesToolCall implements AiConversationBaseToolCall {
  args: AiConversationSearchEntitiesToolCallArgs
  displayInfo: AiConversationToolDisplayInfo!
  name: AiConversationTool!
  rawArgs: JSON
  rawResult: JSON
  result: AiConversationSearchEntitiesToolCallResult
}

type AiConversationSearchEntitiesToolCallArgs {
  queries: [String!]!
  type: String
}

type AiConversationSearchEntitiesToolCallResult {
  entities: [AiConversationSearchEntitiesToolCallResultEntities!]!
}

type AiConversationSearchEntitiesToolCallResultEntities {
  id: String!
  type: String!
}

enum AiConversationStatus {
  active
  awaitingInput
  complete
  error
  pending
}

type AiConversationSuggestValuesToolCall implements AiConversationBaseToolCall {
  args: AiConversationSuggestValuesToolCallArgs
  displayInfo: AiConversationToolDisplayInfo!
  name: AiConversationTool!
  rawArgs: JSON
  rawResult: JSON
}

type AiConversationSuggestValuesToolCallArgs {
  field: String!
  query: String
}

type AiConversationTextPart implements AiConversationBasePart {
  body: String!
  bodyData: JSONObject!
  id: String!
  metadata: AiConversationPartMetadata!
  type: AiConversationPartType!
}

enum AiConversationTool {
  CodeIntelligence
  CreateEntity
  DeleteEntity
  GetMicrosoftTeamsConversationHistory
  GetPullRequestDiff
  GetPullRequestFile
  GetSlackConversationHistory
  HandoffToCodingSession
  InvokeMcpTool
  NavigateToPage
  QueryActivity
  QueryUpdates
  QueryView
  Research
  RestoreEntity
  RetrieveEntities
  SearchDocumentation
  SearchEntities
  SuggestValues
  TranscribeMedia
  TranscribeVideo
  UpdateEntity
  WebSearch
}

union AiConversationToolCall = AiConversationCodeIntelligenceToolCall | AiConversationCreateEntityToolCall | AiConversationDeleteEntityToolCall | AiConversationGetMicrosoftTeamsConversationHistoryToolCall | AiConversationGetPullRequestDiffToolCall | AiConversationGetPullRequestFileToolCall | AiConversationGetSlackConversationHistoryToolCall | AiConversationHandoffToCodingSessionToolCall | AiConversationInvokeMcpToolToolCall | AiConversationNavigateToPageToolCall | AiConversationQueryActivityToolCall | AiConversationQueryUpdatesToolCall | AiConversationQueryViewToolCall | AiConversationResearchToolCall | AiConversationRestoreEntityToolCall | AiConversationRetrieveEntitiesToolCall | AiConversationSearchDocumentationToolCall | AiConversationSearchEntitiesToolCall | AiConversationSuggestValuesToolCall | AiConversationTranscribeMediaToolCall | AiConversationTranscribeVideoToolCall | AiConversationUpdateEntityToolCall | AiConversationWebSearchToolCall

type AiConversationToolCallPart implements AiConversationBasePart {
  id: String!
  metadata: AiConversationPartMetadata!
  toolCall: AiConversationToolCall!
  type: AiConversationPartType!
}

type AiConversationToolDisplayInfo {
  activeLabel: String!
  detail: String
  icon: String!
  inactiveLabel: String!
  result: String
}

type AiConversationTranscribeMediaToolCall implements AiConversationBaseToolCall {
  displayInfo: AiConversationToolDisplayInfo!
  name: AiConversationTool!
  rawArgs: JSON
  rawResult: JSON
}

type AiConversationTranscribeVideoToolCall implements AiConversationBaseToolCall {
  displayInfo: AiConversationToolDisplayInfo!
  name: AiConversationTool!
  rawArgs: JSON
  rawResult: JSON
}

type AiConversationUpdateEntityToolCall implements AiConversationBaseToolCall {
  args: AiConversationUpdateEntityToolCallArgs
  displayInfo: AiConversationToolDisplayInfo!
  name: AiConversationTool!
  rawArgs: JSON
  rawResult: JSON
}

type AiConversationUpdateEntityToolCallArgs {
  entities: [AiConversationSearchEntitiesToolCallResultEntities!]
  entity: AiConversationSearchEntitiesToolCallResultEntities
}

type AiConversationWebSearchToolCall implements AiConversationBaseToolCall {
  args: AiConversationWebSearchToolCallArgs
  displayInfo: AiConversationToolDisplayInfo!
  name: AiConversationTool!
  rawArgs: JSON
  rawResult: JSON
}

type AiConversationWebSearchToolCallArgs {
  query: String
  url: String
}

union AiConversationWidget = AiConversationEntityCardWidget | AiConversationEntityListWidget

type AiConversationWidgetDisplayInfo {
  body: String!
  bodyData: JSONObject!
}

enum AiConversationWidgetName {
  EntityCard
  EntityList
}

type AiConversationWidgetPart implements AiConversationBasePart {
  id: String!
  metadata: AiConversationPartMetadata!
  type: AiConversationPartType!
  widget: AiConversationWidget!
}

type AiPromptProgress implements Node {
  archivedAt: DateTime
  createdAt: DateTime!
  id: ID!
  logId: String
  metadata: JSONObject!
  status: AiPromptProgressStatus!
  type: AiPromptType!
  updatedAt: DateTime!
}

type AiPromptProgressConnection {
  edges: [AiPromptProgressEdge!]!
  nodes: [AiPromptProgress!]!
  pageInfo: PageInfo!
}

type AiPromptProgressEdge {
  cursor: String!
  node: AiPromptProgress!
}

input AiPromptProgressFilter {
  and: [AiPromptProgressFilter!]
  createdAt: DateComparator
  id: IDComparator
  or: [AiPromptProgressFilter!]
  status: AiPromptProgressStatusComparator
  type: AiPromptTypeComparator
  updatedAt: DateComparator
}

enum AiPromptProgressStatus {
  canceled
  created
  failed
  finished
  inProgress
}

input AiPromptProgressStatusComparator {
  eq: AiPromptProgressStatus
  in: [AiPromptProgressStatus!]
  neq: AiPromptProgressStatus
  nin: [AiPromptProgressStatus!]
  null: Boolean
}

input AiPromptProgressSubscriptionFilter {
  commentId: IDComparator
  issueId: IDComparator
  pullRequestCommentId: IDComparator
  status: AiPromptProgressStatusComparator
  type: AiPromptTypeComparator
}

type AiPromptRules implements Node {
  archivedAt: DateTime
  createdAt: DateTime!
  id: ID!
  updatedAt: DateTime!
  updatedBy: User
}

enum AiPromptType {
  agentGuidance
  aiConversation
  codeIntelligence
  gongIssueIntake
  initiativeUpdates
  intercomIssueIntake
  internalResearch
  microsoftTeamsIssueIntake
  productIntelligence
  projectUpdates
  slackIssueIntake
  zendeskIssueIntake
}

input AiPromptTypeComparator {
  eq: AiPromptType
  in: [AiPromptType!]
  neq: AiPromptType
  nin: [AiPromptType!]
  null: Boolean
}

input AirbyteConfigurationInput {
  apiKey: String!
}

type Application {
  clientId: String!
  description: String
  developer: String!
  developerUrl: String!
  id: String!
  imageUrl: String
  name: String!
}

input ApproximateNeedCountSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

interface ArchivePayload {
  lastSyncId: Float!
  success: Boolean!
}

type ArchiveResponse {
  archive: String!
  databaseVersion: Float!
  includesDependencies: [String!]!
  totalCount: Float!
}

type AsksChannelConnectPayload {
  addBot: Boolean!
  integration: Integration
  lastSyncId: Float!
  mapping: SlackChannelNameMapping!
  success: Boolean!
}

input AssigneeSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

type Attachment implements Node {
  archivedAt: DateTime
  bodyData: String
  createdAt: DateTime!
  creator: User
  externalUserCreator: ExternalUser
  groupBySource: Boolean!
  id: ID!
  issue: Issue!
  metadata: JSONObject!
  originalIssue: Issue
  source: JSONObject
  sourceType: String
  subtitle: String
  title: String!
  updatedAt: DateTime!
  url: String!
}

input AttachmentCollectionFilter {
  and: [AttachmentCollectionFilter!]
  createdAt: DateComparator
  creator: NullableUserFilter
  every: AttachmentFilter
  id: IDComparator
  length: NumberComparator
  or: [AttachmentCollectionFilter!]
  some: AttachmentFilter
  sourceType: SourceTypeComparator
  subtitle: NullableStringComparator
  title: StringComparator
  updatedAt: DateComparator
  url: StringComparator
}

type AttachmentConnection {
  edges: [AttachmentEdge!]!
  nodes: [Attachment!]!
  pageInfo: PageInfo!
}

input AttachmentCreateInput {
  commentBody: String
  commentBodyData: JSONObject
  createAsUser: String
  groupBySource: Boolean
  iconUrl: String
  id: String
  issueId: String!
  metadata: JSONObject
  subtitle: String
  title: String!
  url: String!
}

type AttachmentEdge {
  cursor: String!
  node: Attachment!
}

input AttachmentFilter {
  and: [AttachmentFilter!]
  createdAt: DateComparator
  creator: NullableUserFilter
  id: IDComparator
  or: [AttachmentFilter!]
  sourceType: SourceTypeComparator
  subtitle: NullableStringComparator
  title: StringComparator
  updatedAt: DateComparator
  url: StringComparator
}

type AttachmentPayload {
  attachment: Attachment!
  lastSyncId: Float!
  success: Boolean!
}

type AttachmentSourcesPayload {
  sources: JSONObject!
}

input AttachmentUpdateInput {
  iconUrl: String
  metadata: JSONObject
  subtitle: String
  title: String!
}

type AuditEntry implements Node {
  actor: User
  actorId: String
  archivedAt: DateTime
  countryCode: String
  createdAt: DateTime!
  id: ID!
  ip: String
  metadata: JSONObject
  organization: Organization
  requestInformation: JSONObject
  type: String!
  updatedAt: DateTime!
}

type AuditEntryConnection {
  edges: [AuditEntryEdge!]!
  nodes: [AuditEntry!]!
  pageInfo: PageInfo!
}

type AuditEntryEdge {
  cursor: String!
  node: AuditEntry!
}

input AuditEntryFilter {
  actor: NullableUserFilter
  and: [AuditEntryFilter!]
  countryCode: StringComparator
  createdAt: DateComparator
  id: IDComparator
  ip: StringComparator
  or: [AuditEntryFilter!]
  type: StringComparator
  updatedAt: DateComparator
}

type AuditEntryType {
  description: String!
  type: String!
}

type AuthIdentityProvider {
  createdAt: DateTime!
  defaultMigrated: Boolean!
  id: ID!
  issuerEntityId: String
  priority: Float
  samlEnabled: Boolean!
  scimEnabled: Boolean!
  spEntityId: String
  ssoBinding: String
  ssoEndpoint: String
  ssoSignAlgo: String
  ssoSigningCert: String
  type: IdentityProviderType!
}

type AuthOrganization {
  allowedAuthServices: [String!]! @deprecated(reason: "Use authSettings.allowedAuthServices instead.")
  approximateUserCount: Float!
  authSettings: JSONObject!
  createdAt: DateTime!
  deletionRequestedAt: DateTime
  enabled: Boolean!
  hideNonPrimaryOrganizations: Boolean!
  id: ID!
  logoUrl: String
  name: String!
  previousUrlKeys: [String!]!
  region: String!
  releaseChannel: ReleaseChannel!
  samlEnabled: Boolean!
  samlSettings: JSONObject
  scimEnabled: Boolean!
  serviceId: String!
  urlKey: String!
  userCount: Float
}

type AuthResolverResponse {
  allowDomainAccess: Boolean
  availableOrganizations: [AuthOrganization!]
  email: String!
  id: String!
  lastUsedOrganizationId: String
  lockedOrganizations: [AuthOrganization!]
  lockedUsers: [AuthUser!]!
  service: String
  token: String @deprecated(reason: "Deprecated and not used anymore. Never populated.")
  users: [AuthUser!]!
}

type AuthUser {
  active: Boolean!
  avatarUrl: String
  createdAt: DateTime!
  displayName: String!
  email: String!
  id: ID!
  identityProvider: AuthIdentityProvider
  name: String!
  organization: AuthOrganization!
  role: UserRoleType!
  userAccountId: String!
}

type AuthenticationSessionResponse {
  browserType: String
  client: String
  countryCodes: [String!]!
  createdAt: DateTime!
  detailedName: String!
  id: String!
  ip: String
  isCurrentSession: Boolean!
  lastActiveAt: DateTime
  location: String
  locationCity: String
  locationCountry: String
  locationCountryCode: String
  locationRegionCode: String
  name: String!
  operatingSystem: String
  service: String
  type: AuthenticationSessionType!
  updatedAt: DateTime!
  userAgent: String
}

enum AuthenticationSessionType {
  android
  desktop
  ios
  web
}

input BooleanComparator {
  eq: Boolean
  neq: Boolean
}

input CandidateRepository {
  hostname: String!
  repositoryFullName: String!
}

type CodingAgentSandboxEntry {
  baseRef: String
  branchName: String
  createdAt: DateTime!
  creatorId: String
  endedAt: DateTime
  id: String!
  repository: String!
  sandboxLogsUrl: String
  sandboxUrl: String
  startedAt: DateTime
  workerConversationId: String
}

type CodingAgentSandboxPayload {
  agentSessionId: String!
  datadogLogsUrl: String
  sandboxes: [CodingAgentSandboxEntry!]!
  temporalWorkflowsUrl: String
}

type Comment implements Node {
  agentSession: AgentSession
  agentSessions(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): AgentSessionConnection!
  aiPromptProgresses(after: String, before: String, filter: AiPromptProgressFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): AiPromptProgressConnection!
  archivedAt: DateTime
  body: String!
  bodyData: String!
  botActor: ActorBot
  children(after: String, before: String, filter: CommentFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): CommentConnection!
  createdAt: DateTime!
  createdIssues(after: String, before: String, filter: IssueFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): IssueConnection!
  documentContent: DocumentContent
  documentContentId: String
  editedAt: DateTime
  externalThread: SyncedExternalThread
  externalUser: ExternalUser
  hideInLinear: Boolean!
  id: ID!
  initiative: Initiative
  initiativeId: String
  initiativeUpdate: InitiativeUpdate
  initiativeUpdateId: String
  isArtificialAgentSessionRoot: Boolean!
  issue: Issue
  issueId: String
  onBehalfOf: User
  parent: Comment
  parentId: String
  post: Post
  project: Project
  projectId: String
  projectUpdate: ProjectUpdate
  projectUpdateId: String
  quotedText: String
  reactionData: JSONObject!
  reactions: [Reaction!]!
  resolvedAt: DateTime
  resolvingComment: Comment
  resolvingCommentId: String
  resolvingUser: User
  spawnedAgentSessions(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): AgentSessionConnection!
  syncedWith: [ExternalEntityInfo!]
  threadSummary: JSONObject
  updatedAt: DateTime!
  url: String!
  user: User
}

input CommentCollectionFilter {
  and: [CommentCollectionFilter!]
  body: StringComparator
  createdAt: DateComparator
  documentContent: NullableDocumentContentFilter
  every: CommentFilter
  id: IDComparator
  initiative: NullableInitiativeFilter
  issue: NullableIssueFilter
  length: NumberComparator
  needs: CustomerNeedCollectionFilter
  or: [CommentCollectionFilter!]
  parent: NullableCommentFilter
  project: NullableProjectFilter
  projectUpdate: NullableProjectUpdateFilter
  reactions: ReactionCollectionFilter
  some: CommentFilter
  updatedAt: DateComparator
  user: UserFilter
}

type CommentConnection {
  edges: [CommentEdge!]!
  nodes: [Comment!]!
  pageInfo: PageInfo!
}

input CommentCreateInput {
  body: String
  bodyData: JSON
  createAsUser: String
  createOnSyncedSlackThread: Boolean
  createdAt: DateTime
  displayIconUrl: String
  doNotSubscribeToIssue: Boolean
  documentContentId: String
  id: String
  initiativeId: String
  initiativeUpdateId: String
  issueId: String
  parentId: String
  postId: String
  projectId: String
  projectUpdateId: String
  quotedText: String
  subscriberIds: [String!]
}

type CommentEdge {
  cursor: String!
  node: Comment!
}

input CommentFilter {
  and: [CommentFilter!]
  body: StringComparator
  createdAt: DateComparator
  documentContent: NullableDocumentContentFilter
  id: IDComparator
  initiative: NullableInitiativeFilter
  issue: NullableIssueFilter
  needs: CustomerNeedCollectionFilter
  or: [CommentFilter!]
  parent: NullableCommentFilter
  project: NullableProjectFilter
  projectUpdate: NullableProjectUpdateFilter
  reactions: ReactionCollectionFilter
  updatedAt: DateComparator
  user: UserFilter
}

type CommentPayload {
  comment: Comment!
  lastSyncId: Float!
  success: Boolean!
}

input CommentUpdateInput {
  body: String
  bodyData: JSON
  doNotSubscribeToIssue: Boolean
  quotedText: String
  resolvingCommentId: String
  resolvingUserId: String
  subscriberIds: [String!]
}

input CompletedAtSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

input ContactCreateInput {
  browser: String
  clientVersion: String
  device: String
  disappointmentRating: Int
  message: String!
  operatingSystem: String
  type: String!
}

type ContactPayload {
  success: Boolean!
}

input ContactSalesCreateInput {
  companySize: String
  distinctId: String
  email: String!
  message: String
  name: String!
  sessionId: String
  url: String
}

input ContentComparator {
  contains: String
  notContains: String
}

enum ContextViewType {
  activeCycle
  activeIssues
  backlog
  triage
  upcomingCycle
}

type CreateCsvExportReportPayload {
  success: Boolean!
}

type CreateOrJoinOrganizationResponse {
  organization: AuthOrganization!
  user: AuthUser!
}

input CreateOrganizationInput {
  domainAccess: Boolean
  name: String!
  timezone: String
  urlKey: String!
  utm: String
}

input CreatedAtSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

type CustomView implements Node {
  archivedAt: DateTime
  color: String
  createdAt: DateTime!
  creator: User!
  description: String
  facet: Facet
  feedItemFilterData: JSONObject
  filterData: JSONObject!
  filters: JSONObject! @deprecated(reason: "Will be replaced by \`filterData\` in a future update")
  icon: String
  id: ID!
  initiativeFilterData: JSONObject
  initiatives(after: String, before: String, filter: InitiativeFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): InitiativeConnection!
  issues(after: String, before: String, filter: IssueFilter, first: Int, includeArchived: Boolean, includeSubTeams: Boolean = false, last: Int, orderBy: PaginationOrderBy, sort: [IssueSortInput!]): IssueConnection!
  modelName: String!
  name: String!
  organization: Organization!
  organizationViewPreferences: ViewPreferences
  owner: User!
  projectFilterData: JSONObject
  projects(after: String, before: String, filter: ProjectFilter, first: Int, includeArchived: Boolean, includeSubTeams: Boolean = true, last: Int, orderBy: PaginationOrderBy, sort: [ProjectSortInput!]): ProjectConnection!
  shared: Boolean!
  slugId: String!
  team: Team
  updatedAt: DateTime!
  updatedBy: User
  updates(after: String, before: String, filter: FeedItemFilter, first: Int, includeArchived: Boolean, includeSubTeams: Boolean = false, last: Int, orderBy: PaginationOrderBy): FeedItemConnection!
  userViewPreferences: ViewPreferences
  viewPreferencesValues: ViewPreferencesValues
}

type CustomViewConnection {
  edges: [CustomViewEdge!]!
  nodes: [CustomView!]!
  pageInfo: PageInfo!
}

input CustomViewCreateInput {
  color: String
  description: String
  feedItemFilterData: FeedItemFilter
  filterData: IssueFilter
  icon: String
  id: String
  initiativeFilterData: InitiativeFilter
  initiativeId: String
  name: String!
  ownerId: String
  projectFilterData: ProjectFilter
  projectId: String
  shared: Boolean
  teamId: String
}

input CustomViewCreatedAtSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

type CustomViewEdge {
  cursor: String!
  node: CustomView!
}

input CustomViewFilter {
  and: [CustomViewFilter!]
  createdAt: DateComparator
  creator: UserFilter
  hasFacet: Boolean
  id: IDComparator
  modelName: StringComparator
  name: StringComparator
  or: [CustomViewFilter!]
  shared: BooleanComparator
  team: NullableTeamFilter
  updatedAt: DateComparator
}

type CustomViewHasSubscribersPayload {
  hasSubscribers: Boolean!
}

input CustomViewNameSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

type CustomViewNotificationSubscription implements Entity & Node & NotificationSubscription {
  active: Boolean!
  archivedAt: DateTime
  contextViewType: ContextViewType
  createdAt: DateTime!
  customView: CustomView!
  customer: Customer
  cycle: Cycle
  id: ID!
  initiative: Initiative
  label: IssueLabel
  notificationSubscriptionTypes: [String!]!
  project: Project
  subscriber: User!
  team: Team
  updatedAt: DateTime!
  user: User
  userContextViewType: UserContextViewType
}

type CustomViewPayload {
  customView: CustomView!
  lastSyncId: Float!
  success: Boolean!
}

input CustomViewSharedSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

input CustomViewSortInput {
  createdAt: CustomViewCreatedAtSort
  name: CustomViewNameSort
  shared: CustomViewSharedSort
  updatedAt: CustomViewUpdatedAtSort
}

type CustomViewSuggestionPayload {
  description: String
  icon: String
  name: String
}

input CustomViewUpdateInput {
  color: String
  description: String
  feedItemFilterData: FeedItemFilter
  filterData: IssueFilter
  icon: String
  initiativeFilterData: InitiativeFilter
  initiativeId: String
  name: String
  ownerId: String
  projectFilterData: ProjectFilter
  projectId: String
  shared: Boolean
  teamId: String
}

input CustomViewUpdatedAtSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

type Customer implements Node {
  approximateNeedCount: Float!
  archivedAt: DateTime
  createdAt: DateTime!
  domains: [String!]!
  externalIds: [String!]!
  id: ID!
  integration: Integration
  logoUrl: String
  mainSourceId: String
  name: String!
  needs: [CustomerNeed!]!
  owner: User
  revenue: Int
  size: Float
  slackChannelId: String
  slugId: String!
  status: CustomerStatus!
  tier: CustomerTier
  updatedAt: DateTime!
  url: String!
}

type CustomerConnection {
  edges: [CustomerEdge!]!
  nodes: [Customer!]!
  pageInfo: PageInfo!
}

input CustomerCountSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

input CustomerCreateInput {
  domains: [String!] = []
  externalIds: [String!] = []
  id: String
  logoUrl: String
  mainSourceId: String
  name: String!
  ownerId: String
  revenue: Int
  size: Int
  slackChannelId: String
  statusId: String
  tierId: String
}

input CustomerCreatedAtSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

type CustomerEdge {
  cursor: String!
  node: Customer!
}

input CustomerFilter {
  and: [CustomerFilter!]
  createdAt: DateComparator
  domains: StringArrayComparator
  externalIds: StringArrayComparator
  id: IDComparator
  name: StringComparator
  needs: CustomerNeedCollectionFilter
  or: [CustomerFilter!]
  owner: NullableUserFilter
  revenue: NumberComparator
  size: NumberComparator
  slackChannelId: StringComparator
  status: CustomerStatusFilter
  tier: CustomerTierFilter
  updatedAt: DateComparator
}

input CustomerImportantCountSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

type CustomerNeed implements Node {
  archivedAt: DateTime
  attachment: Attachment
  body: String
  bodyData: String
  comment: Comment
  createdAt: DateTime!
  creator: User
  customer: Customer
  id: ID!
  issue: Issue
  originalIssue: Issue
  priority: Float!
  project: Project
  projectAttachment: ProjectAttachment
  updatedAt: DateTime!
  url: String
}

type CustomerNeedArchivePayload implements ArchivePayload {
  entity: CustomerNeed
  lastSyncId: Float!
  success: Boolean!
}

input CustomerNeedCollectionFilter {
  and: [CustomerNeedCollectionFilter!]
  comment: NullableCommentFilter
  createdAt: DateComparator
  customer: NullableCustomerFilter
  every: CustomerNeedFilter
  id: IDComparator
  issue: NullableIssueFilter
  length: NumberComparator
  or: [CustomerNeedCollectionFilter!]
  priority: NumberComparator
  project: NullableProjectFilter
  some: CustomerNeedFilter
  updatedAt: DateComparator
}

type CustomerNeedConnection {
  edges: [CustomerNeedEdge!]!
  nodes: [CustomerNeed!]!
  pageInfo: PageInfo!
}

input CustomerNeedCreateFromAttachmentInput {
  attachmentId: String!
}

input CustomerNeedCreateInput {
  attachmentId: String
  attachmentUrl: String
  body: String
  bodyData: JSON
  commentId: String
  createAsUser: String
  customerExternalId: String
  customerId: String
  displayIconUrl: String
  id: String
  issueId: String
  priority: Float
  projectId: String
}

type CustomerNeedEdge {
  cursor: String!
  node: CustomerNeed!
}

input CustomerNeedFilter {
  and: [CustomerNeedFilter!]
  comment: NullableCommentFilter
  createdAt: DateComparator
  customer: NullableCustomerFilter
  id: IDComparator
  issue: NullableIssueFilter
  or: [CustomerNeedFilter!]
  priority: NumberComparator
  project: NullableProjectFilter
  updatedAt: DateComparator
}

type CustomerNeedNotification implements Entity & Node & Notification {
  actor: User
  actorAvatarColor: String!
  actorAvatarUrl: String
  actorInitials: String
  archivedAt: DateTime
  botActor: ActorBot
  category: NotificationCategory!
  createdAt: DateTime!
  customerNeed: CustomerNeed!
  customerNeedId: String!
  emailedAt: DateTime
  externalUserActor: ExternalUser
  groupingKey: String!
  groupingPriority: Float!
  id: ID!
  inboxUrl: String!
  initiativeUpdateHealth: String
  isLinearActor: Boolean!
  issueStatusType: String
  projectUpdateHealth: String
  readAt: DateTime
  relatedIssue: Issue
  relatedProject: Project
  snoozedUntilAt: DateTime
  subtitle: String!
  title: String!
  type: String!
  unsnoozedAt: DateTime
  updatedAt: DateTime!
  url: String!
  user: User!
}

type CustomerNeedPayload {
  lastSyncId: Float!
  need: CustomerNeed!
  success: Boolean!
}

input CustomerNeedUpdateInput {
  applyPriorityToRelatedNeeds: Boolean
  attachmentUrl: String
  body: String
  bodyData: JSON
  customerExternalId: String
  customerId: String
  id: String
  issueId: String
  priority: Float
  projectId: String
}

type CustomerNeedUpdatePayload {
  lastSyncId: Float!
  need: CustomerNeed!
  success: Boolean!
  updatedRelatedNeeds: [CustomerNeed!]!
}

type CustomerNotification implements Entity & Node & Notification {
  actor: User
  actorAvatarColor: String!
  actorAvatarUrl: String
  actorInitials: String
  archivedAt: DateTime
  botActor: ActorBot
  category: NotificationCategory!
  createdAt: DateTime!
  customer: Customer!
  customerId: String!
  emailedAt: DateTime
  externalUserActor: ExternalUser
  groupingKey: String!
  groupingPriority: Float!
  id: ID!
  inboxUrl: String!
  initiativeUpdateHealth: String
  isLinearActor: Boolean!
  issueStatusType: String
  projectUpdateHealth: String
  readAt: DateTime
  snoozedUntilAt: DateTime
  subtitle: String!
  title: String!
  type: String!
  unsnoozedAt: DateTime
  updatedAt: DateTime!
  url: String!
  user: User!
}

type CustomerNotificationSubscription implements Entity & Node & NotificationSubscription {
  active: Boolean!
  archivedAt: DateTime
  contextViewType: ContextViewType
  createdAt: DateTime!
  customView: CustomView
  customer: Customer!
  cycle: Cycle
  id: ID!
  initiative: Initiative
  label: IssueLabel
  notificationSubscriptionTypes: [String!]!
  project: Project
  subscriber: User!
  team: Team
  updatedAt: DateTime!
  user: User
  userContextViewType: UserContextViewType
}

type CustomerPayload {
  customer: Customer!
  lastSyncId: Float!
  success: Boolean!
}

input CustomerRevenueSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

input CustomerSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

input CustomerSortInput {
  approximateNeedCount: ApproximateNeedCountSort
  createdAt: CustomerCreatedAtSort
  name: NameSort
  owner: OwnerSort
  revenue: RevenueSort
  size: SizeSort
  status: CustomerStatusSort
  tier: TierSort
}

type CustomerStatus implements Node {
  archivedAt: DateTime
  color: String!
  createdAt: DateTime!
  description: String
  displayName: String!
  id: ID!
  name: String!
  position: Float!
  type: CustomerStatusType @deprecated(reason: "Customer statuses are no longer grouped by type.")
  updatedAt: DateTime!
}

type CustomerStatusConnection {
  edges: [CustomerStatusEdge!]!
  nodes: [CustomerStatus!]!
  pageInfo: PageInfo!
}

input CustomerStatusCreateInput {
  color: String!
  description: String
  displayName: String
  id: String
  name: String
  position: Float
}

type CustomerStatusEdge {
  cursor: String!
  node: CustomerStatus!
}

input CustomerStatusFilter {
  and: [CustomerStatusFilter!]
  color: StringComparator
  createdAt: DateComparator
  description: StringComparator
  id: IDComparator
  name: StringComparator
  or: [CustomerStatusFilter!]
  position: NumberComparator
  type: StringComparator
  updatedAt: DateComparator
}

type CustomerStatusPayload {
  lastSyncId: Float!
  status: CustomerStatus!
  success: Boolean!
}

input CustomerStatusSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

enum CustomerStatusType {
  active
  inactive
}

input CustomerStatusUpdateInput {
  color: String
  description: String
  displayName: String
  name: String
  position: Float
}

type CustomerTier implements Node {
  archivedAt: DateTime
  color: String!
  createdAt: DateTime!
  description: String
  displayName: String!
  id: ID!
  name: String!
  position: Float!
  updatedAt: DateTime!
}

type CustomerTierConnection {
  edges: [CustomerTierEdge!]!
  nodes: [CustomerTier!]!
  pageInfo: PageInfo!
}

input CustomerTierCreateInput {
  color: String!
  description: String
  displayName: String
  id: String
  name: String
  position: Float
}

type CustomerTierEdge {
  cursor: String!
  node: CustomerTier!
}

input CustomerTierFilter {
  and: [CustomerTierFilter!]
  color: StringComparator
  createdAt: DateComparator
  description: StringComparator
  displayName: StringComparator
  id: IDComparator
  or: [CustomerTierFilter!]
  position: NumberComparator
  updatedAt: DateComparator
}

type CustomerTierPayload {
  lastSyncId: Float!
  success: Boolean!
  tier: CustomerTier!
}

input CustomerTierUpdateInput {
  color: String
  description: String
  displayName: String
  name: String
  position: Float
}

input CustomerUpdateInput {
  domains: [String!]
  externalIds: [String!]
  logoUrl: String
  mainSourceId: String
  name: String
  ownerId: String
  revenue: Int
  size: Int
  slackChannelId: String
  statusId: String
  tierId: String
}

input CustomerUpsertInput {
  domains: [String!]
  externalId: String
  id: String
  logoUrl: String
  name: String
  ownerId: String
  revenue: Int
  size: Int
  slackChannelId: String
  statusId: String
  tierId: String
  tierName: String
}

enum CustomerVisibilityMode {
  LinearOnly
  SlackMembers
  SlackMembersAndGuests
}

type Cycle implements Node {
  archivedAt: DateTime
  autoArchivedAt: DateTime
  completedAt: DateTime
  completedIssueCountHistory: [Float!]!
  completedScopeHistory: [Float!]!
  createdAt: DateTime!
  currentProgress: JSONObject!
  description: String
  documents(after: String, before: String, filter: DocumentFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): DocumentConnection!
  endsAt: DateTime!
  id: ID!
  inProgressScopeHistory: [Float!]!
  inheritedFrom: Cycle
  isActive: Boolean!
  isFuture: Boolean!
  isNext: Boolean!
  isPast: Boolean!
  isPrevious: Boolean!
  issueCountHistory: [Float!]!
  issues(after: String, before: String, filter: IssueFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): IssueConnection!
  links(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): EntityExternalLinkConnection!
  name: String
  number: Float!
  progress: Float!
  progressHistory: JSONObject!
  scopeHistory: [Float!]!
  startsAt: DateTime!
  team: Team!
  uncompletedIssuesUponClose(after: String, before: String, filter: IssueFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): IssueConnection!
  updatedAt: DateTime!
}

type CycleArchivePayload implements ArchivePayload {
  entity: Cycle
  lastSyncId: Float!
  success: Boolean!
}

type CycleConnection {
  edges: [CycleEdge!]!
  nodes: [Cycle!]!
  pageInfo: PageInfo!
}

input CycleCreateInput {
  completedAt: DateTime
  description: String
  endsAt: DateTime!
  id: String
  name: String
  startsAt: DateTime!
  teamId: String!
}

type CycleEdge {
  cursor: String!
  node: Cycle!
}

input CycleFilter {
  and: [CycleFilter!]
  completedAt: DateComparator
  createdAt: DateComparator
  endsAt: DateComparator
  id: IDComparator
  inheritedFromId: IDComparator
  isActive: BooleanComparator
  isFuture: BooleanComparator
  isInCooldown: BooleanComparator
  isNext: BooleanComparator
  isPast: BooleanComparator
  isPrevious: BooleanComparator
  issues: IssueCollectionFilter
  name: StringComparator
  number: NumberComparator
  or: [CycleFilter!]
  startsAt: DateComparator
  team: TeamFilter
  updatedAt: DateComparator
}

type CycleNotificationSubscription implements Entity & Node & NotificationSubscription {
  active: Boolean!
  archivedAt: DateTime
  contextViewType: ContextViewType
  createdAt: DateTime!
  customView: CustomView
  customer: Customer
  cycle: Cycle!
  id: ID!
  initiative: Initiative
  label: IssueLabel
  notificationSubscriptionTypes: [String!]!
  project: Project
  subscriber: User!
  team: Team
  updatedAt: DateTime!
  user: User
  userContextViewType: UserContextViewType
}

type CyclePayload {
  cycle: Cycle
  lastSyncId: Float!
  success: Boolean!
}

enum CyclePeriod {
  after
  before
  during
}

input CyclePeriodComparator {
  eq: CyclePeriod
  in: [CyclePeriod!]
  neq: CyclePeriod
  nin: [CyclePeriod!]
  null: Boolean
}

input CycleShiftAllInput {
  daysToShift: Float!
  id: String!
}

input CycleSort {
  currentCycleFirst: Boolean = false
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

input CycleUpdateInput {
  completedAt: DateTime
  description: String
  endsAt: DateTime
  name: String
  startsAt: DateTime
}

type Dashboard implements Node {
  archivedAt: DateTime
  color: String
  createdAt: DateTime!
  creator: User
  description: String
  icon: String
  id: ID!
  issueFilter: JSONObject
  name: String!
  organization: Organization!
  owner: User
  projectFilter: JSONObject
  shared: Boolean!
  slugId: String!
  sortOrder: Float!
  updatedAt: DateTime!
  updatedBy: User
  widgets: JSONObject!
}

input DateComparator {
  eq: DateTimeOrDuration
  gt: DateTimeOrDuration
  gte: DateTimeOrDuration
  in: [DateTimeOrDuration!]
  lt: DateTimeOrDuration
  lte: DateTimeOrDuration
  neq: DateTimeOrDuration
  nin: [DateTimeOrDuration!]
}

enum DateResolutionType {
  halfYear
  month
  quarter
  year
}

scalar DateTime

scalar DateTimeOrDuration

enum Day {
  Friday
  Monday
  Saturday
  Sunday
  Thursday
  Tuesday
  Wednesday
}

input DelegateSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

input DeleteOrganizationInput {
  deletionCode: String!
}

type DeletePayload implements ArchivePayload {
  entityId: String!
  lastSyncId: Float!
  success: Boolean!
}

type Document implements Node {
  archivedAt: DateTime
  color: String
  comments(after: String, before: String, filter: CommentFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): CommentConnection!
  content: String
  contentState: String
  createdAt: DateTime!
  creator: User
  cycle: Cycle
  documentContentId: String
  hiddenAt: DateTime
  icon: String
  id: ID!
  initiative: Initiative
  issue: Issue
  lastAppliedTemplate: Template
  project: Project
  release: Release
  slugId: String!
  sortOrder: Float!
  summary: String
  team: Team
  title: String!
  trashed: Boolean
  updatedAt: DateTime!
  updatedBy: User
  url: String!
}

type DocumentArchivePayload implements ArchivePayload {
  entity: Document
  lastSyncId: Float!
  success: Boolean!
}

type DocumentConnection {
  edges: [DocumentEdge!]!
  nodes: [Document!]!
  pageInfo: PageInfo!
}

type DocumentContent implements Node {
  aiPromptRules: AiPromptRules
  archivedAt: DateTime
  content: String
  contentState: String
  createdAt: DateTime!
  document: Document
  id: ID!
  initiative: Initiative
  issue: Issue
  project: Project
  projectMilestone: ProjectMilestone
  pullRequest: PullRequest
  restoredAt: DateTime
  updatedAt: DateTime!
  welcomeMessage: WelcomeMessage
}

type DocumentContentDraft implements Node {
  archivedAt: DateTime
  contentState: String!
  createdAt: DateTime!
  documentContent: DocumentContent!
  documentContentId: String!
  id: ID!
  updatedAt: DateTime!
  user: User!
  userId: String!
}

type DocumentContentHistoryPayload {
  history: [DocumentContentHistoryType!]!
  success: Boolean!
}

type DocumentContentHistoryType {
  actorIds: [String!]
  contentData: JSON
  contentDataSnapshotAt: DateTime!
  createdAt: DateTime!
  id: String!
  metadata: JSON
}

input DocumentCreateInput {
  color: String
  content: String
  cycleId: String
  icon: String
  id: String
  initiativeId: String
  issueId: String
  lastAppliedTemplateId: String
  projectId: String
  releaseId: String
  resourceFolderId: String
  sortOrder: Float
  subscriberIds: [String!]
  teamId: String
  title: String!
}

type DocumentEdge {
  cursor: String!
  node: Document!
}

input DocumentFilter {
  and: [DocumentFilter!]
  createdAt: DateComparator
  creator: UserFilter
  cycle: CycleFilter
  id: IDComparator
  initiative: InitiativeFilter
  issue: IssueFilter
  or: [DocumentFilter!]
  project: ProjectFilter
  release: ReleaseFilter
  slugId: StringComparator
  title: StringComparator
  updatedAt: DateComparator
}

type DocumentNotification implements Entity & Node & Notification {
  actor: User
  actorAvatarColor: String!
  actorAvatarUrl: String
  actorInitials: String
  archivedAt: DateTime
  botActor: ActorBot
  category: NotificationCategory!
  commentId: String
  createdAt: DateTime!
  documentId: String!
  emailedAt: DateTime
  externalUserActor: ExternalUser
  groupingKey: String!
  groupingPriority: Float!
  id: ID!
  inboxUrl: String!
  initiativeUpdateHealth: String
  isLinearActor: Boolean!
  issueStatusType: String
  parentCommentId: String
  projectUpdateHealth: String
  reactionEmoji: String
  readAt: DateTime
  snoozedUntilAt: DateTime
  subtitle: String!
  title: String!
  type: String!
  unsnoozedAt: DateTime
  updatedAt: DateTime!
  url: String!
  user: User!
}

type DocumentPayload {
  document: Document!
  lastSyncId: Float!
  success: Boolean!
}

type DocumentSearchPayload {
  archivePayload: ArchiveResponse!
  edges: [DocumentSearchResultEdge!]!
  nodes: [DocumentSearchResult!]!
  pageInfo: PageInfo!
  totalCount: Float!
}

type DocumentSearchResult implements Node {
  archivedAt: DateTime
  color: String
  comments(after: String, before: String, filter: CommentFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): CommentConnection!
  content: String
  contentState: String
  createdAt: DateTime!
  creator: User
  cycle: Cycle
  documentContentId: String
  hiddenAt: DateTime
  icon: String
  id: ID!
  initiative: Initiative
  issue: Issue
  lastAppliedTemplate: Template
  metadata: JSONObject!
  project: Project
  release: Release
  slugId: String!
  sortOrder: Float!
  summary: String
  team: Team
  title: String!
  trashed: Boolean
  updatedAt: DateTime!
  updatedBy: User
  url: String!
}

type DocumentSearchResultEdge {
  cursor: String!
  node: DocumentSearchResult!
}

input DocumentUpdateInput {
  color: String
  content: String
  cycleId: String
  hiddenAt: DateTime
  icon: String
  initiativeId: String
  issueId: String
  lastAppliedTemplateId: String
  projectId: String
  releaseId: String
  resourceFolderId: String
  sortOrder: Float
  subscriberIds: [String!]
  teamId: String
  title: String
  trashed: Boolean
}

type Draft implements Node {
  anchor: String
  archivedAt: DateTime
  bodyData: JSON!
  createdAt: DateTime!
  customerNeed: CustomerNeed
  data: JSONObject
  id: ID!
  initiative: Initiative
  initiativeUpdate: InitiativeUpdate
  isAutogenerated: Boolean! @deprecated(reason: "Use 'data.generationMetadata' instead")
  issue: Issue
  parentComment: Comment
  post: Post
  project: Project
  projectUpdate: ProjectUpdate
  team: Team
  updatedAt: DateTime!
  user: User!
  wasLocalDraft: Boolean!
}

type DraftConnection {
  edges: [DraftEdge!]!
  nodes: [Draft!]!
  pageInfo: PageInfo!
}

type DraftEdge {
  cursor: String!
  node: Draft!
}

input DueDateSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

scalar Duration

type EmailIntakeAddress implements Node {
  address: String!
  archivedAt: DateTime
  createdAt: DateTime!
  creator: User
  customerRequestsEnabled: Boolean!
  enabled: Boolean!
  forwardingEmailAddress: String
  id: ID!
  issueCanceledAutoReply: String
  issueCanceledAutoReplyEnabled: Boolean!
  issueCompletedAutoReply: String
  issueCompletedAutoReplyEnabled: Boolean!
  issueCreatedAutoReply: String
  issueCreatedAutoReplyEnabled: Boolean!
  organization: Organization!
  reopenOnReply: Boolean!
  repliesEnabled: Boolean!
  senderName: String
  sesDomainIdentity: SesDomainIdentity
  team: Team
  template: Template
  type: EmailIntakeAddressType!
  updatedAt: DateTime!
  useUserNamesInReplies: Boolean!
}

input EmailIntakeAddressCreateInput {
  customerRequestsEnabled: Boolean
  forwardingEmailAddress: String
  id: String
  issueCanceledAutoReply: String
  issueCanceledAutoReplyEnabled: Boolean
  issueCompletedAutoReply: String
  issueCompletedAutoReplyEnabled: Boolean
  issueCreatedAutoReply: String
  issueCreatedAutoReplyEnabled: Boolean
  reopenOnReply: Boolean
  repliesEnabled: Boolean
  senderName: String
  teamId: String
  templateId: String
  type: EmailIntakeAddressType
  useUserNamesInReplies: Boolean
}

type EmailIntakeAddressPayload {
  emailIntakeAddress: EmailIntakeAddress!
  lastSyncId: Float!
  success: Boolean!
}

enum EmailIntakeAddressType {
  asks
  asksWeb
  team
  template
}

input EmailIntakeAddressUpdateInput {
  customerRequestsEnabled: Boolean
  enabled: Boolean
  forwardingEmailAddress: String
  issueCanceledAutoReply: String
  issueCanceledAutoReplyEnabled: Boolean
  issueCompletedAutoReply: String
  issueCompletedAutoReplyEnabled: Boolean
  issueCreatedAutoReply: String
  issueCreatedAutoReplyEnabled: Boolean
  reopenOnReply: Boolean
  repliesEnabled: Boolean
  senderName: String
  teamId: String
  templateId: String
  useUserNamesInReplies: Boolean
}

input EmailUnsubscribeInput {
  token: String!
  type: String!
  userId: String!
}

type EmailUnsubscribePayload {
  success: Boolean!
}

input EmailUserAccountAuthChallengeInput {
  challengeResponse: String
  clientAuthCode: String
  email: String!
  inviteLink: String
  isDesktop: Boolean
  loginCodeOnly: Boolean
  sessionId: String
}

type EmailUserAccountAuthChallengeResponse {
  authType: String!
  success: Boolean!
}

type Emoji implements Node {
  archivedAt: DateTime
  createdAt: DateTime!
  creator: User
  id: ID!
  name: String!
  organization: Organization!
  source: String!
  updatedAt: DateTime!
  url: String!
}

type EmojiConnection {
  edges: [EmojiEdge!]!
  nodes: [Emoji!]!
  pageInfo: PageInfo!
}

input EmojiCreateInput {
  id: String
  name: String!
  url: String!
}

type EmojiEdge {
  cursor: String!
  node: Emoji!
}

type EmojiPayload {
  emoji: Emoji!
  lastSyncId: Float!
  success: Boolean!
}

interface Entity implements Node {
  archivedAt: DateTime
  createdAt: DateTime!
  id: ID!
  updatedAt: DateTime!
}

type EntityExternalLink implements Node {
  archivedAt: DateTime
  createdAt: DateTime!
  creator: User!
  id: ID!
  initiative: Initiative
  label: String!
  sortOrder: Float!
  updatedAt: DateTime!
  url: String!
}

type EntityExternalLinkConnection {
  edges: [EntityExternalLinkEdge!]!
  nodes: [EntityExternalLink!]!
  pageInfo: PageInfo!
}

input EntityExternalLinkCreateInput {
  cycleId: String
  id: String
  initiativeId: String
  label: String!
  projectId: String
  releaseId: String
  resourceFolderId: String
  sortOrder: Float
  teamId: String
  url: String!
}

type EntityExternalLinkEdge {
  cursor: String!
  node: EntityExternalLink!
}

type EntityExternalLinkPayload {
  entityExternalLink: EntityExternalLink!
  lastSyncId: Float!
  success: Boolean!
}

input EntityExternalLinkUpdateInput {
  label: String
  resourceFolderId: String
  sortOrder: Float
  url: String
}

input EstimateComparator {
  and: [NullableNumberComparator!]
  eq: Float
  gt: Float
  gte: Float
  in: [Float!]
  lt: Float
  lte: Float
  neq: Float
  nin: [Float!]
  null: Boolean
  or: [NullableNumberComparator!]
}

input EstimateSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

input EventTrackingInput {
  event: String!
  properties: JSONObject
  sessionId: String
}

type EventTrackingPayload {
  success: Boolean!
}

type ExternalEntityInfo {
  id: String!
  metadata: ExternalEntityInfoMetadata
  service: ExternalSyncService!
}

type ExternalEntityInfoGithubMetadata {
  number: Float
  owner: String
  repo: String
}

type ExternalEntityInfoJiraMetadata {
  issueKey: String
  issueTypeId: String
  projectId: String
}

union ExternalEntityInfoMetadata = ExternalEntityInfoGithubMetadata | ExternalEntityInfoJiraMetadata | ExternalEntitySlackMetadata

type ExternalEntitySlackMetadata {
  channelId: String
  channelName: String
  isFromSlack: Boolean!
  messageUrl: String
}

enum ExternalSyncService {
  github
  jira
  slack
}

type ExternalUser implements Node {
  archivedAt: DateTime
  avatarUrl: String
  createdAt: DateTime!
  displayName: String!
  email: String
  id: ID!
  lastSeen: DateTime
  name: String!
  organization: Organization!
  updatedAt: DateTime!
}

type ExternalUserConnection {
  edges: [ExternalUserEdge!]!
  nodes: [ExternalUser!]!
  pageInfo: PageInfo!
}

type ExternalUserEdge {
  cursor: String!
  node: ExternalUser!
}

type Facet implements Node {
  archivedAt: DateTime
  createdAt: DateTime!
  id: ID!
  sortOrder: Float!
  sourceFeedUser: User
  sourceInitiative: Initiative
  sourceOrganization: Organization
  sourcePage: FacetPageSource
  sourceProject: Project
  sourceTeam: Team
  targetCustomView: CustomView
  updatedAt: DateTime!
}

type FacetConnection {
  edges: [FacetEdge!]!
  nodes: [Facet!]!
  pageInfo: PageInfo!
}

type FacetEdge {
  cursor: String!
  node: Facet!
}

enum FacetPageSource {
  feed
  projects
  teamIssues
}

type Favorite implements Node {
  archivedAt: DateTime
  children(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): FavoriteConnection!
  color: String
  createdAt: DateTime!
  customView: CustomView
  customer: Customer
  cycle: Cycle
  dashboard: Dashboard
  detail: String
  document: Document
  facet: Facet
  folderName: String
  icon: String
  id: ID!
  initiative: Initiative
  initiativeTab: InitiativeTab
  issue: Issue
  label: IssueLabel
  owner: User!
  parent: Favorite
  predefinedViewTeam: Team
  predefinedViewType: String
  project: Project
  projectLabel: ProjectLabel
  projectTab: ProjectTab
  projectTeam: Team
  pullRequest: PullRequest
  release: Release
  releasePipeline: ReleasePipeline
  sortOrder: Float!
  title: String!
  type: String!
  updatedAt: DateTime!
  url: String
  user: User
}

type FavoriteConnection {
  edges: [FavoriteEdge!]!
  nodes: [Favorite!]!
  pageInfo: PageInfo!
}

input FavoriteCreateInput {
  customViewId: String
  customerId: String
  cycleId: String
  dashboardId: String
  documentId: String
  facetId: String
  folderName: String
  id: String
  initiativeId: String
  initiativeTab: InitiativeTab
  issueId: String
  labelId: String
  parentId: String
  predefinedViewTeamId: String
  predefinedViewType: String
  projectId: String
  projectLabelId: String
  projectTab: ProjectTab
  pullRequestId: String
  releaseId: String
  releasePipelineId: String
  sortOrder: Float
  userId: String
}

type FavoriteEdge {
  cursor: String!
  node: Favorite!
}

type FavoritePayload {
  favorite: Favorite!
  lastSyncId: Float!
  success: Boolean!
}

input FavoriteUpdateInput {
  folderName: String
  parentId: String
  sortOrder: Float
}

type FeedItem implements Node {
  archivedAt: DateTime
  createdAt: DateTime!
  id: ID!
  initiativeUpdate: InitiativeUpdate
  organization: Organization!
  post: Post
  projectUpdate: ProjectUpdate
  team: Team
  updatedAt: DateTime!
  user: User
}

type FeedItemConnection {
  edges: [FeedItemEdge!]!
  nodes: [FeedItem!]!
  pageInfo: PageInfo!
}

type FeedItemEdge {
  cursor: String!
  node: FeedItem!
}

input FeedItemFilter {
  and: [FeedItemFilter!]
  author: UserFilter
  createdAt: DateComparator
  id: IDComparator
  or: [FeedItemFilter!]
  projectUpdate: ProjectUpdateFilter
  relatedInitiatives: InitiativeCollectionFilter
  relatedTeams: TeamCollectionFilter
  updateHealth: StringComparator
  updateType: StringComparator
  updatedAt: DateComparator
}

enum FeedSummarySchedule {
  daily
  never
  weekly
}

type FetchDataPayload {
  data: JSONObject
  filters: JSONObject
  query: String
  success: Boolean!
}

type FileUploadDeletePayload {
  success: Boolean!
}

enum FrequencyResolutionType {
  daily
  weekly
}

type FrontAttachmentPayload {
  attachment: Attachment!
  lastSyncId: Float!
  success: Boolean!
}

input FrontSettingsInput {
  automateTicketReopeningOnCancellation: Boolean
  automateTicketReopeningOnComment: Boolean
  automateTicketReopeningOnCompletion: Boolean
  automateTicketReopeningOnProjectCancellation: Boolean
  automateTicketReopeningOnProjectCompletion: Boolean
  disableCustomerRequestsAutoCreation: Boolean
  enableAiIntake: Boolean
  sendNoteOnComment: Boolean
  sendNoteOnStatusChange: Boolean
}

type GitAutomationState implements Node {
  archivedAt: DateTime
  branchPattern: String @deprecated(reason: "Use targetBranch instead.")
  createdAt: DateTime!
  event: GitAutomationStates!
  id: ID!
  state: WorkflowState
  targetBranch: GitAutomationTargetBranch
  team: Team!
  updatedAt: DateTime!
}

type GitAutomationStateConnection {
  edges: [GitAutomationStateEdge!]!
  nodes: [GitAutomationState!]!
  pageInfo: PageInfo!
}

input GitAutomationStateCreateInput {
  event: GitAutomationStates!
  id: String
  stateId: String
  targetBranchId: String
  teamId: String!
}

type GitAutomationStateEdge {
  cursor: String!
  node: GitAutomationState!
}

type GitAutomationStatePayload {
  gitAutomationState: GitAutomationState!
  lastSyncId: Float!
  success: Boolean!
}

input GitAutomationStateUpdateInput {
  event: GitAutomationStates
  stateId: String
  targetBranchId: String
}

enum GitAutomationStates {
  draft
  merge
  mergeable
  review
  start
}

type GitAutomationTargetBranch implements Node {
  archivedAt: DateTime
  automationStates(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): GitAutomationStateConnection!
  branchPattern: String!
  createdAt: DateTime!
  id: ID!
  isRegex: Boolean!
  team: Team!
  updatedAt: DateTime!
}

input GitAutomationTargetBranchCreateInput {
  branchPattern: String!
  id: String
  isRegex: Boolean = false
  teamId: String!
}

type GitAutomationTargetBranchPayload {
  lastSyncId: Float!
  success: Boolean!
  targetBranch: GitAutomationTargetBranch!
}

input GitAutomationTargetBranchUpdateInput {
  branchPattern: String
  isRegex: Boolean
}

type GitHubCommitIntegrationPayload {
  integration: Integration
  lastSyncId: Float!
  success: Boolean!
  webhookSecret: String!
}

type GitHubEnterpriseServerInstallVerificationPayload {
  success: Boolean!
}

type GitHubEnterpriseServerPayload {
  installUrl: String!
  integration: Integration
  lastSyncId: Float!
  setupUrl: String!
  success: Boolean!
  webhookSecret: String!
}

input GitHubImportSettingsInput {
  labels: JSONObject
  orgAvatarUrl: String!
  orgLogin: String!
  orgType: GithubOrgType!
  repositories: [GitHubRepoInput!]!
}

input GitHubPersonalSettingsInput {
  login: String!
}

input GitHubRepoInput {
  archived: Boolean
  externalId: String
  fullName: String!
  id: Float!
}

input GitHubRepoMappingInput {
  bidirectional: Boolean
  default: Boolean
  gitHubLabels: [String!]
  gitHubRepoId: Float!
  id: String!
  linearTeamId: String!
}

input GitHubSettingsInput {
  codeAccess: Boolean
  enterpriseUrl: String
  externalOrgId: String
  orgAvatarUrl: String
  orgLogin: String!
  orgType: GithubOrgType
  pullRequestReviewTool: PullRequestReviewTool
  repositories: [GitHubRepoInput!]
  repositoriesMapping: [GitHubRepoMappingInput!]
}

type GitLabIntegrationCreatePayload {
  error: String
  errorResponseBody: String
  errorResponseHeaders: String
  integration: Integration
  lastSyncId: Float!
  success: Boolean!
  webhookSecret: String!
}

input GitLabSettingsInput {
  expiresAt: String
  readonly: Boolean
  url: String
}

type GitLabTestConnectionPayload {
  error: String
  errorResponseBody: String
  errorResponseHeaders: String
  integration: Integration
  lastSyncId: Float!
  success: Boolean!
}

enum GitLinkKind {
  closes
  contributes
  links
}

enum GithubOrgType {
  organization
  user
}

input GongRecordingImportConfigInput {
  teamId: String
}

input GongSettingsInput {
  importConfig: GongRecordingImportConfigInput
  tagParticipantsInIssues: Boolean
}

input GoogleSheetsExportSettings {
  enabled: Boolean
  sheetId: Float
  spreadsheetId: String
  spreadsheetUrl: String
  updatedAt: DateTime
}

input GoogleSheetsSettingsInput {
  initiative: GoogleSheetsExportSettings
  issue: GoogleSheetsExportSettings
  project: GoogleSheetsExportSettings
  sheetId: Float
  spreadsheetId: String
  spreadsheetUrl: String
  updatedIssuesAt: DateTime
}

input GoogleUserAccountAuthInput {
  code: String!
  disallowSignup: Boolean
  inviteLink: String
  redirectUri: String
  sessionId: String
  timezone: String!
}

input IDComparator {
  eq: ID
  in: [ID!]
  neq: ID
  nin: [ID!]
}

type IdentityProvider implements Node {
  adminsGroupPush: JSONObject
  allowNameChange: Boolean!
  archivedAt: DateTime
  createdAt: DateTime!
  defaultMigrated: Boolean!
  guestsGroupPush: JSONObject
  id: ID!
  issuerEntityId: String
  ownersGroupPush: JSONObject
  priority: Float
  samlEnabled: Boolean!
  scimEnabled: Boolean!
  spEntityId: String
  ssoBinding: String
  ssoEndpoint: String
  ssoSignAlgo: String
  ssoSigningCert: String
  type: IdentityProviderType!
  updatedAt: DateTime!
}

enum IdentityProviderType {
  general
  webForms
}

type ImageUploadFromUrlPayload {
  lastSyncId: Float!
  success: Boolean!
  url: String
}

input InheritanceEntityMapping {
  issueLabels: JSONObject
  workflowStates: JSONObject!
}

type Initiative implements Node {
  archivedAt: DateTime
  color: String
  completedAt: DateTime
  content: String
  createdAt: DateTime!
  creator: User
  description: String
  documentContent: DocumentContent
  documents(after: String, before: String, filter: DocumentFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): DocumentConnection!
  facets: [Facet!]!
  frequencyResolution: FrequencyResolutionType!
  health: InitiativeUpdateHealthType
  healthUpdatedAt: DateTime
  history(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): InitiativeHistoryConnection!
  icon: String
  id: ID!
  initiativeUpdates(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): InitiativeUpdateConnection!
  integrationsSettings: IntegrationsSettings
  lastUpdate: InitiativeUpdate
  links(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): EntityExternalLinkConnection!
  name: String!
  organization: Organization!
  owner: User
  parentInitiative: Initiative
  parentInitiatives(after: String, before: String, filter: InitiativeFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy, sort: [InitiativeSortInput!]): InitiativeConnection!
  projects(after: String, before: String, filter: ProjectFilter, first: Int, includeArchived: Boolean, includeSubInitiatives: Boolean, last: Int, orderBy: PaginationOrderBy, sort: [ProjectSortInput!]): ProjectConnection!
  slugId: String!
  sortOrder: Float!
  startedAt: DateTime
  status: InitiativeStatus!
  subInitiatives(after: String, before: String, filter: InitiativeFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy, sort: [InitiativeSortInput!]): InitiativeConnection!
  targetDate: TimelessDate
  targetDateResolution: DateResolutionType
  trashed: Boolean
  updateReminderFrequency: Float
  updateReminderFrequencyInWeeks: Float
  updateRemindersDay: Day
  updateRemindersHour: Float
  updatedAt: DateTime!
  url: String!
}

type InitiativeArchivePayload implements ArchivePayload {
  entity: Initiative
  lastSyncId: Float!
  success: Boolean!
}

input InitiativeCollectionFilter {
  activityType: StringComparator
  ancestors: InitiativeCollectionFilter
  and: [InitiativeCollectionFilter!]
  completedAt: NullableDateComparator
  createdAt: DateComparator
  creator: NullableUserFilter
  every: InitiativeFilter
  health: StringComparator
  healthWithAge: StringComparator
  id: IDComparator
  initiativeUpdates: InitiativeUpdatesCollectionFilter
  length: NumberComparator
  name: StringComparator
  or: [InitiativeCollectionFilter!]
  owner: NullableUserFilter
  slugId: StringComparator
  some: InitiativeFilter
  startedAt: NullableDateComparator
  status: StringComparator
  targetDate: NullableDateComparator
  teams: TeamCollectionFilter
  updatedAt: DateComparator
}

type InitiativeConnection {
  edges: [InitiativeEdge!]!
  nodes: [Initiative!]!
  pageInfo: PageInfo!
}

input InitiativeCreateInput {
  color: String
  content: String
  description: String
  icon: String
  id: String
  name: String!
  ownerId: String
  sortOrder: Float
  status: InitiativeStatus
  targetDate: TimelessDate
  targetDateResolution: DateResolutionType
}

input InitiativeCreatedAtSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

type InitiativeEdge {
  cursor: String!
  node: Initiative!
}

input InitiativeFilter {
  activityType: StringComparator
  ancestors: InitiativeCollectionFilter
  and: [InitiativeFilter!]
  completedAt: NullableDateComparator
  createdAt: DateComparator
  creator: NullableUserFilter
  health: StringComparator
  healthWithAge: StringComparator
  id: IDComparator
  initiativeUpdates: InitiativeUpdatesCollectionFilter
  name: StringComparator
  or: [InitiativeFilter!]
  owner: NullableUserFilter
  slugId: StringComparator
  startedAt: NullableDateComparator
  status: StringComparator
  targetDate: NullableDateComparator
  teams: TeamCollectionFilter
  updatedAt: DateComparator
}

input InitiativeHealthSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

input InitiativeHealthUpdatedAtSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

type InitiativeHistory implements Node {
  archivedAt: DateTime
  createdAt: DateTime!
  entries: JSONObject!
  id: ID!
  initiative: Initiative!
  updatedAt: DateTime!
}

type InitiativeHistoryConnection {
  edges: [InitiativeHistoryEdge!]!
  nodes: [InitiativeHistory!]!
  pageInfo: PageInfo!
}

type InitiativeHistoryEdge {
  cursor: String!
  node: InitiativeHistory!
}

input InitiativeManualSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

input InitiativeNameSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

type InitiativeNotification implements Entity & Node & Notification {
  actor: User
  actorAvatarColor: String!
  actorAvatarUrl: String
  actorInitials: String
  archivedAt: DateTime
  botActor: ActorBot
  category: NotificationCategory!
  comment: Comment
  commentId: String
  createdAt: DateTime!
  document: Document
  emailedAt: DateTime
  externalUserActor: ExternalUser
  groupingKey: String!
  groupingPriority: Float!
  id: ID!
  inboxUrl: String!
  initiative: Initiative
  initiativeId: String!
  initiativeUpdate: InitiativeUpdate
  initiativeUpdateHealth: String
  initiativeUpdateId: String
  isLinearActor: Boolean!
  issueStatusType: String
  parentComment: Comment
  parentCommentId: String
  projectUpdateHealth: String
  reactionEmoji: String
  readAt: DateTime
  snoozedUntilAt: DateTime
  subtitle: String!
  title: String!
  type: String!
  unsnoozedAt: DateTime
  updatedAt: DateTime!
  url: String!
  user: User!
}

type InitiativeNotificationSubscription implements Entity & Node & NotificationSubscription {
  active: Boolean!
  archivedAt: DateTime
  contextViewType: ContextViewType
  createdAt: DateTime!
  customView: CustomView
  customer: Customer
  cycle: Cycle
  id: ID!
  initiative: Initiative!
  label: IssueLabel
  notificationSubscriptionTypes: [String!]!
  project: Project
  subscriber: User!
  team: Team
  updatedAt: DateTime!
  user: User
  userContextViewType: UserContextViewType
}

input InitiativeOwnerSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

type InitiativePayload {
  initiative: Initiative!
  lastSyncId: Float!
  success: Boolean!
}

type InitiativeRelation implements Node {
  archivedAt: DateTime
  createdAt: DateTime!
  id: ID!
  initiative: Initiative!
  relatedInitiative: Initiative!
  sortOrder: Float!
  updatedAt: DateTime!
  user: User
}

type InitiativeRelationConnection {
  edges: [InitiativeRelationEdge!]!
  nodes: [InitiativeRelation!]!
  pageInfo: PageInfo!
}

input InitiativeRelationCreateInput {
  id: String
  initiativeId: String!
  relatedInitiativeId: String!
  sortOrder: Float
}

type InitiativeRelationEdge {
  cursor: String!
  node: InitiativeRelation!
}

type InitiativeRelationPayload {
  initiativeRelation: InitiativeRelation!
  lastSyncId: Float!
  success: Boolean!
}

input InitiativeRelationUpdateInput {
  sortOrder: Float
}

input InitiativeSortInput {
  createdAt: InitiativeCreatedAtSort
  health: InitiativeHealthSort
  healthUpdatedAt: InitiativeHealthUpdatedAtSort
  manual: InitiativeManualSort
  name: InitiativeNameSort
  owner: InitiativeOwnerSort
  targetDate: InitiativeTargetDateSort
  updatedAt: InitiativeUpdatedAtSort
}

enum InitiativeStatus {
  Active
  Completed
  Planned
}

enum InitiativeTab {
  overview
  projects
  updates
}

input InitiativeTargetDateSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

type InitiativeToProject implements Node {
  archivedAt: DateTime
  createdAt: DateTime!
  id: ID!
  initiative: Initiative!
  project: Project!
  sortOrder: String!
  updatedAt: DateTime!
}

type InitiativeToProjectConnection {
  edges: [InitiativeToProjectEdge!]!
  nodes: [InitiativeToProject!]!
  pageInfo: PageInfo!
}

input InitiativeToProjectCreateInput {
  id: String
  initiativeId: String!
  projectId: String!
  sortOrder: Float
}

type InitiativeToProjectEdge {
  cursor: String!
  node: InitiativeToProject!
}

type InitiativeToProjectPayload {
  initiativeToProject: InitiativeToProject!
  lastSyncId: Float!
  success: Boolean!
}

input InitiativeToProjectUpdateInput {
  sortOrder: Float
}

type InitiativeUpdate implements Node {
  archivedAt: DateTime
  body: String!
  bodyData: String!
  commentCount: Int!
  comments(after: String, before: String, filter: CommentFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): CommentConnection!
  createdAt: DateTime!
  diff: JSONObject
  diffMarkdown: String
  editedAt: DateTime
  health: InitiativeUpdateHealthType!
  id: ID!
  infoSnapshot: JSONObject
  initiative: Initiative!
  isDiffHidden: Boolean!
  isStale: Boolean!
  reactionData: JSONObject!
  reactions: [Reaction!]!
  slugId: String!
  updatedAt: DateTime!
  url: String!
  user: User!
}

type InitiativeUpdateArchivePayload implements ArchivePayload {
  entity: InitiativeUpdate
  lastSyncId: Float!
  success: Boolean!
}

type InitiativeUpdateConnection {
  edges: [InitiativeUpdateEdge!]!
  nodes: [InitiativeUpdate!]!
  pageInfo: PageInfo!
}

input InitiativeUpdateCreateInput {
  body: String
  bodyData: JSON
  health: InitiativeUpdateHealthType
  id: String
  initiativeId: String!
  isDiffHidden: Boolean
}

type InitiativeUpdateEdge {
  cursor: String!
  node: InitiativeUpdate!
}

input InitiativeUpdateFilter {
  and: [InitiativeUpdateFilter!]
  createdAt: DateComparator
  id: IDComparator
  initiative: InitiativeFilter
  or: [InitiativeUpdateFilter!]
  reactions: ReactionCollectionFilter
  updatedAt: DateComparator
  user: UserFilter
}

enum InitiativeUpdateHealthType {
  atRisk
  offTrack
  onTrack
}

input InitiativeUpdateInput {
  color: String
  content: String
  description: String
  frequencyResolution: FrequencyResolutionType
  icon: String
  name: String
  ownerId: String
  sortOrder: Float
  status: InitiativeStatus
  targetDate: TimelessDate
  targetDateResolution: DateResolutionType
  trashed: Boolean
  updateReminderFrequency: Float
  updateReminderFrequencyInWeeks: Float
  updateRemindersDay: Day
  updateRemindersHour: Int
}

type InitiativeUpdatePayload {
  initiativeUpdate: InitiativeUpdate!
  lastSyncId: Float!
  success: Boolean!
}

type InitiativeUpdateReminderPayload {
  lastSyncId: Float!
  success: Boolean!
}

input InitiativeUpdateUpdateInput {
  body: String
  bodyData: JSON
  health: InitiativeUpdateHealthType
  isDiffHidden: Boolean
}

input InitiativeUpdatedAtSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

input InitiativeUpdatesCollectionFilter {
  and: [InitiativeUpdatesCollectionFilter!]
  createdAt: DateComparator
  every: InitiativeUpdatesFilter
  id: IDComparator
  length: NumberComparator
  or: [InitiativeUpdatesCollectionFilter!]
  some: InitiativeUpdatesFilter
  updatedAt: DateComparator
}

input InitiativeUpdatesFilter {
  and: [InitiativeUpdatesFilter!]
  createdAt: DateComparator
  id: IDComparator
  or: [InitiativeUpdatesFilter!]
  updatedAt: DateComparator
}

type Integration implements Node {
  archivedAt: DateTime
  createdAt: DateTime!
  creator: User!
  id: ID!
  organization: Organization!
  service: String!
  team: Team
  updatedAt: DateTime!
}

type IntegrationConnection {
  edges: [IntegrationEdge!]!
  nodes: [Integration!]!
  pageInfo: PageInfo!
}

input IntegrationCustomerDataAttributesRefreshInput {
  service: String!
}

type IntegrationEdge {
  cursor: String!
  node: Integration!
}

type IntegrationHasScopesPayload {
  hasAllScopes: Boolean!
  missingScopes: [String!]
}

type IntegrationPayload {
  integration: Integration
  lastSyncId: Float!
  success: Boolean!
}

input IntegrationRequestInput {
  email: String
  name: String!
}

type IntegrationRequestPayload {
  success: Boolean!
}

enum IntegrationService {
  airbyte
  asksWeb
  discord
  email
  figma
  figmaPlugin
  front
  github
  githubCodeAccessPersonal
  githubCommit
  githubEnterpriseServer
  githubImport
  githubPersonal
  gitlab
  gong
  googleCalendarPersonal
  googleSheets
  intercom
  jira
  jiraPersonal
  launchDarkly
  launchDarklyPersonal
  loom
  mcpServer
  mcpServerPersonal
  microsoftPersonal
  microsoftTeams
  microsoftTeamsProjectPost
  notion
  opsgenie
  pagerDuty
  salesforce
  sentry
  slack
  slackAsks
  slackCustomViewNotifications
  slackInitiativePost
  slackOrgInitiativeUpdatesPost
  slackOrgProjectUpdatesPost
  slackPersonal
  slackPost
  slackProjectPost
  slackProjectUpdatesPost
  zendesk
}

input IntegrationSettingsInput {
  front: FrontSettingsInput
  gitHub: GitHubSettingsInput
  gitHubImport: GitHubImportSettingsInput
  gitHubPersonal: GitHubPersonalSettingsInput
  gitLab: GitLabSettingsInput
  gong: GongSettingsInput
  googleSheets: GoogleSheetsSettingsInput
  intercom: IntercomSettingsInput
  jira: JiraSettingsInput
  jiraPersonal: JiraPersonalSettingsInput
  launchDarkly: LaunchDarklySettingsInput
  microsoftTeams: MicrosoftTeamsSettingsInput
  microsoftTeamsProjectPost: MicrosoftTeamsPostSettingsInput
  notion: NotionSettingsInput
  opsgenie: OpsgenieInput
  pagerDuty: PagerDutyInput
  salesforce: SalesforceSettingsInput
  sentry: SentrySettingsInput
  slack: SlackSettingsInput
  slackAsks: SlackAsksSettingsInput
  slackCustomViewNotifications: SlackPostSettingsInput
  slackInitiativePost: SlackPostSettingsInput
  slackOrgInitiativeUpdatesPost: SlackPostSettingsInput
  slackOrgProjectUpdatesPost: SlackPostSettingsInput
  slackPost: SlackPostSettingsInput
  slackProjectPost: SlackPostSettingsInput
  zendesk: ZendeskSettingsInput
}

type IntegrationSlackWorkspaceNamePayload {
  name: String!
  success: Boolean!
}

type IntegrationTemplate implements Node {
  archivedAt: DateTime
  createdAt: DateTime!
  foreignEntityId: String
  id: ID!
  integration: Integration!
  template: Template!
  updatedAt: DateTime!
}

type IntegrationTemplateConnection {
  edges: [IntegrationTemplateEdge!]!
  nodes: [IntegrationTemplate!]!
  pageInfo: PageInfo!
}

input IntegrationTemplateCreateInput {
  foreignEntityId: String
  id: String
  integrationId: String!
  templateId: String!
}

type IntegrationTemplateEdge {
  cursor: String!
  node: IntegrationTemplate!
}

type IntegrationTemplatePayload {
  integrationTemplate: IntegrationTemplate!
  lastSyncId: Float!
  success: Boolean!
}

input IntegrationUpdateInput {
  settings: IntegrationSettingsInput
}

type IntegrationsSettings implements Node {
  archivedAt: DateTime
  contextViewType: ContextViewType
  createdAt: DateTime!
  id: ID!
  initiative: Initiative
  microsoftTeamsProjectUpdateCreated: Boolean
  project: Project
  slackInitiativeUpdateCreated: Boolean
  slackIssueAddedToTriage: Boolean
  slackIssueAddedToView: Boolean
  slackIssueCreated: Boolean @deprecated(reason: "No longer in use. Use \`slackIssueAddedToView\` instead.")
  slackIssueNewComment: Boolean
  slackIssueSlaBreached: Boolean
  slackIssueSlaHighRisk: Boolean
  slackIssueStatusChangedAll: Boolean
  slackIssueStatusChangedDone: Boolean
  slackProjectUpdateCreated: Boolean
  slackProjectUpdateCreatedToTeam: Boolean
  slackProjectUpdateCreatedToWorkspace: Boolean
  team: Team
  updatedAt: DateTime!
}

input IntegrationsSettingsCreateInput {
  contextViewType: ContextViewType
  customViewId: String
  id: String
  initiativeId: String
  microsoftTeamsProjectUpdateCreated: Boolean
  projectId: String
  slackInitiativeUpdateCreated: Boolean
  slackIssueAddedToTriage: Boolean
  slackIssueAddedToView: Boolean
  slackIssueCreated: Boolean
  slackIssueNewComment: Boolean
  slackIssueSlaBreached: Boolean
  slackIssueSlaHighRisk: Boolean
  slackIssueStatusChangedAll: Boolean
  slackIssueStatusChangedDone: Boolean
  slackProjectUpdateCreated: Boolean
  slackProjectUpdateCreatedToTeam: Boolean
  slackProjectUpdateCreatedToWorkspace: Boolean
  teamId: String
}

type IntegrationsSettingsPayload {
  integrationsSettings: IntegrationsSettings!
  lastSyncId: Float!
  success: Boolean!
}

input IntegrationsSettingsUpdateInput {
  microsoftTeamsProjectUpdateCreated: Boolean
  slackInitiativeUpdateCreated: Boolean
  slackIssueAddedToTriage: Boolean
  slackIssueAddedToView: Boolean
  slackIssueCreated: Boolean
  slackIssueNewComment: Boolean
  slackIssueSlaBreached: Boolean
  slackIssueSlaHighRisk: Boolean
  slackIssueStatusChangedAll: Boolean
  slackIssueStatusChangedDone: Boolean
  slackProjectUpdateCreated: Boolean
  slackProjectUpdateCreatedToTeam: Boolean
  slackProjectUpdateCreatedToWorkspace: Boolean
}

input IntercomSettingsInput {
  automateTicketReopeningOnCancellation: Boolean
  automateTicketReopeningOnComment: Boolean
  automateTicketReopeningOnCompletion: Boolean
  automateTicketReopeningOnProjectCancellation: Boolean
  automateTicketReopeningOnProjectCompletion: Boolean
  disableCustomerRequestsAutoCreation: Boolean
  enableAiIntake: Boolean
  sendNoteOnComment: Boolean
  sendNoteOnStatusChange: Boolean
}

type Issue implements Node {
  activitySummary: JSONObject
  addedToCycleAt: DateTime
  addedToProjectAt: DateTime
  addedToTeamAt: DateTime
  aiPromptProgresses(after: String, before: String, filter: AiPromptProgressFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): AiPromptProgressConnection!
  archivedAt: DateTime
  asksExternalUserRequester: ExternalUser
  asksRequester: User
  assignee: User
  attachments(after: String, before: String, filter: AttachmentFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): AttachmentConnection!
  autoArchivedAt: DateTime
  autoClosedAt: DateTime
  boardOrder: Float! @deprecated(reason: "Will be removed in near future, please use \`sortOrder\` instead")
  botActor: ActorBot
  branchName: String!
  canceledAt: DateTime
  children(after: String, before: String, filter: IssueFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): IssueConnection!
  comments(after: String, before: String, filter: CommentFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): CommentConnection!
  completedAt: DateTime
  createdAt: DateTime!
  creator: User
  customerTicketCount: Int!
  cycle: Cycle
  delegate: User
  description: String
  descriptionState: String
  documentContent: DocumentContent
  documents(after: String, before: String, filter: DocumentFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): DocumentConnection!
  dueDate: TimelessDate
  estimate: Float
  externalUserCreator: ExternalUser
  favorite: Favorite
  formerAttachments(after: String, before: String, filter: AttachmentFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): AttachmentConnection!
  formerNeeds(after: String, before: String, filter: CustomerNeedFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): CustomerNeedConnection!
  history(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): IssueHistoryConnection!
  id: ID!
  identifier: String!
  incomingSuggestions(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): IssueSuggestionConnection!
  inheritsSharedAccess: Boolean!
  integrationSourceType: IntegrationService
  inverseRelations(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): IssueRelationConnection!
  labelIds: [String!]!
  labels(after: String, before: String, filter: IssueLabelFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): IssueLabelConnection!
  lastAppliedTemplate: Template
  needs(after: String, before: String, filter: CustomerNeedFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): CustomerNeedConnection!
  number: Float!
  parent: Issue
  previousIdentifiers: [String!]!
  priority: Float!
  priorityLabel: String!
  prioritySortOrder: Float!
  project: Project
  projectMilestone: ProjectMilestone
  reactionData: JSONObject!
  reactions: [Reaction!]!
  recurringIssueTemplate: Template
  relations(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): IssueRelationConnection!
  releases(after: String, before: String, filter: ReleaseFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): ReleaseConnection!
  sharedAccess: IssueSharedAccess!
  slaBreachesAt: DateTime
  slaHighRiskAt: DateTime
  slaMediumRiskAt: DateTime
  slaStartedAt: DateTime
  slaType: String
  snoozedBy: User
  snoozedUntilAt: DateTime
  sortOrder: Float!
  sourceComment: Comment
  startedAt: DateTime
  startedTriageAt: DateTime
  state: WorkflowState!
  stateHistory(after: String, before: String, first: Int, last: Int): IssueStateSpanConnection!
  subIssueSortOrder: Float
  subscribers(after: String, before: String, filter: UserFilter, first: Int, includeArchived: Boolean, includeDisabled: Boolean, last: Int, orderBy: PaginationOrderBy): UserConnection!
  suggestions(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): IssueSuggestionConnection!
  suggestionsGeneratedAt: DateTime
  summary: Summary
  syncedWith: [ExternalEntityInfo!]
  team: Team!
  title: String!
  trashed: Boolean
  triagedAt: DateTime
  updatedAt: DateTime!
  url: String!
}

type IssueArchivePayload implements ArchivePayload {
  entity: Issue
  lastSyncId: Float!
  success: Boolean!
}

input IssueBatchCreateInput {
  issues: [IssueCreateInput!]!
}

type IssueBatchPayload {
  issues: [Issue!]!
  lastSyncId: Float!
  success: Boolean!
}

input IssueCollectionFilter {
  accumulatedStateUpdatedAt: NullableDateComparator
  activity: ActivityCollectionFilter
  addedToCycleAt: NullableDateComparator
  addedToCyclePeriod: CyclePeriodComparator
  ageTime: NullableDurationComparator
  and: [IssueCollectionFilter!]
  archivedAt: NullableDateComparator
  assignee: NullableUserFilter
  attachments: AttachmentCollectionFilter
  autoArchivedAt: NullableDateComparator
  autoClosedAt: NullableDateComparator
  canceledAt: NullableDateComparator
  children: IssueCollectionFilter
  comments: CommentCollectionFilter
  completedAt: NullableDateComparator
  createdAt: DateComparator
  creator: NullableUserFilter
  customerCount: NumberComparator
  customerImportantCount: NumberComparator
  cycle: NullableCycleFilter
  cycleTime: NullableDurationComparator
  delegate: NullableUserFilter
  description: NullableStringComparator
  dueDate: NullableTimelessDateComparator
  estimate: EstimateComparator
  every: IssueFilter
  hasBlockedByRelations: RelationExistsComparator
  hasBlockingRelations: RelationExistsComparator
  hasDuplicateRelations: RelationExistsComparator
  hasRelatedRelations: RelationExistsComparator
  hasSharedUsers: RelationExistsComparator
  hasSuggestedAssignees: RelationExistsComparator
  hasSuggestedLabels: RelationExistsComparator
  hasSuggestedProjects: RelationExistsComparator
  hasSuggestedRelatedIssues: RelationExistsComparator
  hasSuggestedSimilarIssues: RelationExistsComparator
  hasSuggestedTeams: RelationExistsComparator
  id: IssueIDComparator
  labels: IssueLabelCollectionFilter
  lastAppliedTemplate: NullableTemplateFilter
  leadTime: NullableDurationComparator
  length: NumberComparator
  needs: CustomerNeedCollectionFilter
  number: NumberComparator
  or: [IssueCollectionFilter!]
  parent: NullableIssueFilter
  priority: NullableNumberComparator
  project: NullableProjectFilter
  projectMilestone: NullableProjectMilestoneFilter
  reactions: ReactionCollectionFilter
  recurringIssueTemplate: NullableTemplateFilter
  releases: ReleaseCollectionFilter
  searchableContent: ContentComparator
  sharedWith: UserCollectionFilter
  slaBreachesAt: NullableDateComparator
  slaStatus: SlaStatusComparator
  snoozedBy: NullableUserFilter
  snoozedUntilAt: NullableDateComparator
  some: IssueFilter
  sourceMetadata: SourceMetadataComparator
  startedAt: NullableDateComparator
  state: WorkflowStateFilter
  subscribers: UserCollectionFilter
  suggestions: IssueSuggestionCollectionFilter
  team: TeamFilter
  title: StringComparator
  triageTime: NullableDurationComparator
  triagedAt: NullableDateComparator
  updatedAt: DateComparator
}

type IssueConnection {
  edges: [IssueEdge!]!
  nodes: [Issue!]!
  pageInfo: PageInfo!
}

input IssueCreateInput {
  assigneeId: String
  completedAt: DateTime
  createAsUser: String
  createdAt: DateTime
  cycleId: String
  delegateId: String
  description: String
  descriptionData: JSON
  displayIconUrl: String
  dueDate: TimelessDate
  estimate: Int
  id: String
  inheritsSharedAccess: Boolean
  labelIds: [String!]
  lastAppliedTemplateId: String
  parentId: String
  preserveSortOrderOnCreate: Boolean
  priority: Int
  prioritySortOrder: Float
  projectId: String
  projectMilestoneId: String
  referenceCommentId: String
  releaseIds: [String!]
  slaBreachesAt: DateTime
  slaStartedAt: DateTime
  slaType: SLADayCountType
  sortOrder: Float
  sourceCommentId: String
  sourcePullRequestCommentId: String
  stateId: String
  subIssueSortOrder: Float
  subscriberIds: [String!]
  teamId: String!
  templateId: String
  title: String
  useDefaultTemplate: Boolean
}

type IssueDraft implements Node {
  archivedAt: DateTime
  assigneeId: String
  attachments: JSONObject
  createdAt: DateTime!
  creator: User!
  cycleId: String
  delegateId: String
  description: String
  descriptionData: JSON
  dueDate: TimelessDate
  estimate: Float
  id: ID!
  labelIds: [String!]!
  needs: JSONObject
  parent: IssueDraft
  parentId: String
  parentIssue: Issue
  parentIssueId: String
  priority: Float!
  priorityLabel: String!
  projectId: String
  projectMilestoneId: String
  releaseIds: [String!]!
  schedule: JSONObject
  sourceCommentId: String
  stateId: String!
  subIssueSortOrder: Float
  teamId: String!
  title: String!
  updatedAt: DateTime!
}

type IssueDraftConnection {
  edges: [IssueDraftEdge!]!
  nodes: [IssueDraft!]!
  pageInfo: PageInfo!
}

type IssueDraftEdge {
  cursor: String!
  node: IssueDraft!
}

type IssueEdge {
  cursor: String!
  node: Issue!
}

input IssueFilter {
  accumulatedStateUpdatedAt: NullableDateComparator
  activity: ActivityCollectionFilter
  addedToCycleAt: NullableDateComparator
  addedToCyclePeriod: CyclePeriodComparator
  ageTime: NullableDurationComparator
  and: [IssueFilter!]
  archivedAt: NullableDateComparator
  assignee: NullableUserFilter
  attachments: AttachmentCollectionFilter
  autoArchivedAt: NullableDateComparator
  autoClosedAt: NullableDateComparator
  canceledAt: NullableDateComparator
  children: IssueCollectionFilter
  comments: CommentCollectionFilter
  completedAt: NullableDateComparator
  createdAt: DateComparator
  creator: NullableUserFilter
  customerCount: NumberComparator
  customerImportantCount: NumberComparator
  cycle: NullableCycleFilter
  cycleTime: NullableDurationComparator
  delegate: NullableUserFilter
  description: NullableStringComparator
  dueDate: NullableTimelessDateComparator
  estimate: EstimateComparator
  hasBlockedByRelations: RelationExistsComparator
  hasBlockingRelations: RelationExistsComparator
  hasDuplicateRelations: RelationExistsComparator
  hasRelatedRelations: RelationExistsComparator
  hasSharedUsers: RelationExistsComparator
  hasSuggestedAssignees: RelationExistsComparator
  hasSuggestedLabels: RelationExistsComparator
  hasSuggestedProjects: RelationExistsComparator
  hasSuggestedRelatedIssues: RelationExistsComparator
  hasSuggestedSimilarIssues: RelationExistsComparator
  hasSuggestedTeams: RelationExistsComparator
  id: IssueIDComparator
  labels: IssueLabelCollectionFilter
  lastAppliedTemplate: NullableTemplateFilter
  leadTime: NullableDurationComparator
  needs: CustomerNeedCollectionFilter
  number: NumberComparator
  or: [IssueFilter!]
  parent: NullableIssueFilter
  priority: NullableNumberComparator
  project: NullableProjectFilter
  projectMilestone: NullableProjectMilestoneFilter
  reactions: ReactionCollectionFilter
  recurringIssueTemplate: NullableTemplateFilter
  releases: ReleaseCollectionFilter
  searchableContent: ContentComparator
  sharedWith: UserCollectionFilter
  slaBreachesAt: NullableDateComparator
  slaStatus: SlaStatusComparator
  snoozedBy: NullableUserFilter
  snoozedUntilAt: NullableDateComparator
  sourceMetadata: SourceMetadataComparator
  startedAt: NullableDateComparator
  state: WorkflowStateFilter
  subscribers: UserCollectionFilter
  suggestions: IssueSuggestionCollectionFilter
  team: TeamFilter
  title: StringComparator
  triageTime: NullableDurationComparator
  triagedAt: NullableDateComparator
  updatedAt: DateComparator
}

type IssueFilterSuggestionPayload {
  filter: JSONObject
  logId: String
}

type IssueHistory implements Node {
  actor: User
  actorId: String
  actors: [User!] @deprecated(reason: "Use \`actor\` and \`descriptionUpdatedBy\` instead.")
  addedLabelIds: [String!]
  addedLabels: [IssueLabel!]
  addedToReleaseIds: [String!]
  addedToReleases: [Release!]
  archived: Boolean
  archivedAt: DateTime
  attachment: Attachment
  attachmentId: String
  autoArchived: Boolean
  autoClosed: Boolean
  botActor: ActorBot
  changes: JSONObject
  createdAt: DateTime!
  customerNeedId: String
  descriptionUpdatedBy: [User!]
  fromAssignee: User
  fromAssigneeId: String
  fromCycle: Cycle
  fromCycleId: String
  fromDelegate: User
  fromDueDate: TimelessDate
  fromEstimate: Float
  fromParent: Issue
  fromParentId: String
  fromPriority: Float
  fromProject: Project
  fromProjectId: String
  fromProjectMilestone: ProjectMilestone
  fromSlaBreached: Boolean
  fromSlaBreachesAt: DateTime
  fromSlaStartedAt: DateTime
  fromSlaType: String
  fromState: WorkflowState
  fromStateId: String
  fromTeam: Team
  fromTeamId: String
  fromTitle: String
  id: ID!
  issue: Issue!
  issueImport: IssueImport
  relationChanges: [IssueRelationHistoryPayload!]
  removedFromReleaseIds: [String!]
  removedFromReleases: [Release!]
  removedLabelIds: [String!]
  removedLabels: [IssueLabel!]
  toAssignee: User
  toAssigneeId: String
  toConvertedProject: Project
  toConvertedProjectId: String
  toCycle: Cycle
  toCycleId: String
  toDelegate: User
  toDueDate: TimelessDate
  toEstimate: Float
  toParent: Issue
  toParentId: String
  toPriority: Float
  toProject: Project
  toProjectId: String
  toProjectMilestone: ProjectMilestone
  toSlaBreached: Boolean
  toSlaBreachesAt: DateTime
  toSlaStartedAt: DateTime
  toSlaType: String
  toState: WorkflowState
  toStateId: String
  toTeam: Team
  toTeamId: String
  toTitle: String
  trashed: Boolean
  triageResponsibilityAutoAssigned: Boolean
  triageResponsibilityNotifiedUsers: [User!]
  triageResponsibilityTeam: Team
  triageRuleMetadata: IssueHistoryTriageRuleMetadata @deprecated(reason: "Use \`workflowMetadata\` instead.")
  updatedAt: DateTime!
  updatedDescription: Boolean
  workflowMetadata: IssueHistoryWorkflowMetadata
}

type IssueHistoryConnection {
  edges: [IssueHistoryEdge!]!
  nodes: [IssueHistory!]!
  pageInfo: PageInfo!
}

type IssueHistoryEdge {
  cursor: String!
  node: IssueHistory!
}

type IssueHistoryTriageRuleError {
  conflictForSameChildLabel: Boolean
  conflictingLabels: [IssueLabel!]
  fromTeam: Team
  property: String
  toTeam: Team
  type: TriageRuleErrorType!
}

type IssueHistoryTriageRuleMetadata {
  triageRuleError: IssueHistoryTriageRuleError
  updatedByTriageRule: WorkflowDefinition @deprecated(reason: "Use \`IssueHistoryWorkflowMetadata.workflowDefinition\` instead.")
}

type IssueHistoryWorkflowMetadata {
  aiConversation: AiConversation
  workflowDefinition: WorkflowDefinition
}

input IssueIDComparator {
  eq: ID
  in: [ID!]
  neq: ID
  nin: [ID!]
}

type IssueImport implements Node {
  archivedAt: DateTime
  createdAt: DateTime!
  creatorId: String
  csvFileUrl: String
  displayName: String!
  error: String
  errorMetadata: JSONObject
  id: ID!
  mapping: JSONObject
  progress: Float
  service: String!
  serviceMetadata: JSONObject
  status: String!
  teamName: String
  updatedAt: DateTime!
}

type IssueImportCheckPayload {
  success: Boolean!
}

type IssueImportDeletePayload {
  issueImport: IssueImport
  lastSyncId: Float!
  success: Boolean!
}

type IssueImportJqlCheckPayload {
  count: Float
  error: String
  success: Boolean!
}

type IssueImportPayload {
  issueImport: IssueImport
  lastSyncId: Float!
  success: Boolean!
}

type IssueImportSyncCheckPayload {
  canSync: Boolean!
  error: String
}

input IssueImportUpdateInput {
  mapping: JSONObject!
}

type IssueLabel implements Node {
  archivedAt: DateTime
  children(after: String, before: String, filter: IssueLabelFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): IssueLabelConnection!
  color: String!
  createdAt: DateTime!
  creator: User
  description: String
  id: ID!
  inheritedFrom: IssueLabel
  isGroup: Boolean!
  issues(after: String, before: String, filter: IssueFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): IssueConnection!
  lastAppliedAt: DateTime
  name: String!
  organization: Organization! @deprecated(reason: "Workspace labels are identified by their team being null.")
  parent: IssueLabel
  retiredAt: DateTime
  retiredBy: User
  team: Team
  updatedAt: DateTime!
}

input IssueLabelCollectionFilter {
  and: [IssueLabelCollectionFilter!]
  createdAt: DateComparator
  creator: NullableUserFilter
  every: IssueLabelFilter
  id: IDComparator
  isGroup: BooleanComparator
  length: NumberComparator
  name: StringComparator
  null: Boolean
  or: [IssueLabelCollectionFilter!]
  parent: IssueLabelFilter
  some: IssueLabelFilter
  team: NullableTeamFilter
  updatedAt: DateComparator
}

type IssueLabelConnection {
  edges: [IssueLabelEdge!]!
  nodes: [IssueLabel!]!
  pageInfo: PageInfo!
}

input IssueLabelCreateInput {
  color: String
  description: String
  id: String
  isGroup: Boolean
  name: String!
  parentId: String
  retiredAt: DateTime
  teamId: String
}

type IssueLabelEdge {
  cursor: String!
  node: IssueLabel!
}

input IssueLabelFilter {
  and: [IssueLabelFilter!]
  createdAt: DateComparator
  creator: NullableUserFilter
  id: IDComparator
  isGroup: BooleanComparator
  name: StringComparator
  or: [IssueLabelFilter!]
  parent: IssueLabelFilter
  team: NullableTeamFilter
  updatedAt: DateComparator
}

type IssueLabelPayload {
  issueLabel: IssueLabel!
  lastSyncId: Float!
  success: Boolean!
}

input IssueLabelUpdateInput {
  color: String
  description: String
  isGroup: Boolean
  name: String
  parentId: String
  retiredAt: DateTime
}

type IssueNotification implements Entity & Node & Notification {
  actor: User
  actorAvatarColor: String!
  actorAvatarUrl: String
  actorInitials: String
  archivedAt: DateTime
  botActor: ActorBot
  category: NotificationCategory!
  comment: Comment
  commentId: String
  createdAt: DateTime!
  emailedAt: DateTime
  externalUserActor: ExternalUser
  groupingKey: String!
  groupingPriority: Float!
  id: ID!
  inboxUrl: String!
  initiativeUpdateHealth: String
  isLinearActor: Boolean!
  issue: Issue!
  issueId: String!
  issueStatusType: String
  parentComment: Comment
  parentCommentId: String
  projectUpdateHealth: String
  reactionEmoji: String
  readAt: DateTime
  snoozedUntilAt: DateTime
  subscriptions: [NotificationSubscription!]
  subtitle: String!
  team: Team!
  title: String!
  type: String!
  unsnoozedAt: DateTime
  updatedAt: DateTime!
  url: String!
  user: User!
}

type IssuePayload {
  issue: Issue
  lastSyncId: Float!
  success: Boolean!
}

type IssuePriorityValue {
  label: String!
  priority: Int!
}

input IssueReferenceInput {
  commitSha: String!
  identifier: String!
}

type IssueRelation implements Node {
  archivedAt: DateTime
  createdAt: DateTime!
  id: ID!
  issue: Issue!
  relatedIssue: Issue!
  type: String!
  updatedAt: DateTime!
}

type IssueRelationConnection {
  edges: [IssueRelationEdge!]!
  nodes: [IssueRelation!]!
  pageInfo: PageInfo!
}

input IssueRelationCreateInput {
  id: String
  issueId: String!
  relatedIssueId: String!
  type: IssueRelationType!
}

type IssueRelationEdge {
  cursor: String!
  node: IssueRelation!
}

type IssueRelationHistoryPayload {
  identifier: String!
  type: String!
}

type IssueRelationPayload {
  issueRelation: IssueRelation!
  lastSyncId: Float!
  success: Boolean!
}

enum IssueRelationType {
  blocks
  duplicate
  related
  similar
}

input IssueRelationUpdateInput {
  issueId: String
  relatedIssueId: String
  type: String
}

type IssueSearchPayload {
  archivePayload: ArchiveResponse!
  edges: [IssueSearchResultEdge!]!
  nodes: [IssueSearchResult!]!
  pageInfo: PageInfo!
  totalCount: Float!
}

type IssueSearchResult implements Node {
  activitySummary: JSONObject
  addedToCycleAt: DateTime
  addedToProjectAt: DateTime
  addedToTeamAt: DateTime
  aiPromptProgresses(after: String, before: String, filter: AiPromptProgressFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): AiPromptProgressConnection!
  archivedAt: DateTime
  asksExternalUserRequester: ExternalUser
  asksRequester: User
  assignee: User
  attachments(after: String, before: String, filter: AttachmentFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): AttachmentConnection!
  autoArchivedAt: DateTime
  autoClosedAt: DateTime
  boardOrder: Float! @deprecated(reason: "Will be removed in near future, please use \`sortOrder\` instead")
  botActor: ActorBot
  branchName: String!
  canceledAt: DateTime
  children(after: String, before: String, filter: IssueFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): IssueConnection!
  comments(after: String, before: String, filter: CommentFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): CommentConnection!
  completedAt: DateTime
  createdAt: DateTime!
  creator: User
  customerTicketCount: Int!
  cycle: Cycle
  delegate: User
  description: String
  descriptionState: String
  documentContent: DocumentContent
  documents(after: String, before: String, filter: DocumentFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): DocumentConnection!
  dueDate: TimelessDate
  estimate: Float
  externalUserCreator: ExternalUser
  favorite: Favorite
  formerAttachments(after: String, before: String, filter: AttachmentFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): AttachmentConnection!
  formerNeeds(after: String, before: String, filter: CustomerNeedFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): CustomerNeedConnection!
  history(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): IssueHistoryConnection!
  id: ID!
  identifier: String!
  incomingSuggestions(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): IssueSuggestionConnection!
  inheritsSharedAccess: Boolean!
  integrationSourceType: IntegrationService
  inverseRelations(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): IssueRelationConnection!
  labelIds: [String!]!
  labels(after: String, before: String, filter: IssueLabelFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): IssueLabelConnection!
  lastAppliedTemplate: Template
  metadata: JSONObject!
  needs(after: String, before: String, filter: CustomerNeedFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): CustomerNeedConnection!
  number: Float!
  parent: Issue
  previousIdentifiers: [String!]!
  priority: Float!
  priorityLabel: String!
  prioritySortOrder: Float!
  project: Project
  projectMilestone: ProjectMilestone
  reactionData: JSONObject!
  reactions: [Reaction!]!
  recurringIssueTemplate: Template
  relations(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): IssueRelationConnection!
  releases(after: String, before: String, filter: ReleaseFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): ReleaseConnection!
  sharedAccess: IssueSharedAccess!
  slaBreachesAt: DateTime
  slaHighRiskAt: DateTime
  slaMediumRiskAt: DateTime
  slaStartedAt: DateTime
  slaType: String
  snoozedBy: User
  snoozedUntilAt: DateTime
  sortOrder: Float!
  sourceComment: Comment
  startedAt: DateTime
  startedTriageAt: DateTime
  state: WorkflowState!
  stateHistory(after: String, before: String, first: Int, last: Int): IssueStateSpanConnection!
  subIssueSortOrder: Float
  subscribers(after: String, before: String, filter: UserFilter, first: Int, includeArchived: Boolean, includeDisabled: Boolean, last: Int, orderBy: PaginationOrderBy): UserConnection!
  suggestions(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): IssueSuggestionConnection!
  suggestionsGeneratedAt: DateTime
  summary: Summary
  syncedWith: [ExternalEntityInfo!]
  team: Team!
  title: String!
  trashed: Boolean
  triagedAt: DateTime
  updatedAt: DateTime!
  url: String!
}

type IssueSearchResultEdge {
  cursor: String!
  node: IssueSearchResult!
}

type IssueSharedAccess {
  disallowedIssueFields: [IssueSharedAccessDisallowedField!]!
  isShared: Boolean!
  sharedWithCount: Int!
  sharedWithUsers: [User!]!
  viewerHasOnlySharedAccess: Boolean!
}

enum IssueSharedAccessDisallowedField {
  cycleId
  projectId
  projectMilestoneId
  teamId
}

enum IssueSharingPolicy {
  adminsOnly
  allMembers
  disabled
}

input IssueSortInput {
  accumulatedStateUpdatedAt: TimeInStatusSort
  assignee: AssigneeSort
  completedAt: CompletedAtSort
  createdAt: CreatedAtSort
  customer: CustomerSort
  customerCount: CustomerCountSort
  customerImportantCount: CustomerImportantCountSort
  customerRevenue: CustomerRevenueSort
  cycle: CycleSort
  delegate: DelegateSort
  dueDate: DueDateSort
  estimate: EstimateSort
  label: LabelSort
  labelGroup: LabelGroupSort
  linkCount: LinkCountSort
  manual: ManualSort
  milestone: MilestoneSort
  priority: PrioritySort
  project: ProjectSort
  release: ReleaseSort
  rootIssue: RootIssueSort
  slaStatus: SlaStatusSort
  team: TeamSort
  title: TitleSort
  updatedAt: UpdatedAtSort
  workflowState: WorkflowStateSort
}

type IssueStateSpan {
  endedAt: DateTime
  id: ID!
  startedAt: DateTime!
  state: WorkflowState
  stateId: ID!
}

type IssueStateSpanConnection {
  edges: [IssueStateSpanEdge!]!
  nodes: [IssueStateSpan!]!
  pageInfo: PageInfo!
}

type IssueStateSpanEdge {
  cursor: String!
  node: IssueStateSpan!
}

input IssueSubscriptionFilter {
  assigneeId: IDComparator
  parentId: IDComparator
  projectId: IDComparator
  stateId: IDComparator
  teamId: IDComparator
}

type IssueSuggestion implements Node {
  archivedAt: DateTime
  createdAt: DateTime!
  dismissalReason: String
  id: ID!
  issue: Issue!
  issueId: String!
  metadata: IssueSuggestionMetadata
  state: IssueSuggestionState!
  stateChangedAt: DateTime!
  suggestedIssue: Issue
  suggestedIssueId: String
  suggestedLabel: IssueLabel
  suggestedLabelId: String
  suggestedProject: Project
  suggestedTeam: Team
  suggestedUser: User
  suggestedUserId: String
  type: IssueSuggestionType!
  updatedAt: DateTime!
}

input IssueSuggestionCollectionFilter {
  and: [IssueSuggestionCollectionFilter!]
  createdAt: DateComparator
  every: IssueSuggestionFilter
  id: IDComparator
  length: NumberComparator
  or: [IssueSuggestionCollectionFilter!]
  some: IssueSuggestionFilter
  state: StringComparator
  suggestedLabel: IssueLabelFilter
  suggestedProject: NullableProjectFilter
  suggestedTeam: NullableTeamFilter
  suggestedUser: NullableUserFilter
  type: StringComparator
  updatedAt: DateComparator
}

type IssueSuggestionConnection {
  edges: [IssueSuggestionEdge!]!
  nodes: [IssueSuggestion!]!
  pageInfo: PageInfo!
}

type IssueSuggestionEdge {
  cursor: String!
  node: IssueSuggestion!
}

input IssueSuggestionFilter {
  and: [IssueSuggestionFilter!]
  createdAt: DateComparator
  id: IDComparator
  or: [IssueSuggestionFilter!]
  state: StringComparator
  suggestedLabel: IssueLabelFilter
  suggestedProject: NullableProjectFilter
  suggestedTeam: NullableTeamFilter
  suggestedUser: NullableUserFilter
  type: StringComparator
  updatedAt: DateComparator
}

type IssueSuggestionMetadata {
  appliedAutomationRuleId: String
  classification: String
  evalLogId: String
  rank: Float
  reasons: [String!]
  score: Float
  variant: String
}

enum IssueSuggestionState {
  accepted
  active
  dismissed
  stale
}

enum IssueSuggestionType {
  assignee
  label
  project
  relatedIssue
  similarIssue
  team
}

type IssueTitleSuggestionFromCustomerRequestPayload {
  lastSyncId: Float!
  logId: String
  title: String!
}

type IssueToRelease implements Node {
  archivedAt: DateTime
  createdAt: DateTime!
  id: ID!
  issue: Issue!
  release: Release!
  updatedAt: DateTime!
}

type IssueToReleaseConnection {
  edges: [IssueToReleaseEdge!]!
  nodes: [IssueToRelease!]!
  pageInfo: PageInfo!
}

input IssueToReleaseCreateInput {
  id: String
  issueId: String!
  releaseId: String!
}

type IssueToReleaseEdge {
  cursor: String!
  node: IssueToRelease!
}

type IssueToReleasePayload {
  issueToRelease: IssueToRelease!
  lastSyncId: Float!
  success: Boolean!
}

input IssueUpdateInput {
  addedLabelIds: [String!]
  addedReleaseIds: [String!]
  assigneeId: String
  autoClosedByParentClosing: Boolean
  cycleId: String
  delegateId: String
  description: String
  descriptionData: JSON
  dueDate: TimelessDate
  estimate: Int
  inheritsSharedAccess: Boolean
  labelIds: [String!]
  lastAppliedTemplateId: String
  parentId: String
  priority: Int
  prioritySortOrder: Float
  projectId: String
  projectMilestoneId: String
  releaseIds: [String!]
  removedLabelIds: [String!]
  removedReleaseIds: [String!]
  slaBreachesAt: DateTime
  slaStartedAt: DateTime
  slaType: SLADayCountType
  snoozedById: String
  snoozedUntilAt: DateTime
  sortOrder: Float
  stateId: String
  subIssueSortOrder: Float
  subscriberIds: [String!]
  teamId: String
  title: String
  trashed: Boolean
}

scalar JSON

scalar JSONObject

input JiraConfigurationInput {
  accessToken: String!
  email: String!
  hostname: String!
  manualSetup: Boolean
}

input JiraFetchProjectStatusesInput {
  integrationId: String!
  projectId: String!
}

type JiraFetchProjectStatusesPayload {
  integration: Integration
  issueStatuses: [String!]!
  lastSyncId: Float!
  projectStatuses: [String!]!
  success: Boolean!
}

input JiraLinearMappingInput {
  bidirectional: Boolean
  default: Boolean
  jiraProjectId: String!
  legacyUnidirectional: Boolean
  linearTeamId: String!
}

input JiraPersonalSettingsInput {
  siteName: String
}

input JiraProjectDataInput {
  id: String!
  key: String!
  name: String!
}

input JiraSettingsInput {
  customOAuthServerUrl: String
  isCustomOAuth: Boolean
  isJiraServer: Boolean = false
  label: String
  manualSetup: Boolean
  personalOAuthClientId: String
  projectMapping: [JiraLinearMappingInput!]
  projects: [JiraProjectDataInput!]!
  setupPending: Boolean
  statusNamesPerIssueType: JSONObject
}

input JiraUpdateInput {
  accessToken: String
  deleteWebhook: Boolean
  email: String
  id: String!
  noSecret: Boolean
  updateMetadata: Boolean
  updateProjects: Boolean
  webhookSecret: String
}

input JoinOrganizationInput {
  inviteLink: String
  organizationId: String!
}

input LabelGroupSort {
  labelGroupId: String!
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

type LabelNotificationSubscription implements Entity & Node & NotificationSubscription {
  active: Boolean!
  archivedAt: DateTime
  contextViewType: ContextViewType
  createdAt: DateTime!
  customView: CustomView
  customer: Customer
  cycle: Cycle
  id: ID!
  initiative: Initiative
  label: IssueLabel!
  notificationSubscriptionTypes: [String!]!
  project: Project
  subscriber: User!
  team: Team
  updatedAt: DateTime!
  user: User
  userContextViewType: UserContextViewType
}

input LabelSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

input LaunchDarklySettingsInput {
  environment: String!
  projectKey: String!
}

input LinkCountSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

type LogoutResponse {
  success: Boolean!
}

input ManualSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

input McpServerCustomHeaderInput {
  name: String!
  value: String!
}

type MicrosoftTeamsChannel {
  displayName: String!
  id: String!
  membershipType: String!
}

type MicrosoftTeamsChannelsPayload {
  success: Boolean!
  teams: [MicrosoftTeamsTeam!]!
}

input MicrosoftTeamsPostSettingsInput {
  channelId: String!
  channelName: String!
  membershipType: String!
  teamId: String!
  teamName: String!
  tenantId: String!
}

input MicrosoftTeamsSettingsInput {
  enableCodeIntelligence: Boolean
  tenantName: String
}

type MicrosoftTeamsTeam {
  channels: [MicrosoftTeamsChannel!]!
  displayName: String!
  id: String!
}

input MilestoneSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

type Mutation {
  agentActivityCreate(input: AgentActivityCreateInput!): AgentActivityPayload!
  agentActivityCreatePrompt(input: AgentActivityCreatePromptInput!): AgentActivityPayload!
  agentSessionCreate(input: AgentSessionCreateInput!, pullRequestId: String): AgentSessionPayload!
  agentSessionCreateOnComment(input: AgentSessionCreateOnComment!): AgentSessionPayload!
  agentSessionCreateOnIssue(input: AgentSessionCreateOnIssue!): AgentSessionPayload!
  agentSessionUpdate(id: String!, input: AgentSessionUpdateInput!): AgentSessionPayload!
  agentSessionUpdateExternalUrl(id: String!, input: AgentSessionUpdateExternalUrlInput!): AgentSessionPayload!
  airbyteIntegrationConnect(input: AirbyteConfigurationInput!): IntegrationPayload!
  attachmentCreate(input: AttachmentCreateInput!): AttachmentPayload!
  attachmentDelete(id: String!): DeletePayload!
  attachmentLinkDiscord(channelId: String!, createAsUser: String, displayIconUrl: String, id: String, issueId: String!, messageId: String!, title: String, url: String!): AttachmentPayload!
  attachmentLinkFront(conversationId: String!, createAsUser: String, displayIconUrl: String, id: String, issueId: String!, title: String): FrontAttachmentPayload!
  attachmentLinkGitHubIssue(createAsUser: String, displayIconUrl: String, id: String, issueId: String!, title: String, url: String!): AttachmentPayload!
  attachmentLinkGitHubPR(createAsUser: String, displayIconUrl: String, id: String, issueId: String!, linkKind: GitLinkKind, title: String, url: String!): AttachmentPayload!
  attachmentLinkGitLabMR(createAsUser: String, displayIconUrl: String, id: String, issueId: String!, number: Float!, projectPathWithNamespace: String!, title: String, url: String!): AttachmentPayload!
  attachmentLinkIntercom(conversationId: String!, createAsUser: String, displayIconUrl: String, id: String, issueId: String!, partId: String, title: String): AttachmentPayload!
  attachmentLinkJiraIssue(createAsUser: String, displayIconUrl: String, id: String, issueId: String!, jiraIssueId: String!, title: String, url: String): AttachmentPayload!
  attachmentLinkSalesforce(createAsUser: String, displayIconUrl: String, id: String, issueId: String!, title: String, url: String!): AttachmentPayload!
  attachmentLinkSlack(createAsUser: String, displayIconUrl: String, id: String, issueId: String!, syncToCommentThread: Boolean, title: String, url: String!): AttachmentPayload!
  attachmentLinkURL(createAsUser: String, displayIconUrl: String, id: String, issueId: String!, title: String, url: String!): AttachmentPayload!
  attachmentLinkZendesk(createAsUser: String, displayIconUrl: String, id: String, issueId: String!, ticketId: String!, title: String, url: String): AttachmentPayload!
  attachmentSyncToSlack(id: String!): AttachmentPayload!
  attachmentUpdate(id: String!, input: AttachmentUpdateInput!): AttachmentPayload!
  commentCreate(input: CommentCreateInput!): CommentPayload!
  commentDelete(id: String!): DeletePayload!
  commentResolve(id: String!, resolvingCommentId: String): CommentPayload!
  commentUnresolve(id: String!): CommentPayload!
  commentUpdate(id: String!, input: CommentUpdateInput!, skipEditedAt: Boolean): CommentPayload!
  contactCreate(input: ContactCreateInput!): ContactPayload!
  contactSalesCreate(input: ContactSalesCreateInput!): ContactPayload!
  createCsvExportReport(includePrivateTeamIds: [String!]): CreateCsvExportReportPayload!
  createInitiativeUpdateReminder(initiativeId: String!, userId: String): InitiativeUpdateReminderPayload!
  createOrganizationFromOnboarding(input: CreateOrganizationInput!, sessionId: String, survey: OnboardingCustomerSurvey): CreateOrJoinOrganizationResponse!
  createProjectUpdateReminder(projectId: String!, userId: String): ProjectUpdateReminderPayload!
  customViewCreate(input: CustomViewCreateInput!): CustomViewPayload!
  customViewDelete(id: String!): DeletePayload!
  customViewUpdate(id: String!, input: CustomViewUpdateInput!): CustomViewPayload!
  customerCreate(input: CustomerCreateInput!): CustomerPayload!
  customerDelete(id: String!): DeletePayload!
  customerMerge(sourceCustomerId: String!, targetCustomerId: String!): CustomerPayload!
  customerNeedArchive(id: String!): CustomerNeedArchivePayload!
  customerNeedCreate(input: CustomerNeedCreateInput!): CustomerNeedPayload!
  customerNeedCreateFromAttachment(input: CustomerNeedCreateFromAttachmentInput!): CustomerNeedPayload!
  customerNeedDelete(id: String!, keepAttachment: Boolean): DeletePayload!
  customerNeedUnarchive(id: String!): CustomerNeedArchivePayload!
  customerNeedUpdate(clearAttachment: Boolean, id: String!, input: CustomerNeedUpdateInput!): CustomerNeedUpdatePayload!
  customerStatusCreate(input: CustomerStatusCreateInput!): CustomerStatusPayload!
  customerStatusDelete(id: String!): DeletePayload!
  customerStatusUpdate(id: String!, input: CustomerStatusUpdateInput!): CustomerStatusPayload!
  customerTierCreate(input: CustomerTierCreateInput!): CustomerTierPayload!
  customerTierDelete(id: String!): DeletePayload!
  customerTierUpdate(id: String!, input: CustomerTierUpdateInput!): CustomerTierPayload!
  customerUnsync(id: String!): CustomerPayload!
  customerUpdate(id: String!, input: CustomerUpdateInput!): CustomerPayload!
  customerUpsert(input: CustomerUpsertInput!): CustomerPayload!
  cycleArchive(id: String!): CycleArchivePayload!
  cycleCreate(input: CycleCreateInput!): CyclePayload!
  cycleShiftAll(input: CycleShiftAllInput!): CyclePayload!
  cycleStartUpcomingCycleToday(id: String!): CyclePayload!
  cycleUpdate(id: String!, input: CycleUpdateInput!): CyclePayload!
  documentCreate(input: DocumentCreateInput!): DocumentPayload!
  documentDelete(id: String!): DocumentArchivePayload!
  documentUnarchive(id: String!): DocumentArchivePayload!
  documentUpdate(id: String!, input: DocumentUpdateInput!): DocumentPayload!
  emailIntakeAddressCreate(input: EmailIntakeAddressCreateInput!): EmailIntakeAddressPayload!
  emailIntakeAddressDelete(id: String!): DeletePayload!
  emailIntakeAddressRotate(id: String!): EmailIntakeAddressPayload!
  emailIntakeAddressUpdate(id: String!, input: EmailIntakeAddressUpdateInput!): EmailIntakeAddressPayload!
  emailTokenUserAccountAuth(input: TokenUserAccountAuthInput!): AuthResolverResponse!
  emailUnsubscribe(input: EmailUnsubscribeInput!): EmailUnsubscribePayload!
  emailUserAccountAuthChallenge(input: EmailUserAccountAuthChallengeInput!): EmailUserAccountAuthChallengeResponse!
  emojiCreate(input: EmojiCreateInput!): EmojiPayload!
  emojiDelete(id: String!): DeletePayload!
  entityExternalLinkCreate(input: EntityExternalLinkCreateInput!): EntityExternalLinkPayload!
  entityExternalLinkDelete(id: String!): DeletePayload!
  entityExternalLinkUpdate(id: String!, input: EntityExternalLinkUpdateInput!): EntityExternalLinkPayload!
  favoriteCreate(input: FavoriteCreateInput!): FavoritePayload!
  favoriteDelete(id: String!): DeletePayload!
  favoriteUpdate(id: String!, input: FavoriteUpdateInput!): FavoritePayload!
  fileUpload(contentType: String!, filename: String!, makePublic: Boolean, metaData: JSON, size: Int!): UploadPayload!
  fileUploadDangerouslyDelete(assetUrl: String!): FileUploadDeletePayload!
  gitAutomationStateCreate(input: GitAutomationStateCreateInput!): GitAutomationStatePayload!
  gitAutomationStateDelete(id: String!): DeletePayload!
  gitAutomationStateUpdate(id: String!, input: GitAutomationStateUpdateInput!): GitAutomationStatePayload!
  gitAutomationTargetBranchCreate(input: GitAutomationTargetBranchCreateInput!): GitAutomationTargetBranchPayload!
  gitAutomationTargetBranchDelete(id: String!): DeletePayload!
  gitAutomationTargetBranchUpdate(id: String!, input: GitAutomationTargetBranchUpdateInput!): GitAutomationTargetBranchPayload!
  googleUserAccountAuth(input: GoogleUserAccountAuthInput!): AuthResolverResponse!
  imageUploadFromUrl(url: String!): ImageUploadFromUrlPayload!
  importFileUpload(contentType: String!, filename: String!, metaData: JSON, size: Int!): UploadPayload!
  initiativeArchive(id: String!): InitiativeArchivePayload!
  initiativeCreate(input: InitiativeCreateInput!): InitiativePayload!
  initiativeDelete(id: String!): DeletePayload!
  initiativeRelationCreate(input: InitiativeRelationCreateInput!): InitiativeRelationPayload!
  initiativeRelationDelete(id: String!): DeletePayload!
  initiativeRelationUpdate(id: String!, input: InitiativeRelationUpdateInput!): InitiativeRelationPayload!
  initiativeToProjectCreate(input: InitiativeToProjectCreateInput!): InitiativeToProjectPayload!
  initiativeToProjectDelete(id: String!): DeletePayload!
  initiativeToProjectUpdate(id: String!, input: InitiativeToProjectUpdateInput!): InitiativeToProjectPayload!
  initiativeUnarchive(id: String!): InitiativeArchivePayload!
  initiativeUpdate(id: String!, input: InitiativeUpdateInput!): InitiativePayload!
  initiativeUpdateArchive(id: String!): InitiativeUpdateArchivePayload!
  initiativeUpdateCreate(input: InitiativeUpdateCreateInput!): InitiativeUpdatePayload!
  initiativeUpdateUnarchive(id: String!): InitiativeUpdateArchivePayload!
  initiativeUpdateUpdate(id: String!, input: InitiativeUpdateUpdateInput!): InitiativeUpdatePayload!
  integrationArchive(id: String!): DeletePayload!
  integrationAsksConnectChannel(code: String!, redirectUri: String!): AsksChannelConnectPayload!
  integrationCustomerDataAttributesRefresh(input: IntegrationCustomerDataAttributesRefreshInput!): IntegrationPayload!
  integrationDelete(id: String!, skipInstallationDeletion: Boolean): DeletePayload!
  integrationDiscord(code: String!, redirectUri: String!): IntegrationPayload!
  integrationFigma(code: String!, redirectUri: String!): IntegrationPayload!
  integrationFront(code: String!, redirectUri: String!): IntegrationPayload!
  integrationGitHubEnterpriseServerConnect(githubUrl: String!, organizationName: String!): GitHubEnterpriseServerPayload!
  integrationGitHubPersonal(code: String!, codeAccess: Boolean, enterpriseUrl: String): IntegrationPayload!
  integrationGithubCommitCreate: GitHubCommitIntegrationPayload!
  integrationGithubConnect(code: String!, codeAccess: Boolean = false, githubHost: String, installationId: String!): IntegrationPayload!
  integrationGithubImportConnect(code: String!, installationId: String!): IntegrationPayload!
  integrationGithubImportRefresh(id: String!): IntegrationPayload!
  integrationGitlabConnect(accessToken: String!, gitlabUrl: String!): GitLabIntegrationCreatePayload!
  integrationGitlabTestConnection(integrationId: String!): GitLabTestConnectionPayload!
  integrationGong(code: String!, redirectUri: String!): IntegrationPayload!
  integrationGoogleCalendarPersonalConnect(code: String!): IntegrationPayload!
  integrationGoogleSheets(code: String!): IntegrationPayload!
  integrationIntercom(code: String!, domainUrl: String, redirectUri: String!): IntegrationPayload!
  integrationIntercomDelete: IntegrationPayload!
  integrationIntercomSettingsUpdate(input: IntercomSettingsInput!): IntegrationPayload! @deprecated(reason: "This mutation is deprecated, please use \`integrationSettingsUpdate\` instead")
  integrationJiraFetchProjectStatuses(input: JiraFetchProjectStatusesInput!): JiraFetchProjectStatusesPayload!
  integrationJiraPersonal(accessToken: String, code: String): IntegrationPayload!
  integrationJiraUpdate(input: JiraUpdateInput!): IntegrationPayload!
  integrationLaunchDarklyConnect(code: String!, environment: String!, projectKey: String!): IntegrationPayload!
  integrationLaunchDarklyPersonalConnect(code: String!): IntegrationPayload!
  integrationLoom: IntegrationPayload! @deprecated(reason: "Not available.")
  integrationMcpServerConnect(customHeaders: [McpServerCustomHeaderInput!], serverUrl: String!, teamId: String, workflowDefinitionId: String): IntegrationPayload!
  integrationMcpServerPersonalConnect(customHeaders: [McpServerCustomHeaderInput!], serverUrl: String!): IntegrationPayload!
  integrationMicrosoftPersonalConnect(code: String!, redirectUri: String!): IntegrationPayload!
  integrationMicrosoftTeams(code: String!, redirectUri: String!): IntegrationPayload!
  integrationMicrosoftTeamsProjectPost(channelId: String!, channelName: String!, membershipType: String!, projectId: String!, teamId: String!, teamName: String!): IntegrationPayload!
  integrationOpsgenieConnect(apiKey: String!): IntegrationPayload!
  integrationOpsgenieRefreshScheduleMappings: IntegrationPayload!
  integrationPagerDutyConnect(code: String!, redirectUri: String!): IntegrationPayload!
  integrationPagerDutyRefreshScheduleMappings: IntegrationPayload!
  integrationRequest(input: IntegrationRequestInput!): IntegrationRequestPayload!
  integrationSalesforce(code: String!, redirectUri: String!, subdomain: String!): IntegrationPayload!
  integrationSalesforceMetadataRefresh(id: String!): IntegrationPayload!
  integrationSentryConnect(code: String!, installationId: String!, organizationSlug: String!): IntegrationPayload!
  integrationSettingsUpdate(id: String!, input: IntegrationSettingsInput!): IntegrationPayload! @deprecated(reason: "Use integrationUpdate instead.")
  integrationSlack(code: String!, redirectUri: String!, shouldUseV2Auth: Boolean): IntegrationPayload!
  integrationSlackAsks(code: String!, redirectUri: String!): IntegrationPayload!
  integrationSlackCustomViewNotifications(code: String!, customViewId: String!, redirectUri: String!): SlackChannelConnectPayload!
  integrationSlackCustomerChannelLink(code: String!, customerId: String!, redirectUri: String!): SuccessPayload!
  integrationSlackImportEmojis(code: String!, redirectUri: String!): IntegrationPayload!
  integrationSlackInitiativePost(code: String!, initiativeId: String!, redirectUri: String!): SlackChannelConnectPayload!
  integrationSlackOrAsksUpdateSlackTeamName(integrationId: String!): IntegrationSlackWorkspaceNamePayload!
  integrationSlackOrgInitiativeUpdatesPost(code: String!, redirectUri: String!): SlackChannelConnectPayload!
  integrationSlackOrgProjectUpdatesPost(code: String!, redirectUri: String!): SlackChannelConnectPayload!
  integrationSlackPersonal(code: String!, redirectUri: String!): IntegrationPayload!
  integrationSlackPost(code: String!, redirectUri: String!, shouldUseV2Auth: Boolean, teamId: String!): SlackChannelConnectPayload!
  integrationSlackProjectPost(code: String!, projectId: String!, redirectUri: String!, service: String!): SlackChannelConnectPayload!
  integrationSlackWorkflowAccessUpdate(enabled: Boolean!, integrationId: String!): IntegrationPayload!
  integrationTemplateCreate(input: IntegrationTemplateCreateInput!): IntegrationTemplatePayload!
  integrationTemplateDelete(id: String!): DeletePayload!
  integrationUpdate(id: String!, input: IntegrationUpdateInput!): IntegrationPayload!
  integrationZendesk(code: String!, redirectUri: String!, scope: String!, subdomain: String!): IntegrationPayload!
  integrationsSettingsCreate(input: IntegrationsSettingsCreateInput!): IntegrationsSettingsPayload!
  integrationsSettingsUpdate(id: String!, input: IntegrationsSettingsUpdateInput!): IntegrationsSettingsPayload!
  issueAddLabel(id: String!, labelId: String!): IssuePayload!
  issueArchive(id: String!, trash: Boolean): IssueArchivePayload!
  issueBatchCreate(input: IssueBatchCreateInput!): IssueBatchPayload!
  issueBatchUpdate(ids: [UUID!]!, input: IssueUpdateInput!): IssueBatchPayload!
  issueCreate(input: IssueCreateInput!): IssuePayload!
  issueDelete(id: String!, permanentlyDelete: Boolean): IssueArchivePayload!
  issueDescriptionUpdateFromFront(description: String!, id: String!): IssuePayload!
  issueExternalSyncDisable(attachmentId: String!): IssuePayload!
  issueImportCreateAsana(asanaTeamName: String!, asanaToken: String!, id: String, includeClosedIssues: Boolean, instantProcess: Boolean, teamId: String, teamName: String): IssueImportPayload!
  issueImportCreateCSVJira(csvUrl: String!, jiraEmail: String, jiraHostname: String, jiraToken: String, teamId: String, teamName: String): IssueImportPayload!
  issueImportCreateClubhouse(clubhouseGroupName: String!, clubhouseToken: String!, id: String, includeClosedIssues: Boolean, instantProcess: Boolean, teamId: String, teamName: String): IssueImportPayload!
  issueImportCreateGithub(githubLabels: [String!], githubRepoIds: [Int!], includeClosedIssues: Boolean, instantProcess: Boolean, teamId: String, teamName: String): IssueImportPayload!
  issueImportCreateJira(id: String, includeClosedIssues: Boolean, instantProcess: Boolean, jiraEmail: String!, jiraHostname: String!, jiraProject: String!, jiraToken: String!, jql: String, teamId: String, teamName: String): IssueImportPayload!
  issueImportCreateLinearV2(id: String, linearSourceOrganizationId: String!): IssueImportPayload!
  issueImportDelete(issueImportId: String!): IssueImportDeletePayload!
  issueImportProcess(issueImportId: String!, mapping: JSONObject!): IssueImportPayload!
  issueImportUpdate(id: String!, input: IssueImportUpdateInput!): IssueImportPayload!
  issueLabelCreate(input: IssueLabelCreateInput!, replaceTeamLabels: Boolean): IssueLabelPayload!
  issueLabelDelete(id: String!): DeletePayload!
  issueLabelRestore(id: String!): IssueLabelPayload!
  issueLabelRetire(id: String!): IssueLabelPayload!
  issueLabelUpdate(id: String!, input: IssueLabelUpdateInput!, replaceTeamLabels: Boolean): IssueLabelPayload!
  issueRelationCreate(input: IssueRelationCreateInput!, overrideCreatedAt: DateTime): IssueRelationPayload!
  issueRelationDelete(id: String!): DeletePayload!
  issueRelationUpdate(id: String!, input: IssueRelationUpdateInput!): IssueRelationPayload!
  issueReminder(id: String!, reminderAt: DateTime!): IssuePayload!
  issueRemoveLabel(id: String!, labelId: String!): IssuePayload!
  issueSubscribe(id: String!, userEmail: String, userId: String): IssuePayload!
  issueToReleaseCreate(input: IssueToReleaseCreateInput!): IssueToReleasePayload!
  issueToReleaseDelete(id: String!): DeletePayload!
  issueToReleaseDeleteByIssueAndRelease(issueId: String!, releaseId: String!): DeletePayload!
  issueUnarchive(id: String!): IssueArchivePayload!
  issueUnsubscribe(id: String!, userEmail: String, userId: String): IssuePayload!
  issueUpdate(id: String!, input: IssueUpdateInput!): IssuePayload!
  jiraIntegrationConnect(input: JiraConfigurationInput!): IntegrationPayload!
  joinOrganizationFromOnboarding(input: JoinOrganizationInput!): CreateOrJoinOrganizationResponse!
  leaveOrganization(organizationId: String!): CreateOrJoinOrganizationResponse!
  logout(reason: String): LogoutResponse!
  logoutAllSessions(reason: String): LogoutResponse!
  logoutOtherSessions(reason: String): LogoutResponse!
  logoutSession(sessionId: String!): LogoutResponse!
  notificationArchive(id: String!): NotificationArchivePayload!
  notificationArchiveAll(input: NotificationEntityInput!): NotificationBatchActionPayload!
  notificationCategoryChannelSubscriptionUpdate(category: NotificationCategory!, channel: NotificationChannel!, subscribe: Boolean!): UserSettingsPayload!
  notificationMarkReadAll(input: NotificationEntityInput!, readAt: DateTime!): NotificationBatchActionPayload!
  notificationMarkUnreadAll(input: NotificationEntityInput!): NotificationBatchActionPayload!
  notificationSnoozeAll(input: NotificationEntityInput!, snoozedUntilAt: DateTime!): NotificationBatchActionPayload!
  notificationSubscriptionCreate(input: NotificationSubscriptionCreateInput!): NotificationSubscriptionPayload!
  notificationSubscriptionDelete(id: String!): DeletePayload! @deprecated(reason: "Update \`notificationSubscription.active\` to \`false\` instead.")
  notificationSubscriptionUpdate(id: String!, input: NotificationSubscriptionUpdateInput!): NotificationSubscriptionPayload!
  notificationUnarchive(id: String!): NotificationArchivePayload!
  notificationUnsnoozeAll(input: NotificationEntityInput!, unsnoozedAt: DateTime!): NotificationBatchActionPayload!
  notificationUpdate(id: String!, input: NotificationUpdateInput!): NotificationPayload!
  organizationCancelDelete: OrganizationCancelDeletePayload!
  organizationDelete(input: DeleteOrganizationInput!): OrganizationDeletePayload!
  organizationDeleteChallenge: OrganizationDeletePayload!
  organizationDomainClaim(id: String!): OrganizationDomainSimplePayload!
  organizationDomainCreate(input: OrganizationDomainCreateInput!, triggerEmailVerification: Boolean): OrganizationDomainPayload!
  organizationDomainDelete(id: String!): DeletePayload!
  organizationDomainUpdate(id: String!, input: OrganizationDomainUpdateInput!): OrganizationDomainPayload!
  organizationDomainVerify(input: OrganizationDomainVerificationInput!): OrganizationDomainPayload!
  organizationInviteCreate(input: OrganizationInviteCreateInput!): OrganizationInvitePayload!
  organizationInviteDelete(id: String!): DeletePayload!
  organizationInviteUpdate(id: String!, input: OrganizationInviteUpdateInput!): OrganizationInvitePayload!
  organizationStartTrial: OrganizationStartTrialPayload! @deprecated(reason: "Use organizationStartTrialForPlan")
  organizationStartTrialForPlan(input: OrganizationStartTrialInput!): OrganizationStartTrialPayload!
  organizationUpdate(input: OrganizationUpdateInput!): OrganizationPayload!
  passkeyLoginFinish(authId: String!, response: JSONObject!): AuthResolverResponse!
  passkeyLoginStart(authId: String!): PasskeyLoginStartResponse!
  projectAddLabel(id: String!, labelId: String!): ProjectPayload!
  projectArchive(id: String!, trash: Boolean): ProjectArchivePayload! @deprecated(reason: "Deprecated in favor of projectDelete.")
  projectCreate(input: ProjectCreateInput!, slackChannelName: String): ProjectPayload!
  projectCreateSlackChannel(id: String!, integrationId: String, slackChannelName: String!): ProjectPayload!
  projectDelete(id: String!): ProjectArchivePayload!
  projectExternalSyncDisable(projectId: String!, syncSource: ExternalSyncService!): ProjectPayload!
  projectLabelCreate(input: ProjectLabelCreateInput!): ProjectLabelPayload!
  projectLabelDelete(id: String!): DeletePayload!
  projectLabelRestore(id: String!): ProjectLabelPayload!
  projectLabelRetire(id: String!): ProjectLabelPayload!
  projectLabelUpdate(id: String!, input: ProjectLabelUpdateInput!): ProjectLabelPayload!
  projectMilestoneCreate(input: ProjectMilestoneCreateInput!): ProjectMilestonePayload!
  projectMilestoneDelete(id: String!): DeletePayload!
  projectMilestoneMove(id: String!, input: ProjectMilestoneMoveInput!): ProjectMilestoneMovePayload!
  projectMilestoneUpdate(id: String!, input: ProjectMilestoneUpdateInput!): ProjectMilestonePayload!
  projectReassignStatus(newProjectStatusId: String!, originalProjectStatusId: String!): SuccessPayload!
  projectRelationCreate(input: ProjectRelationCreateInput!): ProjectRelationPayload!
  projectRelationDelete(id: String!): DeletePayload!
  projectRelationUpdate(id: String!, input: ProjectRelationUpdateInput!): ProjectRelationPayload!
  projectRemoveLabel(id: String!, labelId: String!): ProjectPayload!
  projectStatusArchive(id: String!): ProjectStatusArchivePayload!
  projectStatusCreate(input: ProjectStatusCreateInput!): ProjectStatusPayload!
  projectStatusUnarchive(id: String!): ProjectStatusArchivePayload!
  projectStatusUpdate(id: String!, input: ProjectStatusUpdateInput!): ProjectStatusPayload!
  projectUnarchive(id: String!): ProjectArchivePayload!
  projectUpdate(id: String!, input: ProjectUpdateInput!): ProjectPayload!
  projectUpdateArchive(id: String!): ProjectUpdateArchivePayload!
  projectUpdateCreate(input: ProjectUpdateCreateInput!): ProjectUpdatePayload!
  projectUpdateDelete(id: String!): DeletePayload! @deprecated(reason: "Use \`projectUpdateArchive\` instead.")
  projectUpdateUnarchive(id: String!): ProjectUpdateArchivePayload!
  projectUpdateUpdate(id: String!, input: ProjectUpdateUpdateInput!): ProjectUpdatePayload!
  pushSubscriptionCreate(input: PushSubscriptionCreateInput!): PushSubscriptionPayload!
  pushSubscriptionDelete(id: String!): PushSubscriptionPayload!
  reactionCreate(input: ReactionCreateInput!): ReactionPayload!
  reactionDelete(id: String!): DeletePayload!
  refreshGoogleSheetsData(id: String!, type: String): IntegrationPayload!
  releaseArchive(id: String!): ReleaseArchivePayload!
  releaseComplete(input: ReleaseCompleteInput!): ReleasePayload!
  releaseCompleteByAccessKey(input: ReleaseCompleteInputBase!): ReleasePayload!
  releaseCreate(input: ReleaseCreateInput!): ReleasePayload!
  releaseDelete(id: String!): ReleaseArchivePayload!
  releaseNoteCreate(input: ReleaseNoteCreateInput!): ReleaseNotePayload!
  releaseNoteDelete(id: String!): DeletePayload!
  releaseNoteUpdate(id: String!, input: ReleaseNoteUpdateInput!): ReleaseNotePayload!
  releasePipelineArchive(id: String!): ReleasePipelineArchivePayload!
  releasePipelineCreate(input: ReleasePipelineCreateInput!): ReleasePipelinePayload!
  releasePipelineDelete(id: String!): DeletePayload!
  releasePipelineUnarchive(id: String!): ReleasePipelineArchivePayload!
  releasePipelineUpdate(id: String!, input: ReleasePipelineUpdateInput!): ReleasePipelinePayload!
  releaseStageArchive(id: String!): ReleaseStageArchivePayload!
  releaseStageCreate(input: ReleaseStageCreateInput!): ReleaseStagePayload!
  releaseStageUnarchive(id: String!): ReleaseStageArchivePayload!
  releaseStageUpdate(id: String!, input: ReleaseStageUpdateInput!): ReleaseStagePayload!
  releaseSync(input: ReleaseSyncInput!): ReleasePayload!
  releaseSyncByAccessKey(input: ReleaseSyncInputBase!): ReleasePayload!
  releaseUnarchive(id: String!): ReleaseArchivePayload!
  releaseUpdate(id: String!, input: ReleaseUpdateInput!): ReleasePayload!
  releaseUpdateByPipeline(input: ReleaseUpdateByPipelineInput!): ReleasePayload!
  releaseUpdateByPipelineByAccessKey(input: ReleaseUpdateByPipelineInputBase!): ReleasePayload!
  resendOrganizationInvite(id: String!): DeletePayload!
  resendOrganizationInviteByEmail(email: String!): DeletePayload!
  roadmapArchive(id: String!): RoadmapArchivePayload! @deprecated(reason: "Roadmaps are deprecated, use initiatives instead.")
  roadmapCreate(input: RoadmapCreateInput!): RoadmapPayload! @deprecated(reason: "Roadmaps are deprecated, use initiatives instead.")
  roadmapDelete(id: String!): DeletePayload! @deprecated(reason: "Roadmaps are deprecated, use initiatives instead.")
  roadmapToProjectCreate(input: RoadmapToProjectCreateInput!): RoadmapToProjectPayload!
  roadmapToProjectDelete(id: String!): DeletePayload!
  roadmapToProjectUpdate(id: String!, input: RoadmapToProjectUpdateInput!): RoadmapToProjectPayload!
  roadmapUnarchive(id: String!): RoadmapArchivePayload! @deprecated(reason: "Roadmaps are deprecated, use initiatives instead.")
  roadmapUpdate(id: String!, input: RoadmapUpdateInput!): RoadmapPayload! @deprecated(reason: "Roadmaps are deprecated, use initiatives instead.")
  samlTokenUserAccountAuth(input: TokenUserAccountAuthInput!): AuthResolverResponse!
  teamCreate(copySettingsFromTeamId: String, input: TeamCreateInput!): TeamPayload!
  teamCyclesDelete(id: String!): TeamPayload!
  teamDelete(id: String!): DeletePayload!
  teamKeyDelete(id: String!): DeletePayload!
  teamMembershipCreate(input: TeamMembershipCreateInput!): TeamMembershipPayload!
  teamMembershipDelete(alsoLeaveParentTeams: Boolean, id: String!): DeletePayload!
  teamMembershipUpdate(id: String!, input: TeamMembershipUpdateInput!): TeamMembershipPayload!
  teamUnarchive(id: String!): TeamArchivePayload!
  teamUpdate(id: String!, input: TeamUpdateInput!, mapping: InheritanceEntityMapping): TeamPayload!
  templateCreate(input: TemplateCreateInput!): TemplatePayload!
  templateDelete(id: String!): DeletePayload!
  templateUpdate(id: String!, input: TemplateUpdateInput!): TemplatePayload!
  timeScheduleCreate(input: TimeScheduleCreateInput!): TimeSchedulePayload!
  timeScheduleDelete(id: String!): DeletePayload!
  timeScheduleRefreshIntegrationSchedule(id: String!): TimeSchedulePayload!
  timeScheduleUpdate(id: String!, input: TimeScheduleUpdateInput!): TimeSchedulePayload!
  timeScheduleUpsertExternal(externalId: String!, input: TimeScheduleUpdateInput!): TimeSchedulePayload!
  trackAnonymousEvent(input: EventTrackingInput!): EventTrackingPayload!
  triageResponsibilityCreate(input: TriageResponsibilityCreateInput!): TriageResponsibilityPayload!
  triageResponsibilityDelete(id: String!): DeletePayload!
  triageResponsibilityUpdate(id: String!, input: TriageResponsibilityUpdateInput!): TriageResponsibilityPayload!
  updateIntegrationSlackScopes(code: String!, integrationId: String!, redirectUri: String!): IntegrationPayload!
  userChangeRole(id: String!, role: UserRoleType!): UserAdminPayload!
  userDiscordConnect(code: String!, redirectUri: String!): UserPayload!
  userExternalUserDisconnect(service: String!): UserPayload!
  userFlagUpdate(flag: UserFlagType!, operation: UserFlagUpdateOperation!): UserSettingsFlagPayload!
  userRevokeAllSessions(id: String!): UserAdminPayload!
  userRevokeSession(id: String!, sessionId: String!): UserAdminPayload!
  userSettingsFlagsReset(flags: [UserFlagType!]): UserSettingsFlagsResetPayload!
  userSettingsUpdate(id: String!, input: UserSettingsUpdateInput!): UserSettingsPayload!
  userSuspend(forceBypassScimRestrictions: Boolean, id: String!): UserAdminPayload!
  userUnlinkFromIdentityProvider(id: String!): UserAdminPayload!
  userUnsuspend(forceBypassScimRestrictions: Boolean, id: String!): UserAdminPayload!
  userUpdate(id: String!, input: UserUpdateInput!): UserPayload!
  viewPreferencesCreate(input: ViewPreferencesCreateInput!): ViewPreferencesPayload!
  viewPreferencesDelete(id: String!): DeletePayload!
  viewPreferencesUpdate(id: String!, input: ViewPreferencesUpdateInput!): ViewPreferencesPayload!
  webhookCreate(input: WebhookCreateInput!): WebhookPayload!
  webhookDelete(id: String!): DeletePayload!
  webhookRotateSecret(id: String!): WebhookRotateSecretPayload!
  webhookUpdate(id: String!, input: WebhookUpdateInput!): WebhookPayload!
  workflowStateArchive(id: String!): WorkflowStateArchivePayload!
  workflowStateCreate(input: WorkflowStateCreateInput!): WorkflowStatePayload!
  workflowStateUpdate(id: String!, input: WorkflowStateUpdateInput!): WorkflowStatePayload!
}

input NameSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

interface Node {
  id: ID!
}

interface Notification implements Entity & Node {
  actor: User
  actorAvatarColor: String!
  actorAvatarUrl: String
  actorInitials: String
  archivedAt: DateTime
  botActor: ActorBot
  category: NotificationCategory!
  createdAt: DateTime!
  emailedAt: DateTime
  externalUserActor: ExternalUser
  groupingKey: String!
  groupingPriority: Float!
  id: ID!
  inboxUrl: String!
  initiativeUpdateHealth: String
  isLinearActor: Boolean!
  issueStatusType: String
  projectUpdateHealth: String
  readAt: DateTime
  snoozedUntilAt: DateTime
  subtitle: String!
  title: String!
  type: String!
  unsnoozedAt: DateTime
  updatedAt: DateTime!
  url: String!
  user: User!
}

type NotificationArchivePayload implements ArchivePayload {
  entity: Notification
  lastSyncId: Float!
  success: Boolean!
}

type NotificationBatchActionPayload {
  lastSyncId: Float!
  notifications: [Notification!]!
  success: Boolean!
}

enum NotificationCategory {
  appsAndIntegrations
  assignments
  commentsAndReplies
  customers
  documentChanges
  feed
  mentions
  postsAndUpdates
  reactions
  reminders
  reviews
  statusChanges
  subscriptions
  system
  triage
}

type NotificationCategoryPreferences {
  appsAndIntegrations: NotificationChannelPreferences!
  assignments: NotificationChannelPreferences!
  commentsAndReplies: NotificationChannelPreferences!
  customers: NotificationChannelPreferences!
  documentChanges: NotificationChannelPreferences!
  feed: NotificationChannelPreferences!
  mentions: NotificationChannelPreferences!
  postsAndUpdates: NotificationChannelPreferences!
  reactions: NotificationChannelPreferences!
  reminders: NotificationChannelPreferences!
  reviews: NotificationChannelPreferences!
  statusChanges: NotificationChannelPreferences!
  subscriptions: NotificationChannelPreferences!
  system: NotificationChannelPreferences!
  triage: NotificationChannelPreferences!
}

input NotificationCategoryPreferencesInput {
  appsAndIntegrations: PartialNotificationChannelPreferencesInput
  assignments: PartialNotificationChannelPreferencesInput
  commentsAndReplies: PartialNotificationChannelPreferencesInput
  customers: PartialNotificationChannelPreferencesInput
  documentChanges: PartialNotificationChannelPreferencesInput
  feed: PartialNotificationChannelPreferencesInput
  mentions: PartialNotificationChannelPreferencesInput
  postsAndUpdates: PartialNotificationChannelPreferencesInput
  reactions: PartialNotificationChannelPreferencesInput
  reminders: PartialNotificationChannelPreferencesInput
  reviews: PartialNotificationChannelPreferencesInput
  statusChanges: PartialNotificationChannelPreferencesInput
  subscriptions: PartialNotificationChannelPreferencesInput
  triage: PartialNotificationChannelPreferencesInput
}

enum NotificationChannel {
  desktop
  email
  mobile
  slack
}

type NotificationChannelPreferences {
  desktop: Boolean!
  email: Boolean!
  mobile: Boolean!
  slack: Boolean!
}

type NotificationConnection {
  edges: [NotificationEdge!]!
  nodes: [Notification!]!
  pageInfo: PageInfo!
}

type NotificationDeliveryPreferences {
  mobile: NotificationDeliveryPreferencesChannel
}

type NotificationDeliveryPreferencesChannel {
  notificationsDisabled: Boolean @deprecated(reason: "This field has been replaced by notificationChannelPreferences")
  schedule: NotificationDeliveryPreferencesSchedule
}

input NotificationDeliveryPreferencesChannelInput {
  schedule: NotificationDeliveryPreferencesScheduleInput
}

type NotificationDeliveryPreferencesDay {
  end: String
  start: String
}

input NotificationDeliveryPreferencesDayInput {
  end: String
  start: String
}

input NotificationDeliveryPreferencesInput {
  mobile: NotificationDeliveryPreferencesChannelInput
}

type NotificationDeliveryPreferencesSchedule {
  disabled: Boolean
  friday: NotificationDeliveryPreferencesDay!
  monday: NotificationDeliveryPreferencesDay!
  saturday: NotificationDeliveryPreferencesDay!
  sunday: NotificationDeliveryPreferencesDay!
  thursday: NotificationDeliveryPreferencesDay!
  tuesday: NotificationDeliveryPreferencesDay!
  wednesday: NotificationDeliveryPreferencesDay!
}

input NotificationDeliveryPreferencesScheduleInput {
  disabled: Boolean
  friday: NotificationDeliveryPreferencesDayInput!
  monday: NotificationDeliveryPreferencesDayInput!
  saturday: NotificationDeliveryPreferencesDayInput!
  sunday: NotificationDeliveryPreferencesDayInput!
  thursday: NotificationDeliveryPreferencesDayInput!
  tuesday: NotificationDeliveryPreferencesDayInput!
  wednesday: NotificationDeliveryPreferencesDayInput!
}

type NotificationEdge {
  cursor: String!
  node: Notification!
}

input NotificationEntityInput {
  id: String
  initiativeId: String
  initiativeUpdateId: String
  issueId: String
  oauthClientApprovalId: String
  projectId: String
  projectUpdateId: String
}

input NotificationFilter {
  and: [NotificationFilter!]
  archivedAt: DateComparator
  createdAt: DateComparator
  id: IDComparator
  or: [NotificationFilter!]
  type: StringComparator
  updatedAt: DateComparator
}

type NotificationPayload {
  lastSyncId: Float!
  notification: Notification!
  success: Boolean!
}

interface NotificationSubscription implements Entity & Node {
  active: Boolean!
  archivedAt: DateTime
  contextViewType: ContextViewType
  createdAt: DateTime!
  customView: CustomView
  customer: Customer
  cycle: Cycle
  id: ID!
  initiative: Initiative
  label: IssueLabel
  project: Project
  subscriber: User!
  team: Team
  updatedAt: DateTime!
  user: User
  userContextViewType: UserContextViewType
}

type NotificationSubscriptionConnection {
  edges: [NotificationSubscriptionEdge!]!
  nodes: [NotificationSubscription!]!
  pageInfo: PageInfo!
}

input NotificationSubscriptionCreateInput {
  active: Boolean
  contextViewType: ContextViewType
  customViewId: String
  customerId: String
  cycleId: String
  id: String
  initiativeId: String
  labelId: String
  notificationSubscriptionTypes: [String!]
  projectId: String
  teamId: String
  userContextViewType: UserContextViewType
  userId: String
}

type NotificationSubscriptionEdge {
  cursor: String!
  node: NotificationSubscription!
}

type NotificationSubscriptionPayload {
  lastSyncId: Float!
  notificationSubscription: NotificationSubscription!
  success: Boolean!
}

input NotificationSubscriptionUpdateInput {
  active: Boolean
  notificationSubscriptionTypes: [String!]
}

input NotificationUpdateInput {
  initiativeUpdateId: String
  projectUpdateId: String
  readAt: DateTime
  snoozedUntilAt: DateTime
}

input NotionSettingsInput {
  workspaceId: String!
  workspaceName: String!
}

input NullableCommentFilter {
  and: [NullableCommentFilter!]
  body: StringComparator
  createdAt: DateComparator
  documentContent: NullableDocumentContentFilter
  id: IDComparator
  initiative: NullableInitiativeFilter
  issue: NullableIssueFilter
  needs: CustomerNeedCollectionFilter
  null: Boolean
  or: [NullableCommentFilter!]
  parent: NullableCommentFilter
  project: NullableProjectFilter
  projectUpdate: NullableProjectUpdateFilter
  reactions: ReactionCollectionFilter
  updatedAt: DateComparator
  user: UserFilter
}

input NullableCustomerFilter {
  and: [NullableCustomerFilter!]
  createdAt: DateComparator
  domains: StringArrayComparator
  externalIds: StringArrayComparator
  id: IDComparator
  name: StringComparator
  needs: CustomerNeedCollectionFilter
  null: Boolean
  or: [NullableCustomerFilter!]
  owner: NullableUserFilter
  revenue: NumberComparator
  size: NumberComparator
  slackChannelId: StringComparator
  status: CustomerStatusFilter
  tier: CustomerTierFilter
  updatedAt: DateComparator
}

input NullableCycleFilter {
  and: [NullableCycleFilter!]
  completedAt: DateComparator
  createdAt: DateComparator
  endsAt: DateComparator
  id: IDComparator
  inheritedFromId: IDComparator
  isActive: BooleanComparator
  isFuture: BooleanComparator
  isInCooldown: BooleanComparator
  isNext: BooleanComparator
  isPast: BooleanComparator
  isPrevious: BooleanComparator
  issues: IssueCollectionFilter
  name: StringComparator
  null: Boolean
  number: NumberComparator
  or: [NullableCycleFilter!]
  startsAt: DateComparator
  team: TeamFilter
  updatedAt: DateComparator
}

input NullableDateComparator {
  eq: DateTimeOrDuration
  gt: DateTimeOrDuration
  gte: DateTimeOrDuration
  in: [DateTimeOrDuration!]
  lt: DateTimeOrDuration
  lte: DateTimeOrDuration
  neq: DateTimeOrDuration
  nin: [DateTimeOrDuration!]
  null: Boolean
}

input NullableDocumentContentFilter {
  and: [NullableDocumentContentFilter!]
  content: NullableStringComparator
  createdAt: DateComparator
  document: DocumentFilter
  id: IDComparator
  null: Boolean
  or: [NullableDocumentContentFilter!]
  project: ProjectFilter
  updatedAt: DateComparator
}

input NullableDurationComparator {
  eq: Duration
  gt: Duration
  gte: Duration
  in: [Duration!]
  lt: Duration
  lte: Duration
  neq: Duration
  nin: [Duration!]
  null: Boolean
}

input NullableInitiativeFilter {
  activityType: StringComparator
  ancestors: InitiativeCollectionFilter
  and: [NullableInitiativeFilter!]
  completedAt: NullableDateComparator
  createdAt: DateComparator
  creator: NullableUserFilter
  health: StringComparator
  healthWithAge: StringComparator
  id: IDComparator
  initiativeUpdates: InitiativeUpdatesCollectionFilter
  name: StringComparator
  null: Boolean
  or: [NullableInitiativeFilter!]
  owner: NullableUserFilter
  slugId: StringComparator
  startedAt: NullableDateComparator
  status: StringComparator
  targetDate: NullableDateComparator
  teams: TeamCollectionFilter
  updatedAt: DateComparator
}

input NullableIssueFilter {
  accumulatedStateUpdatedAt: NullableDateComparator
  activity: ActivityCollectionFilter
  addedToCycleAt: NullableDateComparator
  addedToCyclePeriod: CyclePeriodComparator
  ageTime: NullableDurationComparator
  and: [NullableIssueFilter!]
  archivedAt: NullableDateComparator
  assignee: NullableUserFilter
  attachments: AttachmentCollectionFilter
  autoArchivedAt: NullableDateComparator
  autoClosedAt: NullableDateComparator
  canceledAt: NullableDateComparator
  children: IssueCollectionFilter
  comments: CommentCollectionFilter
  completedAt: NullableDateComparator
  createdAt: DateComparator
  creator: NullableUserFilter
  customerCount: NumberComparator
  customerImportantCount: NumberComparator
  cycle: NullableCycleFilter
  cycleTime: NullableDurationComparator
  delegate: NullableUserFilter
  description: NullableStringComparator
  dueDate: NullableTimelessDateComparator
  estimate: EstimateComparator
  hasBlockedByRelations: RelationExistsComparator
  hasBlockingRelations: RelationExistsComparator
  hasDuplicateRelations: RelationExistsComparator
  hasRelatedRelations: RelationExistsComparator
  hasSharedUsers: RelationExistsComparator
  hasSuggestedAssignees: RelationExistsComparator
  hasSuggestedLabels: RelationExistsComparator
  hasSuggestedProjects: RelationExistsComparator
  hasSuggestedRelatedIssues: RelationExistsComparator
  hasSuggestedSimilarIssues: RelationExistsComparator
  hasSuggestedTeams: RelationExistsComparator
  id: IssueIDComparator
  labels: IssueLabelCollectionFilter
  lastAppliedTemplate: NullableTemplateFilter
  leadTime: NullableDurationComparator
  needs: CustomerNeedCollectionFilter
  null: Boolean
  number: NumberComparator
  or: [NullableIssueFilter!]
  parent: NullableIssueFilter
  priority: NullableNumberComparator
  project: NullableProjectFilter
  projectMilestone: NullableProjectMilestoneFilter
  reactions: ReactionCollectionFilter
  recurringIssueTemplate: NullableTemplateFilter
  releases: ReleaseCollectionFilter
  searchableContent: ContentComparator
  sharedWith: UserCollectionFilter
  slaBreachesAt: NullableDateComparator
  slaStatus: SlaStatusComparator
  snoozedBy: NullableUserFilter
  snoozedUntilAt: NullableDateComparator
  sourceMetadata: SourceMetadataComparator
  startedAt: NullableDateComparator
  state: WorkflowStateFilter
  subscribers: UserCollectionFilter
  suggestions: IssueSuggestionCollectionFilter
  team: TeamFilter
  title: StringComparator
  triageTime: NullableDurationComparator
  triagedAt: NullableDateComparator
  updatedAt: DateComparator
}

input NullableNumberComparator {
  eq: Float
  gt: Float
  gte: Float
  in: [Float!]
  lt: Float
  lte: Float
  neq: Float
  nin: [Float!]
  null: Boolean
}

input NullableProjectFilter {
  accessibleTeams: TeamCollectionFilter
  activityType: StringComparator
  and: [NullableProjectFilter!]
  canceledAt: NullableDateComparator
  completedAt: NullableDateComparator
  completedProjectMilestones: ProjectMilestoneCollectionFilter
  createdAt: DateComparator
  creator: UserFilter
  customerCount: NumberComparator
  customerImportantCount: NumberComparator
  hasBlockedByRelations: RelationExistsComparator
  hasBlockingRelations: RelationExistsComparator
  hasDependedOnByRelations: RelationExistsComparator
  hasDependsOnRelations: RelationExistsComparator
  hasRelatedRelations: RelationExistsComparator
  hasViolatedRelations: RelationExistsComparator
  health: StringComparator
  healthWithAge: StringComparator
  id: IDComparator
  initiatives: InitiativeCollectionFilter
  issues: IssueCollectionFilter
  labels: ProjectLabelCollectionFilter
  lastAppliedTemplate: NullableTemplateFilter
  lead: NullableUserFilter
  members: UserCollectionFilter
  name: StringComparator
  needs: CustomerNeedCollectionFilter
  nextProjectMilestone: ProjectMilestoneFilter
  null: Boolean
  or: [NullableProjectFilter!]
  priority: NullableNumberComparator
  projectMilestones: ProjectMilestoneCollectionFilter
  projectUpdates: ProjectUpdatesCollectionFilter
  roadmaps: RoadmapCollectionFilter
  searchableContent: ContentComparator
  slugId: StringComparator
  startDate: NullableDateComparator
  startedAt: NullableDateComparator
  state: StringComparator
  status: ProjectStatusFilter
  targetDate: NullableDateComparator
  updatedAt: DateComparator
}

input NullableProjectMilestoneFilter {
  and: [NullableProjectMilestoneFilter!]
  createdAt: DateComparator
  id: IDComparator
  name: NullableStringComparator
  null: Boolean
  or: [NullableProjectMilestoneFilter!]
  project: NullableProjectFilter
  targetDate: NullableDateComparator
  updatedAt: DateComparator
}

input NullableProjectUpdateFilter {
  and: [NullableProjectUpdateFilter!]
  createdAt: DateComparator
  id: IDComparator
  null: Boolean
  or: [NullableProjectUpdateFilter!]
  project: ProjectFilter
  reactions: ReactionCollectionFilter
  updatedAt: DateComparator
  user: UserFilter
}

input NullableStringComparator {
  contains: String
  containsIgnoreCase: String
  containsIgnoreCaseAndAccent: String
  endsWith: String
  eq: String
  eqIgnoreCase: String
  in: [String!]
  neq: String
  neqIgnoreCase: String
  nin: [String!]
  notContains: String
  notContainsIgnoreCase: String
  notEndsWith: String
  notStartsWith: String
  null: Boolean
  startsWith: String
  startsWithIgnoreCase: String
}

input NullableTeamFilter {
  ancestors: TeamCollectionFilter
  and: [NullableTeamFilter!]
  createdAt: DateComparator
  description: NullableStringComparator
  id: IDComparator
  issues: IssueCollectionFilter
  key: StringComparator
  name: StringComparator
  null: Boolean
  or: [NullableTeamFilter!]
  parent: NullableTeamFilter
  private: BooleanComparator
  releasePipelines: ReleasePipelineCollectionFilter
  retiredAt: NullableDateComparator
  updatedAt: DateComparator
}

input NullableTemplateFilter {
  and: [NullableTemplateFilter!]
  createdAt: DateComparator
  id: IDComparator
  inheritedFromId: IDComparator
  name: StringComparator
  null: Boolean
  or: [NullableTemplateFilter!]
  type: StringComparator
  updatedAt: DateComparator
}

input NullableTimelessDateComparator {
  eq: TimelessDateOrDuration
  gt: TimelessDateOrDuration
  gte: TimelessDateOrDuration
  in: [TimelessDateOrDuration!]
  lt: TimelessDateOrDuration
  lte: TimelessDateOrDuration
  neq: TimelessDateOrDuration
  nin: [TimelessDateOrDuration!]
  null: Boolean
}

input NullableUserFilter {
  active: BooleanComparator
  admin: BooleanComparator
  and: [NullableUserFilter!]
  app: BooleanComparator
  assignedIssues: IssueCollectionFilter
  createdAt: DateComparator
  displayName: StringComparator
  email: StringComparator
  id: IDComparator
  invited: BooleanComparator
  isInvited: BooleanComparator
  isMe: BooleanComparator
  name: StringComparator
  null: Boolean
  or: [NullableUserFilter!]
  owner: BooleanComparator
  updatedAt: DateComparator
}

input NumberComparator {
  eq: Float
  gt: Float
  gte: Float
  in: [Float!]
  lt: Float
  lte: Float
  neq: Float
  nin: [Float!]
}

enum OAuthClientApprovalStatus {
  approved
  denied
  requested
}

type OauthClientApproval implements Node {
  archivedAt: DateTime
  createdAt: DateTime!
  denyReason: String
  id: ID!
  newlyRequestedScopes: [String!]
  oauthClientId: String!
  requestReason: String
  requesterId: String!
  responderId: String
  scopes: [String!]!
  status: OAuthClientApprovalStatus!
  updatedAt: DateTime!
}

type OauthClientApprovalNotification implements Entity & Node & Notification {
  actor: User
  actorAvatarColor: String!
  actorAvatarUrl: String
  actorInitials: String
  archivedAt: DateTime
  botActor: ActorBot
  category: NotificationCategory!
  createdAt: DateTime!
  emailedAt: DateTime
  externalUserActor: ExternalUser
  groupingKey: String!
  groupingPriority: Float!
  id: ID!
  inboxUrl: String!
  initiativeUpdateHealth: String
  isLinearActor: Boolean!
  issueStatusType: String
  oauthClientApproval: OauthClientApproval!
  oauthClientApprovalId: String!
  projectUpdateHealth: String
  readAt: DateTime
  snoozedUntilAt: DateTime
  subtitle: String!
  title: String!
  type: String!
  unsnoozedAt: DateTime
  updatedAt: DateTime!
  url: String!
  user: User!
}

input OnboardingCustomerSurvey {
  companyRole: String
  companySize: String
}

input OpsgenieInput {
  apiFailedWithUnauthorizedErrorAt: DateTime
}

type Organization implements Node {
  agentAutomationEnabled: Boolean!
  aiAddonEnabled: Boolean!
  aiDiscussionSummariesEnabled: Boolean!
  aiProviderConfiguration: JSONObject
  aiThreadSummariesEnabled: Boolean!
  allowMembersToInvite: Boolean @deprecated(reason: "Use \`securitySettings.invitationsRole\` instead.")
  allowedAiProviders: [String!]! @deprecated(reason: "Use aiProviderConfiguration instead.")
  allowedAuthServices: [String!]! @deprecated(reason: "Use authSettings.allowedAuthServices instead.")
  allowedFileUploadContentTypes: [String!]
  archivedAt: DateTime
  authSettings: JSONObject!
  codeIntelligenceEnabled: Boolean!
  codeIntelligenceRepository: String
  codingAgentEnabled: Boolean!
  createdAt: DateTime!
  createdIssueCount: Int!
  customerCount: Int!
  customersConfiguration: JSONObject!
  customersEnabled: Boolean!
  defaultFeedSummarySchedule: FeedSummarySchedule
  deletionRequestedAt: DateTime
  facets: [Facet!]!
  feedEnabled: Boolean!
  fiscalYearStartMonth: Float!
  generatedUpdatesEnabled: Boolean!
  gitBranchFormat: String
  gitLinkbackDescriptionsEnabled: Boolean!
  gitLinkbackMessagesEnabled: Boolean!
  gitPublicLinkbackMessagesEnabled: Boolean!
  hideNonPrimaryOrganizations: Boolean! @deprecated(reason: "Use authSettings.hideNonPrimaryOrganizations instead.")
  hipaaComplianceEnabled: Boolean!
  id: ID!
  initiativeUpdateReminderFrequencyInWeeks: Float
  initiativeUpdateRemindersDay: Day!
  initiativeUpdateRemindersHour: Float!
  integrations(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): IntegrationConnection!
  ipRestrictions: [OrganizationIpRestriction!]
  labels(after: String, before: String, filter: IssueLabelFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): IssueLabelConnection!
  linearAgentEnabled: Boolean!
  linearAgentSettings: JSONObject!
  logoUrl: String
  name: String!
  periodUploadVolume: Float!
  previousUrlKeys: [String!]!
  projectLabels(after: String, before: String, filter: ProjectLabelFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): ProjectLabelConnection!
  projectStatuses: [ProjectStatus!]!
  projectUpdateReminderFrequencyInWeeks: Float
  projectUpdateRemindersDay: Day!
  projectUpdateRemindersHour: Float!
  projectUpdatesReminderFrequency: ProjectUpdateReminderFrequency! @deprecated(reason: "Use organization.projectUpdatesReminderFrequencyInWeeks instead")
  releaseChannel: ReleaseChannel!
  releasesEnabled: Boolean!
  restrictAgentInvocationToMembers: Boolean
  restrictLabelManagementToAdmins: Boolean @deprecated(reason: "Use \`securitySettings.labelManagementRole\` instead.")
  restrictTeamCreationToAdmins: Boolean @deprecated(reason: "Use \`securitySettings.teamCreationRole\` instead.")
  roadmapEnabled: Boolean!
  samlEnabled: Boolean!
  samlSettings: JSONObject
  scimEnabled: Boolean!
  scimSettings: JSONObject
  securitySettings: JSONObject!
  slaDayCount: SLADayCountType! @deprecated(reason: "No longer in use")
  slackAutoCreateProjectChannel: Boolean!
  slackProjectChannelIntegration: Integration
  slackProjectChannelPrefix: String!
  slackProjectChannelsEnabled: Boolean!
  subscription: PaidSubscription
  teams(after: String, before: String, filter: TeamFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): TeamConnection!
  templates(after: String, before: String, filter: NullableTemplateFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): TemplateConnection!
  themeSettings: JSONObject
  trialEndsAt: DateTime
  trialStartsAt: DateTime
  updatedAt: DateTime!
  urlKey: String!
  userCount: Int!
  users(after: String, before: String, first: Int, includeArchived: Boolean, includeDisabled: Boolean, last: Int, orderBy: PaginationOrderBy): UserConnection!
  workingDays: [Float!]!
}

type OrganizationAcceptedOrExpiredInviteDetailsPayload {
  status: OrganizationInviteStatus!
}

input OrganizationAuthSettingsInput {
  allowedAuthServiceBypassRole: String
  allowedAuthServices: [String!]
  disableAuthServiceBypass: Boolean
  hideNonPrimaryOrganizations: Boolean
}

type OrganizationCancelDeletePayload {
  success: Boolean!
}

type OrganizationDeletePayload {
  success: Boolean!
}

type OrganizationDomain implements Node {
  archivedAt: DateTime
  authType: OrganizationDomainAuthType!
  claimed: Boolean
  createdAt: DateTime!
  creator: User
  disableOrganizationCreation: Boolean
  id: ID!
  identityProvider: IdentityProvider
  name: String!
  updatedAt: DateTime!
  verificationEmail: String
  verified: Boolean!
}

enum OrganizationDomainAuthType {
  general
  saml
}

type OrganizationDomainClaimPayload {
  verificationString: String!
}

input OrganizationDomainCreateInput {
  authType: String = "general"
  id: String
  identityProviderId: String
  name: String!
  verificationEmail: String
}

type OrganizationDomainPayload {
  lastSyncId: Float!
  organizationDomain: OrganizationDomain!
  success: Boolean!
}

type OrganizationDomainSimplePayload {
  success: Boolean!
}

input OrganizationDomainUpdateInput {
  disableOrganizationCreation: Boolean
}

input OrganizationDomainVerificationInput {
  organizationDomainId: String!
  verificationCode: String!
}

type OrganizationExistsPayload {
  exists: Boolean!
  success: Boolean!
}

type OrganizationInvite implements Node {
  acceptedAt: DateTime
  archivedAt: DateTime
  createdAt: DateTime!
  email: String!
  expiresAt: DateTime
  external: Boolean!
  id: ID!
  invitee: User
  inviter: User!
  metadata: JSONObject
  organization: Organization!
  role: UserRoleType!
  updatedAt: DateTime!
}

type OrganizationInviteConnection {
  edges: [OrganizationInviteEdge!]!
  nodes: [OrganizationInvite!]!
  pageInfo: PageInfo!
}

input OrganizationInviteCreateInput {
  email: String!
  id: String
  metadata: JSONObject
  role: UserRoleType = user
  teamIds: [String!]
}

union OrganizationInviteDetailsPayload = OrganizationAcceptedOrExpiredInviteDetailsPayload | OrganizationInviteFullDetailsPayload

type OrganizationInviteEdge {
  cursor: String!
  node: OrganizationInvite!
}

type OrganizationInviteFullDetailsPayload {
  accepted: Boolean!
  allowedAuthServices: [String!]!
  createdAt: DateTime!
  email: String!
  expired: Boolean!
  inviter: String!
  organizationId: String!
  organizationLogoUrl: String
  organizationName: String!
  role: UserRoleType!
  status: OrganizationInviteStatus!
}

type OrganizationInvitePayload {
  lastSyncId: Float!
  organizationInvite: OrganizationInvite!
  success: Boolean!
}

enum OrganizationInviteStatus {
  accepted
  expired
  pending
}

input OrganizationInviteUpdateInput {
  teamIds: [String!]!
}

type OrganizationIpRestriction {
  description: String
  enabled: Boolean!
  range: String!
  type: String!
}

input OrganizationIpRestrictionInput {
  description: String
  enabled: Boolean!
  range: String!
  type: String!
}

input OrganizationLinearAgentMcpServerAllowlistEntryInput {
  url: String!
}

input OrganizationLinearAgentSettingsInput {
  mcpServersAllowlist: [OrganizationLinearAgentMcpServerAllowlistEntryInput!]
  mcpServersEnabled: Boolean
  webSearchEnabled: Boolean
}

type OrganizationMeta {
  allowedAuthServices: [String!]!
  region: String!
}

type OrganizationPayload {
  lastSyncId: Float!
  organization: Organization
  success: Boolean!
}

input OrganizationSecuritySettingsInput {
  agentGuidanceRole: UserRoleType
  apiSettingsRole: UserRoleType
  importRole: UserRoleType
  integrationCreationRole: UserRoleType
  invitationsRole: UserRoleType
  labelManagementRole: UserRoleType
  personalApiKeysRole: UserRoleType
  teamCreationRole: UserRoleType
  templateManagementRole: UserRoleType
}

input OrganizationStartTrialInput {
  planType: String!
}

type OrganizationStartTrialPayload {
  success: Boolean!
}

input OrganizationUpdateInput {
  agentAutomationEnabled: Boolean
  aiAddonEnabled: Boolean
  aiDiscussionSummariesEnabled: Boolean
  aiProviderConfiguration: JSONObject
  aiTelemetryEnabled: Boolean
  aiThreadSummariesEnabled: Boolean
  allowedAuthServices: [String!]
  allowedFileUploadContentTypes: [String!]
  authSettings: OrganizationAuthSettingsInput
  codeIntelligenceEnabled: Boolean
  codeIntelligenceRepository: String
  codingAgentEnabled: Boolean
  customersConfiguration: JSONObject
  customersEnabled: Boolean
  defaultFeedSummarySchedule: FeedSummarySchedule
  feedEnabled: Boolean
  fiscalYearStartMonth: Float
  generatedUpdatesEnabled: Boolean
  gitBranchFormat: String
  gitLinkbackDescriptionsEnabled: Boolean
  gitLinkbackMessagesEnabled: Boolean
  gitPublicLinkbackMessagesEnabled: Boolean
  hideNonPrimaryOrganizations: Boolean
  hipaaComplianceEnabled: Boolean
  initiativeUpdateReminderFrequencyInWeeks: Float
  initiativeUpdateRemindersDay: Day
  initiativeUpdateRemindersHour: Float
  ipRestrictions: [OrganizationIpRestrictionInput!]
  linearAgentEnabled: Boolean
  linearAgentSettings: OrganizationLinearAgentSettingsInput
  logoUrl: String
  name: String
  oauthAppReview: Boolean
  projectUpdateReminderFrequencyInWeeks: Float
  projectUpdateRemindersDay: Day
  projectUpdateRemindersHour: Float
  reducedPersonalInformation: Boolean
  restrictAgentInvocationToMembers: Boolean
  roadmapEnabled: Boolean
  securitySettings: OrganizationSecuritySettingsInput
  slaEnabled: Boolean
  slackAutoCreateProjectChannel: Boolean
  slackProjectChannelIntegrationId: String
  slackProjectChannelPrefix: String
  slackProjectChannelsEnabled: Boolean
  themeSettings: JSONObject
  urlKey: String
  workingDays: [Float!]
}

input OwnerSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

type PageInfo {
  endCursor: String
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
}

input PagerDutyInput {
  apiFailedWithUnauthorizedErrorAt: DateTime
}

enum PaginationNulls {
  first
  last
}

enum PaginationOrderBy {
  createdAt
  updatedAt
}

enum PaginationSortOrder {
  Ascending
  Descending
}

type PaidSubscription implements Node {
  archivedAt: DateTime
  cancelAt: DateTime
  canceledAt: DateTime
  collectionMethod: String!
  createdAt: DateTime!
  creator: User
  id: ID!
  nextBillingAt: DateTime
  organization: Organization!
  pendingChangeType: String
  seats: Float!
  seatsMaximum: Float
  seatsMinimum: Float
  type: String!
  updatedAt: DateTime!
}

input PartialNotificationChannelPreferencesInput {
  desktop: Boolean
  email: Boolean
  mobile: Boolean
  slack: Boolean
}

type PasskeyLoginStartResponse {
  options: JSONObject!
  success: Boolean!
}

type Post implements Node {
  archivedAt: DateTime
  audioSummary: String
  body: String!
  bodyData: String!
  createdAt: DateTime!
  creator: User
  editedAt: DateTime
  evalLogId: String
  feedSummaryScheduleAtCreate: FeedSummarySchedule
  id: ID!
  reactionData: JSONObject!
  slugId: String!
  team: Team
  title: String
  ttlUrl: String
  type: PostType
  updatedAt: DateTime!
  user: User
  writtenSummaryData: JSONObject
}

type PostNotification implements Entity & Node & Notification {
  actor: User
  actorAvatarColor: String!
  actorAvatarUrl: String
  actorInitials: String
  archivedAt: DateTime
  botActor: ActorBot
  category: NotificationCategory!
  commentId: String
  createdAt: DateTime!
  emailedAt: DateTime
  externalUserActor: ExternalUser
  groupingKey: String!
  groupingPriority: Float!
  id: ID!
  inboxUrl: String!
  initiativeUpdateHealth: String
  isLinearActor: Boolean!
  issueStatusType: String
  parentCommentId: String
  postId: String!
  projectUpdateHealth: String
  reactionEmoji: String
  readAt: DateTime
  snoozedUntilAt: DateTime
  subtitle: String!
  title: String!
  type: String!
  unsnoozedAt: DateTime
  updatedAt: DateTime!
  url: String!
  user: User!
}

enum PostType {
  summary
  update
}

input PrioritySort {
  noPriorityFirst: Boolean = false
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

enum ProductIntelligenceScope {
  none
  team
  teamHierarchy
  workspace
}

type Project implements Node {
  archivedAt: DateTime
  attachments(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): ProjectAttachmentConnection!
  autoArchivedAt: DateTime
  canceledAt: DateTime
  color: String!
  comments(after: String, before: String, filter: CommentFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): CommentConnection!
  completedAt: DateTime
  completedIssueCountHistory: [Float!]!
  completedScopeHistory: [Float!]!
  content: String
  contentState: String
  convertedFromIssue: Issue
  createdAt: DateTime!
  creator: User
  currentProgress: JSONObject!
  description: String!
  documentContent: DocumentContent
  documents(after: String, before: String, filter: DocumentFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): DocumentConnection!
  externalLinks(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): EntityExternalLinkConnection!
  facets: [Facet!]!
  favorite: Favorite
  frequencyResolution: FrequencyResolutionType!
  health: ProjectUpdateHealthType
  healthUpdatedAt: DateTime
  history(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): ProjectHistoryConnection!
  icon: String
  id: ID!
  inProgressScopeHistory: [Float!]!
  initiativeToProjects(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): InitiativeToProjectConnection!
  initiatives(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): InitiativeConnection!
  integrationsSettings: IntegrationsSettings
  inverseRelations(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): ProjectRelationConnection!
  issueCountHistory: [Float!]!
  issues(after: String, before: String, filter: IssueFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): IssueConnection!
  labelIds: [String!]!
  labels(after: String, before: String, filter: ProjectLabelFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): ProjectLabelConnection!
  lastAppliedTemplate: Template
  lastUpdate: ProjectUpdate
  lead: User
  members(after: String, before: String, filter: UserFilter, first: Int, includeArchived: Boolean, includeDisabled: Boolean, last: Int, orderBy: PaginationOrderBy): UserConnection!
  name: String!
  needs(after: String, before: String, filter: CustomerNeedFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): CustomerNeedConnection!
  priority: Int!
  priorityLabel: String!
  prioritySortOrder: Float!
  progress: Float!
  progressHistory: JSONObject!
  projectMilestones(after: String, before: String, filter: ProjectMilestoneFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): ProjectMilestoneConnection!
  projectUpdateRemindersPausedUntilAt: DateTime
  projectUpdates(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): ProjectUpdateConnection!
  relations(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): ProjectRelationConnection!
  scope: Float!
  scopeHistory: [Float!]!
  slackIssueComments: Boolean! @deprecated(reason: "No longer in use")
  slackIssueStatuses: Boolean! @deprecated(reason: "No longer is use")
  slackNewIssue: Boolean! @deprecated(reason: "No longer in use")
  slugId: String!
  sortOrder: Float!
  startDate: TimelessDate
  startDateResolution: DateResolutionType
  startedAt: DateTime
  state: String! @deprecated(reason: "Use project.status instead")
  status: ProjectStatus!
  syncedWith: [ExternalEntityInfo!]
  targetDate: TimelessDate
  targetDateResolution: DateResolutionType
  teams(after: String, before: String, filter: TeamFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): TeamConnection!
  trashed: Boolean
  updateReminderFrequency: Float
  updateReminderFrequencyInWeeks: Float
  updateRemindersDay: Day
  updateRemindersHour: Float
  updatedAt: DateTime!
  url: String!
}

type ProjectArchivePayload implements ArchivePayload {
  entity: Project
  lastSyncId: Float!
  success: Boolean!
}

type ProjectAttachment implements Node {
  archivedAt: DateTime
  createdAt: DateTime!
  creator: User
  id: ID!
  metadata: JSONObject!
  source: JSONObject
  sourceType: String
  subtitle: String
  title: String!
  updatedAt: DateTime!
  url: String!
}

type ProjectAttachmentConnection {
  edges: [ProjectAttachmentEdge!]!
  nodes: [ProjectAttachment!]!
  pageInfo: PageInfo!
}

type ProjectAttachmentEdge {
  cursor: String!
  node: ProjectAttachment!
}

input ProjectCollectionFilter {
  accessibleTeams: TeamCollectionFilter
  activityType: StringComparator
  and: [ProjectCollectionFilter!]
  canceledAt: NullableDateComparator
  completedAt: NullableDateComparator
  completedProjectMilestones: ProjectMilestoneCollectionFilter
  createdAt: DateComparator
  creator: UserFilter
  customerCount: NumberComparator
  customerImportantCount: NumberComparator
  every: ProjectFilter
  hasBlockedByRelations: RelationExistsComparator
  hasBlockingRelations: RelationExistsComparator
  hasDependedOnByRelations: RelationExistsComparator
  hasDependsOnRelations: RelationExistsComparator
  hasRelatedRelations: RelationExistsComparator
  hasViolatedRelations: RelationExistsComparator
  health: StringComparator
  healthWithAge: StringComparator
  id: IDComparator
  initiatives: InitiativeCollectionFilter
  issues: IssueCollectionFilter
  labels: ProjectLabelCollectionFilter
  lastAppliedTemplate: NullableTemplateFilter
  lead: NullableUserFilter
  length: NumberComparator
  members: UserCollectionFilter
  name: StringComparator
  needs: CustomerNeedCollectionFilter
  nextProjectMilestone: ProjectMilestoneFilter
  or: [ProjectCollectionFilter!]
  priority: NullableNumberComparator
  projectMilestones: ProjectMilestoneCollectionFilter
  projectUpdates: ProjectUpdatesCollectionFilter
  roadmaps: RoadmapCollectionFilter
  searchableContent: ContentComparator
  slugId: StringComparator
  some: ProjectFilter
  startDate: NullableDateComparator
  startedAt: NullableDateComparator
  state: StringComparator
  status: ProjectStatusFilter
  targetDate: NullableDateComparator
  updatedAt: DateComparator
}

type ProjectConnection {
  edges: [ProjectEdge!]!
  nodes: [Project!]!
  pageInfo: PageInfo!
}

input ProjectCreateInput {
  color: String
  content: String
  convertedFromIssueId: String
  description: String
  icon: String
  id: String
  labelIds: [String!]
  lastAppliedTemplateId: String
  leadId: String
  memberIds: [String!]
  name: String!
  priority: Int
  prioritySortOrder: Float
  sortOrder: Float
  startDate: TimelessDate
  startDateResolution: DateResolutionType
  statusId: String
  targetDate: TimelessDate
  targetDateResolution: DateResolutionType
  teamIds: [String!]!
  templateId: String
  useDefaultTemplate: Boolean
}

input ProjectCreatedAtSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

type ProjectEdge {
  cursor: String!
  node: Project!
}

input ProjectFilter {
  accessibleTeams: TeamCollectionFilter
  activityType: StringComparator
  and: [ProjectFilter!]
  canceledAt: NullableDateComparator
  completedAt: NullableDateComparator
  completedProjectMilestones: ProjectMilestoneCollectionFilter
  createdAt: DateComparator
  creator: UserFilter
  customerCount: NumberComparator
  customerImportantCount: NumberComparator
  hasBlockedByRelations: RelationExistsComparator
  hasBlockingRelations: RelationExistsComparator
  hasDependedOnByRelations: RelationExistsComparator
  hasDependsOnRelations: RelationExistsComparator
  hasRelatedRelations: RelationExistsComparator
  hasViolatedRelations: RelationExistsComparator
  health: StringComparator
  healthWithAge: StringComparator
  id: IDComparator
  initiatives: InitiativeCollectionFilter
  issues: IssueCollectionFilter
  labels: ProjectLabelCollectionFilter
  lastAppliedTemplate: NullableTemplateFilter
  lead: NullableUserFilter
  members: UserCollectionFilter
  name: StringComparator
  needs: CustomerNeedCollectionFilter
  nextProjectMilestone: ProjectMilestoneFilter
  or: [ProjectFilter!]
  priority: NullableNumberComparator
  projectMilestones: ProjectMilestoneCollectionFilter
  projectUpdates: ProjectUpdatesCollectionFilter
  roadmaps: RoadmapCollectionFilter
  searchableContent: ContentComparator
  slugId: StringComparator
  startDate: NullableDateComparator
  startedAt: NullableDateComparator
  state: StringComparator
  status: ProjectStatusFilter
  targetDate: NullableDateComparator
  updatedAt: DateComparator
}

type ProjectFilterSuggestionPayload {
  filter: JSONObject
  logId: String
}

input ProjectHealthSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

type ProjectHistory implements Node {
  archivedAt: DateTime
  createdAt: DateTime!
  entries: JSONObject!
  id: ID!
  project: Project!
  updatedAt: DateTime!
}

type ProjectHistoryConnection {
  edges: [ProjectHistoryEdge!]!
  nodes: [ProjectHistory!]!
  pageInfo: PageInfo!
}

type ProjectHistoryEdge {
  cursor: String!
  node: ProjectHistory!
}

type ProjectLabel implements Node {
  archivedAt: DateTime
  children(after: String, before: String, filter: ProjectLabelFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): ProjectLabelConnection!
  color: String!
  createdAt: DateTime!
  creator: User
  description: String
  id: ID!
  isGroup: Boolean!
  lastAppliedAt: DateTime
  name: String!
  organization: Organization!
  parent: ProjectLabel
  projects(after: String, before: String, filter: ProjectFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy, sort: [ProjectSortInput!]): ProjectConnection!
  retiredAt: DateTime
  retiredBy: User
  updatedAt: DateTime!
}

input ProjectLabelCollectionFilter {
  and: [ProjectLabelCollectionFilter!]
  createdAt: DateComparator
  creator: NullableUserFilter
  every: ProjectLabelFilter
  id: IDComparator
  isGroup: BooleanComparator
  length: NumberComparator
  name: StringComparator
  null: Boolean
  or: [ProjectLabelCollectionFilter!]
  parent: ProjectLabelFilter
  some: ProjectLabelCollectionFilter
  updatedAt: DateComparator
}

type ProjectLabelConnection {
  edges: [ProjectLabelEdge!]!
  nodes: [ProjectLabel!]!
  pageInfo: PageInfo!
}

input ProjectLabelCreateInput {
  color: String
  description: String
  id: String
  isGroup: Boolean
  name: String!
  parentId: String
  retiredAt: DateTime
}

type ProjectLabelEdge {
  cursor: String!
  node: ProjectLabel!
}

input ProjectLabelFilter {
  and: [ProjectLabelFilter!]
  createdAt: DateComparator
  creator: NullableUserFilter
  id: IDComparator
  isGroup: BooleanComparator
  name: StringComparator
  or: [ProjectLabelFilter!]
  parent: ProjectLabelFilter
  updatedAt: DateComparator
}

type ProjectLabelPayload {
  lastSyncId: Float!
  projectLabel: ProjectLabel!
  success: Boolean!
}

input ProjectLabelUpdateInput {
  color: String
  description: String
  isGroup: Boolean
  name: String
  parentId: String
  retiredAt: DateTime
}

input ProjectLeadSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

input ProjectManualSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

type ProjectMilestone implements Node {
  archivedAt: DateTime
  createdAt: DateTime!
  currentProgress: JSONObject!
  description: String
  descriptionState: String
  documentContent: DocumentContent
  id: ID!
  issues(after: String, before: String, filter: IssueFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): IssueConnection!
  name: String!
  progress: Float!
  progressHistory: JSONObject!
  project: Project!
  sortOrder: Float!
  status: ProjectMilestoneStatus!
  targetDate: TimelessDate
  updatedAt: DateTime!
}

input ProjectMilestoneCollectionFilter {
  and: [ProjectMilestoneCollectionFilter!]
  createdAt: DateComparator
  every: ProjectMilestoneFilter
  id: IDComparator
  length: NumberComparator
  name: NullableStringComparator
  or: [ProjectMilestoneCollectionFilter!]
  project: NullableProjectFilter
  some: ProjectMilestoneFilter
  targetDate: NullableDateComparator
  updatedAt: DateComparator
}

type ProjectMilestoneConnection {
  edges: [ProjectMilestoneEdge!]!
  nodes: [ProjectMilestone!]!
  pageInfo: PageInfo!
}

input ProjectMilestoneCreateInput {
  description: String
  descriptionData: JSONObject
  id: String
  name: String!
  projectId: String!
  sortOrder: Float
  targetDate: TimelessDate
}

type ProjectMilestoneEdge {
  cursor: String!
  node: ProjectMilestone!
}

input ProjectMilestoneFilter {
  and: [ProjectMilestoneFilter!]
  createdAt: DateComparator
  id: IDComparator
  name: NullableStringComparator
  or: [ProjectMilestoneFilter!]
  project: NullableProjectFilter
  targetDate: NullableDateComparator
  updatedAt: DateComparator
}

input ProjectMilestoneMoveInput {
  addIssueTeamToProject: Boolean
  newIssueTeamId: String
  projectId: String!
  undoIssueTeamIds: [ProjectMilestoneMoveIssueToTeamInput!]
  undoProjectTeamIds: ProjectMilestoneMoveProjectTeamsInput
}

type ProjectMilestoneMoveIssueToTeam {
  issueId: String!
  teamId: String!
}

input ProjectMilestoneMoveIssueToTeamInput {
  issueId: String!
  teamId: String!
}

type ProjectMilestoneMovePayload {
  lastSyncId: Float!
  previousIssueTeamIds: [ProjectMilestoneMoveIssueToTeam!]
  previousProjectTeamIds: ProjectMilestoneMoveProjectTeams
  projectMilestone: ProjectMilestone!
  success: Boolean!
}

type ProjectMilestoneMoveProjectTeams {
  projectId: String!
  teamIds: [String!]!
}

input ProjectMilestoneMoveProjectTeamsInput {
  projectId: String!
  teamIds: [String!]!
}

type ProjectMilestonePayload {
  lastSyncId: Float!
  projectMilestone: ProjectMilestone!
  success: Boolean!
}

enum ProjectMilestoneStatus {
  done
  next
  overdue
  unstarted
}

input ProjectMilestoneUpdateInput {
  description: String
  descriptionData: JSONObject
  name: String
  projectId: String
  sortOrder: Float
  targetDate: TimelessDate
}

input ProjectNameSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

type ProjectNotification implements Entity & Node & Notification {
  actor: User
  actorAvatarColor: String!
  actorAvatarUrl: String
  actorInitials: String
  archivedAt: DateTime
  botActor: ActorBot
  category: NotificationCategory!
  comment: Comment
  commentId: String
  createdAt: DateTime!
  document: Document
  emailedAt: DateTime
  externalUserActor: ExternalUser
  groupingKey: String!
  groupingPriority: Float!
  id: ID!
  inboxUrl: String!
  initiativeUpdateHealth: String
  isLinearActor: Boolean!
  issueStatusType: String
  parentComment: Comment
  parentCommentId: String
  project: Project!
  projectId: String!
  projectMilestoneId: String
  projectUpdate: ProjectUpdate
  projectUpdateHealth: String
  projectUpdateId: String
  reactionEmoji: String
  readAt: DateTime
  snoozedUntilAt: DateTime
  subtitle: String!
  title: String!
  type: String!
  unsnoozedAt: DateTime
  updatedAt: DateTime!
  url: String!
  user: User!
}

type ProjectNotificationSubscription implements Entity & Node & NotificationSubscription {
  active: Boolean!
  archivedAt: DateTime
  contextViewType: ContextViewType
  createdAt: DateTime!
  customView: CustomView
  customer: Customer
  cycle: Cycle
  id: ID!
  initiative: Initiative
  label: IssueLabel
  notificationSubscriptionTypes: [String!]!
  project: Project!
  subscriber: User!
  team: Team
  updatedAt: DateTime!
  user: User
  userContextViewType: UserContextViewType
}

type ProjectPayload {
  lastSyncId: Float!
  project: Project
  success: Boolean!
}

input ProjectPrioritySort {
  noPriorityFirst: Boolean = false
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

type ProjectRelation implements Node {
  anchorType: String!
  archivedAt: DateTime
  createdAt: DateTime!
  id: ID!
  project: Project!
  projectMilestone: ProjectMilestone
  relatedAnchorType: String!
  relatedProject: Project!
  relatedProjectMilestone: ProjectMilestone
  type: String!
  updatedAt: DateTime!
  user: User
}

type ProjectRelationConnection {
  edges: [ProjectRelationEdge!]!
  nodes: [ProjectRelation!]!
  pageInfo: PageInfo!
}

input ProjectRelationCreateInput {
  anchorType: String!
  id: String
  projectId: String!
  projectMilestoneId: String
  relatedAnchorType: String!
  relatedProjectId: String!
  relatedProjectMilestoneId: String
  type: String!
}

type ProjectRelationEdge {
  cursor: String!
  node: ProjectRelation!
}

type ProjectRelationPayload {
  lastSyncId: Float!
  projectRelation: ProjectRelation!
  success: Boolean!
}

input ProjectRelationUpdateInput {
  anchorType: String
  projectId: String
  projectMilestoneId: String
  relatedAnchorType: String
  relatedProjectId: String
  relatedProjectMilestoneId: String
  type: String
}

type ProjectSearchPayload {
  archivePayload: ArchiveResponse!
  edges: [ProjectSearchResultEdge!]!
  nodes: [ProjectSearchResult!]!
  pageInfo: PageInfo!
  totalCount: Float!
}

type ProjectSearchResult implements Node {
  archivedAt: DateTime
  attachments(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): ProjectAttachmentConnection!
  autoArchivedAt: DateTime
  canceledAt: DateTime
  color: String!
  comments(after: String, before: String, filter: CommentFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): CommentConnection!
  completedAt: DateTime
  completedIssueCountHistory: [Float!]!
  completedScopeHistory: [Float!]!
  content: String
  contentState: String
  convertedFromIssue: Issue
  createdAt: DateTime!
  creator: User
  currentProgress: JSONObject!
  description: String!
  documentContent: DocumentContent
  documents(after: String, before: String, filter: DocumentFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): DocumentConnection!
  externalLinks(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): EntityExternalLinkConnection!
  facets: [Facet!]!
  favorite: Favorite
  frequencyResolution: FrequencyResolutionType!
  health: ProjectUpdateHealthType
  healthUpdatedAt: DateTime
  history(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): ProjectHistoryConnection!
  icon: String
  id: ID!
  inProgressScopeHistory: [Float!]!
  initiativeToProjects(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): InitiativeToProjectConnection!
  initiatives(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): InitiativeConnection!
  integrationsSettings: IntegrationsSettings
  inverseRelations(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): ProjectRelationConnection!
  issueCountHistory: [Float!]!
  issues(after: String, before: String, filter: IssueFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): IssueConnection!
  labelIds: [String!]!
  labels(after: String, before: String, filter: ProjectLabelFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): ProjectLabelConnection!
  lastAppliedTemplate: Template
  lastUpdate: ProjectUpdate
  lead: User
  members(after: String, before: String, filter: UserFilter, first: Int, includeArchived: Boolean, includeDisabled: Boolean, last: Int, orderBy: PaginationOrderBy): UserConnection!
  metadata: JSONObject!
  name: String!
  needs(after: String, before: String, filter: CustomerNeedFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): CustomerNeedConnection!
  priority: Int!
  priorityLabel: String!
  prioritySortOrder: Float!
  progress: Float!
  progressHistory: JSONObject!
  projectMilestones(after: String, before: String, filter: ProjectMilestoneFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): ProjectMilestoneConnection!
  projectUpdateRemindersPausedUntilAt: DateTime
  projectUpdates(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): ProjectUpdateConnection!
  relations(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): ProjectRelationConnection!
  scope: Float!
  scopeHistory: [Float!]!
  slackIssueComments: Boolean! @deprecated(reason: "No longer in use")
  slackIssueStatuses: Boolean! @deprecated(reason: "No longer is use")
  slackNewIssue: Boolean! @deprecated(reason: "No longer in use")
  slugId: String!
  sortOrder: Float!
  startDate: TimelessDate
  startDateResolution: DateResolutionType
  startedAt: DateTime
  state: String! @deprecated(reason: "Use project.status instead")
  status: ProjectStatus!
  syncedWith: [ExternalEntityInfo!]
  targetDate: TimelessDate
  targetDateResolution: DateResolutionType
  teams(after: String, before: String, filter: TeamFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): TeamConnection!
  trashed: Boolean
  updateReminderFrequency: Float
  updateReminderFrequencyInWeeks: Float
  updateRemindersDay: Day
  updateRemindersHour: Float
  updatedAt: DateTime!
  url: String!
}

type ProjectSearchResultEdge {
  cursor: String!
  node: ProjectSearchResult!
}

input ProjectSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

input ProjectSortInput {
  createdAt: ProjectCreatedAtSort
  health: ProjectHealthSort
  lead: ProjectLeadSort
  manual: ProjectManualSort
  name: ProjectNameSort
  priority: ProjectPrioritySort
  startDate: StartDateSort
  status: ProjectStatusSort
  targetDate: TargetDateSort
  updatedAt: ProjectUpdatedAtSort
}

type ProjectStatus implements Node {
  archivedAt: DateTime
  color: String!
  createdAt: DateTime!
  description: String
  id: ID!
  indefinite: Boolean!
  name: String!
  position: Float!
  type: ProjectStatusType!
  updatedAt: DateTime!
}

type ProjectStatusArchivePayload implements ArchivePayload {
  entity: ProjectStatus
  lastSyncId: Float!
  success: Boolean!
}

type ProjectStatusConnection {
  edges: [ProjectStatusEdge!]!
  nodes: [ProjectStatus!]!
  pageInfo: PageInfo!
}

type ProjectStatusCountPayload {
  archivedTeamCount: Float!
  count: Float!
  privateCount: Float!
}

input ProjectStatusCreateInput {
  color: String!
  description: String
  id: String
  indefinite: Boolean = false
  name: String!
  position: Float!
  type: ProjectStatusType!
}

type ProjectStatusEdge {
  cursor: String!
  node: ProjectStatus!
}

input ProjectStatusFilter {
  and: [ProjectStatusFilter!]
  createdAt: DateComparator
  description: StringComparator
  id: IDComparator
  name: StringComparator
  or: [ProjectStatusFilter!]
  position: NumberComparator
  projects: ProjectCollectionFilter
  type: StringComparator
  updatedAt: DateComparator
}

type ProjectStatusPayload {
  lastSyncId: Float!
  status: ProjectStatus!
  success: Boolean!
}

input ProjectStatusSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

enum ProjectStatusType {
  backlog
  canceled
  completed
  paused
  planned
  started
}

input ProjectStatusUpdateInput {
  color: String
  description: String
  indefinite: Boolean
  name: String
  position: Float
  type: ProjectStatusType
}

enum ProjectTab {
  customers
  documents
  issues
  updates
}

type ProjectUpdate implements Node {
  archivedAt: DateTime
  body: String!
  bodyData: String!
  commentCount: Int!
  comments(after: String, before: String, filter: CommentFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): CommentConnection!
  createdAt: DateTime!
  diff: JSONObject
  diffMarkdown: String
  editedAt: DateTime
  health: ProjectUpdateHealthType!
  id: ID!
  infoSnapshot: JSONObject
  isDiffHidden: Boolean!
  isStale: Boolean!
  project: Project!
  reactionData: JSONObject!
  reactions: [Reaction!]!
  slugId: String!
  updatedAt: DateTime!
  url: String!
  user: User!
}

type ProjectUpdateArchivePayload implements ArchivePayload {
  entity: ProjectUpdate
  lastSyncId: Float!
  success: Boolean!
}

type ProjectUpdateConnection {
  edges: [ProjectUpdateEdge!]!
  nodes: [ProjectUpdate!]!
  pageInfo: PageInfo!
}

input ProjectUpdateCreateInput {
  body: String
  bodyData: JSON
  health: ProjectUpdateHealthType
  id: String
  isDiffHidden: Boolean
  projectId: String!
}

type ProjectUpdateEdge {
  cursor: String!
  node: ProjectUpdate!
}

input ProjectUpdateFilter {
  and: [ProjectUpdateFilter!]
  createdAt: DateComparator
  id: IDComparator
  or: [ProjectUpdateFilter!]
  project: ProjectFilter
  reactions: ReactionCollectionFilter
  updatedAt: DateComparator
  user: UserFilter
}

enum ProjectUpdateHealthType {
  atRisk
  offTrack
  onTrack
}

input ProjectUpdateInput {
  canceledAt: DateTime
  color: String
  completedAt: DateTime
  content: String
  convertedFromIssueId: String
  description: String
  frequencyResolution: FrequencyResolutionType
  icon: String
  labelIds: [String!]
  lastAppliedTemplateId: String
  leadId: String
  memberIds: [String!]
  name: String
  priority: Int
  prioritySortOrder: Float
  projectUpdateRemindersPausedUntilAt: DateTime
  slackIssueComments: Boolean
  slackIssueStatuses: Boolean
  slackNewIssue: Boolean
  sortOrder: Float
  startDate: TimelessDate
  startDateResolution: DateResolutionType
  statusId: String
  targetDate: TimelessDate
  targetDateResolution: DateResolutionType
  teamIds: [String!]
  trashed: Boolean
  updateReminderFrequency: Float
  updateReminderFrequencyInWeeks: Float
  updateRemindersDay: Day
  updateRemindersHour: Int
}

type ProjectUpdatePayload {
  lastSyncId: Float!
  projectUpdate: ProjectUpdate!
  success: Boolean!
}

enum ProjectUpdateReminderFrequency {
  month
  never
  twoWeeks
  week
}

type ProjectUpdateReminderPayload {
  lastSyncId: Float!
  success: Boolean!
}

input ProjectUpdateUpdateInput {
  body: String
  bodyData: JSON
  health: ProjectUpdateHealthType
  isDiffHidden: Boolean
}

input ProjectUpdatedAtSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

input ProjectUpdatesCollectionFilter {
  and: [ProjectUpdatesCollectionFilter!]
  createdAt: DateComparator
  every: ProjectUpdatesFilter
  health: StringComparator
  id: IDComparator
  length: NumberComparator
  or: [ProjectUpdatesCollectionFilter!]
  some: ProjectUpdatesFilter
  updatedAt: DateComparator
}

input ProjectUpdatesFilter {
  and: [ProjectUpdatesFilter!]
  createdAt: DateComparator
  health: StringComparator
  id: IDComparator
  or: [ProjectUpdatesFilter!]
  updatedAt: DateComparator
}

type PullRequest implements Node {
  archivedAt: DateTime
  baseSha: String
  checks: [PullRequestCheck!]!
  commits: [PullRequestCommit!]!
  createdAt: DateTime!
  creator: User
  headSha: String
  id: ID!
  mergeCommit: PullRequestCommit
  mergeSettings: PullRequestMergeSettings
  number: Float!
  slugId: String!
  sourceBranch: String!
  status: PullRequestStatus!
  targetBranch: String!
  title: String!
  updatedAt: DateTime!
  url: String!
}

type PullRequestCheck {
  completedAt: DateTime
  isRequired: Boolean
  name: String!
  presentation: PullRequestCheckPresentation
  startedAt: DateTime
  status: String!
  url: String
  workflowName: String
}

enum PullRequestCheckPresentation {
  externalOnly
  jobLogs
  markdown
  runLogs
}

type PullRequestCommit {
  additions: Float!
  authorExternalUserIds: [String!]!
  authorUserIds: [String!]!
  changedFiles: Float
  committedAt: String!
  deletions: Float!
  isMergeCommit: Boolean
  message: String!
  sha: String!
}

enum PullRequestMergeMethod {
  MERGE
  REBASE
  SQUASH
}

type PullRequestMergeSettings {
  autoMergeAllowed: Boolean!
  deleteBranchOnMerge: Boolean!
  isMergeQueueEnabled: Boolean!
  mergeCommitAllowed: Boolean!
  mergeQueueMergeMethod: PullRequestMergeMethod
  rebaseMergeAllowed: Boolean!
  squashMergeAllowed: Boolean!
}

type PullRequestNotification implements Entity & Node & Notification {
  actor: User
  actorAvatarColor: String!
  actorAvatarUrl: String
  actorInitials: String
  archivedAt: DateTime
  botActor: ActorBot
  category: NotificationCategory!
  createdAt: DateTime!
  emailedAt: DateTime
  externalUserActor: ExternalUser
  groupingKey: String!
  groupingPriority: Float!
  id: ID!
  inboxUrl: String!
  initiativeUpdateHealth: String
  isLinearActor: Boolean!
  issueStatusType: String
  projectUpdateHealth: String
  pullRequest: PullRequest!
  pullRequestCommentId: String
  pullRequestId: String!
  readAt: DateTime
  snoozedUntilAt: DateTime
  subtitle: String!
  title: String!
  type: String!
  unsnoozedAt: DateTime
  updatedAt: DateTime!
  url: String!
  user: User!
}

input PullRequestReferenceInput {
  number: Int!
  repositoryName: String!
  repositoryOwner: String!
}

enum PullRequestReviewTool {
  graphite
  source
}

enum PullRequestStatus {
  approved
  closed
  draft
  inReview
  merged
  open
}

type PushSubscription implements Node {
  archivedAt: DateTime
  createdAt: DateTime!
  id: ID!
  updatedAt: DateTime!
}

input PushSubscriptionCreateInput {
  data: String!
  id: String
  type: PushSubscriptionType = web
}

type PushSubscriptionPayload {
  entity: PushSubscription!
  lastSyncId: Float!
  success: Boolean!
}

type PushSubscriptionTestPayload {
  success: Boolean!
}

enum PushSubscriptionType {
  apple
  appleDevelopment
  firebase
  web
}

type Query {
  administrableTeams(after: String, before: String, filter: TeamFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): TeamConnection!
  agentActivities(after: String, before: String, filter: AgentActivityFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): AgentActivityConnection!
  agentActivity(id: String!): AgentActivity!
  agentSession(id: String!): AgentSession!
  agentSessionSandbox(agentSessionId: String!): CodingAgentSandboxPayload
  agentSessions(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): AgentSessionConnection!
  applicationInfo(clientId: String!): Application!
  archivedTeams: [Team!]!
  attachment(id: String!): Attachment!
  attachmentIssue(id: String!): Issue! @deprecated(reason: "Will be removed in near future, please use \`attachmentsForURL\` to get attachments and their issues instead.")
  attachmentSources(teamId: String): AttachmentSourcesPayload!
  attachments(after: String, before: String, filter: AttachmentFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): AttachmentConnection!
  attachmentsForURL(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy, url: String!): AttachmentConnection!
  auditEntries(after: String, before: String, filter: AuditEntryFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): AuditEntryConnection!
  auditEntryTypes: [AuditEntryType!]!
  authenticationSessions: [AuthenticationSessionResponse!]!
  availableUsers: AuthResolverResponse!
  comment(hash: String, id: String): Comment!
  comments(after: String, before: String, filter: CommentFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): CommentConnection!
  customView(id: String!): CustomView!
  customViewDetailsSuggestion(filter: JSONObject!, modelName: String): CustomViewSuggestionPayload!
  customViewHasSubscribers(id: String!): CustomViewHasSubscribersPayload!
  customViews(after: String, before: String, filter: CustomViewFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy, sort: [CustomViewSortInput!]): CustomViewConnection!
  customer(id: String!): Customer!
  customerNeed(hash: String, id: String): CustomerNeed!
  customerNeeds(after: String, before: String, filter: CustomerNeedFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): CustomerNeedConnection!
  customerStatus(id: String!): CustomerStatus!
  customerStatuses(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): CustomerStatusConnection!
  customerTier(id: String!): CustomerTier!
  customerTiers(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): CustomerTierConnection!
  customers(after: String, before: String, filter: CustomerFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy, sorts: [CustomerSortInput!]): CustomerConnection!
  cycle(id: String!): Cycle!
  cycles(after: String, before: String, filter: CycleFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): CycleConnection!
  document(id: String!): Document!
  documentContentHistory(id: String!): DocumentContentHistoryPayload!
  documentContentHistoryEntries(entryIds: [String!]!): DocumentContentHistoryPayload!
  documents(after: String, before: String, filter: DocumentFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): DocumentConnection!
  emailIntakeAddress(id: String!): EmailIntakeAddress!
  emoji(id: String!): Emoji!
  emojis(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): EmojiConnection!
  entityExternalLink(id: String!): EntityExternalLink!
  externalUser(id: String!): ExternalUser!
  externalUsers(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): ExternalUserConnection!
  failuresForOauthWebhooks(oauthClientId: String!): [WebhookFailureEvent!]!
  favorite(id: String!): Favorite!
  favorites(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): FavoriteConnection!
  fetchData(query: String!): FetchDataPayload!
  initiative(id: String!): Initiative!
  initiativeRelation(id: String!): InitiativeRelation!
  initiativeRelations(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): InitiativeRelationConnection!
  initiativeToProject(id: String!): InitiativeToProject!
  initiativeToProjects(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): InitiativeToProjectConnection!
  initiativeUpdate(id: String!): InitiativeUpdate!
  initiativeUpdates(after: String, before: String, filter: InitiativeUpdateFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): InitiativeUpdateConnection!
  initiatives(after: String, before: String, filter: InitiativeFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy, sort: [InitiativeSortInput!]): InitiativeConnection!
  integration(id: String!): Integration!
  integrationHasScopes(integrationId: String!, scopes: [String!]!): IntegrationHasScopesPayload!
  integrationTemplate(id: String!): IntegrationTemplate!
  integrationTemplates(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): IntegrationTemplateConnection!
  integrations(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): IntegrationConnection!
  integrationsSettings(id: String!): IntegrationsSettings!
  issue(id: String!): Issue!
  issueFigmaFileKeySearch(after: String, before: String, fileKey: String!, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): IssueConnection!
  issueFilterSuggestion(projectId: String, prompt: String!, teamId: String): IssueFilterSuggestionPayload!
  issueImportCheckCSV(csvUrl: String!, service: String!): IssueImportCheckPayload!
  issueImportCheckSync(issueImportId: String!): IssueImportSyncCheckPayload!
  issueImportJqlCheck(jiraEmail: String!, jiraHostname: String!, jiraProject: String!, jiraToken: String!, jql: String!): IssueImportJqlCheckPayload!
  issueLabel(id: String!): IssueLabel!
  issueLabels(after: String, before: String, filter: IssueLabelFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): IssueLabelConnection!
  issuePriorityValues: [IssuePriorityValue!]!
  issueRelation(id: String!): IssueRelation!
  issueRelations(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): IssueRelationConnection!
  issueRepositorySuggestions(agentSessionId: String, candidateRepositories: [CandidateRepository!]!, issueId: String!): RepositorySuggestionsPayload!
  issueSearch(after: String, before: String, filter: IssueFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy, query: String): IssueConnection!
  issueTitleSuggestionFromCustomerRequest(request: String!): IssueTitleSuggestionFromCustomerRequestPayload!
  issueToRelease(id: String!): IssueToRelease!
  issueToReleases(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): IssueToReleaseConnection!
  issueVcsBranchSearch(branchName: String!): Issue
  issues(after: String, before: String, filter: IssueFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy, sort: [IssueSortInput!]): IssueConnection!
  latestReleaseByAccessKey: Release
  microsoftTeamsChannels: MicrosoftTeamsChannelsPayload!
  notification(id: String!): Notification!
  notificationSubscription(id: String!): NotificationSubscription!
  notificationSubscriptions(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): NotificationSubscriptionConnection!
  notifications(after: String, before: String, filter: NotificationFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): NotificationConnection!
  notificationsUnreadCount: Int!
  organization: Organization!
  organizationDomainClaimRequest(id: String!): OrganizationDomainClaimPayload!
  organizationExists(urlKey: String!): OrganizationExistsPayload!
  organizationInvite(id: String!): OrganizationInvite!
  organizationInviteDetails(id: String!): OrganizationInviteDetailsPayload!
  organizationInvites(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): OrganizationInviteConnection!
  organizationMeta(urlKey: String!): OrganizationMeta
  project(id: String!): Project!
  projectFilterSuggestion(prompt: String!, teamId: String): ProjectFilterSuggestionPayload!
  projectLabel(id: String!): ProjectLabel!
  projectLabels(after: String, before: String, filter: ProjectLabelFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): ProjectLabelConnection!
  projectMilestone(id: String!): ProjectMilestone!
  projectMilestones(after: String, before: String, filter: ProjectMilestoneFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): ProjectMilestoneConnection!
  projectRelation(id: String!): ProjectRelation!
  projectRelations(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): ProjectRelationConnection!
  projectStatus(id: String!): ProjectStatus!
  projectStatusProjectCount(id: String!): ProjectStatusCountPayload!
  projectStatuses(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): ProjectStatusConnection!
  projectUpdate(id: String!): ProjectUpdate!
  projectUpdates(after: String, before: String, filter: ProjectUpdateFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): ProjectUpdateConnection!
  projects(after: String, before: String, filter: ProjectFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy, sort: [ProjectSortInput!]): ProjectConnection!
  pushSubscriptionTest(sendStrategy: SendStrategy = push, targetMobile: Boolean = false): PushSubscriptionTestPayload!
  rateLimitStatus: RateLimitPayload!
  release(id: String!): Release!
  releaseNote(id: String!): ReleaseNote!
  releaseNotes(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): ReleaseNoteConnection!
  releasePipeline(id: String!): ReleasePipeline!
  releasePipelineByAccessKey: ReleasePipeline!
  releasePipelines(after: String, before: String, filter: ReleasePipelineFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy, sort: [ReleasePipelineSortInput!]): ReleasePipelineConnection!
  releaseSearch(filter: ReleaseFilter, first: Int = 20, term: String): [Release!]!
  releaseStage(id: String!): ReleaseStage!
  releaseStages(after: String, before: String, filter: ReleaseStageFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): ReleaseStageConnection!
  releases(after: String, before: String, filter: ReleaseFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy, sort: [ReleaseSortInput!]): ReleaseConnection!
  roadmap(id: String!): Roadmap! @deprecated(reason: "Roadmaps are deprecated, use initiatives instead.")
  roadmapToProject(id: String!): RoadmapToProject! @deprecated(reason: "RoadmapToProject is deprecated, use InitiativeToProject instead.")
  roadmapToProjects(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): RoadmapToProjectConnection! @deprecated(reason: "RoadmapToProject is deprecated, use InitiativeToProject instead.")
  roadmaps(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): RoadmapConnection! @deprecated(reason: "Roadmaps are deprecated, use initiatives instead.")
  searchDocuments(after: String, before: String, first: Int, includeArchived: Boolean, includeComments: Boolean, last: Int, orderBy: PaginationOrderBy, teamId: String, term: String!): DocumentSearchPayload!
  searchIssues(after: String, before: String, filter: IssueFilter, first: Int, includeArchived: Boolean, includeComments: Boolean, last: Int, orderBy: PaginationOrderBy, teamId: String, term: String!): IssueSearchPayload!
  searchProjects(after: String, before: String, first: Int, includeArchived: Boolean, includeComments: Boolean, last: Int, orderBy: PaginationOrderBy, teamId: String, term: String!): ProjectSearchPayload!
  semanticSearch(filters: SemanticSearchFilters, includeArchived: Boolean, maxResults: Int, query: String!, types: [SemanticSearchResultType!]): SemanticSearchPayload!
  ssoUrlFromEmail(email: String!, isDesktop: Boolean, type: IdentityProviderType! = general): SsoUrlFromEmailResponse!
  team(id: String!): Team!
  teamMembership(id: String!): TeamMembership!
  teamMemberships(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): TeamMembershipConnection!
  teams(after: String, before: String, filter: TeamFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): TeamConnection!
  template(id: String!): Template!
  templates: [Template!]!
  templatesForIntegration(integrationType: String!): [Template!]!
  timeSchedule(id: String!): TimeSchedule!
  timeSchedules(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): TimeScheduleConnection!
  triageResponsibilities(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): TriageResponsibilityConnection!
  triageResponsibility(id: String!): TriageResponsibility!
  user(id: String!): User!
  userSessions(id: String!): [AuthenticationSessionResponse!]!
  userSettings: UserSettings!
  users(after: String, before: String, filter: UserFilter, first: Int, includeArchived: Boolean, includeDisabled: Boolean, last: Int, orderBy: PaginationOrderBy, sort: [UserSortInput!]): UserConnection!
  verifyGitHubEnterpriseServerInstallation(integrationId: String!): GitHubEnterpriseServerInstallVerificationPayload!
  viewer: User!
  webhook(id: String!): Webhook!
  webhooks(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): WebhookConnection!
  workflowState(id: String!): WorkflowState!
  workflowStates(after: String, before: String, filter: WorkflowStateFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): WorkflowStateConnection!
}

type RateLimitPayload {
  identifier: String
  kind: String!
  limits: [RateLimitResultPayload!]!
}

type RateLimitResultPayload {
  allowedAmount: Float!
  period: Float!
  remainingAmount: Float!
  requestedAmount: Float!
  reset: Float!
  type: String!
}

type Reaction implements Node {
  archivedAt: DateTime
  comment: Comment
  createdAt: DateTime!
  emoji: String!
  externalUser: ExternalUser
  id: ID!
  initiativeUpdate: InitiativeUpdate
  issue: Issue
  post: Post
  projectUpdate: ProjectUpdate
  updatedAt: DateTime!
  user: User
}

input ReactionCollectionFilter {
  and: [ReactionCollectionFilter!]
  createdAt: DateComparator
  customEmojiId: IDComparator
  emoji: StringComparator
  every: ReactionFilter
  id: IDComparator
  length: NumberComparator
  or: [ReactionCollectionFilter!]
  some: ReactionFilter
  updatedAt: DateComparator
}

input ReactionCreateInput {
  commentId: String
  emoji: String!
  id: String
  initiativeUpdateId: String
  issueId: String
  postId: String
  projectUpdateId: String
  pullRequestCommentId: String
  pullRequestId: String
}

input ReactionFilter {
  and: [ReactionFilter!]
  createdAt: DateComparator
  customEmojiId: IDComparator
  emoji: StringComparator
  id: IDComparator
  or: [ReactionFilter!]
  updatedAt: DateComparator
}

type ReactionPayload {
  lastSyncId: Float!
  reaction: Reaction!
  success: Boolean!
}

input RelationExistsComparator {
  eq: Boolean
  neq: Boolean
}

type Release implements Node {
  archivedAt: DateTime
  canceledAt: DateTime
  commitSha: String
  completedAt: DateTime
  createdAt: DateTime!
  creator: User
  currentProgress: JSONObject!
  description: String
  documents(after: String, before: String, filter: DocumentFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): DocumentConnection!
  history(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): ReleaseHistoryConnection!
  id: ID!
  issueCount(includeArchived: Boolean = false): Int!
  issues(after: String, before: String, filter: IssueFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): IssueConnection!
  links(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): EntityExternalLinkConnection!
  name: String!
  pipeline: ReleasePipeline!
  progressHistory: JSONObject!
  releaseNotes: [ReleaseNote!]!
  slugId: String!
  stage: ReleaseStage!
  startDate: TimelessDate
  startedAt: DateTime
  targetDate: TimelessDate
  trashed: Boolean
  updatedAt: DateTime!
  url: String!
  version: String
}

type ReleaseArchivePayload implements ArchivePayload {
  entity: Release
  lastSyncId: Float!
  success: Boolean!
}

enum ReleaseChannel {
  beta
  development
  internal
  preRelease
  privateBeta
  public
}

input ReleaseCollectionFilter {
  and: [ReleaseCollectionFilter!]
  completedAt: NullableDateComparator
  createdAt: DateComparator
  every: ReleaseFilter
  id: IDComparator
  length: NumberComparator
  name: StringComparator
  or: [ReleaseCollectionFilter!]
  pipeline: ReleasePipelineFilter
  some: ReleaseFilter
  stage: ReleaseStageFilter
  updatedAt: DateComparator
  version: StringComparator
}

input ReleaseCompleteInput {
  commitSha: String
  pipelineId: String!
  version: String
}

input ReleaseCompleteInputBase {
  commitSha: String
  version: String
}

type ReleaseConnection {
  edges: [ReleaseEdge!]!
  nodes: [Release!]!
  pageInfo: PageInfo!
}

input ReleaseCreateInput {
  commitSha: String
  description: String
  id: String
  name: String!
  pipelineId: String!
  stageId: String
  startDate: TimelessDate
  targetDate: TimelessDate
  version: String
}

input ReleaseDebugSinkInput {
  includePaths: [String!]
  inspectedShas: [String!]!
  issues: JSONObject!
  pullRequests: [JSONObject!]!
  revertedIssues: JSONObject
}

type ReleaseEdge {
  cursor: String!
  node: Release!
}

input ReleaseFilter {
  and: [ReleaseFilter!]
  completedAt: NullableDateComparator
  createdAt: DateComparator
  id: IDComparator
  name: StringComparator
  or: [ReleaseFilter!]
  pipeline: ReleasePipelineFilter
  stage: ReleaseStageFilter
  updatedAt: DateComparator
  version: StringComparator
}

type ReleaseHistory implements Node {
  archivedAt: DateTime
  createdAt: DateTime!
  entries: JSONObject!
  id: ID!
  release: Release!
  updatedAt: DateTime!
}

type ReleaseHistoryConnection {
  edges: [ReleaseHistoryEdge!]!
  nodes: [ReleaseHistory!]!
  pageInfo: PageInfo!
}

type ReleaseHistoryEdge {
  cursor: String!
  node: ReleaseHistory!
}

type ReleaseNote implements Node {
  archivedAt: DateTime
  createdAt: DateTime!
  documentContent: DocumentContent
  id: ID!
  releases: [Release!]!
  updatedAt: DateTime!
}

type ReleaseNoteConnection {
  edges: [ReleaseNoteEdge!]!
  nodes: [ReleaseNote!]!
  pageInfo: PageInfo!
}

input ReleaseNoteCreateInput {
  id: String
  pipelineId: String!
  releaseIds: [String!]!
}

type ReleaseNoteEdge {
  cursor: String!
  node: ReleaseNote!
}

type ReleaseNotePayload {
  lastSyncId: Float!
  releaseNote: ReleaseNote!
  success: Boolean!
}

input ReleaseNoteUpdateInput {
  releaseIds: [String!]
}

type ReleasePayload {
  lastSyncId: Float!
  release: Release!
  success: Boolean!
}

type ReleasePipeline implements Node {
  approximateReleaseCount: Int!
  archivedAt: DateTime
  createdAt: DateTime!
  id: ID!
  includePathPatterns: [String!]!
  isProduction: Boolean!
  name: String!
  releases(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy, sort: [ReleaseSortInput!]): ReleaseConnection!
  slugId: String!
  stages(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): ReleaseStageConnection!
  teams(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): TeamConnection!
  type: ReleasePipelineType!
  updatedAt: DateTime!
  url: String!
}

type ReleasePipelineArchivePayload implements ArchivePayload {
  entity: ReleasePipeline
  lastSyncId: Float!
  success: Boolean!
}

input ReleasePipelineCollectionFilter {
  and: [ReleasePipelineCollectionFilter!]
  createdAt: DateComparator
  every: ReleasePipelineFilter
  id: IDComparator
  isProduction: BooleanComparator
  length: NumberComparator
  name: StringComparator
  or: [ReleasePipelineCollectionFilter!]
  some: ReleasePipelineFilter
  teams: TeamCollectionFilter
  updatedAt: DateComparator
}

type ReleasePipelineConnection {
  edges: [ReleasePipelineEdge!]!
  nodes: [ReleasePipeline!]!
  pageInfo: PageInfo!
}

input ReleasePipelineCreateInput {
  id: String
  includePathPatterns: [String!]
  isProduction: Boolean
  name: String!
  slugId: String
  teamIds: [String!]
  type: ReleasePipelineType
}

type ReleasePipelineEdge {
  cursor: String!
  node: ReleasePipeline!
}

input ReleasePipelineFilter {
  and: [ReleasePipelineFilter!]
  createdAt: DateComparator
  id: IDComparator
  isProduction: BooleanComparator
  name: StringComparator
  or: [ReleasePipelineFilter!]
  teams: TeamCollectionFilter
  updatedAt: DateComparator
}

input ReleasePipelineNameSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

type ReleasePipelinePayload {
  lastSyncId: Float!
  releasePipeline: ReleasePipeline!
  success: Boolean!
}

input ReleasePipelineSortInput {
  name: ReleasePipelineNameSort
}

enum ReleasePipelineType {
  continuous
  scheduled
}

input ReleasePipelineUpdateInput {
  includePathPatterns: [String!]
  isProduction: Boolean
  name: String
  slugId: String
  teamIds: [String!]
  type: ReleasePipelineType
}

input ReleaseSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

input ReleaseSortInput {
  stage: ReleaseStageSort
}

type ReleaseStage implements Node {
  archivedAt: DateTime
  color: String!
  createdAt: DateTime!
  frozen: Boolean!
  id: ID!
  name: String!
  pipeline: ReleasePipeline!
  position: Float!
  releases(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): ReleaseConnection!
  type: ReleaseStageType!
  updatedAt: DateTime!
}

type ReleaseStageArchivePayload implements ArchivePayload {
  entity: ReleaseStage
  lastSyncId: Float!
  success: Boolean!
}

type ReleaseStageConnection {
  edges: [ReleaseStageEdge!]!
  nodes: [ReleaseStage!]!
  pageInfo: PageInfo!
}

input ReleaseStageCreateInput {
  color: String!
  frozen: Boolean
  id: String
  name: String!
  pipelineId: String!
  position: Float!
  type: ReleaseStageType!
}

type ReleaseStageEdge {
  cursor: String!
  node: ReleaseStage!
}

input ReleaseStageFilter {
  and: [ReleaseStageFilter!]
  createdAt: DateComparator
  id: IDComparator
  name: StringComparator
  or: [ReleaseStageFilter!]
  type: ReleaseStageTypeComparator
  updatedAt: DateComparator
}

type ReleaseStagePayload {
  lastSyncId: Float!
  releaseStage: ReleaseStage!
  success: Boolean!
}

input ReleaseStageSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

enum ReleaseStageType {
  canceled
  completed
  planned
  started
}

input ReleaseStageTypeComparator {
  eq: ReleaseStageType
  in: [ReleaseStageType!]
  neq: ReleaseStageType
  nin: [ReleaseStageType!]
  null: Boolean
}

input ReleaseStageUpdateInput {
  color: String
  frozen: Boolean
  name: String
  position: Float
}

input ReleaseSyncInput {
  commitSha: String!
  debugSink: ReleaseDebugSinkInput
  issueReferences: [IssueReferenceInput!]
  name: String
  pipelineId: String!
  pullRequestReferences: [PullRequestReferenceInput!]
  repository: RepositoryDataInput
  revertedIssueReferences: [IssueReferenceInput!]
  version: String
}

input ReleaseSyncInputBase {
  commitSha: String!
  debugSink: ReleaseDebugSinkInput
  issueReferences: [IssueReferenceInput!]
  name: String
  pullRequestReferences: [PullRequestReferenceInput!]
  repository: RepositoryDataInput
  revertedIssueReferences: [IssueReferenceInput!]
  version: String
}

input ReleaseUpdateByPipelineInput {
  pipelineId: String!
  stage: String
  version: String
}

input ReleaseUpdateByPipelineInputBase {
  stage: String
  version: String
}

input ReleaseUpdateInput {
  commitSha: String
  description: String
  name: String
  pipelineId: String
  stageId: String
  startDate: TimelessDate
  targetDate: TimelessDate
  trashed: Boolean
  version: String
}

input RepositoryDataInput {
  name: String!
  owner: String!
  provider: String!
  url: String!
}

type RepositorySuggestion {
  confidence: Float!
  hostname: String
  repositoryFullName: String!
}

type RepositorySuggestionsPayload {
  suggestions: [RepositorySuggestion!]!
}

input RevenueSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

type Roadmap implements Node {
  archivedAt: DateTime
  color: String
  createdAt: DateTime!
  creator: User!
  description: String
  id: ID!
  name: String!
  organization: Organization!
  owner: User
  projects(after: String, before: String, filter: ProjectFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): ProjectConnection!
  slugId: String!
  sortOrder: Float!
  updatedAt: DateTime!
  url: String!
}

type RoadmapArchivePayload implements ArchivePayload {
  entity: Roadmap
  lastSyncId: Float!
  success: Boolean!
}

input RoadmapCollectionFilter {
  and: [RoadmapCollectionFilter!]
  createdAt: DateComparator
  creator: UserFilter
  every: RoadmapFilter
  id: IDComparator
  length: NumberComparator
  name: StringComparator
  or: [RoadmapCollectionFilter!]
  slugId: StringComparator
  some: RoadmapFilter
  updatedAt: DateComparator
}

type RoadmapConnection {
  edges: [RoadmapEdge!]!
  nodes: [Roadmap!]!
  pageInfo: PageInfo!
}

input RoadmapCreateInput {
  color: String
  description: String
  id: String
  name: String!
  ownerId: String
  sortOrder: Float
}

type RoadmapEdge {
  cursor: String!
  node: Roadmap!
}

input RoadmapFilter {
  and: [RoadmapFilter!]
  createdAt: DateComparator
  creator: UserFilter
  id: IDComparator
  name: StringComparator
  or: [RoadmapFilter!]
  slugId: StringComparator
  updatedAt: DateComparator
}

type RoadmapPayload {
  lastSyncId: Float!
  roadmap: Roadmap!
  success: Boolean!
}

type RoadmapToProject implements Node {
  archivedAt: DateTime
  createdAt: DateTime!
  id: ID!
  project: Project!
  roadmap: Roadmap!
  sortOrder: String!
  updatedAt: DateTime!
}

type RoadmapToProjectConnection {
  edges: [RoadmapToProjectEdge!]!
  nodes: [RoadmapToProject!]!
  pageInfo: PageInfo!
}

input RoadmapToProjectCreateInput {
  id: String
  projectId: String!
  roadmapId: String!
  sortOrder: Float
}

type RoadmapToProjectEdge {
  cursor: String!
  node: RoadmapToProject!
}

type RoadmapToProjectPayload {
  lastSyncId: Float!
  roadmapToProject: RoadmapToProject!
  success: Boolean!
}

input RoadmapToProjectUpdateInput {
  sortOrder: Float
}

input RoadmapUpdateInput {
  color: String
  description: String
  name: String
  ownerId: String
  sortOrder: Float
}

input RootIssueSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
  sort: IssueSortInput!
}

enum SLADayCountType {
  all
  onlyBusinessDays
}

input SalesforceMetadataIntegrationComparator {
  caseMetadata: JSONObject
}

input SalesforceSettingsInput {
  automateTicketReopeningOnCancellation: Boolean
  automateTicketReopeningOnComment: Boolean
  automateTicketReopeningOnCompletion: Boolean
  automateTicketReopeningOnProjectCancellation: Boolean
  automateTicketReopeningOnProjectCompletion: Boolean
  defaultTeam: String
  disableCustomerRequestsAutoCreation: Boolean
  enableAiIntake: Boolean
  reopenCaseStatus: String
  restrictVisibility: Boolean
  sendNoteOnComment: Boolean
  sendNoteOnStatusChange: Boolean
  subdomain: String
  url: String
}

input SemanticSearchFilters {
  documents: DocumentFilter
  initiatives: InitiativeFilter
  issues: IssueFilter
  projects: ProjectFilter
}

type SemanticSearchPayload {
  enabled: Boolean! @deprecated(reason: "Always true.")
  results: [SemanticSearchResult!]!
}

type SemanticSearchResult implements Node {
  document: Document
  id: ID!
  initiative: Initiative
  issue: Issue
  project: Project
  type: SemanticSearchResultType!
}

enum SemanticSearchResultType {
  document
  initiative
  issue
  project
}

enum SendStrategy {
  desktop
  desktopAndPush
  desktopThenPush
  push
}

input SentrySettingsInput {
  organizationId: ID!
  organizationSlug: String!
  resolvingCompletesIssues: Boolean!
  unresolvingReopensIssues: Boolean!
}

type SesDomainIdentity implements Node {
  archivedAt: DateTime
  canSendFromCustomDomain: Boolean!
  createdAt: DateTime!
  creator: User
  dnsRecords: [SesDomainIdentityDnsRecord!]!
  domain: String!
  id: ID!
  organization: Organization!
  region: String!
  updatedAt: DateTime!
}

type SesDomainIdentityDnsRecord {
  content: String!
  isVerified: Boolean!
  name: String!
  type: String!
}

input SizeSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

enum SlaStatus {
  Breached
  Completed
  Failed
  HighRisk
  LowRisk
  MediumRisk
}

input SlaStatusComparator {
  eq: SlaStatus
  in: [SlaStatus!]
  neq: SlaStatus
  nin: [SlaStatus!]
  null: Boolean
}

input SlaStatusSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

input SlackAsksSettingsInput {
  canAdministrate: UserRoleType!
  customerVisibility: CustomerVisibilityMode
  enableAgent: Boolean
  enableLinearAgentWorkflowAccess: Boolean
  enterpriseId: String
  enterpriseName: String
  externalUserActions: Boolean
  shouldUnfurl: Boolean
  shouldUseDefaultUnfurl: Boolean
  slackChannelMapping: [SlackChannelNameMappingInput!]
  teamId: String
  teamName: String
}

type SlackAsksTeamSettings {
  hasDefaultAsk: Boolean!
  id: String!
}

input SlackAsksTeamSettingsInput {
  hasDefaultAsk: Boolean!
  id: String!
}

type SlackChannelConnectPayload {
  addBot: Boolean!
  integration: Integration
  lastSyncId: Float!
  nudgeToConnectMainSlackIntegration: Boolean
  nudgeToUpdateMainSlackIntegration: Boolean
  success: Boolean!
}

type SlackChannelNameMapping {
  aiTitles: Boolean
  autoCreateOnBotMention: Boolean
  autoCreateOnEmoji: Boolean
  autoCreateOnMessage: Boolean
  autoCreateTemplateId: String
  botAdded: Boolean
  id: String!
  isPrivate: Boolean
  isShared: Boolean
  name: String!
  postAcceptedFromTriageUpdates: Boolean
  postCancellationUpdates: Boolean
  postCompletionUpdates: Boolean
  teams: [SlackAsksTeamSettings!]!
}

input SlackChannelNameMappingInput {
  aiTitles: Boolean
  autoCreateOnBotMention: Boolean
  autoCreateOnEmoji: Boolean
  autoCreateOnMessage: Boolean
  autoCreateTemplateId: String
  botAdded: Boolean
  id: String!
  isPrivate: Boolean
  isShared: Boolean
  name: String!
  postAcceptedFromTriageUpdates: Boolean
  postCancellationUpdates: Boolean
  postCompletionUpdates: Boolean
  teams: [SlackAsksTeamSettingsInput!]!
}

enum SlackChannelType {
  DirectMessage
  MultiPersonDirectMessage
  Private
  PrivateGroup
  Public
}

input SlackPostSettingsInput {
  channel: String!
  channelId: String!
  channelType: SlackChannelType
  configurationUrl: String!
  teamId: String
}

input SlackSettingsInput {
  enableAgent: Boolean
  enableCodeIntelligence: Boolean
  enableLinearAgentWorkflowAccess: Boolean
  enterpriseId: String
  enterpriseName: String
  externalUserActions: Boolean
  linkOnIssueIdMention: Boolean!
  shouldUnfurl: Boolean
  shouldUseDefaultUnfurl: Boolean
  teamId: String
  teamName: String
}

input SourceMetadataComparator {
  null: Boolean
  salesforceMetadata: SalesforceMetadataIntegrationComparator
  subType: SubTypeComparator
}

input SourceTypeComparator {
  contains: String
  containsIgnoreCase: String
  containsIgnoreCaseAndAccent: String
  endsWith: String
  eq: String
  eqIgnoreCase: String
  in: [String!]
  neq: String
  neqIgnoreCase: String
  nin: [String!]
  notContains: String
  notContainsIgnoreCase: String
  notEndsWith: String
  notStartsWith: String
  startsWith: String
  startsWithIgnoreCase: String
}

type SsoUrlFromEmailResponse {
  samlSsoUrl: String!
  success: Boolean!
}

input StartDateSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

input StringArrayComparator {
  every: StringItemComparator
  length: NumberComparator
  some: StringItemComparator
}

input StringComparator {
  contains: String
  containsIgnoreCase: String
  containsIgnoreCaseAndAccent: String
  endsWith: String
  eq: String
  eqIgnoreCase: String
  in: [String!]
  neq: String
  neqIgnoreCase: String
  nin: [String!]
  notContains: String
  notContainsIgnoreCase: String
  notEndsWith: String
  notStartsWith: String
  startsWith: String
  startsWithIgnoreCase: String
}

input StringItemComparator {
  contains: String
  containsIgnoreCase: String
  containsIgnoreCaseAndAccent: String
  endsWith: String
  eq: String
  eqIgnoreCase: String
  in: [String!]
  neq: String
  neqIgnoreCase: String
  nin: [String!]
  notContains: String
  notContainsIgnoreCase: String
  notEndsWith: String
  notStartsWith: String
  startsWith: String
  startsWithIgnoreCase: String
}

input SubTypeComparator {
  eq: String
  in: [String!]
  neq: String
  nin: [String!]
  null: Boolean
}

type Subscription {
  agentActivityCreated: AgentActivity!
  agentActivityUpdated: AgentActivity!
  agentSessionCreated: AgentSession!
  agentSessionUpdated: AgentSession!
  aiConversationUpdated: AiConversation!
  aiPromptProgressCreated(filter: AiPromptProgressSubscriptionFilter): AiPromptProgress!
  aiPromptProgressUpdated(filter: AiPromptProgressSubscriptionFilter): AiPromptProgress!
  commentArchived: Comment!
  commentCreated: Comment!
  commentDeleted: Comment!
  commentUnarchived: Comment!
  commentUpdated: Comment!
  cycleArchived: Cycle!
  cycleCreated: Cycle!
  cycleUpdated: Cycle!
  documentArchived: Document!
  documentContentCreated: DocumentContent!
  documentContentDraftCreated: DocumentContentDraft!
  documentContentDraftDeleted: DocumentContentDraft!
  documentContentDraftUpdated: DocumentContentDraft!
  documentContentUpdated: DocumentContent!
  documentCreated: Document!
  documentUnarchived: Document!
  documentUpdated: Document!
  draftCreated: Draft!
  draftDeleted: Draft!
  draftUpdated: Draft!
  favoriteCreated: Favorite!
  favoriteDeleted: Favorite!
  favoriteUpdated: Favorite!
  initiativeCreated: Initiative!
  initiativeDeleted: Initiative!
  initiativeUpdated: Initiative!
  issueArchived: Issue!
  issueCreated(filter: IssueSubscriptionFilter): Issue!
  issueDraftCreated: IssueDraft!
  issueDraftDeleted: IssueDraft!
  issueDraftUpdated: IssueDraft!
  issueHistoryCreated: IssueHistory!
  issueHistoryUpdated: IssueHistory!
  issueLabelCreated: IssueLabel!
  issueLabelDeleted: IssueLabel!
  issueLabelUpdated: IssueLabel!
  issueRelationCreated: IssueRelation!
  issueRelationDeleted: IssueRelation!
  issueRelationUpdated: IssueRelation!
  issueUnarchived: Issue!
  issueUpdated(filter: IssueSubscriptionFilter): Issue!
  notificationArchived: Notification!
  notificationCreated: Notification!
  notificationDeleted: Notification!
  notificationUnarchived: Notification!
  notificationUpdated: Notification!
  organizationUpdated: Organization!
  projectArchived: Project!
  projectCreated: Project!
  projectUnarchived: Project!
  projectUpdateCreated: ProjectUpdate!
  projectUpdateDeleted: ProjectUpdate!
  projectUpdateUpdated: ProjectUpdate!
  projectUpdated: Project!
  roadmapCreated: Roadmap!
  roadmapDeleted: Roadmap!
  roadmapUpdated: Roadmap!
  teamCreated: Team!
  teamDeleted: Team!
  teamMembershipCreated: TeamMembership!
  teamMembershipDeleted: TeamMembership!
  teamMembershipUpdated: TeamMembership!
  teamUpdated: Team!
  userCreated: User!
  userUpdated: User!
  workflowStateArchived: WorkflowState!
  workflowStateCreated: WorkflowState!
  workflowStateUpdated: WorkflowState!
}

type SuccessPayload {
  lastSyncId: Float!
  success: Boolean!
}

type Summary implements Node {
  archivedAt: DateTime
  content: JSONObject!
  createdAt: DateTime!
  evalLogId: String
  generatedAt: DateTime!
  generationStatus: SummaryGenerationStatus!
  id: ID!
  issue: Issue!
  updatedAt: DateTime!
}

enum SummaryGenerationStatus {
  completed
  failed
  pending
}

type SyncedExternalThread {
  displayName: String
  id: ID
  isConnected: Boolean!
  isPersonalIntegrationConnected: Boolean!
  isPersonalIntegrationRequired: Boolean!
  name: String
  subType: String
  type: String!
  url: String
}

input TargetDateSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

type Team implements Node {
  activeCycle: Cycle
  aiDiscussionSummariesEnabled: Boolean!
  aiThreadSummariesEnabled: Boolean!
  allMembersCanJoin: Boolean
  ancestors: [Team!]!
  archivedAt: DateTime
  autoArchivePeriod: Float!
  autoCloseChildIssues: Boolean
  autoCloseParentIssues: Boolean
  autoClosePeriod: Float
  autoCloseStateId: String
  children: [Team!]!
  color: String
  createdAt: DateTime!
  currentProgress: JSONObject!
  cycleCalenderUrl: String!
  cycleCooldownTime: Float!
  cycleDuration: Float!
  cycleIssueAutoAssignCompleted: Boolean!
  cycleIssueAutoAssignStarted: Boolean!
  cycleLockToActive: Boolean!
  cycleStartDay: Float!
  cycles(after: String, before: String, filter: CycleFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): CycleConnection!
  cyclesEnabled: Boolean!
  defaultIssueEstimate: Float!
  defaultIssueState: WorkflowState
  defaultProjectTemplate: Template
  defaultTemplateForMembers: Template
  defaultTemplateForMembersId: String @deprecated(reason: "Use defaultTemplateForMembers instead")
  defaultTemplateForNonMembers: Template
  defaultTemplateForNonMembersId: String @deprecated(reason: "Use defaultTemplateForNonMembers instead")
  description: String
  displayName: String!
  draftWorkflowState: WorkflowState @deprecated(reason: "Use team.gitAutomationStates instead.")
  facets: [Facet!]!
  gitAutomationStates(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): GitAutomationStateConnection!
  groupIssueHistory: Boolean!
  icon: String
  id: ID!
  inheritIssueEstimation: Boolean!
  inheritSlackAutoCreateProjectChannel: Boolean!
  inheritWorkflowStatuses: Boolean!
  integrationsSettings: IntegrationsSettings
  inviteHash: String! @deprecated(reason: "Not used anymore, simply returning an empty string.")
  issueCount(includeArchived: Boolean = false): Int!
  issueEstimationAllowZero: Boolean!
  issueEstimationExtended: Boolean!
  issueEstimationType: String!
  issueOrderingNoPriorityFirst: Boolean! @deprecated(reason: "This setting is no longer in use.")
  issueSortOrderDefaultToBottom: Boolean! @deprecated(reason: "Use setIssueSortOrderOnStateChange instead.")
  issues(after: String, before: String, filter: IssueFilter, first: Int, includeArchived: Boolean, includeSubTeams: Boolean = false, last: Int, orderBy: PaginationOrderBy): IssueConnection!
  joinByDefault: Boolean
  key: String!
  labels(after: String, before: String, filter: IssueLabelFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): IssueLabelConnection!
  markedAsDuplicateWorkflowState: WorkflowState
  members(after: String, before: String, filter: UserFilter, first: Int, includeArchived: Boolean, includeDisabled: Boolean, last: Int, orderBy: PaginationOrderBy): UserConnection!
  membership(userId: String!): TeamMembership
  memberships(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): TeamMembershipConnection!
  mergeWorkflowState: WorkflowState @deprecated(reason: "Use team.gitAutomationStates instead.")
  mergeableWorkflowState: WorkflowState @deprecated(reason: "Use team.gitAutomationStates instead.")
  name: String!
  organization: Organization!
  parent: Team
  posts: [Post!]!
  private: Boolean!
  progressHistory: JSONObject!
  projects(after: String, before: String, filter: ProjectFilter, first: Int, includeArchived: Boolean, includeSubTeams: Boolean = false, last: Int, orderBy: PaginationOrderBy, sort: [ProjectSortInput!]): ProjectConnection!
  releasePipelines(after: String, before: String, filter: ReleasePipelineFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): ReleasePipelineConnection!
  requirePriorityToLeaveTriage: Boolean!
  retiredAt: DateTime
  reviewWorkflowState: WorkflowState @deprecated(reason: "Use team.gitAutomationStates instead.")
  scimGroupName: String
  scimManaged: Boolean!
  securitySettings: JSONObject!
  setIssueSortOrderOnStateChange: String!
  slackAutoCreateProjectChannel: Boolean
  slackIssueComments: Boolean! @deprecated(reason: "No longer in use")
  slackIssueStatuses: Boolean! @deprecated(reason: "No longer in use")
  slackNewIssue: Boolean! @deprecated(reason: "No longer is use")
  startWorkflowState: WorkflowState @deprecated(reason: "Use team.gitAutomationStates instead.")
  states(after: String, before: String, filter: WorkflowStateFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): WorkflowStateConnection!
  templates(after: String, before: String, filter: NullableTemplateFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): TemplateConnection!
  timezone: String!
  triageEnabled: Boolean!
  triageIssueState: WorkflowState
  triageResponsibility: TriageResponsibility
  upcomingCycleCount: Float!
  updatedAt: DateTime!
  webhooks(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): WebhookConnection!
}

type TeamArchivePayload implements ArchivePayload {
  entity: Team
  lastSyncId: Float!
  success: Boolean!
}

input TeamCollectionFilter {
  ancestors: TeamCollectionFilter
  and: [TeamCollectionFilter!]
  createdAt: DateComparator
  every: TeamFilter
  id: IDComparator
  length: NumberComparator
  or: [TeamCollectionFilter!]
  parent: NullableTeamFilter
  some: TeamFilter
  updatedAt: DateComparator
}

type TeamConnection {
  edges: [TeamEdge!]!
  nodes: [Team!]!
  pageInfo: PageInfo!
}

input TeamCreateInput {
  autoArchivePeriod: Float
  autoClosePeriod: Float
  autoCloseStateId: String
  color: String
  cycleCooldownTime: Int
  cycleDuration: Int
  cycleIssueAutoAssignCompleted: Boolean
  cycleIssueAutoAssignStarted: Boolean
  cycleLockToActive: Boolean
  cycleStartDay: Float
  cyclesEnabled: Boolean
  defaultIssueEstimate: Float
  defaultProjectTemplateId: String
  defaultTemplateForMembersId: String
  defaultTemplateForNonMembersId: String
  description: String
  groupIssueHistory: Boolean
  icon: String
  id: String
  inheritIssueEstimation: Boolean
  inheritProductIntelligenceScope: Boolean
  inheritSlackAutoCreateProjectChannel: Boolean
  inheritWorkflowStatuses: Boolean
  issueEstimationAllowZero: Boolean
  issueEstimationExtended: Boolean
  issueEstimationType: String
  issueSharingEnabled: Boolean
  key: String
  markedAsDuplicateWorkflowStateId: String
  name: String!
  parentId: String
  private: Boolean
  productIntelligenceScope: ProductIntelligenceScope
  requirePriorityToLeaveTriage: Boolean
  setIssueSortOrderOnStateChange: String
  slackAutoCreateProjectChannel: Boolean
  timezone: String
  triageEnabled: Boolean
  upcomingCycleCount: Float
}

type TeamEdge {
  cursor: String!
  node: Team!
}

input TeamFilter {
  ancestors: TeamCollectionFilter
  and: [TeamFilter!]
  createdAt: DateComparator
  description: NullableStringComparator
  id: IDComparator
  issues: IssueCollectionFilter
  key: StringComparator
  name: StringComparator
  or: [TeamFilter!]
  parent: NullableTeamFilter
  private: BooleanComparator
  releasePipelines: ReleasePipelineCollectionFilter
  retiredAt: NullableDateComparator
  updatedAt: DateComparator
}

type TeamMembership implements Node {
  archivedAt: DateTime
  createdAt: DateTime!
  id: ID!
  owner: Boolean!
  sortOrder: Float!
  team: Team!
  updatedAt: DateTime!
  user: User!
}

type TeamMembershipConnection {
  edges: [TeamMembershipEdge!]!
  nodes: [TeamMembership!]!
  pageInfo: PageInfo!
}

input TeamMembershipCreateInput {
  id: String
  owner: Boolean
  sortOrder: Float
  teamId: String!
  userId: String!
}

type TeamMembershipEdge {
  cursor: String!
  node: TeamMembership!
}

type TeamMembershipPayload {
  lastSyncId: Float!
  success: Boolean!
  teamMembership: TeamMembership
}

input TeamMembershipUpdateInput {
  owner: Boolean
  sortOrder: Float
}

type TeamNotificationSubscription implements Entity & Node & NotificationSubscription {
  active: Boolean!
  archivedAt: DateTime
  contextViewType: ContextViewType
  createdAt: DateTime!
  customView: CustomView
  customer: Customer
  cycle: Cycle
  id: ID!
  initiative: Initiative
  label: IssueLabel
  notificationSubscriptionTypes: [String!]!
  project: Project
  subscriber: User!
  team: Team!
  updatedAt: DateTime!
  user: User
  userContextViewType: UserContextViewType
}

type TeamPayload {
  lastSyncId: Float!
  success: Boolean!
  team: Team
}

enum TeamRetirementSubTeamHandling {
  retire
  unnest
}

enum TeamRoleType {
  member
  owner
}

input TeamSecuritySettingsInput {
  issueSharing: TeamRoleType
  labelManagement: TeamRoleType
  memberManagement: TeamRoleType
  teamManagement: TeamRoleType
  templateManagement: TeamRoleType
}

input TeamSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

input TeamUpdateInput {
  aiDiscussionSummariesEnabled: Boolean
  aiThreadSummariesEnabled: Boolean
  allMembersCanJoin: Boolean
  autoArchivePeriod: Float
  autoCloseChildIssues: Boolean
  autoCloseParentIssues: Boolean
  autoClosePeriod: Float
  autoCloseStateId: String
  color: String
  cycleCooldownTime: Int
  cycleDuration: Int
  cycleEnabledStartDate: DateTime
  cycleIssueAutoAssignCompleted: Boolean
  cycleIssueAutoAssignStarted: Boolean
  cycleLockToActive: Boolean
  cycleStartDay: Float
  cyclesEnabled: Boolean
  defaultIssueEstimate: Float
  defaultIssueStateId: String
  defaultProjectTemplateId: String
  defaultTemplateForMembersId: String
  defaultTemplateForNonMembersId: String
  description: String
  groupIssueHistory: Boolean
  handleSubTeamsOnRetirement: TeamRetirementSubTeamHandling
  icon: String
  inheritIssueEstimation: Boolean
  inheritProductIntelligenceScope: Boolean
  inheritSlackAutoCreateProjectChannel: Boolean
  inheritWorkflowStatuses: Boolean
  issueEstimationAllowZero: Boolean
  issueEstimationExtended: Boolean
  issueEstimationType: String
  issueSharingEnabled: Boolean
  joinByDefault: Boolean
  key: String
  markedAsDuplicateWorkflowStateId: String
  name: String
  parentId: String
  private: Boolean
  productIntelligenceScope: ProductIntelligenceScope
  requirePriorityToLeaveTriage: Boolean
  retiredAt: DateTime
  scimManaged: Boolean
  securitySettings: TeamSecuritySettingsInput
  setIssueSortOrderOnStateChange: String
  slackAutoCreateProjectChannel: Boolean
  slackIssueComments: Boolean
  slackIssueStatuses: Boolean
  slackNewIssue: Boolean
  timezone: String
  triageEnabled: Boolean
  upcomingCycleCount: Float
}

type Template implements Node {
  archivedAt: DateTime
  color: String
  createdAt: DateTime!
  creator: User
  description: String
  hasFormFields: Boolean!
  icon: String
  id: ID!
  inheritedFrom: Template
  lastAppliedAt: DateTime
  lastUpdatedBy: User
  name: String!
  organization: Organization!
  sortOrder: Float!
  team: Team
  templateData: JSON!
  type: String!
  updatedAt: DateTime!
}

type TemplateConnection {
  edges: [TemplateEdge!]!
  nodes: [Template!]!
  pageInfo: PageInfo!
}

input TemplateCreateInput {
  color: String
  description: String
  icon: String
  id: String
  name: String!
  sortOrder: Float
  teamId: String
  templateData: JSON!
  type: String!
}

type TemplateEdge {
  cursor: String!
  node: Template!
}

type TemplatePayload {
  lastSyncId: Float!
  success: Boolean!
  template: Template!
}

input TemplateUpdateInput {
  color: String
  description: String
  icon: String
  name: String
  sortOrder: Float
  teamId: String
  templateData: JSON
}

input TierSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

input TimeInStatusSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

type TimeSchedule implements Node {
  archivedAt: DateTime
  createdAt: DateTime!
  entries: [TimeScheduleEntry!]
  externalId: String
  externalUrl: String
  id: ID!
  integration: Integration
  name: String!
  organization: Organization!
  updatedAt: DateTime!
}

type TimeScheduleConnection {
  edges: [TimeScheduleEdge!]!
  nodes: [TimeSchedule!]!
  pageInfo: PageInfo!
}

input TimeScheduleCreateInput {
  entries: [TimeScheduleEntryInput!]!
  externalId: String
  externalUrl: String
  id: String
  name: String!
}

type TimeScheduleEdge {
  cursor: String!
  node: TimeSchedule!
}

type TimeScheduleEntry {
  endsAt: DateTime!
  startsAt: DateTime!
  userEmail: String
  userId: String
}

input TimeScheduleEntryInput {
  endsAt: DateTime!
  startsAt: DateTime!
  userEmail: String
  userId: String
}

type TimeSchedulePayload {
  lastSyncId: Float!
  success: Boolean!
  timeSchedule: TimeSchedule!
}

input TimeScheduleUpdateInput {
  entries: [TimeScheduleEntryInput!]
  externalId: String
  externalUrl: String
  name: String
}

scalar TimelessDate

scalar TimelessDateOrDuration

input TitleSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

input TokenUserAccountAuthInput {
  clientAuthCode: String
  email: String!
  inviteLink: String
  timezone: String!
  token: String!
}

type TriageResponsibility implements Node {
  action: TriageResponsibilityAction!
  archivedAt: DateTime
  createdAt: DateTime!
  currentUser: User
  id: ID!
  manualSelection: TriageResponsibilityManualSelection
  team: Team!
  timeSchedule: TimeSchedule
  updatedAt: DateTime!
}

enum TriageResponsibilityAction {
  assign
  notify
}

type TriageResponsibilityConnection {
  edges: [TriageResponsibilityEdge!]!
  nodes: [TriageResponsibility!]!
  pageInfo: PageInfo!
}

input TriageResponsibilityCreateInput {
  action: String!
  id: String
  manualSelection: TriageResponsibilityManualSelectionInput
  teamId: String!
  timeScheduleId: String
}

type TriageResponsibilityEdge {
  cursor: String!
  node: TriageResponsibility!
}

type TriageResponsibilityManualSelection {
  assignmentIndex: Int
  userIds: [String!]!
}

input TriageResponsibilityManualSelectionInput {
  assignmentIndex: Int
  userIds: [String!]!
}

type TriageResponsibilityPayload {
  lastSyncId: Float!
  success: Boolean!
  triageResponsibility: TriageResponsibility!
}

input TriageResponsibilityUpdateInput {
  action: String
  manualSelection: TriageResponsibilityManualSelectionInput
  timeScheduleId: String
}

enum TriageRuleErrorType {
  codingAgentQuotaExceeded
  cycle
  default
  labelGroupConflict
}

scalar UUID

input UpdatedAtSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

type UploadFile {
  assetUrl: String!
  contentType: String!
  filename: String!
  headers: [UploadFileHeader!]!
  metaData: JSONObject
  size: Int!
  uploadUrl: String!
}

type UploadFileHeader {
  key: String!
  value: String!
}

type UploadPayload {
  lastSyncId: Float!
  success: Boolean!
  uploadFile: UploadFile
}

type User implements Node {
  active: Boolean!
  admin: Boolean!
  app: Boolean!
  archivedAt: DateTime
  assignedIssues(after: String, before: String, filter: IssueFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): IssueConnection!
  avatarBackgroundColor: String!
  avatarUrl: String
  calendarHash: String
  canAccessAnyPublicTeam: Boolean!
  createdAt: DateTime!
  createdIssueCount: Int!
  createdIssues(after: String, before: String, filter: IssueFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): IssueConnection!
  delegatedIssues(after: String, before: String, filter: IssueFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): IssueConnection!
  description: String
  disableReason: String
  displayName: String!
  drafts(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): DraftConnection!
  email: String!
  feedFacets(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): FacetConnection!
  gitHubUserId: String
  guest: Boolean!
  id: ID!
  identityProvider: IdentityProvider
  initials: String!
  inviteHash: String! @deprecated(reason: "This hash is not in use anymore, this value will always be empty.")
  isAssignable: Boolean!
  isMe: Boolean!
  isMentionable: Boolean!
  issueDrafts(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): IssueDraftConnection!
  lastSeen: DateTime
  name: String!
  organization: Organization!
  owner: Boolean!
  statusEmoji: String
  statusLabel: String
  statusUntilAt: DateTime
  supportsAgentSessions: Boolean!
  teamMemberships(after: String, before: String, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): TeamMembershipConnection!
  teams(after: String, before: String, filter: TeamFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): TeamConnection!
  timezone: String
  title: String
  updatedAt: DateTime!
  url: String!
}

type UserAdminPayload {
  success: Boolean!
}

input UserCollectionFilter {
  active: BooleanComparator
  admin: BooleanComparator
  and: [UserCollectionFilter!]
  app: BooleanComparator
  assignedIssues: IssueCollectionFilter
  createdAt: DateComparator
  displayName: StringComparator
  email: StringComparator
  every: UserFilter
  id: IDComparator
  invited: BooleanComparator
  isInvited: BooleanComparator
  isMe: BooleanComparator
  length: NumberComparator
  name: StringComparator
  or: [UserCollectionFilter!]
  owner: BooleanComparator
  some: UserFilter
  updatedAt: DateComparator
}

type UserConnection {
  edges: [UserEdge!]!
  nodes: [User!]!
  pageInfo: PageInfo!
}

enum UserContextViewType {
  assigned
}

input UserDisplayNameSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

type UserEdge {
  cursor: String!
  node: User!
}

input UserFilter {
  active: BooleanComparator
  admin: BooleanComparator
  and: [UserFilter!]
  app: BooleanComparator
  assignedIssues: IssueCollectionFilter
  createdAt: DateComparator
  displayName: StringComparator
  email: StringComparator
  id: IDComparator
  invited: BooleanComparator
  isInvited: BooleanComparator
  isMe: BooleanComparator
  name: StringComparator
  or: [UserFilter!]
  owner: BooleanComparator
  updatedAt: DateComparator
}

enum UserFlagType {
  agentExamplesDismissed
  agentHomeHeadlineSeen
  agentHomePageNotice
  all
  analyticsWelcomeDismissed
  canPlaySnake
  canPlayTetris
  commandMenuClearShortcutTip
  completedOnboarding
  cycleWelcomeDismissed
  desktopDownloadToastDismissed
  desktopInstalled
  desktopTabsOnboardingDismissed
  dueDateShortcutMigration
  editorSlashCommandUsed
  emptyActiveIssuesDismissed
  emptyBacklogDismissed
  emptyCustomViewsDismissed
  emptyMyIssuesDismissed
  emptyParagraphSlashCommandTip
  figmaPluginBannerDismissed
  figmaPromptDismissed
  helpIslandFeatureInsightsDismissed
  importBannerDismissed
  initiativesBannerDismissed
  insightsHelpDismissed
  insightsWelcomeDismissed
  issueLabelSuggestionUsed
  issueMovePromptCompleted
  joinTeamIntroductionDismissed
  listSelectionTip
  migrateThemePreference
  milestoneOnboardingIsSeenAndDismissed
  projectBacklogWelcomeDismissed
  projectBoardOnboardingIsSeenAndDismissed
  projectUpdatesWelcomeDismissed
  projectWelcomeDismissed
  pulseWelcomeDismissed
  rewindBannerDismissed
  slackAgentPromoFromCreateNewIssueShown
  slackBotWelcomeMessageShown
  slackCommentReactionTipShown
  teamsBotWelcomeMessageShown
  teamsPageIntroductionDismissed
  threadedCommentsNudgeIsSeen
  triageWelcomeDismissed
  tryCodexDismissed
  tryCursorDismissed
  tryCyclesDismissed
  tryGithubDismissed
  tryInvitePeopleDismissed
  tryRoadmapsDismissed
  tryTriageDismissed
  updatedSlackThreadSyncIntegration
}

enum UserFlagUpdateOperation {
  clear
  decr
  incr
  lock
}

input UserNameSort {
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

type UserNotificationSubscription implements Entity & Node & NotificationSubscription {
  active: Boolean!
  archivedAt: DateTime
  contextViewType: ContextViewType
  createdAt: DateTime!
  customView: CustomView
  customer: Customer
  cycle: Cycle
  id: ID!
  initiative: Initiative
  label: IssueLabel
  notificationSubscriptionTypes: [String!]!
  project: Project
  subscriber: User!
  team: Team
  updatedAt: DateTime!
  user: User!
  userContextViewType: UserContextViewType
}

type UserPayload {
  lastSyncId: Float!
  success: Boolean!
  user: User
}

enum UserRoleType {
  admin
  app
  guest
  owner
  user
}

type UserSettings implements Node {
  archivedAt: DateTime
  autoAssignToSelf: Boolean!
  calendarHash: String
  createdAt: DateTime!
  feedLastSeenTime: DateTime
  feedSummarySchedule: FeedSummarySchedule
  id: ID!
  notificationCategoryPreferences: NotificationCategoryPreferences!
  notificationChannelPreferences: NotificationChannelPreferences!
  notificationDeliveryPreferences: NotificationDeliveryPreferences!
  showFullUserNames: Boolean!
  subscribedToChangelog: Boolean!
  subscribedToDPA: Boolean!
  subscribedToInviteAccepted: Boolean!
  subscribedToPrivacyLegalUpdates: Boolean!
  theme(deviceType: UserSettingsThemeDeviceType = desktop, mode: UserSettingsThemeMode = light): UserSettingsTheme
  unsubscribedFrom: [String!]! @deprecated(reason: "Use individual subscription fields instead. This field's value is now outdated.")
  updatedAt: DateTime!
  user: User!
}

type UserSettingsCustomSidebarTheme {
  accent: [Float!]!
  base: [Float!]!
  contrast: Int!
}

type UserSettingsCustomTheme {
  accent: [Float!]!
  base: [Float!]!
  contrast: Int!
  sidebar: UserSettingsCustomSidebarTheme
}

type UserSettingsFlagPayload {
  flag: String
  lastSyncId: Float!
  success: Boolean!
  value: Int
}

type UserSettingsFlagsResetPayload {
  lastSyncId: Float!
  success: Boolean!
}

type UserSettingsPayload {
  lastSyncId: Float!
  success: Boolean!
  userSettings: UserSettings!
}

type UserSettingsTheme {
  custom: UserSettingsCustomTheme
  preset: UserSettingsThemePreset!
}

enum UserSettingsThemeDeviceType {
  desktop
  mobileWeb
}

enum UserSettingsThemeMode {
  dark
  light
}

enum UserSettingsThemePreset {
  classicDark
  custom
  dark
  light
  magicBlue
  pureLight
  system
}

input UserSettingsUpdateInput {
  feedLastSeenTime: DateTime
  feedSummarySchedule: FeedSummarySchedule
  notificationCategoryPreferences: NotificationCategoryPreferencesInput
  notificationChannelPreferences: PartialNotificationChannelPreferencesInput
  notificationDeliveryPreferences: NotificationDeliveryPreferencesInput
  settings: JSONObject
  subscribedToChangelog: Boolean
  subscribedToDPA: Boolean
  subscribedToGeneralMarketingCommunications: Boolean
  subscribedToInviteAccepted: Boolean
  subscribedToPrivacyLegalUpdates: Boolean
  usageWarningHistory: JSONObject
}

input UserSortInput {
  displayName: UserDisplayNameSort
  name: UserNameSort
}

input UserUpdateInput {
  avatarUrl: String
  description: String
  displayName: String
  name: String
  statusEmoji: String
  statusLabel: String
  statusUntilAt: DateTime
  timezone: String
  title: String
}

type ViewPreferences implements Node {
  archivedAt: DateTime
  createdAt: DateTime!
  id: ID!
  preferences: ViewPreferencesValues!
  type: String!
  updatedAt: DateTime!
  viewType: String!
}

input ViewPreferencesCreateInput {
  customViewId: String
  id: String
  initiativeId: String
  insights: JSONObject
  labelId: String
  preferences: JSONObject!
  projectId: String
  projectLabelId: String
  releasePipelineId: String
  teamId: String
  type: ViewPreferencesType!
  userId: String
  viewType: ViewType!
}

type ViewPreferencesPayload {
  lastSyncId: Float!
  success: Boolean!
  viewPreferences: ViewPreferences!
}

type ViewPreferencesProjectLabelGroupColumn {
  active: Boolean!
  id: String!
}

enum ViewPreferencesType {
  organization
  user
}

input ViewPreferencesUpdateInput {
  insights: JSONObject
  preferences: JSONObject
}

type ViewPreferencesValues {
  closedIssuesOrderedByRecency: Boolean
  columnOrderBoard: [String!]
  columnOrderList: [String!]
  continuousPipelineReleaseFieldReleaseDate: Boolean
  continuousPipelineReleaseFieldVersion: Boolean
  continuousPipelineReleasesViewGrouping: String
  customViewFieldDateCreated: Boolean
  customViewFieldDateUpdated: Boolean
  customViewFieldOwner: Boolean
  customViewFieldVisibility: Boolean
  customViewsOrdering: String
  customerFieldDomains: Boolean
  customerFieldOwner: Boolean
  customerFieldRequestCount: Boolean
  customerFieldRevenue: Boolean
  customerFieldSize: Boolean
  customerFieldSource: Boolean
  customerFieldStatus: Boolean
  customerFieldTier: Boolean
  customerPageNeedsFieldIssueIdentifier: Boolean
  customerPageNeedsFieldIssuePriority: Boolean
  customerPageNeedsFieldIssueStatus: Boolean
  customerPageNeedsFieldIssueTargetDueDate: Boolean
  customerPageNeedsShowCompletedIssuesAndProjects: String
  customerPageNeedsShowImportantFirst: Boolean
  customerPageNeedsViewGrouping: String
  customerPageNeedsViewOrdering: String
  customersViewOrdering: String
  dashboardFieldDateCreated: Boolean
  dashboardFieldDateUpdated: Boolean
  dashboardFieldOwner: Boolean
  dashboardsOrdering: String
  embeddedCustomerNeedsShowImportantFirst: Boolean
  embeddedCustomerNeedsViewOrdering: String
  fieldAssignee: Boolean
  fieldCustomerCount: Boolean
  fieldCustomerRevenue: Boolean
  fieldCycle: Boolean
  fieldDateArchived: Boolean
  fieldDateCreated: Boolean
  fieldDateMyActivity: Boolean
  fieldDateUpdated: Boolean
  fieldDueDate: Boolean
  fieldEstimate: Boolean
  fieldId: Boolean
  fieldLabels: Boolean
  fieldLinkCount: Boolean
  fieldMilestone: Boolean
  fieldPreviewLinks: Boolean
  fieldPriority: Boolean
  fieldProject: Boolean
  fieldPullRequests: Boolean
  fieldRelease: Boolean
  fieldSentryIssues: Boolean
  fieldSla: Boolean
  fieldStatus: Boolean
  fieldTimeInCurrentStatus: Boolean
  focusViewGrouping: String
  focusViewOrdering: String
  focusViewOrderingDirection: String
  hiddenColumns: [String!]
  hiddenGroupsList: [String!]
  hiddenRows: [String!]
  inboxViewOrdering: String
  initiativeFieldActivity: Boolean
  initiativeFieldDateCompleted: Boolean
  initiativeFieldDateCreated: Boolean
  initiativeFieldDateUpdated: Boolean
  initiativeFieldDescription: Boolean
  initiativeFieldHealth: Boolean
  initiativeFieldInitiativeHealth: Boolean
  initiativeFieldOwner: Boolean
  initiativeFieldProjects: Boolean
  initiativeFieldStartDate: Boolean
  initiativeFieldStatus: Boolean
  initiativeFieldTargetDate: Boolean
  initiativeFieldTeams: Boolean
  initiativeGrouping: String
  initiativesViewOrdering: String
  issueGrouping: String
  issueGroupingLabelGroupId: String
  issueNesting: String
  issueSubGrouping: String
  issueSubGroupingLabelGroupId: String
  layout: String
  memberFieldJoined: Boolean
  memberFieldStatus: Boolean
  memberFieldTeams: Boolean
  projectCustomerNeedsShowCompletedIssuesLast: Boolean
  projectCustomerNeedsShowImportantFirst: Boolean
  projectCustomerNeedsViewGrouping: String
  projectCustomerNeedsViewOrdering: String
  projectFieldActivity: Boolean
  projectFieldCustomerCount: Boolean
  projectFieldCustomerRevenue: Boolean
  projectFieldDateCompleted: Boolean
  projectFieldDateCreated: Boolean
  projectFieldDateUpdated: Boolean
  projectFieldDescription: Boolean
  projectFieldDescriptionBoard: Boolean
  projectFieldHealth: Boolean
  projectFieldHealthTimeline: Boolean
  projectFieldInitiatives: Boolean
  projectFieldLabels: Boolean
  projectFieldLead: Boolean
  projectFieldLeadTimeline: Boolean
  projectFieldMembers: Boolean
  projectFieldMembersBoard: Boolean
  projectFieldMembersList: Boolean
  projectFieldMembersTimeline: Boolean
  projectFieldMilestone: Boolean
  projectFieldMilestoneTimeline: Boolean
  projectFieldPredictions: Boolean
  projectFieldPredictionsTimeline: Boolean
  projectFieldPriority: Boolean
  projectFieldRelations: Boolean
  projectFieldRelationsTimeline: Boolean
  projectFieldRoadmaps: Boolean
  projectFieldRoadmapsBoard: Boolean
  projectFieldRoadmapsList: Boolean
  projectFieldRoadmapsTimeline: Boolean
  projectFieldRolloutStage: Boolean
  projectFieldStartDate: Boolean
  projectFieldStatus: Boolean
  projectFieldStatusTimeline: Boolean
  projectFieldTargetDate: Boolean
  projectFieldTeams: Boolean
  projectFieldTeamsBoard: Boolean
  projectFieldTeamsList: Boolean
  projectFieldTeamsTimeline: Boolean
  projectGroupOrdering: String
  projectGrouping: String
  projectGroupingDateResolution: String
  projectGroupingLabelGroupId: String
  projectLabelGroupColumns: [ViewPreferencesProjectLabelGroupColumn!]
  projectLayout: String
  projectShowEmptyGroups: String
  projectShowEmptyGroupsBoard: String
  projectShowEmptyGroupsList: String
  projectShowEmptyGroupsTimeline: String
  projectShowEmptySubGroups: String
  projectShowEmptySubGroupsBoard: String
  projectShowEmptySubGroupsList: String
  projectShowEmptySubGroupsTimeline: String
  projectSubGrouping: String
  projectSubGroupingLabelGroupId: String
  projectViewOrdering: String
  projectZoomLevel: String @deprecated(reason: "Use timelineZoomScale instead.")
  releasePipelineFieldLatestRelease: Boolean
  releasePipelineFieldReleases: Boolean
  releasePipelineFieldTeams: Boolean
  releasePipelineFieldType: Boolean
  releasePipelineGrouping: String
  releasePipelinesViewOrdering: String
  reviewFieldAvatar: Boolean
  reviewFieldChecks: Boolean
  reviewFieldIdentifier: Boolean
  reviewFieldPreviewLinks: Boolean
  reviewFieldRepository: Boolean
  reviewGrouping: String
  reviewViewOrdering: String
  scheduledPipelineReleaseFieldCompletion: Boolean
  scheduledPipelineReleaseFieldDescription: Boolean
  scheduledPipelineReleaseFieldReleaseDate: Boolean
  scheduledPipelineReleaseFieldVersion: Boolean
  scheduledPipelineReleasesViewGrouping: String
  scheduledPipelineReleasesViewOrdering: String
  searchResultType: String
  searchViewOrdering: String
  showArchivedItems: Boolean
  showCompletedAgentSessions: String
  showCompletedIssues: String
  showCompletedProjects: String
  showCompletedReviews: String
  showDraftReviews: Boolean
  showEmptyGroups: Boolean
  showEmptyGroupsBoard: Boolean
  showEmptyGroupsList: Boolean
  showEmptySubGroups: Boolean
  showEmptySubGroupsBoard: Boolean
  showEmptySubGroupsList: Boolean
  showNestedInitiatives: Boolean
  showOnlySnoozedItems: Boolean
  showParents: Boolean
  showReadItems: Boolean
  showSnoozedItems: Boolean
  showSubInitiativeProjects: Boolean
  showSubIssues: Boolean
  showSubTeamIssues: Boolean
  showSubTeamProjects: Boolean
  showSupervisedIssues: Boolean
  showTriageIssues: Boolean
  showUnreadItemsFirst: Boolean
  teamFieldCycle: Boolean
  teamFieldDateCreated: Boolean
  teamFieldDateUpdated: Boolean
  teamFieldIdentifier: Boolean
  teamFieldMembers: Boolean
  teamFieldMembership: Boolean
  teamFieldOwner: Boolean
  teamFieldProjects: Boolean
  teamViewOrdering: String
  timelineChronologyShowCycleTeamIds: [String!]
  timelineChronologyShowWeekNumbers: Boolean
  timelineZoomScale: Float
  triageViewOrdering: String
  viewOrdering: String
  viewOrderingDirection: String
  workspaceMembersViewOrdering: String
}

enum ViewType {
  activeIssues
  agents
  allIssues
  archive
  backlog
  board
  completedCycle
  continuousPipelineReleases
  createdReviews
  customView
  customViews
  customer
  customers
  cycle
  dashboards
  embeddedCustomerNeeds
  feedAll
  feedCreated
  feedFollowing
  feedPopular
  focus
  inbox
  initiative
  initiativeOverview
  initiativeOverviewSubInitiatives
  initiatives
  initiativesCompleted
  initiativesPlanned
  issueIdentifiers
  label
  myIssues
  myIssuesActivity
  myIssuesCreatedByMe
  myIssuesSharedWithMe
  myIssuesSubscribedTo
  myReviews
  project
  projectCustomerNeeds
  projectDocuments
  projectLabel
  projects
  projectsAll
  projectsBacklog
  projectsClosed
  quickView
  release
  releasePipelines
  reviews
  roadmap
  roadmapAll
  roadmapBacklog
  roadmapClosed
  roadmaps
  scheduledPipelineReleases
  search
  splitSearch
  subIssues
  teams
  triage
  userProfile
  userProfileCreatedByUser
  workspaceMembers
}

type Webhook implements Node {
  allPublicTeams: Boolean!
  archivedAt: DateTime
  createdAt: DateTime!
  creator: User
  enabled: Boolean!
  failures: [WebhookFailureEvent!]!
  id: ID!
  label: String
  resourceTypes: [String!]!
  secret: String
  team: Team
  teamIds: [String!]
  updatedAt: DateTime!
  url: String
}

type WebhookConnection {
  edges: [WebhookEdge!]!
  nodes: [Webhook!]!
  pageInfo: PageInfo!
}

input WebhookCreateInput {
  allPublicTeams: Boolean
  enabled: Boolean = true
  id: String
  label: String
  resourceTypes: [String!]!
  secret: String
  teamId: String
  url: String!
}

type WebhookEdge {
  cursor: String!
  node: Webhook!
}

type WebhookFailureEvent {
  createdAt: DateTime!
  executionId: String!
  httpStatus: Float
  id: ID!
  responseOrError: String
  url: String!
  webhook: Webhook!
}

type WebhookPayload {
  lastSyncId: Float!
  success: Boolean!
  webhook: Webhook!
}

type WebhookRotateSecretPayload {
  lastSyncId: Float!
  secret: String!
  success: Boolean!
}

input WebhookUpdateInput {
  enabled: Boolean
  label: String
  resourceTypes: [String!]
  secret: String
  url: String
}

type WelcomeMessage implements Node {
  archivedAt: DateTime
  createdAt: DateTime!
  enabled: Boolean!
  id: ID!
  title: String
  updatedAt: DateTime!
  updatedBy: User
}

type WelcomeMessageNotification implements Entity & Node & Notification {
  actor: User
  actorAvatarColor: String!
  actorAvatarUrl: String
  actorInitials: String
  archivedAt: DateTime
  botActor: ActorBot
  category: NotificationCategory!
  createdAt: DateTime!
  emailedAt: DateTime
  externalUserActor: ExternalUser
  groupingKey: String!
  groupingPriority: Float!
  id: ID!
  inboxUrl: String!
  initiativeUpdateHealth: String
  isLinearActor: Boolean!
  issueStatusType: String
  projectUpdateHealth: String
  readAt: DateTime
  snoozedUntilAt: DateTime
  subtitle: String!
  title: String!
  type: String!
  unsnoozedAt: DateTime
  updatedAt: DateTime!
  url: String!
  user: User!
  welcomeMessageId: String!
}

type WorkflowDefinition implements Node {
  activities: JSONObject!
  archivedAt: DateTime
  conditions: JSONObject
  contextViewType: ContextViewType
  createdAt: DateTime!
  creator: User!
  customView: CustomView
  cycle: Cycle
  description: String
  enabled: Boolean!
  groupName: String
  id: ID!
  initiative: Initiative
  label: IssueLabel
  lastExecutedAt: DateTime
  lastUpdatedBy: User
  name: String!
  project: Project
  slugId: String!
  sortOrder: String!
  team: Team
  trigger: WorkflowTrigger!
  triggerType: WorkflowTriggerType!
  type: WorkflowType!
  updatedAt: DateTime!
  user: User
  userContextViewType: UserContextViewType
}

type WorkflowState implements Node {
  archivedAt: DateTime
  color: String!
  createdAt: DateTime!
  description: String
  id: ID!
  inheritedFrom: WorkflowState
  issues(after: String, before: String, filter: IssueFilter, first: Int, includeArchived: Boolean, last: Int, orderBy: PaginationOrderBy): IssueConnection!
  name: String!
  position: Float!
  team: Team!
  type: String!
  updatedAt: DateTime!
}

type WorkflowStateArchivePayload implements ArchivePayload {
  entity: WorkflowState
  lastSyncId: Float!
  success: Boolean!
}

type WorkflowStateConnection {
  edges: [WorkflowStateEdge!]!
  nodes: [WorkflowState!]!
  pageInfo: PageInfo!
}

input WorkflowStateCreateInput {
  color: String!
  description: String
  id: String
  name: String!
  position: Float
  teamId: String!
  type: String!
}

type WorkflowStateEdge {
  cursor: String!
  node: WorkflowState!
}

input WorkflowStateFilter {
  and: [WorkflowStateFilter!]
  createdAt: DateComparator
  description: StringComparator
  id: IDComparator
  issues: IssueCollectionFilter
  name: StringComparator
  or: [WorkflowStateFilter!]
  position: NumberComparator
  team: TeamFilter
  type: StringComparator
  updatedAt: DateComparator
}

type WorkflowStatePayload {
  lastSyncId: Float!
  success: Boolean!
  workflowState: WorkflowState!
}

input WorkflowStateSort {
  closedIssuesOrderedByRecency: Boolean = false
  nulls: PaginationNulls = last
  order: PaginationSortOrder
}

input WorkflowStateUpdateInput {
  color: String
  description: String
  name: String
  position: Float
}

enum WorkflowTrigger {
  entityCreated
  entityCreatedOrUpdated
  entityRemoved
  entityUnarchived
  entityUpdated
}

enum WorkflowTriggerType {
  issue
  project
  release
}

enum WorkflowType {
  automation
  release
  sla
  triage
  triageAutomation
  viewSubscription
}

input ZendeskSettingsInput {
  automateTicketReopeningOnCancellation: Boolean
  automateTicketReopeningOnComment: Boolean
  automateTicketReopeningOnCompletion: Boolean
  automateTicketReopeningOnProjectCancellation: Boolean
  automateTicketReopeningOnProjectCompletion: Boolean
  botUserId: String
  canReadCustomers: Boolean
  disableCustomerRequestsAutoCreation: Boolean
  enableAiIntake: Boolean
  hostMappings: [String!]
  sendNoteOnComment: Boolean
  sendNoteOnStatusChange: Boolean
  subdomain: String!
  supportsOAuthRefresh: Boolean
  url: String!
}
`)
