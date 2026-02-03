# Chatty MVP - Product Requirements Document

**Version:** 1.0  
**Last Updated:** February 2, 2026  
**Author:** Sam
**Status:** Draft  
**Timeline:** Months 1-3

---

## 1. Executive Summary

### 1.1 Product Vision
Chatty is a Shopify-native customer support helpdesk that empowers eCommerce brands to deliver fast, contextual support by bringing order data, subscription information, and customer history directly into the agent workspace.

### 1.2 MVP Objective
Build a functional email-based ticket management system with deep Shopify integration that allows support agents to view customer context and respond to inquiries without switching between multiple tools.

### 1.3 MVP Value Proposition
"See everything, respond faster" - Agents can view complete customer order history, subscription status, and lifetime value alongside every ticket, eliminating tab-switching and reducing average handle time by 40%.

### 1.4 MVP Success Statement
A Shopify merchant can connect their store, receive customer emails as tickets, view relevant order/customer data, and respond to customers—all within Chatty.

---

## 2. Problem Statement

### 2.1 Current Pain Points

| Problem | Impact | Who Feels It |
|---------|--------|--------------|
| Agents constantly switch between Shopify Admin and email | 30-60 seconds wasted per ticket | Support Agents |
| No unified view of customer history across orders | Repeated questions to customers, poor CX | Customers, Agents |
| Email threads get lost or duplicated | Customers receive multiple/conflicting responses | Customers, Managers |
| No visibility into team workload | Uneven distribution, burnout | Managers, Agents |
| Can't track response times or performance | No data for improvement | Managers, Owners |
| Manual copy-paste of order info into responses | Errors, slow responses | Agents |

### 2.2 Jobs To Be Done

**Support Agent:**
- When I receive a customer email, I want to immediately see their recent orders so I can understand their issue without asking clarifying questions.
- When I'm responding to a ticket, I want to reference order details (tracking, items, status) so I can give accurate information quickly.

**Support Manager:**
- When I start my day, I want to see all open tickets and who's working on what so I can ensure nothing falls through the cracks.
- When I'm evaluating team performance, I want to see response times and resolution rates so I can coach my team.

**Store Owner:**
- When I'm evaluating support tools, I want something that works with Shopify out-of-the-box so I don't need technical setup.
- When customers email us, I want them to get fast, accurate responses so they buy from us again.

---

## 3. Goals & Success Metrics

### 3.1 MVP Goals

| Goal | Description | Measurement |
|------|-------------|-------------|
| **G1** | Functional email ticketing | Merchants can receive and respond to emails |
| **G2** | Shopify data integration | Order data displays correctly in 100% of tickets |
| **G3** | Team collaboration | Multiple agents can work without conflicts |
| **G4** | Basic workflow management | Tickets can be assigned, prioritized, and resolved |

### 3.2 Success Metrics (MVP Launch + 30 Days)

| Metric | Target | How Measured |
|--------|--------|--------------|
| Stores connected | 50 beta users | Database count |
| Tickets processed | 1,000+ tickets | Ticket volume |
| Email delivery rate | >99% | Email provider metrics |
| Shopify sync success | >99.5% | Error logs |
| Avg. page load time | <2 seconds | Performance monitoring |
| Critical bugs | 0 open P0 bugs | Bug tracker |
| User activation | 70% complete onboarding | Funnel analytics |

### 3.3 Non-Goals for MVP
- Live chat support
- AI/automation features
- Help center / Knowledge base
- Mobile app
- Social channel integrations
- Advanced reporting
- Subscription management actions

---

## 4. Target Users

### 4.1 Primary Persona: Support Agent (Sarah)

**Demographics:**
- Age: 24-35
- Role: Customer Support Representative
- Company: DTC Shopify brand, $1M-$10M ARR
- Team size: 2-10 support agents
- Tech comfort: Moderate (uses multiple SaaS tools daily)

**Daily Workflow:**
- Starts day checking email inbox
- Handles 30-80 tickets per day
- Constantly switches between Shopify Admin, email, shipping carrier sites
- Uses copy-paste for order info
- Escalates complex issues via Slack

**Pain Points:**
- "I waste so much time looking up orders in Shopify"
- "Customers get frustrated when I ask for their order number"
- "Sometimes two of us reply to the same email"
- "I can't tell which tickets are urgent"

**Success Criteria:**
- Can find customer order info in <5 seconds
- Never accidentally works on same ticket as colleague
- Clear visibility into ticket queue and priorities

### 4.2 Secondary Persona: Support Manager (Mike)

**Demographics:**
- Age: 30-45
- Role: Customer Support Manager / Head of CX
- Company: DTC Shopify brand, $5M-$50M ARR
- Team size: 5-20 support agents
- Tech comfort: High (evaluates and implements tools)

**Daily Workflow:**
- Reviews overnight tickets
- Assigns/redistributes workload
- Handles escalations
- Reports on metrics to leadership
- Trains new team members

**Pain Points:**
- "I have no visibility into response times"
- "I can't tell who's overloaded"
- "No way to see ticket trends or common issues"
- "Onboarding new agents takes too long"

**Success Criteria:**
- Dashboard showing team workload at a glance
- Basic metrics on response/resolution times
- Easy to add new team members

### 4.3 Tertiary Persona: Store Owner (Emma)

