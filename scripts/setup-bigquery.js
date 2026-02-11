#!/usr/bin/env node

/**
 * BigQuery Setup Script
 * Creates dataset and tables for Firestore -> BigQuery sync
 * Using service account for authentication
 */

const {BigQuery} = require('@google-cloud/bigquery');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m'
};

const log = {
  success: msg => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: msg => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warn: msg => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  info: msg => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`)
};

// Load environment variables
function loadEnv() {
  try {
    const envPath = path.join(__dirname, '../packages/functions/.env');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const env = {};

    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=:#]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        env[key] = value;
      }
    });

    return env;
  } catch (error) {
    log.error('Failed to load .env file');
    log.info('Make sure packages/functions/.env exists');
    process.exit(1);
  }
}

// Load service account
function loadServiceAccount() {
  const serviceAccountPaths = [
    path.join(__dirname, '../packages/functions/serviceAccount.development.json'),
    path.join(__dirname, '../packages/functions/serviceAccount.json'),
    path.join(__dirname, '../packages/functions/serviceAccountKey.json'),
    path.join(__dirname, '../serviceAccount.development.json'),
    path.join(__dirname, '../serviceAccount.json'),
    path.join(__dirname, '../serviceAccountKey.json')
  ];

  for (const serviceAccountPath of serviceAccountPaths) {
    if (fs.existsSync(serviceAccountPath)) {
      log.info(`Using service account: ${serviceAccountPath.replace(__dirname + '/../', '')}`);
      return require(serviceAccountPath);
    }
  }

  log.error('Service account file not found');
  log.info('Expected in packages/functions/ or root:');
  log.info('  - serviceAccount.development.json');
  log.info('  - serviceAccount.json');
  log.info('  - serviceAccountKey.json');
  process.exit(1);
}

// SQL queries to create views
function getCreateViewQueries(dataset) {
  return {
    shopify_stores_latest_view: `
      CREATE OR REPLACE VIEW \`${dataset}.shopify_stores_latest_view\` AS
      SELECT *
      FROM (
        SELECT
          *,
          ROW_NUMBER() OVER (
            PARTITION BY document_id
            ORDER BY timestamp DESC
          ) AS rn
        FROM \`${dataset}.shopify_stores_changelogs\`
        WHERE document_id NOT IN (
          SELECT DISTINCT document_id
          FROM \`${dataset}.shopify_stores_changelogs\`
          WHERE operation = 'DELETE'
        )
      )
      WHERE rn = 1
    `,
    google_auth_latest_view: `
      CREATE OR REPLACE VIEW \`${dataset}.google_auth_latest_view\` AS
      SELECT *
      FROM (
        SELECT
          *,
          ROW_NUMBER() OVER (
            PARTITION BY document_id
            ORDER BY timestamp DESC
          ) AS rn
        FROM \`${dataset}.google_auth_changelogs\`
        WHERE document_id NOT IN (
          SELECT DISTINCT document_id
          FROM \`${dataset}.google_auth_changelogs\`
          WHERE operation = 'DELETE'
        )
      )
      WHERE rn = 1
    `,
    google_sheets_latest_view: `
      CREATE OR REPLACE VIEW \`${dataset}.google_sheets_latest_view\` AS
      SELECT *
      FROM (
        SELECT
          *,
          ROW_NUMBER() OVER (
            PARTITION BY document_id
            ORDER BY timestamp DESC
          ) AS rn
        FROM \`${dataset}.google_sheets_changelogs\`
        WHERE document_id NOT IN (
          SELECT DISTINCT document_id
          FROM \`${dataset}.google_sheets_changelogs\`
          WHERE operation = 'DELETE'
        )
      )
      WHERE rn = 1
    `,
    products_latest_view: `
      CREATE OR REPLACE VIEW \`${dataset}.products_latest_view\` AS
      SELECT *
      FROM (
        SELECT
          *,
          ROW_NUMBER() OVER (
            PARTITION BY document_id
            ORDER BY timestamp DESC
          ) AS rn
        FROM \`${dataset}.products_changelogs\`
        WHERE document_id NOT IN (
          SELECT DISTINCT document_id
          FROM \`${dataset}.products_changelogs\`
          WHERE operation = 'DELETE'
        )
      )
      WHERE rn = 1
    `
  };
}

