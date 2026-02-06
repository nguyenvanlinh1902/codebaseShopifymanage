# Setup Guide - PubSub Topics

## Problem

When deploying Firebase Functions that use PubSub, you might see this error:

```
5 NOT_FOUND: Resource not found (resource=product-import).
```

This happens because **PubSub topics must be created before deploying functions**.

## Quick Fix

Run the setup script to create required topics:

```bash
# Option 1: Using npm/yarn script (Recommended)
yarn setup:pubsub

# Option 2: Run script directly
node scripts/setup-pubsub.js

# Option 3: Using bash script (Linux/Mac)
./scripts/setup-pubsub.sh
```

## Manual Setup

If scripts don't work, create topics manually:

```bash
# Get your project ID first
firebase projects:list

# Create topics
gcloud pubsub topics create product-import --project=YOUR_PROJECT_ID
gcloud pubsub topics create tracking-import --project=YOUR_PROJECT_ID
```

## Full Deployment Workflow

```bash
# 1. Setup PubSub topics (first time only)
yarn setup:pubsub

# 2. Deploy everything
yarn deploy

# Or use the combined command
yarn deploy:full
```

## Required Topics

This project uses the following PubSub topics:

1. **product-import** - For background product import processing
   - Triggered when CSV files are uploaded
   - Processes product data in batches
   - Updates import status in Firestore

2. **tracking-import** - For background tracking number import
   - Triggered when Excel files are uploaded
   - Updates Shopify orders with tracking info
   - Tracks import progress in Firestore

## Verification

After setup, verify topics exist:

```bash
# List all topics
gcloud pubsub topics list --project=YOUR_PROJECT_ID

# Should show:
# - projects/YOUR_PROJECT_ID/topics/product-import
# - projects/YOUR_PROJECT_ID/topics/tracking-import
```

## Troubleshooting

### Error: "gcloud: command not found"

Install Google Cloud SDK:
```bash
# Mac
brew install google-cloud-sdk

# Or download from:
https://cloud.google.com/sdk/docs/install
```

### Error: "Firebase project not found"

Set your project first:
```bash
firebase use <project-id>
```

### Error: "Permission denied"

Make scripts executable:
```bash
chmod +x scripts/setup-pubsub.sh
chmod +x scripts/setup-pubsub.js
```

### Topics already exist

If topics already exist, the script will skip them. This is safe and expected.

## Architecture

```
User uploads file → Firebase Function
                         ↓
                    Validates data
                         ↓
                    Publishes messages to PubSub Topic
                         ↓
                    Background Function processes each message
                         ↓
                    Updates Shopify via API
                         ↓
                    Saves results to Firestore
```

## Notes

- Topics are created **per project**, not per deployment
- Once created, topics persist until manually deleted
- No need to recreate topics on subsequent deployments
- Topics are free (you only pay for messages)

## Next Steps

After setup:
1. ✅ Deploy functions: `yarn deploy`
2. ✅ Test file uploads in the UI
3. ✅ Monitor logs: `yarn logs`
4. ✅ Check PubSub metrics in Firebase Console
