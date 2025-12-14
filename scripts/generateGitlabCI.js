/**
 * GitLab CI Configuration Generator
 *
 * This script generates the .gitlab-ci.yml file dynamically.
 *
 * Usage: node scripts/generateGitlabCI.js
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Docker image for CI/CD
  image: 'registry.gitlab.com/anhnt34/avada-docker-image-cicd:wasm2-node-20-19-5',

  // Yarn version
  yarnVersion: '4.9.1',

  // Firebase project ID (production)
  firebaseProjectId: 'thomas-app-base-template',

  // Production branch name
  productionBranch: 'node-22',

  // Staging environments - add staging numbers here to generate staging jobs
  // Example: [2, 3, 4] will create staging2, staging3, staging4 branches
  stagingNumbers: []
};

// ============================================================================
// TEMPLATES
// ============================================================================

/**
 *
 * @return {string}
 */
function generateHeader() {
  return `image: ${CONFIG.image}

stages: # List of stages for jobs and their order of execution
  - deploy

# Cache modules in between jobs
cache:
  paths:
    - .yarn-cache/
    - packages/*/.yarn-cache/

before_script:
  - corepack enable
  - corepack prepare yarn@${CONFIG.yarnVersion} --activate
  - yarn --version # (optional, for debugging)

`;
}

/**
 * Generate staging job for a given staging number
 *
 * @param {number} num - Staging environment number
 * @return {string}
 */
function generateStagingJob(num) {
  const branchName = `staging${num}`;
  const envName = `staging_${num}`;
  const varPrefix = `STAGING${num}`;
  const envFileVar = `STAGING_${num}_ENV_FILE`;
  const projectId = `\${${varPrefix}_FIREBASE_PROJECT_ID}`;

  return `# Staging environment ${num}
staging_${num}:
  stage: deploy

  environment:
    name: ${envName}

  only:
    - ${branchName}

  except:
    variables:
      - $CI_COMMIT_TITLE =~ /\\[deploy-only]/

  script:
    - yarn install
    - echo VITE_APP_DEPLOYED_BRANCH=$CI_COMMIT_REF_NAME >> packages/assets/.env.production
    - echo "VITE_DEPLOY_TIME=$(TZ='Asia/Ho_Chi_Minh' date +'%Y-%m-%d %H:%M:%S')" >> packages/assets/.env.production
    - echo VITE_DEPLOYED_BY=$GITLAB_USER_NAME >> packages/assets/.env.production
    - echo VITE_SHOPIFY_API_KEY=$${varPrefix}_SHOPIFY_API_KEY >> packages/assets/.env.production
    - echo VITE_FIREBASE_API_KEY=$${varPrefix}_FIREBASE_API_KEY >> packages/assets/.env.production
    - echo VITE_FIREBASE_AUTH_DOMAIN=${projectId}.firebaseapp.com >> packages/assets/.env.production
    - echo VITE_FIREBASE_PROJECT_ID=$${varPrefix}_FIREBASE_PROJECT_ID >> packages/assets/.env.production
    - echo VITE_FIREBASE_STORAGE_BUCKET=${projectId}.firebasestorage.app >> packages/assets/.env.production
    - echo VITE_FIREBASE_APP_ID=$${varPrefix}_FIREBASE_APP_ID >> packages/assets/.env.production
    - echo VITE_FIREBASE_MEASUREMENT_ID=$${varPrefix}_FIREBASE_MEASUREMENT_ID >> packages/assets/.env.production
    - yarn predeploy
    - npm install -g firebase-tools@13.35.1
    - echo $FIREBASE_DEPLOY_KEY
    - echo "$${envFileVar}" >> packages/functions/.env
    - ./node_modules/.bin/firebase use --token $FIREBASE_DEPLOY_KEY ${branchName}
    - ./node_modules/.bin/firebase deploy -m "Pipeline $CI_PIPELINE_ID, build $CI_BUILD_ID" --non-interactive --token $FIREBASE_DEPLOY_KEY --force

`;
}

/**
 *
 * @return {string}
 */
function generateProductionJob() {
  return `# Production environment, deploy a new version for application
# Run only when release a new version with a new tag from Gitlab
production:
  stage: deploy

  environment:
    name: production

  artifacts:
    paths:
      - 'static/'

  only:
    - ${CONFIG.productionBranch}

  except:
    variables:
      - $CI_COMMIT_TITLE =~ /\\[deploy-only]/

  script:
    - yarn install
    - echo VITE_APP_DEPLOYED_BRANCH=$CI_COMMIT_REF_NAME >> packages/assets/.env.production
    - echo "VITE_DEPLOY_TIME=$(TZ='Asia/Ho_Chi_Minh' date +'%Y-%m-%d %H:%M:%S')" >> packages/assets/.env.production
    - echo VITE_DEPLOYED_BY=$GITLAB_USER_NAME >> packages/assets/.env.production
    # Export all variables to /asset/.env.production
    - echo VITE_SHOPIFY_API_KEY=$PROD_SHOPIFY_API_KEY >> packages/assets/.env.production
    - echo VITE_FIREBASE_API_KEY=$PROD_FIREBASE_API_KEY >> packages/assets/.env.production
    - echo VITE_FIREBASE_AUTH_DOMAIN=$PROD_FIREBASE_AUTH_DOMAIN >> packages/assets/.env.production
    - echo VITE_FIREBASE_PROJECT_ID=$PROD_FIREBASE_PROJECT_ID >> packages/assets/.env.production
    - echo VITE_FIREBASE_STORAGE_BUCKET=$PROD_FIREBASE_STORAGE_BUCKET >> packages/assets/.env.production
    - echo VITE_FIREBASE_APP_ID=$PROD_FIREBASE_APP_ID >> packages/assets/.env.production
    - echo VITE_FIREBASE_MEASUREMENT_ID=$PROD_FIREBASE_MEASUREMENT_ID >> packages/assets/.env.production
    - yarn predeploy
    - npm install -g firebase-tools@13.35.1
    - echo $FIREBASE_DEPLOY_KEY
    - echo "$STAGING_ENV_FILE" >> packages/functions/.env
    - ./node_modules/.bin/firebase use --token $FIREBASE_DEPLOY_KEY ${CONFIG.firebaseProjectId}
    - ./node_modules/.bin/firebase deploy -m "Pipeline $CI_PIPELINE_ID, build $CI_BUILD_ID" --non-interactive --token $FIREBASE_DEPLOY_KEY --force
`;
}

// ============================================================================
// MAIN GENERATION LOGIC
// ============================================================================
/**
 *
 * @return {string}
 */
function generateGitlabCI() {
  let content = '';

  content += generateHeader();

  // Generate staging jobs
  for (const num of CONFIG.stagingNumbers) {
    content += generateStagingJob(num);
  }

  // Generate production job
  content += generateProductionJob();

  return content;
}

// ============================================================================
// SCRIPT EXECUTION
// ============================================================================

const outputPath = path.resolve(__dirname, '../.gitlab-ci.yml');
const content = generateGitlabCI();

fs.writeFileSync(outputPath, content, 'utf8');

console.log('Generated .gitlab-ci.yml successfully!');
if (CONFIG.stagingNumbers.length > 0) {
  console.log(`Staging environments: ${CONFIG.stagingNumbers.join(', ')}`);
}
console.log(`Firebase project: ${CONFIG.firebaseProjectId}`);
console.log(`Production branch: ${CONFIG.productionBranch}`);
console.log(`Output: ${outputPath}`);