// SQL queries to create tables
function getCreateTableQueries(dataset) {
  return {
    shopify_stores_changelogs: `
      CREATE TABLE IF NOT EXISTS \`${dataset}.shopify_stores_changelogs\` (
        timestamp TIMESTAMP,
        event_id STRING,
        document_name STRING,
        operation STRING,
        data STRING,
        old_data STRING,
        document_id STRING,
        userId STRING,
        shopDomain STRING,
        name STRING,
        niche STRING,
        email STRING,
        currency STRING,
        timezone STRING,
        status STRING,
        createdAt TIMESTAMP,
        updatedAt TIMESTAMP
      )
    `,
    google_auth_changelogs: `
      CREATE TABLE IF NOT EXISTS \`${dataset}.google_auth_changelogs\` (
        timestamp TIMESTAMP,
        event_id STRING,
        document_name STRING,
        operation STRING,
        data STRING,
        old_data STRING,
        document_id STRING,
        userId STRING,
        googleEmail STRING,
        scopes STRING,
        createdAt TIMESTAMP,
        updatedAt TIMESTAMP
      )
    `,
    google_sheets_changelogs: `
      CREATE TABLE IF NOT EXISTS \`${dataset}.google_sheets_changelogs\` (
        timestamp TIMESTAMP,
        event_id STRING,
        document_name STRING,
        operation STRING,
        data STRING,
        old_data STRING,
        document_id STRING,
        userId STRING,
        spreadsheetId STRING,
        name STRING,
        title STRING,
        status STRING,
        googleEmail STRING,
        createdAt TIMESTAMP,
        updatedAt TIMESTAMP
      )
    `,
    products_changelogs: `
      CREATE TABLE IF NOT EXISTS \`${dataset}.products_changelogs\` (
        timestamp TIMESTAMP,
        event_id STRING,
        document_name STRING,
        operation STRING,
        data STRING,
        old_data STRING,
        document_id STRING,
        userId STRING,
        storeId STRING,
        storeName STRING,
        shopDomain STRING,
        shopifyProductId STRING,
        importId STRING,
        action STRING,
        importedAt TIMESTAMP,
        handle STRING,
        title STRING,
        description STRING,
        vendor STRING,
        productType STRING,
        tags STRING,
        status STRING,
        giftCard BOOLEAN,
        option1Name STRING,
        option1Value STRING,
        option2Name STRING,
        option2Value STRING,
        option3Name STRING,
        option3Value STRING,
        sku STRING,
        price FLOAT64,
        compareAtPrice FLOAT64,
        cost FLOAT64,
        inventoryQuantity INT64,
        inventoryTracker STRING,
        inventoryPolicy STRING,
        fulfillmentService STRING,
        barcode STRING,
        weight FLOAT64,
        weightUnit STRING,
        requiresShipping BOOLEAN,
        taxable BOOLEAN,
        taxCode STRING,
        imageUrl STRING,
        imagePosition INT64,
        imageAlt STRING,
        variantImage STRING,
        googleShoppingMPN STRING,
        googleShoppingAgeGroup STRING,
        googleShoppingGender STRING,
        googleShoppingProductCategory STRING,
        googleShoppingAdWordsGrouping STRING,
        googleShoppingAdWordsLabels STRING,
        googleShoppingCondition STRING,
        googleShoppingCustomProduct BOOLEAN,
        googleShoppingCustomLabel0 STRING,
        googleShoppingCustomLabel1 STRING,
        googleShoppingCustomLabel2 STRING,
        googleShoppingCustomLabel3 STRING,
        googleShoppingCustomLabel4 STRING,
        seoTitle STRING,
        seoDescription STRING,
        seoHidden BOOLEAN,
        createdAt TIMESTAMP,
        updatedAt TIMESTAMP
      )
    `
  };
}

// Columns generated by trigger.js (generateDefaultRow) that must exist in all changelog tables
const REQUIRED_BASE_COLUMNS = [
  {name: 'event_id', type: 'STRING'},
  {name: 'document_name', type: 'STRING'},
  {name: 'data', type: 'STRING'},
  {name: 'old_data', type: 'STRING'}
];

