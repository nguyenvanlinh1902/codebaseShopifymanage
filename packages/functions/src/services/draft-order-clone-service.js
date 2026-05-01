/**
 * Draft Order Clone Service — pure helpers for duplicating + completing draft orders.
 * GraphQL queries/mutations + buildDraftCloneInput pure function.
 */

export const FETCH_DRAFT_FOR_CLONE_QUERY = `
query FetchDraftForClone($id: ID!) {
  draftOrder(id: $id) {
    id
    note2
    tags
    email
    phone
    taxExempt
    customAttributes { key value }
    appliedDiscount { title value valueType description }
    shippingLine { title originalPriceSet { shopMoney { amount } } }
    customer { id }
    shippingAddress {
      address1 address2 city province country zip
      phone firstName lastName company
    }
    billingAddress {
      address1 address2 city province country zip
      phone firstName lastName company
    }
    lineItems(first: 250) {
      edges { node {
        title quantity custom
        variant { id }
        originalUnitPriceSet { shopMoney { amount } }
        customAttributes { key value }
        appliedDiscount { title value valueType description }
      } }
    }
  }
}`;

export const DRAFT_ORDER_CREATE_MUTATION = `
mutation DraftOrderCreate($input: DraftOrderInput!) {
  draftOrderCreate(input: $input) {
    draftOrder { id name status }
    userErrors { field message }
  }
}`;

export const DRAFT_ORDER_COMPLETE_MUTATION = `
mutation DraftOrderComplete($id: ID!, $paymentPending: Boolean) {
  draftOrderComplete(id: $id, paymentPending: $paymentPending) {
    draftOrder { id name status order { id name } }
    userErrors { field message }
  }
}`;

function pickAddress(a) {
  if (!a) return null;
  const fields = ['address1', 'address2', 'city', 'province', 'country', 'zip', 'phone', 'firstName', 'lastName', 'company'];
  const hasAny = fields.some(f => a[f]);
  if (!hasAny) return null;
  return Object.fromEntries(fields.map(f => [f, a[f] || '']));
}

function pickDiscount(d) {
  if (!d) return null;
  return {
    title: d.title || 'Discount',
    description: d.description || '',
    value: parseFloat(d.value) || 0,
    valueType: d.valueType || 'FIXED_AMOUNT'
  };
}

/**
 * Build DraftOrderInput from a fetched draft order (for re-creation as duplicate).
 * Preserves: line items (variant or custom), customer, addresses, discount,
 * shipping line, tags, note, email, phone, taxExempt, customAttributes.
 */
export function buildDraftCloneInput(source) {
  const input = {
    lineItems: (source.lineItems?.edges || []).map(({node}) => {
      const li = node.variant?.id
        ? {variantId: node.variant.id, quantity: node.quantity}
        : {
            title: node.title || 'Custom Item',
            originalUnitPrice: node.originalUnitPriceSet?.shopMoney?.amount || '0',
            quantity: node.quantity
          };
      if (node.customAttributes?.length) {
        li.customAttributes = node.customAttributes.map(a => ({
          key: a.key,
          value: String(a.value ?? '')
        }));
      }
      const liDiscount = pickDiscount(node.appliedDiscount);
      if (liDiscount && liDiscount.value > 0) li.appliedDiscount = liDiscount;
      return li;
    })
  };

  if (source.note2) input.note = source.note2;
  if (source.tags?.length) input.tags = source.tags;
  if (source.email) input.email = source.email;
  if (source.phone) input.phone = source.phone;
  if (source.taxExempt) input.taxExempt = true;
  if (source.customer?.id) input.customerId = source.customer.id;

  const ship = pickAddress(source.shippingAddress);
  if (ship) input.shippingAddress = ship;
  const bill = pickAddress(source.billingAddress);
  if (bill) input.billingAddress = bill;

  const discount = pickDiscount(source.appliedDiscount);
  if (discount && discount.value > 0) input.appliedDiscount = discount;

  if (source.shippingLine) {
    input.shippingLine = {
      title: source.shippingLine.title || 'Shipping',
      price: source.shippingLine.originalPriceSet?.shopMoney?.amount || '0'
    };
  }

  if (source.customAttributes?.length) {
    input.customAttributes = source.customAttributes.map(a => ({
      key: a.key,
      value: String(a.value ?? '')
    }));
  }

  return input;
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));
