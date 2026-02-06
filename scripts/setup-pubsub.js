#!/usr/bin/env node

/**
 * Setup PubSub Topics for Shopify Integration
 * Creates required PubSub topics before function deployment
 */

const {execSync} = require('child_process');
const fs = require('fs');
const path = require('path');

const TOPICS = ['product-import', 'tracking-import'];

/**
 * 
 * @returns {*|null}
 */
function getProjectId() {
  try {
    // Try to get from .firebaserc
    const firebaseRcPath = path.join(__dirname, '..', '.firebaserc');
    if (fs.existsSync(firebaseRcPath)) {
      const firebaseRc = JSON.parse(fs.readFileSync(firebaseRcPath, 'utf8'));
      return firebaseRc.projects?.default;
    }

    // Fallback to firebase CLI
    const output = execSync('firebase projects:list --json', {encoding: 'utf8'});
    const projects = JSON.parse(output);
    const currentProject = projects.result.find(p => p.current);
    return currentProject?.projectId;
  } catch (error) {
    return null;
  }
}

function topicExists(projectId, topicName) {
  try {
    execSync(`gcloud pubsub topics describe ${topicName} --project=${projectId}`, {
      stdio: 'ignore'
    });
    return true;
  } catch {
    return false;
  }
}

function createTopic(projectId, topicName) {
  try {
    execSync(`gcloud pubsub topics create ${topicName} --project=${projectId}`, {
      stdio: 'ignore'
    });
    return true;
  } catch (error) {
    console.error(`❌ Failed to create topic ${topicName}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Setting up PubSub topics...\n');

  // Get project ID
  const projectId = getProjectId();
  if (!projectId) {
    console.error('❌ Error: No Firebase project found.');
    console.error('   Run: firebase use <project-id>');
    process.exit(1);
  }

  console.log(`📦 Project: ${projectId}\n`);

  // Create topics
  let created = 0;
  let existing = 0;

  for (const topicName of TOPICS) {
    process.stdout.write(`Creating topic: ${topicName}... `);

    if (topicExists(projectId, topicName)) {
      console.log('ℹ️  Already exists');
      existing++;
    } else {
      if (createTopic(projectId, topicName)) {
        console.log('✅ Created');
        created++;
      } else {
        console.log('❌ Failed');
      }
    }
  }

  console.log('\n✨ PubSub setup complete!');
  console.log('📝 Summary:');
  console.log(`   - Created: ${created} topic(s)`);
  console.log(`   - Already exists: ${existing} topic(s)`);
  console.log('\n📋 Available topics:');
  TOPICS.forEach(topic => console.log(`   - ${topic}`));
  console.log('\n🚀 Next steps:');
  console.log('   1. Deploy functions: firebase deploy --only functions');
  console.log('   2. Or deploy all: firebase deploy');
}

main().catch(error => {
  console.error('❌ Setup failed:', error.message);
  process.exit(1);
});
