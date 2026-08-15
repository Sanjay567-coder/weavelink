# WeaveLink



**A mobile-first Progressive Web App for handloom weaving cooperatives in India**- the small, close-knit groups of artisans who take on bulk orders together, share looms and raw materials, and depend on trust between members to function. It bridges traditional craftsmanship with modern cooperative commerce: the weaving itself stays exactly as skilled and manual as it's always been, but everything around the weaving — how an order gets accepted, how work gets split fairly, how a delay gets caught in time, how payment gets divided — moves from informal, memory-based coordination into a structured, transparent system that every member can see and trust. It's installable straight to a phone's home screen like a native app, works in English, Hindi, and Tamil, and is built around a simple principle: nothing that affects the whole cooperative should depend on one person remembering it correctly.

### 🔗 [Try the live demo →](https://weavelink-wheat.vercel.app/)

Use one of the test accounts below to sign in instantly, no OTP required in demo mode.

| Role | Phone | Code |
|---|---|---|
| Admin | `+919999999999` | `123456` |
| Weaver | `+918888888888` | `123456` |
| Treasurer | `+917777777777` | `123456` |

---

 ## What it does

WeaveLink turns the day-to-day running of a handloom cooperative — accepting orders, agreeing to take on the work, allocating it fairly, tracking production, and settling payment — into one connected, accountable system instead of a mix of phone calls, notebooks, and chat threads.

## How it works

Take a real order end to end, the way it actually flows through the app:

Take a real order end to end, the way it actually flows through the app:

1. A buyer quotes a price — the admin logs it the moment the call ends: buyer, item, quantity, price, deadline, so it's on record instead of in someone's memory.
2. The cooperative discusses it — the order is shared to the group chat, where the admin can add a plain-language summary or a voice note, in English, Hindi, or Tamil.
3. Every member votes — instead of one person deciding for everyone, each weaver responds Agree, Raise a Concern, or Can't Do It, with their own reason attached, and a live consensus percentage builds in real time.
4. The buyer locks the price — once consensus is reached, the buyer confirms the order themselves on a public link, no account needed. From that point the price is frozen; changing it requires a formal renegotiation that resets the whole consensus vote.
5. Work gets allocated fairly — the system recommends how many units each weaver should take based on their current loom capacity and load, which the admin can fine-tune.
6. Production stays visible — weavers log their own progress, and the cooperative sees a live rollup, so if someone falls behind, it's flagged immediately instead of discovered at the deadline.
7. Payment stays transparent — the treasurer sees every weaver's split and status; each weaver sees their own record. No single role controls price, consensus, and payment all at once.
8. Cooperatives buy materials together — separate cooperatives can see each other's raw-material needs on a map and pool bulk orders, turning isolated groups into a network that negotiates better prices collectively.
---

## Key features

1. **Multi-role dashboards** — adaptive views for Admin (quote reviewing, pooling), Weaver (loom tracking, chat), and Treasurer (disbursements pool).
2. **Order → consensus → allocation → production pipeline** — a buyer's phone quote becomes a recorded order, the whole cooperative votes (Agree / Concern / Can't Do It), work is allocated[...]
3. **Direct member addition & toggle** — admins add a brand-new member directly (Name, Phone, Age, Experience, Specialization, Village/Area) or search and claim existing unassigned candidates.
4. **SMS profile self-migration** — transaction-safe: a newly registered weaver logging in via Phone Auth automatically claims their admin-created profile through phone-number mapping, in a sing[...]
5. **Group chat consensus & structured systems** — live consensus polling inside chat, with voice-note logging, live translation, and structured system logs (e.g. `member_added`) that resolve dy[...]
6. **Inter-cooperative material pooling** — cooperatives see each other's material needs on a map and pool bulk raw-material orders together to unlock better pricing.
7. **Mobile responsive precision** — reflowing layout cards, an auto-collapsing bottom navbar for short screens/landscape (< 540px), and truncated headings that prevent overflow on narrow viewpo[...]
8. **Real-time production tracking & alerts** — monitor loom station progress, flag delays, and contact weavers instantly.

---

## Technology stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router), TypeScript |
| Styling | Vanilla CSS with Artisanal Digital Coop theme tokens & Tailwind CSS |
| Icons & fonts | Outfit, IBM Plex Sans, Material Symbols Outlined |
| Database / Auth | Firebase Firestore (offline persistence) & Phone Auth |
| PWA | `@ducanh2912/next-pwa` |
| i18n | `next-intl` — English / Hindi / Tamil |
| Charts | Recharts (district price benchmarking) |
| Maps | Leaflet or similar for material pooling visualization |

---

## Getting started

### 1. Prerequisites
- Node.js v18 or later
- A Firebase project

### 2. Local setup

```bash
git clone <this-repo>
cd weavelink
npm install
```

### 3. Firebase & environment configuration

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

### 4. Database seeding & test accounts

Seed your Firebase project with initial cooperatives, weaver accounts, allocations, and orders:

```bash
npm run seed
```

**Verification / test phone numbers** — the seed script registers these with deterministic UIDs. To sign in via the real Phone Auth path without SMS costs, add them under **Firebase Console →[...]

| Role | Phone | Verification code |
|---|---|---|
| Admin | `+919999999999` | `123456` |
| Weaver | `+918888888888` | `123456` |
| Treasurer | `+917777777777` | `123456` |

### 5. reCAPTCHA configuration warning

> [!IMPORTANT]
> **reCAPTCHA Enterprise enforcement must stay OFF** in your Firebase project. Enabling it without linked Enterprise site keys causes the client SDK to fall back to standard v2, which leaks invis[...]
>
> Verify it's disabled under **Firebase Console → Authentication → Settings → User actions → reCAPTCHA protection**, or set it programmatically with the Admin SDK:
> ```typescript
> recaptchaConfig: {
>   phoneEnforcementState: 'OFF',
>   emailPasswordEnforcementState: 'OFF'
> }
> ```

### Commands

| Command | Description |
|---|---|
| `npm run dev` | Run the development server |
| `npm run build` | Build the production version |
| `npm run start` | Start the built production version |
| `npm run seed` | Seed Firebase with test data |

---


---

