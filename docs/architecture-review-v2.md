# Architecture Review v2 — Delta

Checked the updated `.docx` set against the last pass. Good news first: **five of the seven MUST FIX items from the last review are genuinely resolved** —

- `product.md` §9 now defers to `DESIGN.md` for all visual styling — contradiction gone.
- Post content format is now settled as structured editor JSON, and it's consistent across `database.md`, `api.md`, `security.md`, and `DESIGN.md`.
- Rich-text sanitization is now specified (`security.md` §10: server validates node types/attributes/URLs, no arbitrary HTML/scripts).
- JWT expiration is now specified (`security.md` §11: 15-min access token, server-side refresh token, logout revokes it).

That last fix, though, opened a new gap (item 1 below). Everything past that is either unresolved from before or new in this pass. Only reporting what's still live.

---

### 1. Refresh-token architecture has no API endpoint or storage model to implement it
**Where:** `security.md` §11 commits to "refresh tokens... stored server-side" and a logout that "revokes the refresh token." But `api.md` §4's endpoint list has only `/auth/register`, `/auth/login`, `/auth/logout` — no refresh endpoint. `database.md` §2's seven core collections have nowhere to persist a server-side refresh token (no `RefreshToken` collection, no field on `User`).
**Why it matters:** This is a security control specified without the surface area to support it. As written, there's no route for a client to exchange a refresh token for a new access token, and no schema to store what's being revoked. Whoever implements this will have to invent both, which is exactly what `ai-context.md`'s AI rules say not to do silently.
**Smallest fix:** Either (a) add `POST /auth/refresh` to `api.md` and a `RefreshToken` collection (or field) to `database.md`, or (b) simplify `security.md` §11 to a single short-lived token with re-login on expiry, dropping the refresh-token claim if that infrastructure isn't wanted for this scope.

---

### 2. Pipeline ordering — now a contradiction *within* `architecture.md` itself, not just across files
**Where:** `architecture.md` §4 "Request Flow" orders it Auth → Authorization/Ownership → Validation. `architecture.md` §14 "Validation and Error Handling" — same document — orders it Validation → Authentication → Authorization. `api.md` §2 matches §4. None of the three fully agree on where ownership checks (which require fetching a resource by a now-needs-to-be-valid ID) fit.
**Why it matters:** An implementer can't "follow the diagram" when the same document contains two different diagrams. Practically: an ownership check needs a validated ID to fetch the resource — if it runs before validation, a malformed ID produces a raw Mongoose `CastError` instead of a clean 400.
**Smallest fix:** Pick one order — Authenticate → Validate input/params → Authorize (role) → Authorize (ownership, post-fetch) → Service — and make §4, §14, and `api.md` §2 all match it.

---

### 3. Report / Notification polymorphic target still unresolved
**Where:** `database.md` §8 still lists this as open ("whether targets for Report use a polymorphic reference or another representation"); `architecture.md` §6.7 repeats it. `Notification.relatedContent` has the identical ambiguity and still isn't tracked as an open decision anywhere.
**Why it matters:** This isn't a "decide during implementation" item — it determines the actual field shape of two schemas (discriminator field vs. two optional refs). Worth resolving before those models are written.
**Smallest fix:** `targetType: 'post' | 'comment'` + single `targetId` (Mongoose `refPath`), applied to both `Report.target` and `Notification.relatedContent`.

---

### 4. Deletion cascade behavior still undefined
**Where:** `database.md` §7, `api.md`'s `DELETE /posts/:id` and `DELETE /comments/:id`.
**Why it matters:** No rule for what happens to a post's comments/bookmarks/reports when the post is deleted, or to replies when their parent comment is deleted. Data-integrity gap, not a style choice.
**Smallest fix:** One rule per entity in `database.md` §7 (e.g., post deletion cascades to comments/bookmarks/reports; comment deletion cascades to its one-level replies).

---

### 5. Admin "manage users" endpoint has no defined payload
**Where:** `api.md` `PATCH /admin/users/:id`; `database.md`'s User schema still has no status or other admin-mutable field.
**Why it matters:** The endpoint exists in the API surface with no defined effect — can't be implemented without inventing behavior.
**Smallest fix:** Either scope the endpoint to role changes only, or add a `status` (active/suspended) field to the User schema.

