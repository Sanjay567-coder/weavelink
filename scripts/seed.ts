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
    },
    {
      uid: 'admin-uid-silk-b',
      phoneNumber: '+919999999998',
      displayName: 'Balaji S. (Admin B)',
    },
    {
      uid: 'admin-uid-arani',
      phoneNumber: '+919999999997',
      displayName: 'Srinivas R. (Admin Arani)',
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
      availableForPooling: true,
      materials: [
        { item: 'Silk Saree Threads', targetAmount: '150kg', savings: '₹9,500' }
      ],
      weaversCount: 18,
      distance: '0km (Own)'
    },
    {
      id: 'coop-varanasi',
      name: 'Varanasi Weavers Cooperative',
      district: 'Varanasi',
      language: 'hi',
      availableForPooling: false,
      materials: [
        { item: 'Zari Border Threads', targetAmount: '80kg', savings: '₹14,000' }
      ],
      weaversCount: 15,
      distance: '800km'
    },
    {
      id: 'coop-silk-b',
      name: 'Silk Weaver Coop B',
      district: 'Kanchipuram B',
      language: 'en',
      availableForPooling: true,
      materials: [
        { item: 'Mulberry Silk Yarn', targetAmount: '250kg', savings: '₹12,500' },
        { item: 'Natural Indigo Dye', targetAmount: '50L', savings: '₹3,200' }
      ],
      weaversCount: 12,
      distance: '5km'
    },
    {
      id: 'coop-arani',
      name: 'Arani Master Weavers',
      district: 'Arani',
      language: 'en',
      availableForPooling: false,
      materials: [
        { item: 'Fine Zari Thread', targetAmount: '40kg', savings: '₹8,200' }
      ],
      weaversCount: 8,
      distance: '12km'
    },
    {
      id: 'coop-handlooms',
      name: 'Kanchipuram Handlooms Association',
      district: 'Kanchipuram',
      language: 'en',
      availableForPooling: true,
      materials: [
        { item: 'Fine Zari Thread', targetAmount: '60kg', savings: '₹11,000' }
      ],
      weaversCount: 15,
      distance: '3km'
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
    },
    {
      id: 'admin-uid-silk-b',
      coopId: 'coop-silk-b',
      name: 'Balaji S.',
      role: 'admin',
      phone: '+919999999998',
      capacity: 0,
    },
    {
      id: 'admin-uid-arani',
      coopId: 'coop-arani',
      name: 'Srinivas R.',
      role: 'admin',
      phone: '+919999999997',
      capacity: 0,
    },
    {
      id: 'weaver-uid-105',
      coopId: '',
      name: 'Kavitha Murugan',
      role: 'weaver',
      phone: '+918888888005',
      capacity: 6,
    },
    {
      id: 'weaver-uid-106',
      coopId: '',
      name: 'Anbu Selvan',
      role: 'weaver',
      phone: '+918888888006',
      capacity: 4,
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
    { memberId: 'weaver-uid-888', response: 'agree', note: 'Looks good, warp is ready', timestamp: new Date() },
    { memberId: 'weaver-uid-101', response: 'concern', note: 'The raw silk yarn price has gone up. Can we verify raw material cost?', timestamp: new Date() },
    { memberId: 'weaver-uid-102', response: 'reject', note: 'My loom capacity is already full with the local Kanchipuram bridal order.', timestamp: new Date() }
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
  console.log("Clearing old chat messages...");
  const msgSnap = await db.collection('cooperatives').doc('coop-kanchipuram')
    .collection('messages').get();
  const deleteBatch = db.batch();
  msgSnap.forEach((docSnap) => {
    deleteBatch.delete(docSnap.ref);
  });
  await deleteBatch.commit();

  console.log("Seeding realistic chat messages...");
  const chatMessages = [
    {
      senderId: 'admin-uid-999',
      senderName: 'Amit Patel (Admin)',
      messageText: 'Namaste weavers! I have posted the details for the new Ethnic Threads order (Order #8922). Can everyone review material costs and capacity?',
      isAudio: false,
      timestamp: new Date(Date.now() - 14400000) // 4 hours ago
    },
    {
      senderId: 'weaver-uid-888',
      senderName: 'Ramesh Vankar',
      messageText: 'I checked the warp count for the Zari border. It looks good and my loom is free. I am casting my vote to agree.',
      isAudio: false,
      timestamp: new Date(Date.now() - 10800000) // 3 hours ago
    },
    {
      senderId: 'system',
      senderName: 'System Log',
      messageText: 'Ramesh Vankar responded: I AGREE',
      isAudio: false,
      timestamp: new Date(Date.now() - 10750000)
    },
    {
      senderId: 'weaver-uid-101',
      senderName: 'Deepika Das',
      messageText: 'The raw silk yarn price from our local vendor has gone up this week. Can we double check if our margins are safe for raw material costs?',
      isAudio: false,
      timestamp: new Date(Date.now() - 7200000) // 2 hours ago
    },
    {
      senderId: 'system',
      senderName: 'System Log',
      messageText: 'Deepika Das raised a concern: The raw silk yarn price has gone up. Can we verify raw material cost?',
      isAudio: false,
      timestamp: new Date(Date.now() - 7150000)
    },
    {
      senderId: 'weaver-uid-102',
      senderName: 'Rajesh M.',
      messageText: 'I would love to participate, but my loom capacity is already full with the local Kanchipuram bridal order. I will pass on this one.',
      isAudio: false,
      timestamp: new Date(Date.now() - 3600000) // 1 hour ago
    },
    {
      senderId: 'system',
      senderName: 'System Log',
      messageText: "Rajesh M. responded: CAN'T DO IT — My loom capacity is already full with the local Kanchipuram bridal order.",
      isAudio: false,
      timestamp: new Date(Date.now() - 3550000)
    }
  ];

  for (const msg of chatMessages) {
    await db.collection('cooperatives').doc('coop-kanchipuram')
      .collection('messages').add(msg);
  }

  console.log("Clearing old pooling requests...");
  const poolSnap = await db.collection('poolingRequests').get();
  for (const doc of poolSnap.docs) {
    await doc.ref.delete();
  }

  console.log("Seeding pooling requests...");
  const initialPoolRequests = [
    {
      id: 'pool-req-1',
      fromCoopId: 'coop-kanchipuram',
      toCoopId: 'coop-varanasi',
      status: 'pending',
      createdAt: new Date(),
      item: 'Fine Zari Thread',
      targetAmount: '40kg',
      savings: '₹8,200'
    },
    {
      id: 'pool-req-2',
      fromCoopId: 'coop-handlooms',
      toCoopId: 'coop-kanchipuram',
      status: 'pending',
      createdAt: new Date(),
      item: 'Fine Zari Thread',
      targetAmount: '60kg',
      savings: '₹11,000'
    },
    {
      id: 'pool-req-3',
      fromCoopId: 'coop-arani',
      toCoopId: 'coop-kanchipuram',
      status: 'accepted',
      createdAt: new Date(),
      item: 'Raw Dye Vat Chemicals',
      targetAmount: '500L',
      savings: '₹15,000'
    }
  ];
  for (const req of initialPoolRequests) {
    const { id, ...data } = req;
    await db.collection('poolingRequests').doc(id).set(data);
  }

  console.log("Firebase Auth and Firestore Seeding completed successfully!");
};

seedData().catch(err => {
  console.error("Seeding failed with error:", err);
  process.exit(1);
});
