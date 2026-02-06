#!/bin/bash

# Setup PubSub Topics for Shopify Integration
# Run this before deploying functions

echo "🚀 Setting up PubSub topics..."

# Get Firebase project ID
PROJECT_ID=$(firebase projects:list | grep "(current)" | awk '{print $1}')

if [ -z "$PROJECT_ID" ]; then
  echo "❌ Error: No Firebase project found. Run 'firebase use <project-id>' first."
  exit 1
fi

echo "📦 Project: $PROJECT_ID"

# Create product-import topic
echo "Creating topic: product-import..."
if gcloud pubsub topics create product-import --project=$PROJECT_ID 2>/dev/null; then
  echo "✅ Created topic: product-import"
else
  echo "ℹ️  Topic product-import already exists"
fi

# Create tracking-import topic
echo "Creating topic: tracking-import..."
if gcloud pubsub topics create tracking-import --project=$PROJECT_ID 2>/dev/null; then
  echo "✅ Created topic: tracking-import"
else
  echo "ℹ️  Topic tracking-import already exists"
fi

echo ""
echo "✨ PubSub setup complete!"
echo "📝 Topics created:"
echo "   - product-import"
echo "   - tracking-import"
echo ""
echo "Next steps:"
echo "1. Deploy functions: firebase deploy --only functions"
echo "2. Or deploy all: firebase deploy"
