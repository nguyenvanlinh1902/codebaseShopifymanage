# Shopify Functions Skill

Use this skill when the user asks about "Shopify Functions", "discount function", "checkout validation", "delivery customization", "payment customization", "Rust function", or any server-side checkout logic.

## Overview

Shopify Functions run server-side logic at checkout. Written in Rust (recommended) or JavaScript, compiled to WebAssembly.

## When to Use Functions

| Use Case | Function Type |
|----------|---------------|
| Volume/tiered discounts | `discounts` |
| Cart validation rules | `cart-checkout-validation` |
| Custom shipping options | `delivery-customization` |
| Custom payment options | `payment-customization` |
| Bundle pricing | `discounts` |

## Directory Structure

```
extensions/discount-function-rs/
├── Cargo.toml                 # Rust dependencies
├── src/
│   ├── main.rs                # Entry point, re-exports run functions
│   ├── cart_lines_discounts_generate_run.rs      # Product discounts
│   ├── cart_lines_discounts_generate_run.graphql # Input query
│   ├── cart_delivery_options_discounts_generate_run.rs   # Shipping discounts
│   └── cart_delivery_options_discounts_generate_run.graphql
├── schema.graphql             # Generated schema (don't edit)
├── tests/
│   ├── default.test.js        # Vitest tests
│   └── fixtures/              # Test input JSON files
├── locales/
│   └── en.default.json        # Extension name/description
└── shopify.extension.toml     # Extension config
```

## Setup

### 1. Generate Extension
```bash
yarn shopify app generate extension --template rust
# Select: Discounts - Rust
```

### 2. Configuration (`shopify.extension.toml`)
```toml
api_version = "2024-10"

[[extensions]]
name = "Volume Discount"
handle = "volume-discount-function"
type = "function"

[[extensions.targeting]]
target = "purchase.cart-lines-discounts.generate-run"
input_query = "src/cart_lines_discounts_generate_run.graphql"
export = "cart_lines_discounts_generate_run"

[[extensions.targeting]]
target = "purchase.cart-delivery-options-discounts.generate-run"
input_query = "src/cart_delivery_options_discounts_generate_run.graphql"
export = "cart_delivery_options_discounts_generate_run"
```

### 3. Generate Types
```bash
yarn shopify app function typegen --path extensions/discount-function-rs
```

## Input Query (GraphQL)

Define what data the function receives:

```graphql
# src/cart_lines_discounts_generate_run.graphql
query Input {
  cart {
    lines {
      id
      quantity
      merchandise {
        ... on ProductVariant {
          id
          product {
            id
          }
        }
      }
    }
  }
  discount {
    metafield(namespace: "$app:volume-discount", key: "config") {
      value
    }
  }
}
```

## Rust Implementation

### Basic Structure

```rust
// src/cart_lines_discounts_generate_run.rs
use crate::schema;
use shopify_function::prelude::*;
use shopify_function::Result;

/// Configuration from metafield
#[derive(Deserialize, Default)]
#[shopify_function(rename_all = "camelCase")]
pub struct Configuration {
    pub tiers: Vec<Tier>,
    pub target_type: String,
    pub product_ids: Vec<String>,
}

#[derive(Deserialize, Default)]
#[shopify_function(rename_all = "camelCase")]
pub struct Tier {
    pub quantity: i32,
    pub discount_value: f64,
    pub discount_type: String,
}

#[shopify_function]
fn cart_lines_discounts_generate_run(
    input: schema::cart_lines_discounts_generate_run::Input,
) -> Result<schema::CartLinesDiscountsGenerateRunResult> {
    // Get config from metafield
    let config: Configuration = match input.discount().metafield() {
        Some(metafield) => metafield.json_value(),
        None => return Ok(empty_result()),
    };

    // Process cart lines
    let mut candidates = vec![];

    for line in input.cart().lines() {
        // Your discount logic here
    }

    Ok(schema::CartLinesDiscountsGenerateRunResult {
        operations: vec![
            schema::CartLinesDiscountsGenerateRunOperation::AddProductDiscount(
                schema::AddProductDiscount {
                    title: "Volume Discount".to_string(),
                    candidates,
                }
            )
        ],
    })
}

fn empty_result() -> schema::CartLinesDiscountsGenerateRunResult {
    schema::CartLinesDiscountsGenerateRunResult { operations: vec![] }
}
```

### Discount Value Types

```rust
// Percentage discount
schema::ProductDiscountCandidateValue::Percentage(
    schema::Percentage {
        value: Decimal(10.0), // 10% off
    }
)

// Fixed amount per item
schema::ProductDiscountCandidateValue::FixedAmount(
    schema::ProductDiscountCandidateFixedAmount {
        amount: Decimal(5.0), // $5 off each
        applies_to_each_item: Some(true),
    }
)
```

