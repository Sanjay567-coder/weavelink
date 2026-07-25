# WeaveLink

WeaveLink is a mobile-first Progressive Web App (PWA) designed for handloom weaving cooperatives in India, bridging the gap between traditional craftsmanship and modern cooperative commerce.

## Technology Stack
- **Framework**: Next.js 14+ (App Router), TypeScript
- **Styling**: Tailwind CSS (customized with the Artisanal Digital Coop design tokens)
- **Icons & Fonts**: IBM Plex Sans, Material Symbols Outlined
- **Database/Auth**: Firebase Firestore (Offline Persistence) & Phone Auth
- **PWA**: PWA configuration using `@ducanh2912/next-pwa`
- **i18n**: Multi-language support (English/Hindi) via `next-intl`
- **Charts**: Recharts (for District Price Benchmarking)

---

## Getting Started

### 1. Prerequisites
- Node.js v18 or later
- Firebase project set up

### 2. Local Setup

Clone the project and install dependencies:
```bash
npm install
```

### 3. Firebase & Environment Configuration
Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-auth-domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-storage-bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

# Firebase Admin SDK credentials (used for seeding)
FIREBASE_CLIENT_EMAIL=your-firebase-client-email
FIREBASE_PRIVATE_KEY="your-firebase-private-key"
```

### 4. Database Seeding & Test Accounts
To seed your Firebase project with initial cooperatives, weaver accounts, allocations, and orders, run the seed script:
```bash
npm run seed
```

#### Verification/Test Phone Numbers
The seeding script registers specific test accounts in Auth using deterministic UIDs. To test the real Phone Auth sign-in path without SMS costs, add these test numbers in your **Firebase Console > Authentication > Sign-in method > Phone > Phone numbers for testing**:
* **Admin Account**: `+919999999999` (Verification Code: `123456`)
* **Weaver Account**: `+918888888888` (Verification Code: `123456`)
* **Treasurer Account**: `+917777777777` (Verification Code: `123456`)

---

## Commands
- Run development server: `npm run dev`
- Build production version: `npm run build`
- Start built production version: `npm run start`
