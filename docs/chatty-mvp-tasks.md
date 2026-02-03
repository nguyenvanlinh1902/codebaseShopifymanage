# Chatty MVP - Implementation Tasks

## Overview

This document breaks down the Chatty MVP PRD into implementable tasks organized by phases and sprints. Each task is scoped for Claude Code to implement.

**Timeline:** 12 weeks (3 months)
**Tech Stack:** Firebase Functions, Firestore, React/Polaris, Cloud Tasks

---

## Phase 1: Foundation (Weeks 1-4)

### Sprint 1.1: Project Setup & Infrastructure (Week 1-2)

- [x] **P1-001** Initialize Firestore collections
  - Create base collections: `organizations`, `users`, `tickets`, `messages`, `customers`, `orders`
  - Location: `packages/functions/src/repositories/`

- [x] **P1-002** Create Firestore indexes
  - Define compound indexes for ticket queries (org+status, org+assignee, org+customer)
  - Location: `firestore-indexes/`

- [x] **P1-003** Setup organization repository
  - CRUD operations for organizations collection
  - Include: create, getById, getByShopifyDomain, update, updateSettings
  - Location: `repositories/organizationRepository.js`

- [x] **P1-004** Setup user repository
  - CRUD operations for users collection with org scoping
  - Include: create, getById, getByEmail, listByOrg, update, deactivate
  - Location: `repositories/userRepository.js`

- [x] **P1-005** Create base type definitions
  - TypeScript interfaces for: Organization, User, Ticket, Message, Customer, Order, Tag, Activity
  - Location: `packages/functions/index.d.ts`

- [x] **P1-006** Setup Firebase Auth integration
  - Configure Firebase Auth for user management
  - Helper functions for token validation
  - Location: `packages/functions/src/helpers/auth.js`

### Sprint 1.2: Authentication System (Week 2)

- [x] **P1-010** Create auth handler
  - Endpoints: POST /auth/register, POST /auth/login, POST /auth/logout, POST /auth/forgot-password, POST /auth/reset-password, GET /auth/me
  - Location: `handlers/chatty/authHandler.js`

- [x] **P1-011** Create auth service
  - Business logic: validateCredentials, createUser, generateToken, resetPassword
  - Password hashing with bcrypt (cost 12)
  - Location: `services/authService.js`

- [x] **P1-012** Implement JWT middleware
  - Token validation, session management
  - Extract user context from token
  - Location: `helpers/authMiddleware.js`

- [x] **P1-013** Create login page
  - Email/password login form with Polaris components
  - Error handling, loading states
  - Location: `pages/Auth/LoginPage.js`

- [x] **P1-014** Create registration page
  - Sign up form with email verification trigger
  - Password strength validation
  - Location: `pages/Auth/RegisterPage.js`

- [x] **P1-015** Create password reset flow
  - Forgot password page, reset password page
  - Token-based reset links
  - Location: `pages/Auth/ForgotPasswordPage.js`, `pages/Auth/ResetPasswordPage.js`

- [x] **P1-016** Implement session management
  - Auth context provider, protected routes HOC
  - Auto-refresh tokens, logout on expiry
  - Location: `contexts/authContext.js`, `components/Auth/ProtectedRoute.js`

### Sprint 1.3: Basic Ticket System (Week 3-4)

- [x] **P1-020** Create ticket repository
  - CRUD with org scoping, status filtering, pagination
  - Include: create, getById, listByOrg, listByCustomer, update, search
  - Location: `repositories/ticketRepository.js`

- [x] **P1-021** Create message repository
  - Messages linked to tickets
  - Include: create, listByTicket, getLatest
  - Location: `repositories/messageRepository.js`

- [x] **P1-022** Create ticket handler
  - Endpoints: GET /tickets, GET /tickets/:id, POST /tickets, PATCH /tickets/:id
  - Support filters: status, priority, assignee, tag
  - Location: `handlers/chatty/ticketHandler.js`

- [x] **P1-023** Create ticket service
  - Business logic: createTicket, updateStatus, assign, setPriority
  - Status transition rules (open→pending→resolved→closed)
  - Location: `services/ticketService.js`

- [x] **P1-024** Create ticket list page
  - Paginated list with status tabs (All, Open, Pending, Resolved)
  - Sort by date, priority
  - Location: `pages/Tickets/TicketsPage.js`

