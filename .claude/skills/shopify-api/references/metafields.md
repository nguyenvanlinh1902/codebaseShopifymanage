# Metafield Operations

## Set Metafields (Batch)

```javascript
const mutation = `
  mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id key value }
      userErrors { field message }
    }
  }
`;

await shopify.graphql(mutation, {
  metafields: [
    {
      ownerId: customerId,
      namespace: 'loyalty',
      key: 'points',
      type: 'number_integer',
      value: '500'
    },
    {
      ownerId: customerId,
      namespace: 'loyalty',
      key: 'tier',
      type: 'single_line_text_field',
      value: 'Gold'
    }
  ]
});
```

## Metafield Types

| Type | Value Example | Use Case |
|------|---------------|----------|
| `single_line_text_field` | `"Gold Tier"` | Short text |
| `multi_line_text_field` | `"Line 1\nLine 2"` | Long text |
| `number_integer` | `"500"` | Whole numbers |
| `number_decimal` | `"19.99"` | Decimals |
| `boolean` | `"true"` | True/false |
| `json` | `"{\"key\":\"value\"}"` | Complex data |
| `date` | `"2024-01-15"` | Dates |
| `date_time` | `"2024-01-15T10:30:00Z"` | Timestamps |
| `url` | `"https://..."` | URLs |

## Get Metafields

```javascript
const query = `
  query getCustomerMetafields($id: ID!) {
    customer(id: $id) {
      metafields(first: 10, namespace: "loyalty") {
        nodes {
          key
          value
          type
        }
      }
    }
  }
`;
```

## Delete Metafield

```javascript
const mutation = `
  mutation deleteMetafield($input: MetafieldDeleteInput!) {
    metafieldDelete(input: $input) {
      deletedId
      userErrors { field message }
    }
  }
`;

await shopify.graphql(mutation, {
  input: { id: metafieldId }
});
```

## App-Reserved Namespace

```javascript
// Use $app: prefix for app-owned metafields
const NAMESPACE = '$app:loyalty';

// Benefits:
// - Automatically scoped to your app
// - Visible in Shopify admin under your app
// - Automatically cleaned up on app uninstall
```

## Enable Storefront Access

```javascript
// Make metafield visible to Storefront API
const mutation = `
  mutation enableStorefrontAccess {
    metafieldStorefrontVisibilityCreate(input: {
      namespace: "$app:loyalty"
      key: "points"
      ownerType: CUSTOMER
    }) {
      userErrors { field message }
    }
  }
`;
```