/**
 * Add missing base columns to existing changelog tables.
 * BigQuery supports ALTER TABLE ADD COLUMN for missing fields.
 */
async function addMissingColumns(bigquery, datasetId, tableNames) {
  console.log(`${colors.yellow}Checking for missing columns...${colors.reset}`);

  for (const tableName of tableNames) {
    process.stdout.write(`  - ${tableName}: `);
    try {
      const [metadata] = await bigquery.dataset(datasetId).table(tableName).getMetadata();
      const existingCols = metadata.schema.fields.map(f => f.name);
      const missing = REQUIRED_BASE_COLUMNS.filter(c => !existingCols.includes(c.name));

      if (missing.length === 0) {
        console.log(`${colors.green}OK${colors.reset}`);
        continue;
      }

      for (const col of missing) {
        await bigquery.query(
          `ALTER TABLE \`${datasetId}.${tableName}\` ADD COLUMN ${col.name} ${col.type}`
        );
      }
      console.log(`${colors.green}added [${missing.map(c => c.name).join(', ')}]${colors.reset}`);
    } catch (error) {
      console.log(`${colors.red}failed${colors.reset}`);
      log.error(`  Error: ${error.message}`);
    }
  }
}

async function main() {
  console.log(`${colors.yellow}============================================${colors.reset}`);
  console.log(`${colors.yellow}  BigQuery Setup Script                    ${colors.reset}`);
  console.log(`${colors.yellow}============================================${colors.reset}\n`);

  // Load service account
  const serviceAccount = loadServiceAccount();
  const projectId = serviceAccount.project_id;

  // Load environment
  const env = loadEnv();
  const datasetId = env.BIG_QUERY_DATASET_ID;

  if (!datasetId) {
    log.error('BIG_QUERY_DATASET_ID not set in packages/functions/.env');
    process.exit(1);
  }

  log.info(`Project: ${projectId}`);
  log.info(`Dataset: ${datasetId}\n`);

  // Initialize BigQuery client with service account
  const bigquery = new BigQuery({
    projectId,
    credentials: serviceAccount
  });

  try {
    // Create dataset if not exists
    console.log(`${colors.yellow}Creating dataset...${colors.reset}`);
    const dataset = bigquery.dataset(datasetId);
    const [exists] = await dataset.exists();

    if (exists) {
      log.success('Dataset already exists');
    } else {
      await bigquery.createDataset(datasetId, {location: 'US'});
      log.success('Dataset created');
    }

    console.log('');

    // Create tables using SQL queries
    console.log(`${colors.yellow}Creating tables...${colors.reset}`);
    const queries = getCreateTableQueries(datasetId);
    const tableNames = Object.keys(queries);

    for (const tableName of tableNames) {
      process.stdout.write(`  - ${tableName}: `);

      try {
        await bigquery.query(queries[tableName]);
        console.log(`${colors.green}created/exists${colors.reset}`);
      } catch (error) {
        console.log(`${colors.red}failed${colors.reset}`);
        log.error(`  Error: ${error.message}`);
      }
    }

    console.log('');

    // Add missing columns to existing tables (idempotent)
    await addMissingColumns(bigquery, datasetId, tableNames);

    console.log('');

    // Create views using SQL queries
    console.log(`${colors.yellow}Creating views...${colors.reset}`);
    const viewQueries = getCreateViewQueries(datasetId);
    const viewNames = Object.keys(viewQueries);

    for (const viewName of viewNames) {
      process.stdout.write(`  - ${viewName}: `);

      try {
        await bigquery.query(viewQueries[viewName]);
        console.log(`${colors.green}created/replaced${colors.reset}`);
      } catch (error) {
        console.log(`${colors.red}failed${colors.reset}`);
        log.error(`  Error: ${error.message}`);
      }
    }

    console.log('');
    log.success('BigQuery setup complete!\n');

    console.log(`${colors.yellow}Next steps:${colors.reset}`);
    console.log('  1. Deploy Firestore triggers: yarn deploy:functions');
    console.log(
      `  2. Check BigQuery console: https://console.cloud.google.com/bigquery?project=${projectId}`
    );
  } catch (error) {
    console.log('');
    log.error(`Setup failed: ${error.message}`);
    process.exit(1);
  }
}

main();