**Demographics:**
- Age: 28-50
- Role: Founder / Owner / Operations Lead
- Company: Small Shopify brand, <$1M ARR
- Team size: Solo or 1-2 support people
- Tech comfort: Varies

**Daily Workflow:**
- Wears multiple hats (marketing, ops, support)
- Checks support inbox a few times per day
- Handles complex/VIP issues personally
- Makes tool purchasing decisions

**Pain Points:**
- "I need something simple, not enterprise software"
- "Gorgias is too expensive for my volume"
- "I just want customer context without the complexity"

**Success Criteria:**
- Can set up in <30 minutes
- Intuitive without training
- Affordable pricing

---

## 5. User Stories

### 5.1 Authentication & Onboarding

| ID | Story | Priority | Acceptance Criteria |
|----|-------|----------|---------------------|
| US-001 | As a store owner, I want to sign up with my email so I can create a Chatty account | P0 | - Email/password registration<br>- Email verification required<br>- Password strength requirements |
| US-002 | As a store owner, I want to connect my Shopify store via OAuth so I can import my store data | P0 | - Shopify OAuth flow completes<br>- Store name/URL captured<br>- Required scopes granted |
| US-003 | As a store owner, I want to set up email forwarding so customer emails become tickets | P0 | - Unique forwarding address generated<br>- Clear setup instructions<br>- Test email confirms setup |
| US-004 | As a store owner, I want to invite team members so they can help with support | P0 | - Email invitation sent<br>- Invitee creates password<br>- Appears in team list |
| US-005 | As an agent, I want to log in securely so I can access my workspace | P0 | - Email/password login<br>- Session management<br>- Password reset flow |

### 5.2 Ticket Management

| ID | Story | Priority | Acceptance Criteria |
|----|-------|----------|---------------------|
| US-010 | As an agent, I want to see a list of all tickets so I can manage my queue | P0 | - Ticket list with pagination<br>- Shows subject, customer, status, date<br>- Sortable columns |
| US-011 | As an agent, I want to filter tickets by status so I can focus on what needs attention | P0 | - Filter by: Open, Pending, Resolved, Closed<br>- Filter persists during session<br>- Count shown per status |
| US-012 | As an agent, I want to search tickets so I can find specific conversations | P0 | - Search by customer email, name, subject<br>- Results update as I type<br>- Highlights matching text |
| US-013 | As an agent, I want to view a ticket's full conversation so I can understand the context | P0 | - All messages in chronological order<br>- Clear visual distinction: customer vs agent<br>- Timestamps on all messages |
| US-014 | As an agent, I want to reply to a ticket so I can help the customer | P0 | - Rich text editor<br>- Reply sends as email to customer<br>- Reply appears in conversation thread |
| US-015 | As an agent, I want to add internal notes so I can communicate with teammates | P0 | - Notes visible only to agents<br>- Clearly marked as internal<br>- Supports @mentions (display only in MVP) |
| US-016 | As an agent, I want to change ticket status so I can track progress | P0 | - Status dropdown: Open → Pending → Resolved → Closed<br>- Status change logged in activity |
| US-017 | As an agent, I want to assign a ticket to myself or a teammate so we know who's responsible | P0 | - Assignee dropdown with team members<br>- Assignment logged in activity<br>- Notification to assignee (email) |
| US-018 | As an agent, I want to set ticket priority so urgent issues are handled first | P0 | - Priority levels: Low, Normal, High, Urgent<br>- Visual indicator (color/icon)<br>- Can filter by priority |
| US-019 | As an agent, I want to add tags to tickets so I can categorize issues | P1 | - Add existing or create new tags<br>- Multiple tags per ticket<br>- Filter by tag |
| US-020 | As an agent, I want to attach files to my reply so I can share screenshots or documents | P0 | - Drag-drop or click to upload<br>- Max 10MB per file<br>- Common formats: jpg, png, pdf, gif |

### 5.3 Customer Sidebar (Shopify Integration)

| ID | Story | Priority | Acceptance Criteria |
|----|-------|----------|---------------------|
| US-030 | As an agent, I want to see customer profile info so I know who I'm talking to | P0 | - Name, email, phone (if available)<br>- Customer since date<br>- Total orders count |
| US-031 | As an agent, I want to see customer lifetime value so I can prioritize appropriately | P0 | - Total spent (all time)<br>- Currency formatted correctly<br>- Updates with new orders |
| US-032 | As an agent, I want to see the customer's order history so I can reference their purchases | P0 | - List of orders (most recent first)<br>- Order number, date, total, status<br>- Click to expand details |
| US-033 | As an agent, I want to see order details so I can answer questions about specific orders | P0 | - Line items with images, names, quantities<br>- Shipping address<br>- Payment status<br>- Fulfillment status |
| US-034 | As an agent, I want to see tracking information so I can update customers on delivery | P0 | - Tracking number (clickable)<br>- Carrier name<br>- Current status if available |
| US-035 | As an agent, I want customer data to load automatically based on email so I don't have to search | P0 | - Email matching to Shopify customer<br>- Fallback: "Customer not found" message<br>- Manual search option |
| US-036 | As an agent, I want to see if this customer has other open tickets so I can consolidate issues | P1 | - Count of other open tickets<br>- Links to those tickets<br>- Shows across all agents |

