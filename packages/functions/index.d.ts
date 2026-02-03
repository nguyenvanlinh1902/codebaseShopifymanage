import {Timestamp} from '@google-cloud/firestore/build/src';

declare interface IUserContext {
  shop: Shop;
  shopID: string;
  type: 'shopify';
}

declare interface Shop {
  id: string;
  accessToken: string;
  appStatus: boolean;
  domain: string;
  email: string;
  installedAt: Date | Timestamp | string;
  isInstalled: boolean;
  isOnTrial: boolean;
  name: string;
  plan: string;
  shopifyDomain: string;
  uid: string;
  vendor: string;
}

declare interface ShopInfo {
  [key: string]: any;
}

declare interface Subscription {
  shop: Shop;
  getting: boolean;
  subscribing: boolean;
}

declare interface IStoreReducer {
  state: IStoreState;
  dispatch: Function;
}

declare interface IStoreState {
  loading: boolean;
  user: any;
  shop: Shop;
  subscription: Subscription;
  toast?: {content: string; error: boolean};
}

// ============================================================================
// CHATTY MVP TYPES
// ============================================================================

/**
 * Organization represents a Shopify store using Chatty
 * One organization per Shopify store
 */
declare interface Organization {
  id: string;
  name: string;
  shopifyDomain: string;
  shopifyToken?: string; // Encrypted
  shopId: string; // Reference to shops collection
  emailAddress: string; // Unique forwarding address for inbound emails
  timezone: string;
  settings: OrganizationSettings;
  onboardingStatus: OnboardingStatus;
  createdAt: Date | Timestamp | string;
  updatedAt: Date | Timestamp | string;
}

declare interface OrganizationSettings {
  supportEmailName?: string; // "Store Name Support"
  emailSignature?: string; // Plain text signature
  replyToEmail?: string; // Original support email
  autoCloseAfterDays?: number; // Auto-close resolved tickets (default: 7)
}

declare interface OnboardingStatus {
  accountCreated: boolean;
  shopifyConnected: boolean;
  emailConfigured: boolean;
  teamInvited: boolean;
  testEmailSent: boolean;
}

/**
 * User represents a team member in an organization
 * Roles: owner (1 per org), admin, agent
 */
declare interface User {
  id: string;
  organizationId: string;
  email: string;
  passwordHash: string;
  name: string;
  avatarUrl?: string;
  role: 'owner' | 'admin' | 'agent';
  status: 'active' | 'invited' | 'deactivated';
  lastLoginAt?: Date | Timestamp | string;
  notificationPreferences: UserNotificationPreferences;
  createdAt: Date | Timestamp | string;
  updatedAt: Date | Timestamp | string;
}

declare interface UserNotificationPreferences {
  emailOnAssignment: boolean;
  emailOnCustomerReply: boolean;
}

/**
 * Customer synced from Shopify
 */
declare interface Customer {
  id: string;
  organizationId: string;
  shopifyId: string;
  email: string;
  phone?: string;
  firstName: string;
  lastName: string;
  totalOrders: number;
  totalSpent: number;
  currency: string;
  averageOrderValue: number;
  createdAtShopify: Date | Timestamp | string;
  syncedAt: Date | Timestamp | string;
  createdAt: Date | Timestamp | string;
  updatedAt: Date | Timestamp | string;
}

/**
 * Order synced from Shopify
 */
declare interface Order {
  id: string;
  organizationId: string;
  customerId: string;
  shopifyId: string;
  orderNumber: string;
  email: string;
  totalPrice: number;
  currency: string;
  financialStatus: string;
  fulfillmentStatus: string;
  lineItems: OrderLineItem[];
  shippingAddress?: ShippingAddress;
  trackingInfo: TrackingInfo[];
  createdAtShopify: Date | Timestamp | string;
  syncedAt: Date | Timestamp | string;
  createdAt: Date | Timestamp | string;
  updatedAt: Date | Timestamp | string;
}

declare interface OrderLineItem {
  shopifyId: string;
  title: string;
  variantTitle?: string;
  quantity: number;
  price: number;
  imageUrl?: string;
  sku?: string;
}

declare interface ShippingAddress {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  province: string;
  provinceCode?: string;
  country: string;
  countryCode?: string;
  zip: string;
  phone?: string;
}

declare interface TrackingInfo {
  number: string;
  carrier: string;
  url?: string;
  status?: string;
}

/**
 * Ticket represents a support conversation
 */
declare interface Ticket {
  id: string;
  organizationId: string;
  customerId?: string;
  assigneeId?: string;
  number: number; // Human-readable ticket number
  subject: string;
  status: 'open' | 'pending' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  channel: 'email' | 'manual';
  customerEmail: string;
  customerName: string;
  tagIds: string[];
  relatedTicketId?: string; // For linked tickets
  messageCount: number;
  lastMessageAt: Date | Timestamp | string;
  resolvedAt?: Date | Timestamp | string;
  closedAt?: Date | Timestamp | string;
  createdAt: Date | Timestamp | string;
  updatedAt: Date | Timestamp | string;
}

/**
 * Message in a ticket conversation
 */
declare interface Message {
  id: string;
  ticketId: string;
  userId?: string; // NULL for customer messages
  type: 'reply' | 'note' | 'system';
  contentText: string;
  contentHtml?: string;
  senderType: 'customer' | 'agent';
  senderEmail: string;
  senderName: string;
  emailMessageId?: string; // For email threading
  isInternal: boolean;
  createdAt: Date | Timestamp | string;
}

/**
 * Attachment on a message
 */
declare interface Attachment {
  id: string;
  messageId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  storageUrl: string;
  createdAt: Date | Timestamp | string;
}

/**
 * Activity/audit log entry for a ticket
 */
declare interface Activity {
  id: string;
  ticketId: string;
  userId?: string;
  action: 'created' | 'status_changed' | 'assigned' | 'priority_changed' | 'tagged' | 'untagged' | 'replied' | 'note_added';
  oldValue?: string;
  newValue?: string;
  metadata?: Record<string, any>;
  createdAt: Date | Timestamp | string;
}

/**
 * Tag for categorizing tickets
 */
declare interface Tag {
  id: string;
  organizationId: string;
  name: string;
  color: string;
  createdAt: Date | Timestamp | string;
  updatedAt: Date | Timestamp | string;
}

/**
 * User invitation for team members
 */
declare interface Invitation {
  id: string;
  organizationId: string;
  email: string;
  role: 'admin' | 'agent';
  invitedBy: string;
  token: string;
  expiresAt: Date | Timestamp | string;
  status: 'pending' | 'accepted' | 'expired';
  createdAt: Date | Timestamp | string;
}

// ============================================================================
// API TYPES
// ============================================================================

declare interface PaginationQuery {
  after?: string;
  before?: string;
  limit?: number;
  hasCount?: boolean;
  getAll?: boolean;
}

declare interface PaginationResult<T> {
  data: T[];
  count: number;
  total?: number;
  pageInfo: {
    hasPre: boolean;
    hasNext: boolean;
    totalPage?: number;
  };
}

declare interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

declare interface TicketFilters {
  status?: Ticket['status'];
  priority?: Ticket['priority'];
  assigneeId?: string;
  customerId?: string;
  tagId?: string;
  search?: string;
}

declare interface TicketSort {
  field: 'createdAt' | 'updatedAt' | 'lastMessageAt' | 'priority';
  direction: 'asc' | 'desc';
}