- [x] **P1-025** Create ticket card component
  - List item showing: subject, customer name, status badge, priority badge, date, assignee avatar
  - Click to navigate to detail
  - Location: `components/Tickets/TicketCard.js`

- [x] **P1-026** Create ticket detail page
  - Full conversation view with header bar
  - Three-panel layout: list | detail | sidebar
  - Location: `pages/Tickets/TicketDetailPage.js`

- [x] **P1-027** Create message bubble component
  - Visual distinction: customer (left, gray) vs agent (right, blue) vs note (yellow, internal)
  - Show: sender name, timestamp, content, attachments
  - Location: `components/Tickets/MessageBubble.js`

- [x] **P1-028** Create status/priority badges
  - StatusBadge: Open (red), Pending (yellow), Resolved (green), Closed (gray)
  - PriorityBadge: Urgent (red), High (orange), Normal (none), Low (gray)
  - Location: `components/StatusBadge.jsx`, `components/PriorityBadge.jsx`

---

## Phase 2: Core Features (Weeks 5-8)

### Sprint 2.1: Ticket Interactions (Week 5-6)

- [x] **P2-001** Create reply composer
  - Rich text editor (basic: bold, italic, lists, links)
  - Send button, attachment button
  - Location: `pages/Tickets/TicketDetailPage.js` (integrated)

- [x] **P2-002** Implement reply handler
  - POST /tickets/:id/messages endpoint
  - Support type: reply, note
  - Location: `handlers/chatty/ticketHandler.js`

- [x] **P2-003** Create internal notes feature
  - Notes visible only to agents (is_internal: true)
  - Yellow background, "Internal note" label
  - Location: `components/Tickets/MessageBubble.js` (integrated)

- [x] **P2-004** Implement ticket assignment
  - Dropdown showing all org team members
  - Unassigned option, current user quick-assign
  - Location: `pages/Tickets/TicketDetailPage.js` (integrated)

- [x] **P2-005** Implement status changes
  - Dropdown: Open, Pending, Resolved, Closed
  - Log status change in activity
  - Location: `pages/Tickets/TicketDetailPage.js` (integrated)

- [x] **P2-006** Implement priority changes
  - Dropdown: Low, Normal, High, Urgent
  - Visual feedback on change
  - Location: `pages/Tickets/TicketDetailPage.js` (integrated)

- [x] **P2-007** Create activity log
  - Track: created, status_changed, assigned, priority_changed, tagged
  - Store in activities collection
  - Location: `repositories/activityRepository.js`

- [x] **P2-008** Display activity timeline
  - Show changes inline in conversation
  - Compact format: "Sarah changed status from Open to Pending"
  - Location: `components/Tickets/ActivityTimeline.js`

### Sprint 2.2: Email Integration (Week 5-6)

- [x] **P2-010** Setup inbound email webhook
  - POST /webhooks/email/inbound endpoint
  - Verify webhook signature
  - Location: `handlers/chatty/webhookHandler.js`

- [x] **P2-011** Create email parser service
  - Extract: From (name, email), Subject, Body (text + HTML), Attachments
  - Sanitize HTML (remove scripts, dangerous CSS)
  - Location: `services/emailService.js`