### Main Entry Point

```rust
// src/main.rs
use shopify_function::shopify_function_target;

mod cart_lines_discounts_generate_run;
mod cart_delivery_options_discounts_generate_run;

pub mod schema {
    shopify_function::generate_types!();
}
```

## Configuration via Metafield

Functions read configuration from discount metafields:

### Backend Service (Store Config)
```javascript
function buildMetafieldConfig(discountData) {
  return {
    namespace: '$app:volume-discount',
    key: 'config',
    type: 'json',
    value: JSON.stringify({
      tiers: discountData.tiers,
      targetType: discountData.targetType,
      productIds: discountData.productIds
    })
  };
}
```

### Create Discount with Metafield
```graphql
mutation CreateDiscount($discount: DiscountAutomaticAppInput!) {
  discountAutomaticAppCreate(automaticAppDiscount: $discount) {
    automaticAppDiscount {
      discountId
    }
    userErrors {
      field
      message
    }
  }
}
```

```javascript
const variables = {
  discount: {
    title: "Volume Discount",
    functionHandle: "volume-discount-function",
    startsAt: new Date().toISOString(),
    metafields: [buildMetafieldConfig(discountData)]
  }
};
```

## Testing

### Vitest Setup
```javascript
// tests/default.test.js
import {describe, it, expect} from 'vitest';
import {run_cart_lines_discounts_generate_run} from '../src/main.rs';

describe('volume discount function', () => {
  it('applies percentage discount at tier quantity', async () => {
    const input = require('./fixtures/cart-with-tier.json');
    const result = await run_cart_lines_discounts_generate_run(input);

    expect(result.operations).toHaveLength(1);
    expect(result.operations[0].addProductDiscount.candidates).toHaveLength(1);
  });

  it('returns empty when no config', async () => {
    const input = require('./fixtures/no-config.json');
    const result = await run_cart_lines_discounts_generate_run(input);

    expect(result.operations).toHaveLength(0);
  });
});
```

### Test Fixture
```json
// tests/fixtures/cart-with-tier.json
{
  "cart": {
    "lines": [
      {
        "id": "gid://shopify/CartLine/1",
        "quantity": 5,
        "merchandise": {
          "__typename": "ProductVariant",
          "id": "gid://shopify/ProductVariant/123",
          "product": {
            "id": "gid://shopify/Product/456"
          }
        }
      }
    ]
  },
  "discount": {
    "metafield": {
      "value": "{\"tiers\":[{\"quantity\":3,\"discountValue\":10,\"discountType\":\"percentage\"}],\"targetType\":\"all\",\"productIds\":[]}"
    }
  }
}
```

### Run Tests
```bash
cd extensions/discount-function-rs
yarn test
```

## Build & Deploy

```bash
# Build WASM
cd extensions/discount-function-rs
cargo build --release --target wasm32-wasip1

# Deploy with app
yarn shopify app deploy
```

## Debugging

### Local Testing
```bash
# Run function with input file
yarn shopify app function run --path extensions/discount-function-rs \
  --export cart_lines_discounts_generate_run \
  --input tests/fixtures/cart-with-tier.json
```

### Check Logs
```bash
yarn shopify app logs --source extensions
```

## Common Patterns

### Check Product Targeting
```rust
fn is_product_targeted(config: &Configuration, product_id: &str) -> bool {
    match config.target_type.as_str() {
        "all" => true,
        "products" => config.product_ids.iter().any(|id| id == product_id),
        _ => true,
    }
}
```

### Find Applicable Tier
```rust
fn find_applicable_tier(tiers: &[Tier], quantity: i32) -> Option<&Tier> {
    let mut sorted: Vec<&Tier> = tiers.iter().collect();
    sorted.sort_by(|a, b| b.quantity.cmp(&a.quantity)); // Descending
    sorted.into_iter().find(|tier| quantity >= tier.quantity)
}
```

### Extract Product from Merchandise
```rust
use schema::cart_lines_discounts_generate_run::input::cart::lines::Merchandise;

for line in input.cart().lines() {
    let variant = match line.merchandise() {
        Merchandise::ProductVariant(v) => v,
        _ => continue,
    };
    let product_id = variant.product().id();
    // ...
}
```

## Limitations

| Constraint | Limit |
|------------|-------|
| Execution time | 5ms |
| Memory | 10MB |
| WASM binary size | 256KB |
| Input query complexity | Limited depth |

## Related Skills
- `shopify-api` - Creating/updating discounts via Admin API
- `backend` - Service layer for managing discount config
- `storefront-data` - Syncing config to shop metafield for display