### 5.4 Email Channel

| ID | Story | Priority | Acceptance Criteria |
|----|-------|----------|---------------------|
| US-040 | As a system, I want to receive forwarded emails and create tickets so customers get tracked responses | P0 | - Parses From, Subject, Body<br>- Creates new ticket or adds to existing thread<br>- Handles attachments |
| US-041 | As a system, I want to send agent replies as emails so customers receive responses | P0 | - Sends from configured address<br>- Includes conversation history (quoted)<br>- Handles attachments |
| US-042 | As a store owner, I want to customize the "From" name so emails look professional | P0 | - Configurable sender name<br>- Default: store name<br>- Shows in customer's inbox |
| US-043 | As a system, I want to thread related emails together so conversations stay organized | P0 | - Uses In-Reply-To header<br>- Falls back to subject + sender matching<br>- Max 30-day window for threading |
| US-044 | As an agent, I want to see when an email bounced so I know the customer didn't receive it | P1 | - Bounce notification on ticket<br>- Email status: Sent, Delivered, Bounced<br>- Bounce reason if available |

### 5.5 Team Management

| ID | Story | Priority | Acceptance Criteria |
|----|-------|----------|---------------------|
| US-050 | As an admin, I want to view all team members so I can manage my team | P0 | - List: name, email, role, status<br>- Shows pending invitations<br>- Sortable |
| US-051 | As an admin, I want to assign roles (Admin, Agent) so I can control permissions | P0 | - Admin: full access + settings<br>- Agent: tickets + customer data only<br>- Role shown in team list |
| US-052 | As an admin, I want to deactivate team members so former employees lose access | P0 | - Deactivate button (soft delete)<br>- Immediate session termination<br>- Can reactivate later |
| US-053 | As an admin, I want to see agent workload so I can distribute tickets fairly | P1 | - Open tickets per agent<br>- Assigned tickets count<br>- Simple bar visualization |

### 5.6 Settings & Configuration

| ID | Story | Priority | Acceptance Criteria |
|----|-------|----------|---------------------|
| US-060 | As an admin, I want to configure store settings so Chatty matches my brand | P0 | - Store name<br>- Support email display name<br>- Timezone |
| US-061 | As an admin, I want to manage Shopify connection so I can troubleshoot sync issues | P0 | - Connection status indicator<br>- Last sync timestamp<br>- Reconnect button |
| US-062 | As an admin, I want to configure email settings so I can control email behavior | P0 | - Forwarding address display<br>- Reply-to configuration<br>- Email signature (plain text) |
| US-063 | As a user, I want to update my profile so my information is accurate | P0 | - Name, avatar<br>- Password change<br>- Notification preferences (email) |
| US-064 | As an admin, I want to manage tags so I can organize categorization | P1 | - Create/edit/delete tags<br>- Tag colors<br>- Merge duplicate tags |

---

## 6. Functional Requirements

### 6.1 Ticket System

#### 6.1.1 Ticket Creation
```
RULE: A ticket is created when:
  1. A new email is received that doesn't match an existing thread
  2. An agent manually creates a ticket (v1.1)

RULE: Ticket auto-fields on creation:
  - Status: "Open"
  - Priority: "Normal"
  - Assignee: Unassigned
  - Created_at: Current timestamp
  - Channel: "Email"
```

#### 6.1.2 Ticket Statuses

| Status | Description | Triggered By | Color |
|--------|-------------|--------------|-------|
| Open | New or active ticket needing response | New ticket, Customer reply | Red |
| Pending | Waiting for customer response | Agent sets manually | Yellow |
| Resolved | Issue addressed, awaiting confirmation | Agent sets manually | Green |
| Closed | Ticket complete, no further action | Agent sets manually, Auto after 7 days resolved | Gray |

#### 6.1.3 Ticket Auto-Reopen Rules
```
RULE: If status is "Pending" or "Resolved" and customer replies:
  → Set status to "Open"
  → Notify assigned agent (if any)
  
RULE: If status is "Closed" and customer replies within 7 days:
  → Create new ticket
  → Link to previous ticket as "Related"
```

#### 6.1.4 Priority Levels

| Priority | Response Target | Visual | Use Case |
|----------|-----------------|--------|----------|
| Urgent | 1 hour | Red badge | Order issues, angry customer |
| High | 4 hours | Orange badge | Payment problems, shipping delays |
| Normal | 24 hours | None | General inquiries |
| Low | 48 hours | Gray badge | Feedback, feature requests |

### 6.2 Shopify Integration

#### 6.2.1 OAuth Scopes Required
```
read_customers    - Customer profiles and history
read_orders       - Order details and status
read_products     - Product info for line items
read_fulfillments - Tracking and shipping info
```

#### 6.2.2 Data Sync Strategy
```
Initial Sync (on connection):
  - Last 90 days of orders
  - All customers with orders in last 90 days
  - Run as background job
  - Show progress indicator

Ongoing Sync:
  - Webhook: orders/create, orders/updated
  - Webhook: customers/create, customers/update
  - Webhook: fulfillments/create, fulfillments/update
  - Fallback: Poll every 15 minutes for missed webhooks

Customer Matching:
  1. Exact email match
  2. Normalized email match (lowercase, trim)
  3. Phone number match (if email not found)
  4. Show "Customer not found in Shopify" if no match
```

