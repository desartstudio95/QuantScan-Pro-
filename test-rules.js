import { readFileSync } from 'fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';

async function main() {
  const projectId = `test-project-${Date.now()}`;
  const testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });

  const alice = testEnv.authenticatedContext('alice', { email: 'alice@example.com' });
  const db = alice.firestore();

  // Test signals query
  const signalsRef = db.collection('signals');
  const q = signalsRef.where('userId', '==', 'alice');
  
  try {
    await assertSucceeds(q.get());
    console.log("SUCCESS: signals query passed");
  } catch (err) {
    console.error("FAILED: signals query failed", err);
  }

  // Next, let's try users list
  try {
    await assertFails(db.collection('users').get());
    console.log("SUCCESS: non-admin users list correctly denied");
  } catch(err) {
    console.error("FAILED: non-admin users list passed or threw error we didn't expect", err);
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
