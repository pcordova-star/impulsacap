# ImpulsaCap Security Specification

## 1. Data Invariants
1. **User Identity Invariant**: A user document in `/users/{userId}` can only be created, read, or modified by the authenticated user whose `request.auth.uid == userId`.
2. **Company Ownership Invariant**: A company record in `/companies/{companyId}` must have `ownerId == request.auth.uid`. An unauthenticated user or an attacker cannot read, create or modify another company's records.
3. **Application Ownership Invariant**: An application postulation record in `/applications/{applicationId}` must belong to the creator (`ownerId == request.auth.uid`). No cross-tenant listing or reading allowed.
4. **Tax Folder Confidentiality Invariant**: Financial and tax folder records in `/tax_folders/{folderId}` contain sensitive SII data (sales, F29 history, margins) and must be readable and writable solely by the owner (`ownerId == request.auth.uid`).
5. **Immutable Ownership & Timestamps**: `ownerId` and `createdAt` are strictly immutable upon updates.
6. **Default Deny**: Any path not explicitly matched is denied by default (`match /{document=**} { allow read, write: if false; }`).

7. **Entitlements Server-Authoritative Invariant**: Entitlements in `/entitlements/{uid}` can ONLY be read by the owner (`request.auth.uid == uid`). Client writes (create, update, delete) are strictly forbidden (`allow write: if false`). Only the trusted backend using `firebase-admin` can grant or alter plan access.
8. **Payments Confidentiality Invariant**: Financial transactions in `/payments/{paymentId}` contain sensitive Mercado Pago payment data and are strictly inaccessible to all client SDKs (`allow read, write: if false`). Only server webhooks can write or query payment data.

## 2. The "Dirty Dozen" Malicious Payloads
1. **Payload 1 (Identity Spoofing - User Profile)**: An attacker attempts to create `/users/victim_user_123` with `request.auth.uid = attacker_456`. Must fail with `PERMISSION_DENIED`.
2. **Payload 2 (Ghost Field Injection - Privilege Escalation)**: A regular user attempts to create `/users/{userId}` with an unapproved administrative field `{ "role": "super_admin", "isAdmin": true }`. Must fail.
3. **Payload 3 (Company Stealing - Orphaned Record)**: An attacker attempts to set `ownerId: "victim_123"` inside `/companies/{companyId}` while authenticated as `attacker_456`. Must fail.
4. **Payload 4 (Company Mutate Other - Cross-Tenant Update)**: An authenticated user tries to update `/companies/comp_other` where `resource.data.ownerId != request.auth.uid`. Must fail.
5. **Payload 5 (Unauthenticated Leak)**: An unauthenticated request attempts to list `/companies` or `/users`. Must fail with `PERMISSION_DENIED`.
6. **Payload 6 (Application Tampering - Modifying Immutable Creator)**: An update to an existing application tries to change `ownerId` to someone else (`incoming().ownerId != existing().ownerId`). Must fail.
7. **Payload 7 (Path ID Injection / Poisoning)**: An attacker requests document with 2000 character ID or invalid characters like `../../` or SQL-like chars. Must fail via `isValidId()`.
8. **Payload 8 (Oversized Payload / Denial of Wallet)**: A payload contains a string exceeding the maximum allowed size (e.g. 50,000 characters in `companyName`). Must fail.
9. **Payload 9 (Tax Folder Hijacking)**: User A tries to read or query `/tax_folders/folder_of_user_B`. Must fail.
10. **Payload 10 (Terminal State Bypass)**: Attempting to edit a submitted application after reaching terminal status without admin rights. Must fail.
11. **Payload 11 (Blanket Query Scraping)**: A client issues a query on `/applications` without scoping by `ownerId == request.auth.uid`. Must be blocked by `resource.data.ownerId == request.auth.uid` in `allow list`.
12. **Payload 12 (Timestamp Forgery)**: A client passes an artificial past/future timestamp in `createdAt` instead of `request.time`. Must fail.

13. **Payload 13 (Self-Assigned Entitlement Attack)**: A user attempts to create or update `/entitlements/{uid}` from the client SDK to activate a free Plan Semestral (`{ "status": "active", "plan": "semestral", "expiresAt": "2030-01-01T00:00:00Z" }`). Must fail with `PERMISSION_DENIED`.
14. **Payload 14 (Cross-User Entitlement Read Attack)**: Authenticated User A tries to read `/entitlements/user_B` to inspect their subscription status. Must fail with `PERMISSION_DENIED`.
15. **Payload 15 (Direct Client Payment Tampering / Reading Attack)**: An attacker attempts to read `/payments/{paymentId}` or inject fake approved payment records from the client SDK. Must fail with `PERMISSION_DENIED`.

## 3. Test Runner Specification
Tests verify that all 12 payloads are blocked and rejected with `PERMISSION_DENIED`.