#### 6.2.3 Data Displayed

**Customer Profile Card:**
```
┌─────────────────────────────────────┐
│ 👤 John Smith                       │
│ john@example.com                    │
│ +1 (555) 123-4567                   │
├─────────────────────────────────────┤
│ Customer since: Jan 15, 2024        │
│ Total orders: 12                    │
│ Lifetime value: $1,247.00           │
│ Avg order value: $103.92            │
└─────────────────────────────────────┘
```

**Order Card (Collapsed):**
```
┌─────────────────────────────────────┐
│ #1042 · Jan 28, 2026 · $89.00       │
│ ● Fulfilled · Delivered Jan 31     │
└─────────────────────────────────────┘
```

**Order Card (Expanded):**
```
┌─────────────────────────────────────┐
│ Order #1042                         │
│ Placed: Jan 28, 2026 at 3:42 PM     │
├─────────────────────────────────────┤
│ Items:                              │
│ [img] Blue Widget × 2      $49.98   │
│ [img] Red Gadget × 1       $39.02   │
│                    ─────────────    │
│                    Subtotal: $89.00 │
│                    Shipping: $0.00  │
│                    Total: $89.00    │
├─────────────────────────────────────┤
│ Shipping: John Smith                │
│ 123 Main St, Apt 4B                 │
│ New York, NY 10001                  │
├─────────────────────────────────────┤
│ Tracking: 1Z999AA10123456784        │
│ UPS Ground · Delivered Jan 31      │
│ [View on UPS ↗]                     │
└─────────────────────────────────────┘
```

### 6.3 Email Processing

#### 6.3.1 Inbound Email Flow
```
1. Customer sends email to support@store.com
2. Store forwards to {unique-id}@inbound.chatty.io
3. Chatty receives via webhook from email provider
4. Parse email:
   - Extract: From, Subject, Body (plain + HTML), Attachments
   - Sanitize HTML (remove scripts, limit styles)
   - Download attachments to storage
5. Match to existing ticket:
   - Check In-Reply-To / References headers
   - Check subject line for ticket ID pattern [#1234]
   - Check sender + subject similarity in last 30 days
6. If match found → Add as reply to existing ticket
   If no match → Create new ticket
7. Match customer to Shopify (by email)
8. Trigger notification to assignee (if any)
```

#### 6.3.2 Outbound Email Flow
```
1. Agent clicks "Send" on reply
2. Build email:
   - From: "{Store Name} Support" <support-{store-id}@mail.chatty.io>
   - Reply-To: support@store.com (original address)
   - To: Customer email
   - Subject: Re: {original subject} [#{ticket_id}]
   - Body: Agent message + quoted original
   - Attachments: Any uploaded files
3. Send via transactional email provider
4. Log message in ticket conversation
5. Update ticket activity
6. Track delivery/bounce status via webhooks
```

#### 6.3.3 Email Signature
```
Default signature (appended to all replies):

---
{Agent Name}
{Store Name} Support

Plain text only for MVP. Rich signatures in v1.1.
```

### 6.4 User & Permissions

#### 6.4.1 Role Permissions Matrix

| Permission | Admin | Agent |
|------------|-------|-------|
| View all tickets | ✅ | ✅ |
| Reply to tickets | ✅ | ✅ |
| Assign tickets | ✅ | ✅ |
| Change ticket status | ✅ | ✅ |
| View customer data | ✅ | ✅ |
| Invite team members | ✅ | ❌ |
| Manage team members | ✅ | ❌ |
| Access settings | ✅ | ❌ |
| Manage Shopify connection | ✅ | ❌ |
| View reports | ✅ | ✅ (own only) |
| Manage tags | ✅ | ❌ |
| Billing access | ✅ (owner) | ❌ |

#### 6.4.2 Account Hierarchy
```
Organization (Shopify Store)
└── Users
    ├── Owner (1, cannot be changed)
    ├── Admins (unlimited)
    └── Agents (unlimited)
```

---

## 7. Non-Functional Requirements

### 7.1 Performance

| Metric | Requirement | Notes |
|--------|-------------|-------|
| Page load time | < 2 seconds | 90th percentile |
| Ticket list load | < 1 second | Up to 100 tickets |
| Search results | < 500ms | After typing stops |
| Shopify data load | < 3 seconds | Customer sidebar |
| Email send | < 5 seconds | From click to sent |
| Webhook processing | < 10 seconds | Email and Shopify |

### 7.2 Scalability

| Metric | MVP Target | Architecture Notes |
|--------|------------|---------------------|
| Concurrent users | 100 | Per organization |
| Tickets per org | 100,000 | With pagination |
| Emails per hour | 1,000 | Per organization |
| Shopify orders synced | 50,000 | Per organization |
| File storage | 10 GB | Per organization |

### 7.3 Availability
- Target uptime: 99.5%
- Planned maintenance: Off-peak hours, advance notice
- Status page: status.chatty.io

### 7.4 Browser Support
- Chrome (last 2 versions) - Primary
- Firefox (last 2 versions)
- Safari (last 2 versions)
- Edge (last 2 versions)
- No IE support
- Mobile browsers: Responsive but not optimized

### 7.5 Accessibility
- WCAG 2.1 Level A compliance
- Keyboard navigation for core flows
- Screen reader compatible (semantic HTML)
- Color contrast ratios meet standards

