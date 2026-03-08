/**
 * Seed script: create initial admin user in Firestore.
 * Run once: node packages/functions/src/scripts/seed-admin-user.js
 *
 * Requires FIRESTORE_EMULATOR_HOST or GOOGLE_APPLICATION_CREDENTIALS env vars.
 * Default credentials: admin / admin@2024 (change immediately after first login)
 */
import bcrypt from 'bcryptjs';
import {initializeApp, getApps} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

async function seedAdmin() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin@2024';

  const existing = await db.collection('admin_users')
    .where('username', '==', username)
    .limit(1)
    .get();

  if (!existing.empty) {
    console.log(`Admin user "${username}" already exists. Skipping.`);
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const docRef = await db.collection('admin_users').add({
    username,
    password: hashedPassword,
    displayName: 'Admin',
    role: 'admin',
    assignedStores: [],
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  console.log(`Admin user created: id=${docRef.id}, username=${username}`);
  console.log('IMPORTANT: Change the default password after first login!');
}

seedAdmin().catch(console.error);
