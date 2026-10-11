# Security Specification — Mizan AI Requirements & Solution Lifecycle Platform

## 1. Data Invariants
1. **Default-Deny Catch-All**: All paths not explicitly matched are denied read and write access (`match /{document=**} { allow read, write: if false; }`).
2. **Verified Identity**: Every write operation requires an authenticated user with `request.auth.token.email_verified == true`.
3. **Platform Admin Exclusivity**: Only the bootstrapped Platform Admin (`awadsandal2@gmail.com` with verified email or `/admins/$(request.auth.uid)`) can create new `/companies/{companyId}` documents. Public self-service company creation is strictly forbidden.
4. **PII Isolation (`/users/{userId}`)**: User profile documents contain PII (`email`) and RBAC fields (`role`, `companyId`). Reading a user document is restricted strictly to the document owner (`request.auth.uid == userId`) or an Admin. Users cannot self-assign `platform_admin` unless they are the bootstrapped Platform Admin.
5. **Acceptance Criteria Validation Gate**: An `Artifact` of `type == 'acceptance_criteria'` cannot transition to `status == 'approved'` unless `validationStatus == 'passed'`.
6. **Strict Schema & Key Allowlisting**: Every `create` and `update` operation validates exact required/allowed keys (`hasAll` and `hasOnly`), string maxLengths, regex ID patterns (`^[a-zA-Z0-9_\-]+$`), bounded array sizes (`<= 10`), and immutable fields (`id`, `companyId`, `authorId`/`ownerId`, `createdAt`).
7. **Secure List Queries**: Every `allow list` rule enforces ownership or tenant filtering directly on `resource.data` without `get()`/`exists()` inside `list`.
8. **Immutable Audit Logs**: `/auditLogs/{logId}` supports `create` and `read` by the actor/admin, and strictly forbids `update` and `delete`.

## 2. The "Dirty Dozen" Payloads

1. **Unverified Email Spoof**: Authenticated user with `email: "awadsandal2@gmail.com"` and `email_verified: false` attempts to create a company. -> `PERMISSION_DENIED`
2. **Self-Service Company Creation by Non-Admin**: Verified standard user (`user_123`) attempts to create `/companies/comp_rogue`. -> `PERMISSION_DENIED`
3. **Shadow Field Injection on Artifact Create**: User sends a valid artifact payload plus `{ "isSuperApproved": true }`. -> `PERMISSION_DENIED`
4. **PII Harvesting on `/users`**: Authenticated user `user_A` attempts `get(/users/user_B)` or `list(/users)` without ownership filter. -> `PERMISSION_DENIED`
5. **Privilege Escalation on User Update**: User `user_A` attempts to update their own `/users/user_A` document with `{ "role": "platform_admin" }`. -> `PERMISSION_DENIED`
6. **Acceptance Criteria Approval Without Passing Validation**: User attempts to update an `acceptance_criteria` artifact to `status: "approved"` while `validationStatus: "failed"`. -> `PERMISSION_DENIED`
7. **ID Poisoning Attack**: User attempts to create `/artifacts/bad$id!with@spaces` or a 500-char ID. -> `PERMISSION_DENIED`
8. **Denial of Wallet String Overflow**: User sends a 50,000-character `description` in `/artifacts/art_1`. -> `PERMISSION_DENIED`
9. **Unbounded Array Injection**: User sends `sourceRefs` with 25 elements (exceeding limit of 10) on `/artifacts/art_1`. -> `PERMISSION_DENIED`
10. **Author Spoofing on Create**: User `user_A` creates an artifact with `authorId: "user_B"`. -> `PERMISSION_DENIED`
11. **Immortal Field Mutation on Update**: User `user_A` updates `/projects/proj_1` and changes `ownerId` or `createdAt`. -> `PERMISSION_DENIED`
12. **Audit Log Tampering**: Any user attempts to `update` or `delete` `/auditLogs/log_1`. -> `PERMISSION_DENIED`