---

## 8. System Architecture

### 8.1 High-Level Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENTS                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                       │
│  │ Web App  │  │  Mobile  │  │  Shopify │                       │
│  │ (React)  │  │  (Future)│  │   App    │                       │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                       │
└───────┼──────────────┼──────────────┼───────────────────────────┘
        │              │              │
        ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API GATEWAY / CDN                          │
│                   (Cloudflare / Vercel Edge)                    │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND SERVICES                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  API Server │  │  Worker     │  │  Webhook    │              │
│  │  (Node.js)  │  │  (Jobs)     │  │  Handler    │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
│         ▼                ▼                ▼                      │
│  ┌─────────────────────────────────────────────────┐            │
│  │              MESSAGE QUEUE (Redis/BullMQ)       │            │
│  └─────────────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │  PostgreSQL  │  │    Redis     │  │     S3       │           │
│  │  (Primary DB)│  │   (Cache)    │  │  (Files)     │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │   Shopify    │  │   SendGrid   │  │   Postmark   │           │
│  │     API      │  │  (Outbound)  │  │  (Inbound)   │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend | React 18 + TypeScript | Industry standard, team expertise |
| UI Framework | Tailwind CSS + shadcn/ui | Rapid development, customizable |
| State Management | Zustand / React Query | Simple, performant |
| Backend | Node.js + Express | JavaScript ecosystem, async I/O |
| API Style | REST + WebSockets | REST for CRUD, WS for real-time |
| Database | PostgreSQL 15 | Relational, JSONB for flexibility |
| ORM | Prisma | Type-safe, migrations |
| Cache | Redis | Session, rate limiting, pub/sub |
| Queue | BullMQ | Job processing, retries |
| File Storage | AWS S3 / Cloudflare R2 | Scalable, cost-effective |
| Email Inbound | Postmark | Reliable parsing, webhooks |
| Email Outbound | SendGrid | Deliverability, tracking |
| Hosting | Vercel + Railway / Render | Simplicity, scaling |
| Monitoring | Sentry + Datadog | Errors + performance |

---

## 9. Data Models

### 9.1 Core Entities

```
┌─────────────────┐     ┌─────────────────┐
│   Organization  │────<│      User       │
└────────┬────────┘     └─────────────────┘
         │
         │         ┌─────────────────┐
         ├────────<│     Ticket      │
         │         └────────┬────────┘
         │                  │
         │                  ├────────<┌─────────────────┐
         │                  │         │     Message     │
         │                  │         └─────────────────┘
         │                  │
         │                  ├────────<┌─────────────────┐
         │                  │         │   Attachment    │
         │                  │         └─────────────────┘
         │                  │
         │                  └────────<┌─────────────────┐
         │                            │    Activity     │
         │                            └─────────────────┘
         │
         ├────────<┌─────────────────┐
         │         │    Customer     │
         │         │   (Shopify)     │
         │         └────────┬────────┘
         │                  │
         │                  └────────<┌─────────────────┐
         │                            │     Order       │
         │                            │   (Shopify)     │
         │                            └─────────────────┘
         │
         └────────<┌─────────────────┐
                   │      Tag        │
                   └─────────────────┘
```

### 9.2 Database Schema

