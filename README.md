# WeaveLink

WeaveLink is a mobile-first Progressive Web App (PWA) designed for handloom weaving cooperatives in India, bridging the gap between traditional craftsmanship and modern cooperative commerce.

## Technology Stack
- **Framework**: Next.js (App Router), TypeScript
- **Styling**: Vanilla CSS with Artisanal Digital Coop theme tokens & Tailwind CSS
- **Icons & Fonts**: Outfit, IBM Plex Sans, Material Symbols Outlined
- **Database/Auth**: Firebase Firestore (Offline Persistence) & Phone Auth
- **PWA**: PWA configuration using `@ducanh2912/next-pwa`
- **i18n**: Multi-language support (English/Hindi/Tamil) via `next-intl`
- **Charts**: Recharts (for District Price Benchmarking)

---

## Key Features Built

1. **Multi-Role Dashboards**: Adaptive views for Admin (quote reviewing, pooling), Weaver (loom tracking, chat), and Treasurer (disbursements pool).
2. **Direct Member Addition & Toggle**: Segmented form allowing Admins to add a brand-new member directly (fields: Name, Phone, Age, Experience, Specialization, Village/Area) or search and claim existing unassigned candidates.
3. **SMS Profile Self-Migration**: Transaction-safe profile self-migration. Newly registered weavers logging in with Phone Auth automatically claim their Admin-created profile document via telephone mapping in a single atomic database batch transaction.
4. **Group Chat Consensus & Structured Systems**: Live consensus polling inside the group chat (Agree, Concern, Cant-Do options) supporting voice note logging, live translation, and structured system logs (`member_added` events resolving dynamically in English, Hindi, and Tamil).
5. **Mobile Responsive Precision**: Responsive reflowing layout cards, auto-collapsing bottom navbar for short screens/landscape orientation (< 540px), and truncated headings preventing layout overflows on narrow viewports (~360px).

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

### 5. reCAPTCHA Configuration Warning
> [!IMPORTANT]
> **reCAPTCHA Enterprise enforcement must stay OFF** in your Firebase project configurations. Enabling reCAPTCHA Enterprise on Firebase without linked Enterprise site keys causes the client SDK to trigger an internal fallback flow to standard v2 which leaks invisible challenge iframes and overlays.
>
> To ensure this remains disabled, verify that **reCAPTCHA Enterprise** is disabled under **Firebase Console > Authentication > Settings > User actions > reCAPTCHA protection**, or programmatically set the following options using the Admin SDK:
> ```typescript
> recaptchaConfig: {
>   phoneEnforcementState: 'OFF',
>   emailPasswordEnforcementState: 'OFF'
> }
> ```

---

## Known Limitations & Design Tradeoffs

1. **Seeded Order Hardcoding (`order-4421`)**: To ensure complete visual flow on stage without requiring initial manual setup, Weaver progress logging and Treasurer payout panels default to linking to the seeded active order `order-4421` on the Home screen.
2. **Double-Claim Race Condition**: In the event that two Admins from different cooperatives try to claim the exact same unassigned candidate at nearly the same time, last-write-wins mechanics apply, and no error is surfaced to either Admin.
3. **Web Speech API**: Dictation features rely on browser implementation. Google Chrome is recommended for the best speech experience during demo presentations.

---

## Commands
- Run development server: `npm run dev`
- Build production version: `npm run build`
- Start built production version: `npm run start`