- [x] **P2-012** Implement email threading
  - Check In-Reply-To / References headers
  - Check subject for ticket ID pattern [#1234]
  - Fallback: sender + subject similarity in 30 days
  - Location: `services/emailService.js`

- [x] **P2-013** Create ticket from email
  - Auto-create ticket if no thread match
  - Set status=open, priority=normal, channel=email
  - Location: `services/emailService.js`

- [x] **P2-014** Setup outbound email service
  - Send via SendGrid/Postmark
  - Configure From name, Reply-To
  - Location: `services/emailService.js`

- [x] **P2-015** Implement email templates
  - Reply template with quoted original
  - Include ticket ID in subject [#1234]
  - Plain text signature
  - Location: `services/emailService.js`

- [x] **P2-016** Create attachment repository
  - Store: filename, content_type, size, storage_url, message_id
  - Location: `repositories/attachmentRepository.js`

- [x] **P2-017** Implement file upload
  - Upload to Firebase Cloud Storage
  - Max 10MB per file
  - Allowed: jpg, png, gif, pdf
  - Location: `services/fileUploadService.js`

- [x] **P2-018** Create attachment component
  - Preview for images, icon for documents
  - Download link
  - Location: `components/Tickets/AttachmentPreview.js`

### Sprint 2.3: Shopify OAuth & Connection (Week 7)

- [x] **P2-020** Implement Shopify OAuth handler
  - GET /shopify/auth - initiate OAuth
  - GET /shopify/callback - handle callback
  - Location: `handlers/chatty/shopifyAuthHandler.js`

- [x] **P2-021** Create Shopify auth service
  - Token exchange, store access token
  - Validate scopes: read_customers, read_orders, read_products, read_fulfillments
  - Location: `services/shopifyAuthService.js`

- [x] **P2-022** Store encrypted tokens
  - Encrypt access tokens before storing
  - AES-256 encryption
  - Location: `helpers/encryption.js`

- [x] **P2-023** Create connect Shopify page
  - Button to initiate OAuth
  - Show required permissions
  - Location: `pages/Settings/ShopifySettings.js`

- [x] **P2-024** Create connection status component
  - Show: connected store name, last sync time
  - Disconnect/reconnect buttons
  - Location: `pages/Settings/ShopifySettings.js` (integrated)

- [x] **P2-025** Setup Shopify webhooks
  - Register webhooks on connection: orders/create, orders/updated, customers/create, customers/update, fulfillments/create, fulfillments/update
  - Location: `services/shopifySyncService.js`

- [x] **P2-026** Create webhook handlers
  - POST /webhooks/shopify/:topic
  - HMAC verification
  - Location: `handlers/chatty/webhookHandler.js`

### Sprint 2.4: Customer & Order Sync (Week 8)

- [x] **P2-030** Create customer repository
  - Synced Shopify customers with org scoping
  - Include: upsertByShopifyId, getByEmail, getById, search
  - Location: `repositories/customerRepository.js`

- [x] **P2-031** Create order repository
  - Synced Shopify orders linked to customers
  - Include: upsertByShopifyId, listByCustomer, getById
  - Location: `repositories/orderRepository.js`

- [x] **P2-032** Implement initial sync service
  - Sync last 90 days of orders on connection
  - Background job with progress tracking
  - Use Shopify bulk operations for efficiency
  - Location: `services/shopifySyncService.js`

- [x] **P2-033** Create customer sync handler
  - Process customers/create, customers/update webhooks
  - Update local customer record
  - Location: `handlers/chatty/webhookHandler.js`

- [x] **P2-034** Create order sync handler
  - Process orders/create, orders/updated, fulfillments/* webhooks
  - Update local order record with line items, tracking
  - Location: `handlers/chatty/webhookHandler.js`

- [x] **P2-035** Implement customer matching
  - Match ticket email to Shopify customer
  - 1. Exact email match
  - 2. Normalized email (lowercase, trim)
  - 3. Phone match (if no email)
  - Location: `services/customerService.js`

- [x] **P2-036** Create customer sidebar
  - Right panel in ticket detail view
  - Show profile, orders, other tickets
  - Location: `components/Tickets/CustomerSidebar.js`

- [x] **P2-037** Create customer profile card
  - Show: name, email, phone, customer since, total orders, LTV, avg order value
  - Location: `components/Tickets/CustomerSidebar.js` (integrated)

- [x] **P2-038** Create order list component
  - Collapsed order cards: #number, date, total, status
  - Click to expand
  - Location: `components/Tickets/CustomerSidebar.js` (integrated)

- [x] **P2-039** Create order detail component
  - Expanded: line items with images, shipping address, payment status, fulfillment status
  - Location: `components/Tickets/CustomerSidebar.js` (OrderCard)

- [x] **P2-040** Create tracking info component
  - Tracking number (clickable), carrier, current status
  - Link to carrier tracking page
  - Location: `components/Tickets/CustomerSidebar.js` (integrated)

---

## Phase 3: Polish & Launch (Weeks 9-12)

### Sprint 3.1: Team Management (Week 9)

- [x] **P3-001** Create team handler
  - GET /users, POST /users/invite, GET /users/:id, PATCH /users/:id, DELETE /users/:id
  - Location: `handlers/chatty/teamHandler.js`

- [x] **P3-002** Create team service
  - createInvitation, acceptInvitation, updateRole, deactivate
  - Location: `services/teamService.js`

- [ ] **P3-003** Implement email invitations
  - Send invite email with unique token
  - Token expires in 7 days
  - Location: `services/invitationService.js`

- [ ] **P3-004** Create team members page
  - Table: name, email, role, status, actions
  - Show pending invitations
  - Location: `pages/TeamMembersPage.jsx`

- [ ] **P3-005** Create invite modal
  - Form: email, role (Admin/Agent)
  - Validate email not already in org
  - Location: `components/InviteUserModal.jsx`

- [ ] **P3-006** Create role selector
  - Dropdown: Admin, Agent
  - Show permission differences
  - Location: `components/RoleSelect.jsx`

- [ ] **P3-007** Implement accept invitation
  - Landing page for invite links
  - Create password, join team
  - Location: `pages/AcceptInvitePage.jsx`

- [ ] **P3-008** Create workload display
  - Show open/assigned tickets per agent
  - Simple bar visualization
  - Location: `components/AgentWorkload.jsx`

### Sprint 3.2: Settings & Configuration (Week 9-10)

- [x] **P3-010** Create settings handler
  - GET /settings, PATCH /settings
  - Location: `handlers/chatty/settingsHandler.js`

- [x] **P3-011** Create settings service
  - getSettings, updateSettings, validateSettings
  - Location: `services/settingsService.js`

- [ ] **P3-012** Create settings page layout
  - Tabbed navigation: General, Team, Shopify, Email, Tags
  - Location: `pages/SettingsPage.jsx`

- [ ] **P3-013** Create general settings
  - Store name, timezone selection
  - Location: `components/settings/GeneralSettings.jsx`

- [ ] **P3-014** Create email settings
  - Display forwarding address, configure reply-to, email signature (plain text)
  - Location: `components/settings/EmailSettings.jsx`

- [ ] **P3-015** Create Shopify settings
  - Connection status, last sync, reconnect button
  - Location: `components/settings/ShopifySettings.jsx`

- [ ] **P3-016** Create profile settings
  - User profile: name, avatar
  - Password change
  - Notification preferences
  - Location: `pages/ProfilePage.jsx`

### Sprint 3.3: Tags & Search (Week 10)

- [x] **P3-020** Create tag repository
  - Tags with org scoping, unique name per org
  - Include: create, list, update, delete, getByName
  - Location: `repositories/tagRepository.js`

- [x] **P3-021** Create tag handler
  - GET /tags, POST /tags, PATCH /tags/:id, DELETE /tags/:id
  - POST /tickets/:id/tags, DELETE /tickets/:id/tags/:tagId
  - Location: `handlers/chatty/tagHandler.js`

- [ ] **P3-022** Create tag management page
  - List tags with colors
  - Create/edit/delete modals
  - Location: `pages/TagsSettingsPage.jsx`

- [ ] **P3-023** Implement ticket tagging
  - Add existing tags or create new
  - Remove tags
  - Location: `components/TicketTags.jsx`

- [ ] **P3-024** Create tag filter
  - Multi-select tag filter in ticket list
  - Location: `components/TagFilter.jsx`

- [ ] **P3-025** Implement ticket search
  - Search by: customer email, customer name, subject
  - Debounced input, highlight matches
  - Location: `services/ticketSearchService.js`

- [ ] **P3-026** Create search component
  - Search input in ticket list header
  - Results update as typing
  - Location: `components/TicketSearch.jsx`

### Sprint 3.4: Notifications & Real-time (Week 10-11)

- [ ] **P3-030** Create notification service
  - Generate notifications for: assignment, customer reply, mention
  - Location: `services/notificationService.js`

- [ ] **P3-031** Implement email notifications
  - Send email when: assigned to ticket, customer replies to assigned ticket
  - Respect user preferences
  - Location: `services/emailNotificationService.js`

- [ ] **P3-032** Create notification preferences
  - Toggle: email on assignment, email on customer reply
  - Location: `components/NotificationSettings.jsx`

- [ ] **P3-033** Implement ticket auto-reopen
  - If Pending/Resolved and customer replies → set to Open
  - If Closed and reply within 7 days → create new linked ticket
  - Location: `services/ticketStatusService.js`

- [ ] **P3-034** Create real-time updates
  - Firestore listeners for ticket changes
  - Update UI without refresh
  - Location: `hooks/useTicketSubscription.js`

### Sprint 3.5: Onboarding Flow (Week 11)

- [ ] **P3-040** Create onboarding service
  - Track steps: account_created, shopify_connected, email_configured, team_invited
  - Location: `services/onboardingService.js`

- [ ] **P3-041** Create onboarding page
  - Step wizard with progress indicator
  - Location: `pages/OnboardingPage.jsx`

- [ ] **P3-042** Create connect Shopify step
  - OAuth initiation with clear instructions
  - Location: `components/onboarding/ConnectShopifyStep.jsx`

- [ ] **P3-043** Create email setup step
  - Display unique forwarding address
  - Instructions for email provider
  - Location: `components/onboarding/EmailSetupStep.jsx`

- [ ] **P3-044** Create invite team step
  - Optional quick invite form
  - Skip option
  - Location: `components/onboarding/InviteTeamStep.jsx`

- [ ] **P3-045** Create test email step
  - Send test email button
  - Verify ticket created
  - Location: `components/onboarding/TestEmailStep.jsx`

### Sprint 3.6: Testing & Bug Fixes (Week 11-12)

- [ ] **P3-050** Write unit tests - repositories
  - Test all repository functions
  - Mock Firestore
  - Location: `packages/functions/test/repositories/`

- [ ] **P3-051** Write unit tests - services
  - Test business logic
  - Mock dependencies
  - Location: `packages/functions/test/services/`

- [ ] **P3-052** Write integration tests - handlers
  - Test API endpoints end-to-end
  - Use Firebase emulators
  - Location: `packages/functions/test/handlers/`

- [ ] **P3-053** Write E2E tests - critical flows
  - Login flow, create ticket, reply to ticket, view customer
  - Location: `test/e2e/`

- [ ] **P3-054** Performance testing
  - Load test: 100 concurrent users, 1000 tickets
  - Verify <2s page load
  - Location: `test/performance/`

- [ ] **P3-055** Security audit
  - Run `/security` command
  - Fix any vulnerabilities
  - OWASP top 10 check

- [ ] **P3-056** Fix P0 bugs
  - Critical bug fixes from testing
  - Blocking issues

- [ ] **P3-057** Fix P1 bugs
  - Important bug fixes
  - UX improvements

### Sprint 3.7: Launch Prep (Week 12)

- [ ] **P3-060** Create Firestore security rules
  - Multi-tenant access control
  - Users can only access their org's data
  - Location: `firestore.rules`

- [ ] **P3-061** Setup production environment
  - Firebase project configuration
  - Environment variables
  - Domain setup

- [ ] **P3-062** Configure monitoring
  - Sentry for error tracking
  - Firebase Performance Monitoring
  - Custom metrics for SLAs

- [ ] **P3-063** Setup status page
  - status.chatty.io
  - Uptime monitoring

- [ ] **P3-064** Prepare Shopify app listing
  - App name, description, screenshots
  - Privacy policy, terms
  - Submit for review

- [ ] **P3-065** Create user documentation
  - Getting started guide
  - Email setup instructions
  - FAQ
  - Location: `docs/user-guide/`

---

## Summary

| Phase | Weeks | Tasks | Focus |
|-------|-------|-------|-------|
| Phase 1 | 1-4 | 28 tasks | Foundation, Auth, Basic Tickets |
| Phase 2 | 5-8 | 40 tasks | Email, Shopify, Customer Sidebar |
| Phase 3 | 9-12 | 38 tasks | Team, Settings, Polish, Launch |
| **Total** | 12 | **106 tasks** | |

## Implementation Order

For each sprint, tasks should be implemented in order (dependencies flow top to bottom):

1. **Repositories first** - Data layer foundation
2. **Services second** - Business logic
3. **Handlers third** - API endpoints
4. **Frontend last** - UI components and pages

## Quick Start Commands

```bash
# Start implementing Phase 1, Sprint 1.1
# Task P1-001: Initialize Firestore collections

# Check current progress
grep -c "\[x\]" docs/chatty-mvp-tasks.md
grep -c "\[ \]" docs/chatty-mvp-tasks.md
```
