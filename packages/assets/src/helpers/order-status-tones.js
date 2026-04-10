/** Shared Polaris Badge tone maps for order statuses */

export const FULFILLMENT_TONE = {
  FULFILLED: 'success',
  UNFULFILLED: 'attention',
  PARTIALLY_FULFILLED: 'info',
  IN_PROGRESS: 'info'
};

export const FINANCIAL_TONE = {
  PAID: 'success',
  PENDING: 'attention',
  REFUNDED: 'info',
  PARTIALLY_REFUNDED: 'warning',
  VOIDED: 'critical'
};
