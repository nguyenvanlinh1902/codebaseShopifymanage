import * as customerRepository from '@functions/repositories/customerRepository';
import * as orderRepository from '@functions/repositories/orderRepository';
import * as ticketRepository from '@functions/repositories/ticketRepository';

/**
 * Get customer by ID with validation
 *
 * @param {string} customerId - Customer ID
 * @param {string} organizationId - Organization ID for validation
 * @returns {Promise<Customer>}
 */
export async function getCustomer(customerId, organizationId) {
  const customer = await customerRepository.getById(customerId);

  if (!customer) {
    throw new Error('Customer not found');
  }

  if (customer.organizationId !== organizationId) {
    throw new Error('Customer not found');
  }

  return customer;
}

/**
 * Get customer with full details (orders, tickets)
 *
 * @param {string} customerId - Customer ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<{customer: Customer, orders: Order[], tickets: Ticket[], otherOpenTickets: number}>}
 */
export async function getCustomerWithDetails(customerId, organizationId) {
  const customer = await getCustomer(customerId, organizationId);

  const [orders, ticketsResult] = await Promise.all([
    orderRepository.getAllByCustomer(customerId, 10),
    ticketRepository.listByCustomer(customerId, {limit: 5})
  ]);

  // Count other open tickets
  const openTicketCount = await ticketRepository.getOpenTicketCountForCustomer(customerId, '');

  return {
    customer,
    orders,
    tickets: ticketsResult.data,
    otherOpenTickets: openTicketCount
  };
}

/**
 * Get customer sidebar data for a ticket
 * Optimized for ticket detail view
 *
 * @param {string} customerId - Customer ID
 * @param {string} ticketId - Current ticket ID (to exclude from open count)
 * @returns {Promise<{customer: Customer, orders: Order[], otherOpenTicketCount: number}>}
 */
export async function getCustomerSidebarData(customerId, ticketId) {
  const [customer, orders, otherOpenTicketCount] = await Promise.all([
    customerRepository.getById(customerId),
    orderRepository.getAllByCustomer(customerId, 10),
    ticketRepository.getOpenTicketCountForCustomer(customerId, ticketId)
  ]);

  if (!customer) {
    return null;
  }

  return {customer, orders, otherOpenTicketCount};
}

/**
 * List customers with pagination
 *
 * @param {Object} params
 * @param {string} params.organizationId - Organization ID
 * @param {PaginationQuery} [params.query] - Pagination options
 * @returns {Promise<PaginationResult<Customer>>}
 */
export async function listCustomers({organizationId, query = {}}) {
  return customerRepository.listByOrganization({organizationId, query});
}

/**
 * Search customers
 *
 * @param {string} organizationId - Organization ID
 * @param {string} searchTerm - Search term
 * @param {number} [limit=20] - Max results
 * @returns {Promise<Customer[]>}
 */
export async function searchCustomers(organizationId, searchTerm, limit = 20) {
  return customerRepository.search(organizationId, searchTerm, limit);
}

/**
 * Match customer by email (for ticket creation)
 *
 * @param {string} organizationId - Organization ID
 * @param {string} email - Customer email
 * @returns {Promise<Customer|null>}
 */
export async function matchByEmail(organizationId, email) {
  return customerRepository.getByEmail(organizationId, email);
}

/**
 * Get customer orders
 *
 * @param {string} customerId - Customer ID
 * @param {string} organizationId - Organization ID
 * @param {number} [limit=10] - Max orders to return
 * @returns {Promise<Order[]>}
 */
export async function getCustomerOrders(customerId, organizationId, limit = 10) {
  const customer = await getCustomer(customerId, organizationId);
  return orderRepository.getAllByCustomer(customer.id, limit);
}

/**
 * Get customer tickets
 *
 * @param {string} customerId - Customer ID
 * @param {string} organizationId - Organization ID
 * @param {PaginationQuery} [query] - Pagination options
 * @returns {Promise<PaginationResult<Ticket>>}
 */
export async function getCustomerTickets(customerId, organizationId, query = {}) {
  await getCustomer(customerId, organizationId);
  return ticketRepository.listByCustomer(customerId, query);
}

/**
 * Get order details
 *
 * @param {string} orderId - Order ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Order>}
 */
export async function getOrderDetails(orderId, organizationId) {
  const order = await orderRepository.getById(orderId);

  if (!order) {
    throw new Error('Order not found');
  }

  if (order.organizationId !== organizationId) {
    throw new Error('Order not found');
  }

  return order;
}

/**
 * Search orders by number or email
 *
 * @param {string} organizationId - Organization ID
 * @param {string} searchTerm - Search term
 * @param {number} [limit=20] - Max results
 * @returns {Promise<Order[]>}
 */
export async function searchOrders(organizationId, searchTerm, limit = 20) {
  return orderRepository.search(organizationId, searchTerm, limit);
}