```sql
-- Organizations (Shopify Stores)
CREATE TABLE organizations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    shopify_domain  VARCHAR(255) UNIQUE,
    shopify_token   TEXT,  -- Encrypted
    email_address   VARCHAR(255) UNIQUE,  -- Forwarding address
    timezone        VARCHAR(50) DEFAULT 'UTC',
    settings        JSONB DEFAULT '{}',
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- Users
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    email           VARCHAR(255) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    name            VARCHAR(255),
    avatar_url      VARCHAR(500),
    role            VARCHAR(20) DEFAULT 'agent',  -- owner, admin, agent
    status          VARCHAR(20) DEFAULT 'active', -- active, invited, deactivated
    last_login_at   TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(organization_id, email)
);

-- Customers (synced from Shopify)
CREATE TABLE customers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID REFERENCES organizations(id),
    shopify_id          BIGINT,
    email               VARCHAR(255),
    phone               VARCHAR(50),
    first_name          VARCHAR(255),
    last_name           VARCHAR(255),
    total_orders        INTEGER DEFAULT 0,
    total_spent         DECIMAL(10,2) DEFAULT 0,
    currency            VARCHAR(3) DEFAULT 'USD',
    created_at_shopify  TIMESTAMP,
    synced_at           TIMESTAMP DEFAULT NOW(),
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW(),
    UNIQUE(organization_id, shopify_id),
    UNIQUE(organization_id, email)
);

-- Orders (synced from Shopify)
CREATE TABLE orders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID REFERENCES organizations(id),
    customer_id         UUID REFERENCES customers(id),
    shopify_id          BIGINT,
    order_number        VARCHAR(50),
    email               VARCHAR(255),
    total_price         DECIMAL(10,2),
    currency            VARCHAR(3),
    financial_status    VARCHAR(50),
    fulfillment_status  VARCHAR(50),
    line_items          JSONB,
    shipping_address    JSONB,
    tracking_numbers    JSONB,  -- [{number, carrier, url, status}]
    created_at_shopify  TIMESTAMP,
    synced_at           TIMESTAMP DEFAULT NOW(),
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW(),
    UNIQUE(organization_id, shopify_id)
);

-- Tickets
CREATE TABLE tickets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    customer_id     UUID REFERENCES customers(id),
    assignee_id     UUID REFERENCES users(id),
    number          SERIAL,  -- Human-readable ticket number
    subject         VARCHAR(500),
    status          VARCHAR(20) DEFAULT 'open',  -- open, pending, resolved, closed
    priority        VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent
    channel         VARCHAR(20) DEFAULT 'email',
    customer_email  VARCHAR(255),
    customer_name   VARCHAR(255),
    last_message_at TIMESTAMP,
    resolved_at     TIMESTAMP,
    closed_at       TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- Messages (ticket replies)
CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id       UUID REFERENCES tickets(id),
    user_id         UUID REFERENCES users(id),  -- NULL for customer messages
    type            VARCHAR(20) DEFAULT 'reply',  -- reply, note, system
    content_text    TEXT,
    content_html    TEXT,
    sender_type     VARCHAR(20),  -- customer, agent
    sender_email    VARCHAR(255),
    sender_name     VARCHAR(255),
    email_message_id VARCHAR(255),  -- For threading
    is_internal     BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Attachments
CREATE TABLE attachments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id      UUID REFERENCES messages(id),
    filename        VARCHAR(255),
    content_type    VARCHAR(100),
    size_bytes      INTEGER,
    storage_url     VARCHAR(500),
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Ticket Activities (audit log)
CREATE TABLE activities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id       UUID REFERENCES tickets(id),
    user_id         UUID REFERENCES users(id),
    action          VARCHAR(50),  -- created, status_changed, assigned, etc.
    old_value       VARCHAR(255),
    new_value       VARCHAR(255),
    metadata        JSONB,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Tags
CREATE TABLE tags (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    name            VARCHAR(100),
    color           VARCHAR(20) DEFAULT 'gray',
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(organization_id, name)
);

-- Ticket Tags (many-to-many)
CREATE TABLE ticket_tags (
    ticket_id       UUID REFERENCES tickets(id),
    tag_id          UUID REFERENCES tags(id),
    created_at      TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (ticket_id, tag_id)
);

-- Indexes
CREATE INDEX idx_tickets_org_status ON tickets(organization_id, status);
CREATE INDEX idx_tickets_org_assignee ON tickets(organization_id, assignee_id);
CREATE INDEX idx_tickets_customer ON tickets(customer_id);
CREATE INDEX idx_messages_ticket ON messages(ticket_id);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_customers_email ON customers(organization_id, email);
```

---

## 10. API Specifications

### 10.1 API Overview
- Base URL: `https://api.chatty.io/v1`
- Authentication: Bearer token (JWT)
- Content-Type: `application/json`
- Rate Limiting: 100 requests/minute per user

### 10.2 Authentication Endpoints

```
POST /auth/register
POST /auth/login
POST /auth/logout
POST /auth/forgot-password
POST /auth/reset-password
GET  /auth/me
```

### 10.3 Ticket Endpoints

```
GET    /tickets              # List tickets (paginated, filterable)
POST   /tickets              # Create ticket (manual)
GET    /tickets/:id          # Get ticket details
PATCH  /tickets/:id          # Update ticket (status, priority, assignee)
DELETE /tickets/:id          # Delete ticket (soft delete)

GET    /tickets/:id/messages # Get ticket messages
POST   /tickets/:id/messages # Add message (reply or note)

POST   /tickets/:id/tags     # Add tag
DELETE /tickets/:id/tags/:tagId # Remove tag
```

### 10.4 Customer Endpoints

```
GET    /customers            # List customers
GET    /customers/:id        # Get customer details
GET    /customers/:id/orders # Get customer orders
GET    /customers/:id/tickets # Get customer tickets
POST   /customers/search     # Search by email/phone
```

### 10.5 Team Endpoints

```
GET    /users                # List team members
POST   /users/invite         # Invite new user
GET    /users/:id            # Get user details
PATCH  /users/:id            # Update user
DELETE /users/:id            # Deactivate user
```

### 10.6 Settings Endpoints

```
GET    /settings             # Get all settings
PATCH  /settings             # Update settings
GET    /settings/shopify     # Shopify connection status
POST   /settings/shopify/connect    # Initiate OAuth
DELETE /settings/shopify/disconnect # Disconnect store
```

### 10.7 Example API Response

```json
// GET /tickets/:id
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "number": 1042,
  "subject": "Order not received",
  "status": "open",
  "priority": "high",
  "channel": "email",
  "customer": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "email": "john@example.com",
    "name": "John Smith",
    "totalOrders": 12,
    "totalSpent": 1247.00
  },
  "assignee": {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "name": "Sarah Agent",
    "email": "sarah@store.com"
  },
  "tags": [
    {"id": "...", "name": "shipping", "color": "blue"}
  ],
  "messageCount": 3,
  "lastMessageAt": "2026-02-02T10:30:00Z",
  "createdAt": "2026-02-01T14:22:00Z",
  "updatedAt": "2026-02-02T10:30:00Z"
}
```

---

## 11. UI/UX Requirements

### 11.1 Information Architecture

