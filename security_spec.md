# Security Specification & Threat Model

## 1. Data Invariants
1. **Owner Isolation**: Every `Donor` and `BloodRequest` document contains an immutable `ownerId` matching `request.auth.uid` of an email-verified Google user. No user may read, list, update, or delete another user's donor PII or requests.
2. **Strict Schema Enforcement**: Every write (`create` and `update`) must pass `isValidUserProfile`, `isValidDonor`, or `isValidBloodRequest` using `hasAll()` and `hasOnly()` to reject shadow/ghost fields.
3. **Temporal Integrity**: `createdAt` and `updatedAt` must equal `request.time` on creation; `createdAt` is immutable and `updatedAt` must equal `request.time` on updates.
4. **Terminal State Locking**: Once a `BloodRequest` transitions to `status: 'fulfilled'`, no further updates are permitted.
5. **Bounded Arrays & Strings**: All strings enforce `.size()` limits, document IDs match `^[a-zA-Z0-9_\-]+$`, and arrays (`donationHistory`, `matchedDonorIds`) are capped at 50 items with element type validation.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Write**: Creating `/donors/d1` with `request.auth == null` -> `PERMISSION_DENIED`.
2. **Unverified Email Spoofing**: Creating `/donors/d1` with `email_verified: false` -> `PERMISSION_DENIED`.
3. **Identity Spoofing**: Creating `/donors/d1` with `ownerId: "victim-uid"` while signed in as `"attacker-uid"` -> `PERMISSION_DENIED`.
4. **Shadow/Ghost Field Injection**: Creating `/donors/d1` with extra `isAdmin: true` -> `PERMISSION_DENIED`.
5. **Path ID Poisoning**: Creating `/donors/invalid$id..123` -> `PERMISSION_DENIED`.
6. **Client Timestamp Forgery**: Creating `/donors/d1` with backdated `createdAt` instead of `request.time` -> `PERMISSION_DENIED`.
7. **Owner Transfer on Update**: Updating `/donors/d1` to change `ownerId` -> `PERMISSION_DENIED`.
8. **Invalid Blood Type Injection**: Writing `bloodType: "X+"` -> `PERMISSION_DENIED`.
9. **Age Out-of-Bounds / Type Confusion**: Writing `age: "twenty"` or `age: 5` -> `PERMISSION_DENIED`.
10. **Array Overflow / Type Poisoning**: Writing `donationHistory: [123]` or > 50 entries -> `PERMISSION_DENIED`.
11. **Blanket List Query Scraping**: Listing `/donors` without `where("ownerId", "==", auth.uid)` -> `PERMISSION_DENIED`.
12. **Terminal State Bypass**: Updating `/bloodRequests/r1` after `status == "fulfilled"` -> `PERMISSION_DENIED`.