---

### 6. Image content nodes — upload vs. external URL is undecided, and it's a real scope fork
**Where:** `DESIGN.md`'s new "Rich Text Editor" section: "Images are represented as content nodes with a source URL, alternative text, and optional caption." `product.md`'s Create Blog view also now explicitly includes images among the supported node types.
**Why it matters:** This determines whether you need file-upload infrastructure at all. If images are inserted by pasting an already-hosted URL, nothing new is needed beyond the URL validation `security.md` §10 already implies. If the platform must let students upload image files, that requires an upload endpoint, a storage decision (disk/S3/other), and file-type/size validation — none of which exist in `api.md`, `database.md`, or `architecture.md`. These two readings are very different amounts of work, and nothing currently says which one is intended.
**Smallest fix:** One sentence in `product.md` or `DESIGN.md`: images are inserted via external URL only (no upload), or images require platform upload (and then add the endpoint + storage decision).

---

### 7. Public vs. authenticated read boundary for posts
**Where:** `api.md` §5 — "published-content discovery/read operations as allowed by implementation," still unresolved.
**Why it matters:** Determines frontend routing (which pages need a logged-out state) and where auth middleware sits on `GET /posts` / `GET /posts/:id`.
**Smallest fix:** One sentence: browsing/reading published posts is public; everything else (comment, bookmark, report, create) requires auth.

---

### 8. Reply endpoint's `post` field derivation isn't stated
**Where:** `api.md` — `POST /comments/:id/replies` has no `postId` in the path, unlike `POST /posts/:postId/comments`.
**Why it matters:** The service must derive `post` from the parent comment server-side; without saying so, it's easy to accidentally trust a client-supplied `post` field and let a reply attach to the wrong post.
**Smallest fix:** One line: "`post` on a reply is derived server-side from the parent comment, never client input."

---

### 9. No rate limiting on auth endpoints
**Where:** `security.md` was updated (§10, §11 added) but rate limiting still isn't mentioned anywhere.
**Why it matters:** `/auth/login` with no throttling is brute-forceable — this is a baseline control, not an advanced one deferred by §9's scope carve-out.
**Smallest fix:** One line rate-limiting `/auth/login` and `/auth/register`.

---

### 10. CORS policy still unaddressed
**Where:** Absent from every document, despite frontend and backend being separate containers/origins per `development.md` §5.
**Why it matters:** Becomes a "discover it while debugging" problem instead of a decision, and interacts with whichever JWT transport gets chosen (cookie-based auth needs stricter CORS + credentials handling than header-based).
**Smallest fix:** Resolve CORS alongside the JWT-transport decision (`api.md` §9).

---

### 11. Comment counts on My Posts dashboard still have no backing query
**Where:** `product.md` view 8 requires comment counts per post; `database.md`'s Post schema still has no count field or note on how it's computed.
**Why it matters:** Small but real gap between a stated UI requirement and the data model serving it.
**Smallest fix:** State that it's computed via aggregation at read time — no denormalized counter needed at this scale.

---

### 12. Socket.IO/WebSockets still listed as "intended stack" despite the docs already agreeing it's unneeded
**Where:** `product.md` §11/§12 — unchanged, still lists it as "needs confirmation" rather than removed.
**Why it matters:** `architecture.md` §11/§28 already conclude it shouldn't be a required dependency. Leaving it in the "intended stack" list invites someone to wire it up during implementation just because it's listed.
**Smallest fix:** Drop it from `product.md` §11 now; the conclusion is already made elsewhere.

---

## Priority

**Before implementation starts:**
1. Refresh-token endpoint/storage gap (#1)
2. Pipeline ordering self-contradiction in `architecture.md` (#2)
3. Report/Notification polymorphic target shape (#3)
4. Deletion cascade rules (#4)
5. Admin user-management payload (#5)
6. Image upload vs. external-URL decision (#6)

**Before the relevant feature is built:**
7. Public/private read boundary (#7) — before posts routes
8. Reply `post`-field derivation (#8) — before comments module
9. Rate limiting (#9) and CORS (#10) — before auth module
10. Comment-count sourcing (#11) — before My Posts dashboard

**Low cost, do whenever:**
11. Drop Socket.IO from intended stack (#12)