```
Chatty App
├── Onboarding
│   ├── Sign Up
│   ├── Connect Shopify
│   ├── Set Up Email
│   └── Invite Team
│
├── Inbox (Main View)
│   ├── Ticket List (Left Panel)
│   │   ├── Status Tabs (All, Open, Pending, Resolved)
│   │   ├── Search Bar
│   │   ├── Filter/Sort
│   │   └── Ticket Cards
│   │
│   ├── Ticket Detail (Center Panel)
│   │   ├── Conversation Thread
│   │   ├── Reply Composer
│   │   └── Internal Notes Tab
│   │
│   └── Customer Sidebar (Right Panel)
│       ├── Profile Card
│       ├── Orders List
│       ├── Order Details (Expandable)
│       └── Other Tickets
│
├── Reports (Future - placeholder)
│
├── Settings
│   ├── General
│   ├── Team Members
│   ├── Shopify Connection
│   ├── Email Settings
│   └── Tags
│
└── Profile
    ├── My Profile
    └── Logout
```

### 11.2 Key Screens

#### 11.2.1 Inbox (Primary Screen)
```
┌────────────────────────────────────────────────────────────────────────────┐
│ 🏠 Chatty                                    🔔 Sarah ▾                    │
├────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────┐ ┌────────────────────────────┐ ┌───────────────────┐ │
│ │ 🔍 Search...     │ │ Order not received         │ │ 👤 John Smith     │ │
│ ├──────────────────┤ │                            │ │ john@example.com  │ │
│ │ All  Open Pending│ │ John Smith                 │ │ Customer since:   │ │
│ │  45   12    8    │ │ Today at 10:30 AM          │ │ Jan 2024          │ │
│ ├──────────────────┤ │ ─────────────────────────  │ │ LTV: $1,247       │ │
│ │                  │ │ Hi, I ordered a Blue       │ ├───────────────────┤ │
│ │ ● Order not rec. │ │ Widget last week and it    │ │ ORDERS            │ │
│ │   John Smith     │ │ still hasn't arrived.      │ │                   │ │
│ │   10:30 AM  HIGH │ │ Can you help?              │ │ ┌─────────────────┤ │
│ │                  │ │                            │ │ │ #1042 · $89     │ │
│ │ ○ Refund request │ │ ─────────────────────────  │ │ │ Jan 28 · Fulfil │ │
│ │   Jane Doe       │ │ Sarah · Today at 11:45 AM  │ │ │ ▾ View details  │ │
│ │   Yesterday      │ │                            │ │ │                 │ │
│ │                  │ │ Hi John, I'm sorry to hear │ │ │ Blue Widget × 2 │ │
│ │ ○ Size question  │ │ about the delay. Let me    │ │ │ Red Gadget × 1  │ │
│ │   Bob Wilson     │ │ check your order...        │ │ │                 │ │
│ │   2 days ago     │ │                            │ │ │ Tracking:       │ │
│ │                  │ │ ─────────────────────────  │ │ │ 1Z999AA101234   │ │
│ │                  │ │                            │ │ │ UPS · Delivered │ │
│ │                  │ │ ┌────────────────────────┐ │ │ └─────────────────┤ │
│ │                  │ │ │ Type your reply...     │ │ │                   │ │
│ │                  │ │ │                        │ │ │ #1035 · $124     │ │
│ │                  │ │ │                        │ │ │ Jan 15 · Fulfil  │ │
│ │                  │ │ └────────────────────────┘ │ │                   │ │
│ │                  │ │ 📎 Attach  [Send Reply]    │ │ #998 · $203      │ │
│ └──────────────────┘ └────────────────────────────┘ └───────────────────┘ │
└────────────────────────────────────────────────────────────────────────────┘
```

#### 11.2.2 Ticket Header Bar
```
┌─────────────────────────────────────────────────────────────────┐
│ #1042: Order not received                                       │
├─────────────────────────────────────────────────────────────────┤
│ Status: [Open ▾]  Priority: [High ▾]  Assignee: [Sarah ▾]       │
│                                                                 │
│ Tags: [shipping ×] [urgent ×] [+ Add tag]                       │
└─────────────────────────────────────────────────────────────────┘
```

### 11.3 Component Library

**Core Components:**
- Button (primary, secondary, ghost, danger)
- Input (text, email, password, search)
- Select / Dropdown
- Modal / Dialog
- Toast / Notification
- Avatar
- Badge (status, priority, tag)
- Card
- Table (with pagination)
- Tabs
- Tooltip
- Loading spinner / Skeleton

**Ticket Components:**
- TicketCard (list view)
- TicketDetail (full view)
- MessageBubble (customer, agent, note)
- ReplyComposer (rich text)
- AttachmentPreview

**Customer Components:**
- CustomerCard (sidebar header)
- OrderCard (collapsed/expanded)
- OrderLineItem
- TrackingInfo

### 11.4 Design Principles

1. **Efficiency First:** Minimize clicks for common actions
2. **Context Always:** Customer data visible without navigation
3. **Clear Hierarchy:** Visual distinction between customer/agent messages
4. **Keyboard Friendly:** Power users can navigate without mouse
5. **Responsive:** Works on 1280px+ screens (mobile not prioritized in MVP)

---

## 12. Security Requirements

