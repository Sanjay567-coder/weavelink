# WeaveLink — Verified Project Inventory & Feature Audits

This document lists the verified, fully functioning screens and features of **WeaveLink** as of August 2026. Every item listed here is fully backed by the active production codebase.

---

## 📱 1. Screen & Route Inventory

| Route Path | Screen Name | Target Role | Key Features |
| :--- | :--- | :--- | :--- |
| `/` | **Landing Portal** | Guest / Guest Weaver | Secure Phone Auth input, OTP entry field, and New vs. Existing toggle for weaver migrations. |
| `/[locale]/home` | **Home Dashboard** | Dynamic (Admin / Weaver / Treasurer) | Renders three completely different dashboards: stats & quick actions for Admins, consensus alert alerts & progress bars for Weavers, and payout logs & pools for Treasurers. |
| `/[locale]/orders` | **Order Dashboard** | Admin | Full list of past, active, and pending cooperative orders. |
| `/[locale]/orders/new` | **Post New Order** | Admin | Create proposed contracts with fields for Item, Quantity, Price, Deadline, and Buyer Name. |
| `/[locale]/orders/[orderId]` | **Order Details** | Admin | Detailed metrics showing deadline, price, and enteredBy / enteredAt creator attribution. |
| `/[locale]/orders/[orderId]/share` | **Share to Chat** | Admin | Publishes a proposed contract card directly into the cooperative chat to start consensus voting. |
| `/[locale]/chat/[coopId]` | **Cooperative Chat** | Dynamic (Admin / Weaver) | Group chat stream, active consensus voting card (Agree/Concern/Can't Do), and speech-to-text voice input. |
| `/[locale]/orders/[orderId]/consensus` | **Consensus Breakdown** | Admin | Shows votes breakdown, weaver concerns transcripts, and a Price Renegotiation tool to reset proposed contracts. |
| `/[locale]/orders/[orderId]/allocate` | **Workforce Allocation** | Admin | Distributes weaving loom loads across weavers, recommending split metrics based on weaver capacity. |
| `/[locale]/production/[orderId]` | **Production Tracker** | Dynamic (Admin / Weaver) | Progress tracking bars per weaver, status tags (On Track / Late), and voice log update records. |
| `/[locale]/payments/[orderId]` | **Payment Ledger** | Dynamic (Admin / Treasurer) | Payout splits per weaver, paid/due state toggles, expected settlement metrics, and collective revenue pool data. |
| `/[locale]/federation` | **Federation Insights** | Admin | Styled vector map showing cooperative pins, distance summaries, and regional pooling requests. |
| `/[locale]/federation/[coopId]` | **Cooperative Portal** | Admin | Detail card of external cooperatives with buttons to send, accept, or decline resource pooling invitations. |
| `/[locale]/confirm/[orderId]` | **Buyer Confirmation** | Public Buyer (No login) | Open verification portal for buyer confirmation of contract prices. |
| `/~offline` | **Offline Fallback** | All | Precached static fallback route displayed when network connectivity is lost. |

---

## 🛠️ 2. Genuinely Distinctive Features

1. **Price Immutability Guard**: Once an order status is set to `'confirmed'` (consensus reached), security rules block any changes to the order price. Pricing can only be edited during the Renegotiate Flow, which automatically resets the order status back to draft and clears all weaver votes.
2. **Unauthenticated Public Buyer Page**: The `/confirm/[orderId]` page allows buyers to verify contract terms without authentication. Firestore security rules strictly restrict updates on this path to only `buyerConfirmed` and `buyerConfirmedAt` fields, and only if not already confirmed.
3. **Mandatory Vote Justifications**: Weavers are prompted for text descriptions when voting "Raise Concern" or "Can't Do It", which are logged to Firestore and displayed to the Admin.
4. **Speech-to-Text Inputs**: Integrates Web Speech API inside the chat interface, converting spoken Tamil, Hindi, or English into text in the input box.
5. **Role-Based Security Rules**: Full three-way role separation (Admin / Weaver / Treasurer) enforced in `firestore.rules`.
6. **Robust Offline Support**: Statically caches `/~offline` fallbacks. Enables Firestore IndexedDB local persistence which caches queried documents and queues offline writes (chat messages, progress, consensus votes) to sync automatically when online.
7. **Persona Switcher (DevBar)**: Floating terminal switcher that signs out, authenticates under the selected role (Admin, Weaver, Treasurer) using custom mock credentials, and navigates to the dashboard cleanly.

---

## 🔒 3. Verification of In-Progress Items

* **Federation Material-Requirements-Edit-Save**: **Fully resolved.** Saving edited material requirements is synchronized using real-time Firestore listeners, which update the UI immediately upon document write.
* **Pooling Confirmed-vs-Pending State-Conflict**: **Fully resolved.** Weavers are prevented from seeing cooperatives as active opportunities once an accepted or pending pooling relationship is established.
* **Add Member Flow**: **Fully resolved.** Firestore security rules authorize Admins to create new member documents inside their coop and associate unclaimed weavers (`coopId == ''`).
* **Multilingual Coverage**: **100% complete.** JSON catalogs are fully synchronized across English, Hindi, and Tamil with identical key structures. Development fallback highlights missing translation keys loudly.
* **Role-Based Access & Logout Hardening**: **Fully resolved.** Home page layout blocks dynamically adjust per role. Logouts cleanly sign out and refresh the page to clear memory state and DOM context.
