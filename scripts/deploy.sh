#!/usr/bin/env bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FIREBASE="$PROJECT_DIR/node_modules/.bin/firebase"

# Parse arguments
DEPLOY_TARGET="${1:-all}" # all | functions | hosting | firestore | only-build
SKIP_BUILD="${SKIP_BUILD:-false}"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  ToolTrackingOrder - Deploy                ${NC}"
echo -e "${BLUE}============================================${NC}"
echo -e "  Target: ${YELLOW}$DEPLOY_TARGET${NC}"
echo ""

cd "$PROJECT_DIR"

# ============ Pre-flight Check ============
echo -e "${YELLOW}[1/5] Pre-flight check...${NC}"

# Run setup validation (non-blocking)
bash "$SCRIPT_DIR/setup.sh" || {
  echo ""
  echo -e "${RED}Setup validation failed. Fix errors above before deploying.${NC}"
  echo -e "Run: ${YELLOW}yarn setup${NC} to see details."
  exit 1
}

echo ""

# ============ Install Dependencies ============
echo -e "${YELLOW}[2/5] Installing dependencies...${NC}"
yarn install --frozen-lockfile 2>/dev/null || yarn install
echo -e "${GREEN}Dependencies installed.${NC}"
echo ""

# ============ Setup PubSub Topics ============
echo -e "${YELLOW}[3/5] Setting up PubSub topics...${NC}"
if command -v gcloud &>/dev/null; then
  node "$SCRIPT_DIR/setup-pubsub.js" || {
    echo -e "${YELLOW}PubSub setup skipped (topics may already exist).${NC}"
  }
else
  echo -e "${YELLOW}Skipped: gcloud CLI not available.${NC}"
  echo -e "  If PubSub functions fail, install gcloud and run: yarn setup:pubsub"
fi
echo ""

# ============ Build ============
if [ "$SKIP_BUILD" = "false" ]; then
  echo -e "${YELLOW}[4/5] Building...${NC}"

  case "$DEPLOY_TARGET" in
    functions)
      echo "  Building backend..."
      yarn workspace @linhnv/functions run production
      ;;
    hosting)
      echo "  Building frontend..."
      yarn workspace @linhnv/assets run production
      ;;
    *)
      echo "  Building frontend..."
      yarn workspace @linhnv/assets run production
      echo "  Building backend..."
      yarn workspace @linhnv/functions run production
      ;;
  esac

  echo -e "${GREEN}Build completed.${NC}"
else
  echo -e "${YELLOW}[4/5] Build skipped (SKIP_BUILD=true).${NC}"
fi
echo ""

# ============ Deploy ============
echo -e "${YELLOW}[5/5] Deploying to Firebase...${NC}"

case "$DEPLOY_TARGET" in
  functions)
    echo "  Deploying functions only..."
    $FIREBASE deploy --only functions
    ;;
  hosting)
    echo "  Deploying hosting only..."
    $FIREBASE deploy --only hosting
    ;;
  firestore)
    echo "  Deploying Firestore rules & indexes..."
    $FIREBASE deploy --only firestore
    ;;
  only-build)
    echo -e "${GREEN}Build-only mode. Skipping Firebase deploy.${NC}"
    ;;
  *)
    echo "  Deploying everything (hosting + functions + firestore)..."
    $FIREBASE deploy
    ;;
esac

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Deploy completed!                         ${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""

# Show deployed URLs
PROJECT_ID=$(cat "$PROJECT_DIR/.firebaserc" | grep -o '"default": "[^"]*"' | cut -d'"' -f4)
if [ -n "$PROJECT_ID" ]; then
  echo -e "${BLUE}Deployed URLs:${NC}"
  echo "  Hosting:   https://${PROJECT_ID}.web.app"
  echo "  Functions: https://us-central1-${PROJECT_ID}.cloudfunctions.net/api"
  echo ""
  echo -e "${BLUE}Useful commands:${NC}"
  echo "  yarn logs              # View function logs"
  echo "  firebase open hosting  # Open hosting URL"
  echo "  firebase open console  # Open Firebase Console"
fi
echo ""