### 12.1 Authentication
- Password hashing: bcrypt (cost factor 12)
- JWT tokens: 24-hour expiry, refresh token rotation
- Session invalidation on password change
- Account lockout after 5 failed attempts (15 min)

### 12.2 Authorization
- Row-level security: Users can only access their organization's data
- Role-based access control for all endpoints
- API keys scoped to organization

### 12.3 Data Protection
- Encryption at rest (AES-256) for sensitive fields
- Encryption in transit (TLS 1.3)
- PII handling compliant with GDPR basics
- Shopify tokens encrypted in database

### 12.4 Infrastructure
- DDoS protection (Cloudflare)
- Rate limiting per user and IP
- Input validation and sanitization
- SQL injection prevention (parameterized queries)
- XSS prevention (content sanitization)
- CORS configuration (allowlist only)

### 12.5 Audit & Compliance
- Activity logging for sensitive actions
- Login history tracking
- Data export capability (GDPR)
- 30-day soft delete retention

---

## 13. Timeline & Milestones

### 13.1 Development Phases

```
MONTH 1: Foundation
Week 1-2: Project setup, authentication, database
Week 3-4: Basic ticket CRUD, ticket list view

MONTH 2: Core Features
Week 5-6: Ticket detail, reply functionality, email integration
Week 7-8: Shopify OAuth, customer sync, sidebar

MONTH 3: Polish & Launch
Week 9-10: Team management, settings, notifications
Week 11-12: Testing, bug fixes, performance, launch prep
```

### 13.2 Milestone Checklist

**M1: Foundation Complete (End of Week 4)**
- [ ] Development environment configured
- [ ] Database schema deployed
- [ ] User authentication working
- [ ] Basic ticket list displays
- [ ] CI/CD pipeline running

**M2: Ticketing Working (End of Week 6)**
- [ ] Create/read/update tickets
- [ ] Reply to tickets via UI
- [ ] Internal notes functional
- [ ] Ticket assignment working
- [ ] Status and priority changes

**M3: Email Integration (End of Week 8)**
- [ ] Inbound email creates tickets
- [ ] Outbound email sends replies
- [ ] Email threading works
- [ ] Attachments supported

**M4: Shopify Integration (End of Week 10)**
- [ ] OAuth flow complete
- [ ] Customer data syncs
- [ ] Orders display in sidebar
- [ ] Tracking info visible
- [ ] Webhook handlers working

**M5: MVP Complete (End of Week 12)**
- [ ] Team management functional
- [ ] Settings pages complete
- [ ] All P0 bugs resolved
- [ ] Performance targets met
- [ ] Security audit passed
- [ ] Documentation complete

---

## 14. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Shopify API rate limits | Medium | High | Implement caching, queue requests, handle 429s gracefully |
| Email deliverability issues | Medium | High | Use reputable provider, warm up domain, monitor bounce rates |
| Scope creep | High | Medium | Strict PRD adherence, defer to backlog, weekly scope reviews |
| Data sync failures | Medium | Medium | Idempotent operations, retry queues, reconciliation jobs |
| Performance under load | Low | High | Load testing at M4, horizontal scaling plan ready |
| Security vulnerabilities | Low | Critical | Security review at M5, penetration testing before launch |
| Shopify OAuth rejection | Low | Critical | Follow Shopify guidelines, prepare for review process early |

---

## 15. Out of Scope (MVP)

Explicitly excluded from MVP to maintain focus:

**Features:**
- Live chat widget
- AI/automation (auto-replies, suggested responses)
- Help center / Knowledge base
- Social channels (Instagram, Facebook, etc.)
- Canned responses / Macros
- Advanced reporting / Analytics
- CSAT surveys
- SLA management
- Subscription management (Recharge integration)
- Mobile app

**Technical:**
- Multi-language support
- White-labeling
- SSO/SAML
- API access for customers
- Webhooks for integrations
- Advanced search (full-text, filters)

**Business:**
- Usage-based billing
- Enterprise features
- Multi-store support

---

## 16. Appendix

### 16.1 Glossary

| Term | Definition |
|------|------------|
| Ticket | A support conversation initiated by a customer |
| Thread | A series of messages within a ticket |
| Agent | A support team member who handles tickets |
| WISMO | "Where Is My Order" - most common support query |
| LTV | Lifetime Value - total revenue from a customer |
| FRT | First Response Time - time to first agent reply |

### 16.2 References

- Shopify API Documentation: https://shopify.dev/docs/api
- Postmark Inbound API: https://postmarkapp.com/developer/webhooks/inbound-webhook
- SendGrid API: https://docs.sendgrid.com/api-reference
- Gorgias (Competitor): https://www.gorgias.com
- RichPanel (Competitor): https://www.richpanel.com

### 16.3 Open Questions

| Question | Owner | Due Date | Status |
|----------|-------|----------|--------|
| Which email provider (SendGrid vs Postmark vs both)? | Engineering | Week 1 | Open |
| Pricing model for MVP beta? | Product | Week 4 | Open |
| Shopify App Store listing requirements? | Product | Week 8 | Open |
| Beta user recruitment strategy? | Marketing | Week 10 | Open |

### 16.4 Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Feb 2, 2026 | Product Team | Initial draft |

---

**Document Approval**

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product Manager | | | |
| Engineering Lead | | | |
| Design Lead | | | |
| QA Lead | | | |
