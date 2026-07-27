import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const serviceAccountEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (!projectId) {
  console.error("ERROR: NEXT_PUBLIC_FIREBASE_PROJECT_ID is not set in env variables.");
  process.exit(1);
}

// If running in local emulator or if service account credentials are provided
if (process.env.FIRESTORE_EMULATOR_HOST) {
  console.log("Running in Emulator environment...");
  if (getApps().length === 0) {
    initializeApp({
      projectId: projectId,
    });
  }
} else {
  if (!serviceAccountEmail || !privateKey) {
    console.error("ERROR: FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY is missing from .env.local.");
    console.log("Please make sure you have initialized your .env.local file with real Firebase Admin SDK credentials.");
    process.exit(1);
  }
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        clientEmail: serviceAccountEmail,
        privateKey: privateKey,
        projectId: projectId,
      }),
    });
  }
}

const db = getFirestore();
const auth = getAuth();

const seedData = async () => {
  console.log("Starting Firebase Auth and Firestore Seeding...");

  // 1. Create or update test users in Firebase Auth
  const testUsers = [
    {
      uid: 'admin-uid-999',
      phoneNumber: '+919999999999',
      displayName: 'Amit Patel (Admin)',
    },
    {
      uid: 'weaver-uid-888',
      phoneNumber: '+918888888888',
      displayName: 'Ramesh Vankar (Weaver)',
    },
    {
      uid: 'treasurer-uid-777',
      phoneNumber: '+917777777777',
      displayName: 'Meera Devi (Treasurer)',
    }
  ];

  for (const user of testUsers) {
    try {
      // Try fetching the user
      await auth.getUser(user.uid);
      console.log(`User ${user.displayName} (${user.uid}) already exists in Auth. Updating...`);
      await auth.updateUser(user.uid, {
        phoneNumber: user.phoneNumber,
        displayName: user.displayName,
      });
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        console.log(`Creating user ${user.displayName} (${user.uid}) in Auth...`);
        await auth.createUser({
          uid: user.uid,
          phoneNumber: user.phoneNumber,
          displayName: user.displayName,
        });
      } else {
        console.error(`Error processing auth user ${user.uid}:`, error);
      }
    }
  }

  // 2. Seed Cooperatives
  const cooperatives = [
    {
      id: 'coop-kanchipuram',
      name: 'Kanchipuram Silk Cooperative',
      district: 'Kanchipuram',
      language: 'en',
    },
    {
      id: 'coop-varanasi',
      name: 'Varanasi Weavers Cooperative',
      district: 'Varanasi',
      language: 'hi',
    }
  ];

  console.log("Seeding Cooperatives...");
  for (const coop of cooperatives) {
    const { id, ...data } = coop;
    await db.collection('cooperatives').doc(id).set(data, { merge: true });
  }

  // 3. Seed Members
  const members = [
    {
      id: 'admin-uid-999',
      coopId: 'coop-kanchipuram',
      name: 'Amit Patel',
      role: 'admin',
      phone: '+919999999999',
      capacity: 0,
    },
    {
      id: 'weaver-uid-888',
      coopId: 'coop-kanchipuram',
      name: 'Ramesh Vankar',
      role: 'weaver',
      phone: '+918888888888',
      capacity: 10,
    },
    {
      id: 'treasurer-uid-777',
      coopId: 'coop-kanchipuram',
      name: 'Meera Devi',
      role: 'treasurer',
      phone: '+917777777777',
      capacity: 0,
    },
    {
      id: 'weaver-uid-101',
      coopId: 'coop-kanchipuram',
      name: 'Deepika Das',
      role: 'weaver',
      phone: '+918888888001',
      capacity: 8,
    },
    {
      id: 'weaver-uid-102',
      coopId: 'coop-kanchipuram',
      name: 'Rajesh M.',
      role: 'weaver',
      phone: '+918888888002',
      capacity: 5,
    }
  ];

  console.log("Seeding Members...");
  for (const member of members) {
    const { id, ...data } = member;
    await db.collection('members').doc(id).set(data, { merge: true });
  }

  // 4. Seed Orders, Responses, Allocations, Progress, and Payments
  console.log("Seeding Orders...");

  // Order 1: Pending Review (Screen 1)
  const order1 = {
    id: 'order-8922',
    coopId: 'coop-kanchipuram',
    buyerName: 'Ethnic Threads',
    item: '100% Mulberry Silk Saree',
    quantity: 50,
    price: 75000,
    deadline: '2026-10-15',
    status: 'pending_review',
    createdAt: FieldValue.serverTimestamp(),
    enteredBy: 'Amit Patel (Admin)',
    enteredAt: new Date('2026-07-24T09:30:00Z'),
  };
  await db.collection('orders').doc(order1.id).set(order1, { merge: true });

  // Responses for Order 1
  const responsesOrder1 = [
    { memberId: 'weaver-uid-888', response: 'agree', note: 'Looks good warp is ready', timestamp: new Date() },
    { memberId: 'weaver-uid-101', response: 'concern', note: 'Dye supply for indigo warp is delayed', timestamp: new Date() },
    { memberId: 'weaver-uid-102', response: 'reject', note: 'Pricing does not cover the intricate zari work', timestamp: new Date() }
  ];
  for (const resp of responsesOrder1) {
    await db.collection('orders').doc(order1.id)
      .collection('responses').doc(resp.memberId).set(resp, { merge: true });
  }

  // Order 2: In Production / Work Allocation (Screen 5 & 6)
  const order2 = {
    id: 'order-4421',
    coopId: 'coop-kanchipuram',
    buyerName: 'Spring Jamdani Batch #402',
    item: 'Jamdani Silk Saree',
    quantity: 45,
    price: 67500,
    deadline: '2026-11-22',
    status: 'confirmed',
    createdAt: FieldValue.serverTimestamp(),
    enteredBy: 'Amit Patel (Admin)',
    enteredAt: new Date('2026-07-20T14:15:00Z'),
  };
  await db.collection('orders').doc(order2.id).set(order2, { merge: true });

  // Allocations for Order 2
  const allocationsOrder2 = [
    { memberId: 'weaver-uid-888', assignedQuantity: 12 },
    { memberId: 'weaver-uid-101', assignedQuantity: 18 },
    { memberId: 'weaver-uid-102', assignedQuantity: 15 }
  ];
  for (const alloc of allocationsOrder2) {
    await db.collection('orders').doc(order2.id)
      .collection('allocations').doc(alloc.memberId).set(alloc, { merge: true });
  }

  // Progress for Order 2
  const progressOrder2 = [
    { memberId: 'weaver-uid-888', percentComplete: 33.3, unitsCompleted: 4, timestamp: new Date() },
    { memberId: 'weaver-uid-101', percentComplete: 20, unitsCompleted: 3.6, timestamp: new Date() },
    { memberId: 'weaver-uid-102', percentComplete: 85, unitsCompleted: 12.75, timestamp: new Date() }
  ];
  for (const prog of progressOrder2) {
    await db.collection('orders').doc(order2.id)
      .collection('progress').doc(prog.memberId).set(prog, { merge: true });
  }

  // Payments for Order 2
  const paymentsOrder2 = [
    { memberId: 'weaver-uid-888', amountOwed: 18000, status: 'pending', expectedDate: '2026-11-30' },
    { memberId: 'weaver-uid-101', amountOwed: 27000, status: 'pending', expectedDate: '2026-11-30' },
    { memberId: 'weaver-uid-102', amountOwed: 22500, status: 'paid', expectedDate: '2026-11-30' }
  ];
  for (const pay of paymentsOrder2) {
    await db.collection('orders').doc(order2.id)
      .collection('payments').doc(pay.memberId).set(pay, { merge: true });
  }

  // Seed chat messages for Kanchipuram Cooperative (Screen 3)
  console.log("Seeding chat messages...");
  const chatMessages = [
    {
      senderId: 'admin-uid-999',
      senderName: 'Amit Patel (Admin)',
      messageText: 'Can everyone confirm the new yardage requirement for the Blue Silk lot? We need an extra 5 meters each.',
      isAudio: false,
      timestamp: new Date(Date.now() - 3600000)
    },
    {
      senderId: 'weaver-uid-888',
      senderName: 'Ramesh Vankar',
      messageText: '[Voice Note 0:14]',
      isAudio: true,
      audioDuration: '0:14',
      timestamp: new Date(Date.now() - 1800000)
    },
    {
      senderId: 'weaver-uid-101',
      senderName: 'Deepika Das',
      messageText: 'I agree. The warp density allows for it. 👍',
      isAudio: false,
      timestamp: new Date(Date.now() - 600000)
    }
  ];

  for (const msg of chatMessages) {
    await db.collection('cooperatives').doc('coop-kanchipuram')
      .collection('messages').add(msg);
  }

  console.log("Firebase Auth and Firestore Seeding completed successfully!");
};

seedData().catch(err => {
  console.error("Seeding failed with error:", err);
  process.exit(1);
});
