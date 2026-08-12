# WeaveLink — Project Overview & Explanatory Video Guide

This document provides a comprehensive overview of **WeaveLink**, its architectural modules, screens, and features, followed by a **production-ready storyboard and script** for creating a promotional/explanatory video.

---

## 🧵 Part 1: Project Overview

### What is WeaveLink?
WeaveLink is a mobile-first, offline-capable platform designed for **handloom weaving cooperatives** in India. It bridges the gap between rural weavers and digital commerce by decentralizing production management, automating financial ledger splits, and establishing a democratic consensus voting system for order terms.

### The Core Problem it Solves
1. **Communication & Language Barriers**: Many weavers read/speak only local languages (e.g., Tamil, Hindi). WeaveLink has native translation routing.
2. **Literacy & Accessibility**: Logging daily work metrics textually is difficult. WeaveLink integrates **voice logs with automated Speech-to-Text translation**.
3. **Exploitation & Agreement Discrepancies**: Middlemen often dictate order conditions. WeaveLink implements **Consensus Voting** where order details must be collectively approved by a majority of weavers before production starts.
4. **Poor Network Infrastructure**: Rural areas have unstable connectivity. WeaveLink uses **client-side Service Worker caching and Firestore offline write queueing**.

---

## 📱 Part 2: Dynamic Screens & Core Features

### 1. Secure Authentication & Self-Migration Portal
* **Path**: `/` (Redirects to `/[locale]/` landing portal)
* **Features**:
  * **Phone Authentication (Mock OTP)**: Enter a phone number to sign in. Allows developer bypasses for easy testing on staging/local.
  * **New vs. Existing Toggle**:
    * **New Weaver**: Fills out registration details (Name, Phone number, Age, Years of Experience, Specialized Weave Type, Village/Area).
    * **Existing Weaver**: Dynamically links credentials with pre-seeded cooperative records in Firestore, migrating their account details securely.

### 2. Home Dashboard (The Weaver Hub)
* **Path**: `/[locale]/home`
* **Features**:
  * **Localized Multi-Language Toggle**: Seamless routing switcher between English, Hindi (हिन्दी), and Tamil (தமிழ்).
  * **Active Loom Tracker**: Displays the weaver's current assigned saree specifications and target progress.
  * **Interactive Summary widgets**: Direct shortcut entryways to group chats, pending orders, payments ledger, and federation updates.

### 3. Cooperative Group Chat & Consensus Center
* **Path**: `/[locale]/chat/[coopId]`
* **Features**:
  * **Consensus Card**: Displays target metrics (quantity, rate, deadline) of proposed orders. Weavers can vote:
    * **I Agree**: Approves the terms.
    * **Raise Concern**: Opens a modal to detail potential roadblocks.
    * **Can't Do It**: Weaver indicates they cannot participate in this batch.
  * **Speech-to-Text Messaging**: Uses browser Web Speech API to capture speech in Tamil, Hindi, or English and converts it to text in the input box.
  * **Responsive Layouts**: Designed to be responsive, including mobile landscape locking (`max-height: 540px`) that locks the input overlay to the bottom of the screen to prevent keyboard layout overlap.

### 4. Consensus Breakdown Dashboard (Admin Panel)
* **Path**: `/[locale]/orders/[orderId]/consensus`
* **Features**:
  * **Pulsing Consensus Status Badge**: Auto-calculates consensus states (`Waiting for responses`, `Consensus reached`, `Action needed: Rejections / Concerns present`).
  * **Weaver Responses List**: Displays exact votes by name and resolved avatar.
  * **Price Renegotiation Module**: Admins can adjust target pricing in real-time. Submitting a new price clears all weaver votes and automatically resets the order status back to a fresh consensus round.

### 5. Workforce Allocation Tool (Admin Panel)
* **Path**: `/[locale]/orders/[orderId]/allocate`
* **Features**:
  * **System Recommendations**: Auto-calculates split distributions based on loom compatibility and weaver capacity.
  * **Mobile-Responsive Grid**: Stacked layouts optimized for narrow viewports.

### 6. Loom Production Tracker
* **Path**: `/[locale]/production/[orderId]`
* **Features**:
  * **Real-Time Weaver Status**: Tracks metrics (e.g. Sarees woven vs target) and categorizes weavers as `On Track` or `X Days Late`.
  * **Voice Log Transcripts**: Playback and logs for weaver updates.

