/**
 * One-time script to create the first admin user in Firestore.
 *
 * Usage:
 *   node scripts/createAdmin.mjs <username> <password> [displayName]
 *
 * Example:
 *   node scripts/createAdmin.mjs admin MySecurePass123 "Admin User"
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS env or running in GCP context.
 */
import {initializeApp, cert} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import bcrypt from 'bcryptjs';

const [, , username, password, displayName = 'Administrator'] = process.argv;

if (!username || !password) {
  console.error('Usage: node scripts/createAdmin.mjs <username> <password> [displayName]');
  process.exit(1);
}

initializeApp();
const db = getFirestore();

async function createAdmin() {
  // Check if username already exists
  const existing = await db
    .collection('admin_users')
    .where('username', '==', username)
    .limit(1)
    .get();

  if (!existing.empty) {
    console.error(`User "${username}" already exists (ID: ${existing.docs[0].id})`);
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const docRef = await db.collection('admin_users').add({
    username,
    password: hashedPassword,
    displayName,
    role: 'admin',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  console.log(`Admin user created successfully!`);
  console.log(`  ID: ${docRef.id}`);
  console.log(`  Username: ${username}`);
  console.log(`  Display Name: ${displayName}`);
}

createAdmin().catch(err => {
  console.error('Failed to create admin:', err);
  process.exit(1);
});
