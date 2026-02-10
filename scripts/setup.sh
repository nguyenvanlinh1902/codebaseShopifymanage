#!/usr/bin/env bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  ToolTrackingOrder - Setup & Validation    ${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

ERRORS=0
WARNINGS=0

success() { echo -e "  ${GREEN}[OK]${NC} $1"; }
error()   { echo -e "  ${RED}[ERROR]${NC} $1"; ERRORS=$((ERRORS + 1)); }
warn()    { echo -e "  ${YELLOW}[WARN]${NC} $1"; WARNINGS=$((WARNINGS + 1)); }
info()    { echo -e "  ${BLUE}[INFO]${NC} $1"; }

# ============ 1. Check Prerequisites ============
echo -e "${YELLOW}1. Checking prerequisites...${NC}"

# Node.js
if command -v node &>/dev/null; then
  NODE_VERSION=$(node -v)
  success "Node.js $NODE_VERSION"
  # Check Node 20+
  NODE_MAJOR=$(echo "$NODE_VERSION" | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_MAJOR" -lt 20 ]; then
    error "Node.js 20+ required (current: $NODE_VERSION)"
  fi
else
  error "Node.js not installed. Install from https://nodejs.org/"
fi

# Yarn
if command -v yarn &>/dev/null; then
  YARN_VERSION=$(yarn --version)
  success "Yarn $YARN_VERSION"
else
  error "Yarn not installed. Run: npm install -g yarn"
fi

# Firebase CLI
if command -v firebase &>/dev/null || [ -f "$PROJECT_DIR/node_modules/.bin/firebase" ]; then
  if command -v firebase &>/dev/null; then
    FB_VERSION=$(firebase --version)
  else
    FB_VERSION=$("$PROJECT_DIR/node_modules/.bin/firebase" --version)
  fi
  success "Firebase CLI $FB_VERSION"
else
  error "Firebase CLI not installed. Run: yarn add -D firebase-tools"
fi

# gcloud (optional but recommended)
if command -v gcloud &>/dev/null; then
  GCLOUD_VERSION=$(gcloud --version 2>/dev/null | head -1)
  success "Google Cloud SDK ($GCLOUD_VERSION)"
else
  warn "gcloud CLI not installed. Required for PubSub setup."
  info "Install: https://cloud.google.com/sdk/docs/install"
fi

echo ""

# ============ 2. Check Firebase Project ============
echo -e "${YELLOW}2. Checking Firebase project...${NC}"

if [ -f "$PROJECT_DIR/.firebaserc" ]; then
  PROJECT_ID=$(cat "$PROJECT_DIR/.firebaserc" | grep -o '"default": "[^"]*"' | cut -d'"' -f4)
  if [ -n "$PROJECT_ID" ]; then
    success "Firebase project: $PROJECT_ID"
  else
    error ".firebaserc exists but no default project set"
  fi
else
  error ".firebaserc not found. Run: firebase use --add"
fi

# Check firebase.json
if [ -f "$PROJECT_DIR/firebase.json" ]; then
  success "firebase.json exists"
else
  error "firebase.json not found"
fi

# Check firestore.rules
if [ -f "$PROJECT_DIR/firestore.rules" ]; then
  success "firestore.rules exists"
else
  warn "firestore.rules not found"
fi

# Check firestore.indexes.json
if [ -f "$PROJECT_DIR/firestore.indexes.json" ]; then
  success "firestore.indexes.json exists"
else
  warn "firestore.indexes.json not found (indexes won't deploy)"
fi

echo ""

# ============ 3. Check Environment Variables ============
echo -e "${YELLOW}3. Checking environment variables...${NC}"

# Backend .env
FUNCTIONS_ENV="$PROJECT_DIR/packages/functions/.env"
if [ -f "$FUNCTIONS_ENV" ]; then
  success "Backend .env exists"

  # Check required vars
  check_env_var() {
    local file=$1
    local var=$2
    local label=$3
    if grep -q "^${var}=" "$file" && ! grep -q "^${var}=$" "$file" && ! grep -q "^${var}=your_" "$file"; then
      success "$label ($var)"
    else
      error "$label ($var) not set in $(basename $(dirname $file))/.env"
    fi
  }

  check_env_var "$FUNCTIONS_ENV" "SHOPIFY_API_KEY" "Shopify API Key"
  check_env_var "$FUNCTIONS_ENV" "SHOPIFY_API_SECRET" "Shopify API Secret"
  check_env_var "$FUNCTIONS_ENV" "GOOGLE_CLIENT_ID" "Google Client ID"
  check_env_var "$FUNCTIONS_ENV" "GOOGLE_CLIENT_SECRET" "Google Client Secret"
  check_env_var "$FUNCTIONS_ENV" "JWT_SECRET" "JWT Secret"
  check_env_var "$FUNCTIONS_ENV" "FUNCTION_URL" "Function URL"
  check_env_var "$FUNCTIONS_ENV" "APP_URL" "App URL"

  # Check GOOGLE_REDIRECT_URI for production
  if grep -q "localhost" "$FUNCTIONS_ENV" 2>/dev/null; then
    REDIRECT_URI=$(grep "^GOOGLE_REDIRECT_URI=" "$FUNCTIONS_ENV" | cut -d= -f2-)
    if echo "$REDIRECT_URI" | grep -q "localhost"; then
      warn "GOOGLE_REDIRECT_URI still points to localhost: $REDIRECT_URI"
      info "Update to production URL before deploying"
    fi
  fi
else
  error "Backend .env not found!"
  info "Copy from template: cp packages/functions/.env.example packages/functions/.env"
fi

# Frontend .env
ASSETS_ENV="$PROJECT_DIR/packages/assets/.env"
if [ -f "$ASSETS_ENV" ]; then
  success "Frontend .env exists"
  check_env_var "$ASSETS_ENV" "VITE_FIREBASE_API_KEY" "Firebase API Key"
  check_env_var "$ASSETS_ENV" "VITE_FIREBASE_PROJECT_ID" "Firebase Project ID"
  check_env_var "$ASSETS_ENV" "VITE_FIREBASE_APP_ID" "Firebase App ID"
else
  error "Frontend .env not found!"
  info "Copy from template: cp packages/assets/.env.example packages/assets/.env"
fi

echo ""

# ============ 4. Check Dependencies ============
echo -e "${YELLOW}4. Checking dependencies...${NC}"

if [ -d "$PROJECT_DIR/node_modules" ]; then
  success "Root node_modules exists"
else
  warn "Root node_modules missing. Run: yarn install"
fi

if [ -d "$PROJECT_DIR/packages/functions/node_modules" ]; then
  success "Functions node_modules exists"
else
  warn "Functions node_modules missing. Run: yarn install"
fi

if [ -d "$PROJECT_DIR/packages/assets/node_modules" ]; then
  success "Assets node_modules exists"
else
  warn "Assets node_modules missing. Run: yarn install"
fi

echo ""

# ============ 5. Check Build Output ============
echo -e "${YELLOW}5. Checking build artifacts...${NC}"

# Check static directory (frontend build output)
if [ -d "$PROJECT_DIR/static" ]; then
  if [ -f "$PROJECT_DIR/static/embed.html" ]; then
    success "Frontend embed build exists (static/embed.html)"
  else
    warn "static/embed.html not found. Run: yarn workspace @linhnv/assets run production"
  fi
  if [ -f "$PROJECT_DIR/static/index.html" ]; then
    success "Frontend standalone build exists (static/index.html)"
  else
    warn "static/index.html not found. Run: yarn workspace @linhnv/assets run production"
  fi
else
  warn "static/ directory not found. Frontend not built yet."
fi

# Check functions lib directory
if [ -d "$PROJECT_DIR/packages/functions/lib" ]; then
  if [ -f "$PROJECT_DIR/packages/functions/lib/index.js" ]; then
    success "Backend build exists (lib/index.js)"
  else
    warn "lib/index.js not found. Run: yarn workspace @linhnv/functions run production"
  fi
else
  warn "packages/functions/lib/ not found. Backend not built yet."
fi

echo ""

# ============ 6. Check Shopify Config ============
echo -e "${YELLOW}6. Checking Shopify app config...${NC}"

SHOPIFY_TOML="$PROJECT_DIR/shopify.app.toml"
if [ -f "$SHOPIFY_TOML" ]; then
  success "shopify.app.toml exists"
  APP_URL=$(grep "^application_url" "$SHOPIFY_TOML" | cut -d'"' -f2)
  if [ -n "$APP_URL" ]; then
    success "Application URL: $APP_URL"
  else
    warn "application_url not set in shopify.app.toml"
  fi
  CLIENT_ID=$(grep "^client_id" "$SHOPIFY_TOML" | cut -d'"' -f2)
  if [ -n "$CLIENT_ID" ]; then
    success "Client ID configured"
  else
    error "client_id not set in shopify.app.toml"
  fi
else
  error "shopify.app.toml not found"
fi

echo ""

# ============ Summary ============
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Summary                                   ${NC}"
echo -e "${BLUE}============================================${NC}"
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "  ${GREEN}All checks passed! Ready to deploy.${NC}"
elif [ $ERRORS -eq 0 ]; then
  echo -e "  ${YELLOW}$WARNINGS warning(s) found. Review above.${NC}"
  echo -e "  ${GREEN}No blocking errors. Can proceed with deploy.${NC}"
else
  echo -e "  ${RED}$ERRORS error(s) and $WARNINGS warning(s) found.${NC}"
  echo -e "  ${RED}Fix errors before deploying.${NC}"
fi

echo ""
echo -e "${BLUE}Quick commands:${NC}"
echo "  yarn install          # Install all dependencies"
echo "  yarn setup:pubsub     # Create PubSub topics (first time)"
echo "  yarn build            # Build frontend + backend"
echo "  yarn deploy           # Deploy to Firebase"
echo "  yarn deploy:full      # Setup PubSub + Deploy"
echo ""

exit $ERRORS