### 7. Interactive Payment Ledger
* **Path**: `/[locale]/payments/[orderId]`
* **Features**:
  * **Disbursement Splits**: Displays collective revenue pool breakdown and automatic payouts calculated by role/production share.
  * **PDF Ledger Export**: One-click generation of audit reports.

### 8. Federation Map & Insights
* **Path**: `/[locale]/federation` & `/[locale]/federation/[coopId]`
* **Features**:
  * **Dashboard**: Displays cooperative clusters, pooled materials, and network-wide production outputs.
  * **Smooth Load States**: Branded loaders eliminate layout jumps.

### 9. Custom Offline Mode
* **Path**: `/~offline`
* **Features**:
  * **App-Shell Fallback**: If internet connection drops completely, the service worker intercepts network failures and serves a dedicated, clean `/~offline` page with retry options.

---

## 🎬 Part 3: Explanatory Video Script & Storyboard

This script is structured for a **2.5-minute explanatory video** highlighting WeaveLink's value proposition and features.

### Video Structure Table

| Time | Visual / Screen Action | Voiceover (Narration) |
| :--- | :--- | :--- |
| **0:00 - 0:15** | **Intro**: Close-up shot of a handloom weaving. Graphic overlays highlighting the challenges of manual ledgers and language barriers. Transition to WeaveLink splash screen. | *"Indian handloom weavers create some of the world's finest textiles, but rural cooperatives are often locked out of digital tools due to language barriers, unstable internet, and unequal pricing decisions. Enter WeaveLink."* |
| **0:15 - 0:40** | **Authentication & Onboarding**: Show a weaver signing in via phone. Toggle from "New" to "Existing" weaver. Transition to the Home Dashboard showing translation switching (English $\to$ Tamil $\to$ Hindi). | *"WeaveLink is a mobile-first portal designed to empower weavers. Onboarding is secure and simple, allowing weavers to register fresh or link to their pre-existing cooperative record. With full support for Tamil and Hindi, the dashboard speaks the weaver's language."* |
| **0:40 - 1:10** | **Consensus Voting & Chat**: Display the Cooperative Group Chat. Zoom into the Consensus Card. Tap "I Agree" and "Raise Concern". Demonstrate voice typing via speech-to-text. | *"Before production begins, order metrics must be approved collectively. In the group chat, weavers review deadlines, pricing, and volume. With a tap, they vote to agree or raise concerns. No typing is needed—weavers can simply speak to send voice-to-text messages in their local dialect."* |
| **1:10 - 1:35** | **Admin Consensus & Price negotiation**: Show the Consensus Breakdown screen. Highlight the status change to "Concerns Present". The admin enters a renegotiated price, resetting the poll. | *"Cooperative admins monitor consensus in real-time. If weavers raise concerns, admins can renegotiate the target pricing on the fly. Adjusting the price clears the queue and prompts a fresh, democratic vote, ensuring every weaver is fairly compensated."* |
| **1:35 - 2:00** | **Loom Tracker & Payment Ledger**: Display the Production tracker with progress bars. Show the Payment Ledger splits by weaver name, followed by exporting the PDF ledger report. | *"During production, the Loom Tracker monitors daily output, classifying progress in real-time. Once complete, WeaveLink automatically splits order payouts based on actual metrics, logging transactions transparently and allowing direct PDF exports."* |
| **2:00 - 2:30** | **Offline Support & Outro**: Switch device to Airplane mode. Show the app loading previously cached orders cleanly. Trigger a simulated write that queues locally. Transition to the final slide with URL. | *"Even when the network drops, WeaveLink keeps running. Enabled with local cache databases and service worker fail-safes, weavers can view existing data and register votes offline. The writes queue locally and sync automatically when connection returns. WeaveLink: Connecting heritage and technology."* |

---

## 🛠️ Part 4: Technical Stack Summary for Presenters

For any technical Q&A during your event, here is the architecture summary:

* **Frontend**: Next.js 16 (App Router), React 19, TypeScript.
* **Styling**: Tailwind CSS (PostCSS v4) configured with Outfit and IBM Plex Sans custom typographies.
* **Database & Auth**: Firebase Firestore (multi-collection structure with subcollections for `progress`, `responses`, and `messages`) + Firebase Auth (Phone Authentication).
* **PWA & Offline System**:
  * `@ducanh2912/next-pwa` compiled via **Webpack builder** (`--webpack` flag) to output registered service workers (`sw.js`).
  * Statically compiled `/~offline` fallback route for offline entry redirects.
  * Firestore `persistentLocalCache` configuration using IndexedDB local storage tab management.
* **APIs**: Web Speech API for voice-to-text transcription.
