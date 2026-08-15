# WeaveLink



**A mobile-first Progressive Web App for handloom weaving cooperatives in India** — bridging traditional craftsmanship and modern cooperative commerce.

### 🔗 [Try the live demo →](https://weavelink-wheat.vercel.app/)

Use one of the test accounts below to sign in instantly, no OTP required in demo mode.

| Role | Phone | Code |
|---|---|---|
| Admin | `+919999999999` | `123456` |
| Weaver | `+918888888888` | `123456` |
| Treasurer | `+917777777777` | `123456` |

---

## What problem this solves

Weaving cooperatives typically take orders informally — a buyer calls or messages the admin with a price and a quantity, and everything downstream lives in memory, a notebook, or a scattered cha[...]

WeaveLink replaces that with a structured, accountable workflow: from the moment a buyer quotes a price, to group consensus, to production tracking, to payment — every step is recorded, visible,[...]

---


## Workflow demonstration

**Order #7269** demonstrates the complete WeaveLink flow:

- **Image 6: Workforce Allocation** — After consensus, the system recommends optimal unit distribution (3 units each for 5 weavers) based on loom compatibility. Weavers are listed with their cap[...]

- **Image 7: Group Chat & Consensus** — The cooperative discusses the order in a live chat thread where members vote ("I Agree," "Raise Concern," "Can't Do It"). System logs track key events (e.[...]

- **Image 8: Order Details Card** — The order summary displays buyer (nkvd), price (₹50,000), item (dscvzxds), quantity (3 units), deadline (11 Sept 2026), and a high-quality product image. St[...]

---

## Order tracking & material pooling

**Order #6149 and #4378** demonstrate the cooperative orders management:

- **Image 9: Cooperative Orders** — Active and historical orders are listed with buyer names, prices (₹20,000), and confirmation status ("Buyer Confirmed ✓"). Orders show expiry status and c[...]

- **Image 10: Material Pooling Map** — Cooperatives discover each other's material needs on an interactive map. Red pins mark "Available for Pooling" cooperatives, blue pins mark those "At Capac[...]

---

## Production tracking & alerts

- **Image 11: Overall Progress & Loom Station Updates** — For Cooperative Batch #7269 (0% Complete), the dashboard shows production timelines (30 Days Remaining, Started: Oct 12, Deadline: Sep 1[...]

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

## Known limitations & design tradeoffs

1. **Seeded order hardcoding (`order-4421`)** — to ensure a complete visual flow on stage without manual setup, Weaver progress logging and Treasurer payout panels default to the seeded active [...]
2. **Double-claim race condition** — if two admins from different cooperatives try to claim the same unassigned candidate at nearly the same time, last-write-wins applies and no error is surfac[...]
3. **Web Speech API** — dictation relies on the browser's implementation. Chrome is recommended for the best speech experience during demos.

---

## License

Add your license here.
