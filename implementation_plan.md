# Complete Admin Panel Dashboard (Ai Team)

This plan outlines the evolution of the current tokenviewer_admin piece into a complete, centralized Admin Panel for managing Users, Agents, Teams (Agent Groups), and Memberships.

## Proposed Changes

### Prisma Schema Updates (Backend)

Horizontal expansion of our schema to support time-based token tracking and predefined packages:

#### [MODIFY] `ai_team_server/prisma/schema.prisma`
- **New Model `MembershipTemplate`**: Defines a predefined packaging.
  - `id`, `name` (e.g., "1 year Sara AI", "3 months Ai Team")
  - `durationDays` (e.g., 365, 90)
  - `monthlyTokenLimit`
  - relations to included Agents and/or included AgentGroups.
- **New Model `AssignedMembership`**: Links a user to a `MembershipTemplate`.
  - `userId`, `membershipTemplateId`, `startsAt`, `expiresAt`, `isActive`.
- **New Model `DailyTokenUsage`**: Tracks token usage temporally to construct graphs.
  - `date`, `userId`, `agentName`, `inputTokens`, `outputTokens`, `totalTokens`.
- **New Model `TokenLimitStopLog`**: Logs quota-reached events when user traffic is blocked.
  - `timestamp`, `userId`, `agentName`, `reason`, `attemptedTokens`.
- Update existing `AssignedAgent` and `AssignedGroup` to feature explicit `monthlyTokenLimit` and explicit relations for tracking token tracking natively per assignment.

---

### Backend API Enhancements

#### [MODIFY] `ai_team_server/src/token-usage/services/token-usage.service.ts`
- Implement daily token usage tracking: append consumption events into `DailyTokenUsage`.
- Enhance the quota verification logic. Instead of a single `UserAgentTokenUsage.tokenLimit` check, sum the tokens in `DailyTokenUsage` for the *current billing month* and check against the `monthlyTokenLimit` of active assignments.
- Log to `TokenLimitStopLog` when the limit is breached instead of just throwing forbidden unconditionally unrecorded.

#### [NEW] Admin API controllers and services 
- `admin-users.controller.ts`: Fetch user paginations, full user profiles, and execute bulk account adjustments.
- `admin-agents.controller.ts`: Create/edit `AgentGroup`, visualize standalone agents, apply single assignments.
- `admin-memberships.controller.ts`: CRUD for `MembershipTemplate`.

---

### Frontend Admin UI Implementation (`AI-Team-frontend`)

A new set of routes will be created under `src/app/dashboard/admin/` or similar structured grouping, replacing the single `tokenviewer_admin` file over time.

#### 1. Core Layout Structure
- Modern, dynamic sidebar/header for Admin Navigation: Users, Agents & Teams, Memberships, Analytics.
- Implementation of modern UI standards (glassmorphism tabs, subtle micro-animations).

#### 2. Agents & Teams Page
- Form elements to create teams/groups of agents.
- Gallery/Grid visualization of all single Agents and Teams.
- Interface to generate `MembershipTemplates`.

#### 3. Agent Assignment Interface
- Advanced Modal/Slide-over forms for defining token limits and expiration duration for direct agent assignments, team assignments, or predefined membership assignments.
- Colored Bar Charts/Pile Charts for holistic Agent Token Usage by Days.
- Data table for Top Users on each specific agent.

#### 4. All Users Table Page
- Robust Filter/Search Bar: Combine querying by Email/Name, Membership type, and Expiration range constraints.
- Time frame selectors (Last 7 Days, Month, Custom Calendar) interacting tightly with DailyTokenUsage aggregates.
- High-performance Table exhibiting assignments, durations, expirations, and sum logic of monthly/weekly tokens.
- Native Bulk Actions: Multiselect checkboxes for Bulk Duration/Expiration/Limits modifications, or Deletes.

#### 5. Single User Insight Page
- Comprehensive view obtained by clicking a user. 
- Integrated Time Frame Selector for localized statistics context.
- Visual Graphing: Line/Bar charts illustrating Total Agent Usage over Days/Weeks, plus visual "Red Dot" plotting for `n. of stops applied`.

## Additional Features Suggestions (For Consideration)

1. **Revenue/Billing Metrics:** If these memberships are paid, tie the Admin Dashboard to Stripe/PayPal data (MRR, churn rate, active subscriptions).
2. **Audit Logging:** An internal log tracking *which admin* updated a user's limits or changed a membership template (useful for larger admin teams).
3. **Automated Notification Triggers:** A switch to enable automatic warning emails when a user hits 80%, 90%, and 100% of their monthly token limit.
4. **Agent Response Analytics:** Expanding tracking from just tokens to average response times or user ratings (if you implement user feedback on answers).

## Open Questions

Before we execute, please clarify the following logic rules:

1. **Membership Assignment Interactions:** If a user has a "1 year Sara AI" membership (with 500k monthly tokens), and the admin also manually assigns them "Sara AI for 30 days" (with 100k tokens), do these limits combine (600k), or override?
2. **Token Reset Logic:** The prompt indicates a "monthly token limit". Does the system automatically reset tokens on the 1st of every month, OR 30 days from their assignment/subscription start date?
3. **Historical Token Usage Data Migration:** The current database tracks `totalTokens` endlessly under `UserAgentTokenUsage` but not *daily*. We will start tracking daily tokens fresh on deployment. Are you okay with historical daily graphs being empty until new traffic flows, or should I attempt to artificially distribute their existing `totalTokens` equally across past days as dummy data?
4. **URL Structure:** I plan to build out standard admin routes: `/dashboard/admin/users`, `/dashboard/admin/agents`, etc. instead of keeping everything in `/dashboard/tokenviewer_admin/page.tsx`. Does that sound good?

Please provide your feedback and any corrections on the suggestions!
