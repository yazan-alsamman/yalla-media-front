# Meta Ads API integration — readiness audit

**Scope:** Laravel API (`routes/api.php`, controllers, models, migrations) at the Yalla Media backend, plus React dashboard (`src/**/*.tsx`, `api` client).  
**Audit date:** Based on repository state as reviewed (code inspection, not production config).

**Legend:** ✅ Ready / ⚠ Partial or planned / ❌ Not implemented

---

## 1. Meta Developer App

| Item | Status | Notes |
|------|--------|--------|
| Developer app exists | ⚠ | **Operational requirement** — must exist in [Meta for Developers](https://developers.facebook.com/). Not verifiable from code. |
| App ID / secret stored securely | ⚠ | `.env.example` defines `META_APP_ID`, `META_APP_SECRET`, `META_API_VERSION`, `META_REDIRECT_URI` (and sync-related vars). **Secrets belong only in `.env` / secret manager** — correct pattern, but **`MetaOAuthController` does not read these values** yet (see §3). |
| Dev vs Live mode | ⚠ | **Process/BM configuration**, not in repo. Live mode + app review needed before broad production use. |

**Blockers:** Fill `.env` with real credentials; wire config into OAuth URL builder and token exchange.

---

## 2. Business Manager & ad accounts

| Item | Status | Notes |
|------|--------|--------|
| Linked ad accounts in Meta | ⚠ | **Org setup** — code assumes customers link `act_*` IDs via `ad_accounts.meta_ad_account_id`. |
| User roles / permissions | ⚠ | Not enforced in app; depends on token scopes and BM roles (`ads_management`, etc.). |
| Business verification | ⚠ | **Meta policy** — may be required for certain features; not reflected in code. |

**Blockers:** None in code; ensure BM/ad account access matches intended users before testing.

---

## 3. OAuth / access tokens

| Item | Status | Notes |
|------|--------|--------|
| OAuth flow & redirect URLs | ⚠ | **Route exists:** `GET /api/meta/callback` (public). **Dashboard** can call `GET /meta/auth-url` and open the URL. **Implementation:** `MetaOAuthController::callback` and `authUrl` are **stubs** — placeholder URL with empty `client_id` / `redirect_uri`; callback returns JSON echo of `code`/`state`, **does not** exchange code for token or persist anything. |
| Token storage | ✅ | `ad_accounts` has `access_token`, `refresh_token`, `token_expires_at`; model uses **Laravel encrypted casts** for tokens. |
| Token refresh | ⚠ | `AdAccountController::refreshToken` **stores a new user-supplied** `access_token` only — **no** server-side exchange with Meta. **No** scheduled job in repo calling Meta to extend tokens (composer autoload in some environments referenced `RefreshMetaTokenJob` / `MetaAdsService` — **those classes are not present** in the audited `app/` tree). |
| Long-lived / system user tokens | ❌ | **Not implemented** as a first-class flow (would be explicit exchange or system user setup in Meta). |

**Blockers:** Implement real `authUrl` (scopes, state, PKCE if required), callback handler (exchange `code` → short-lived → long-lived), persist to `ad_accounts`, associate with `user_id` from signed `state`.

---

## 4. Permissions / scopes

| Item | Status | Notes |
|------|--------|--------|
| `ads_management` | ❌ | Not requested in stub OAuth URL (URL has no `scope` parameter). |
| `ads_read` | ❌ | Same as above. |
| `business_management` | ❌ | Same as above. |
| `pages_read_engagement` | ❌ | Not referenced in backend. |

**Blockers:** Define minimal scope set for product (read vs write), add to OAuth dialog URL, submit for **App Review** if needed for external users.

---

## 5. Webhooks / callbacks

| Item | Status | Notes |
|------|--------|--------|
| HTTPS endpoints for Meta webhooks | ❌ | **No** dedicated webhook routes/controllers found for Meta (e.g. `hub.challenge`, signed payload handling). |
| OAuth callback only | ⚠ | `GET /api/meta/callback` exists but is **JSON stub**, not a browser redirect back to the SPA with success/error. |

**Blockers:** If you need real-time spend/status, add webhook endpoint + verification; otherwise polling Graph may suffice (still needs Graph client).

---

## 6. API version & SDK

| Item | Status | Notes |
|------|--------|--------|
| Graph API version | ⚠ | Stub URL uses **v21.0**; `.env.example` sets `META_API_VERSION=v21.0`. **No** centralized client enforcing version on all calls. |
| Facebook PHP SDK | ❌ | **`composer.json` does not require** `facebook/graph-sdk` or similar. |
| HTTP to Graph | ⚠ | **Guzzle** ships with Laravel; **no** `MetaAdsService` (or equivalent) in audited codebase making `graph.facebook.com` requests. |

**Blockers:** Add thin service using `Illuminate\Support\Facades\Http` or official SDK; pin version from `config('services.meta.api_version')`.

---

## 7. Server readiness

| Item | Status | Notes |
|------|--------|--------|
| HTTP client | ✅ | Guzzle available via Laravel. |
| Rate limits / backoff | ❌ | **No** Meta-specific retry/backoff wrapper found. |
| Error handling / logging | ⚠ | Generic Laravel logging exists; **no** structured Meta error mapping (error_subcode, etc.). |

**Blockers:** Implement retries with respect to `X-App-Usage` / `X-Ad-Account-Usage` headers and Graph error payloads.

---

## 8. Database & models

| Item | Status | Notes |
|------|--------|--------|
| Tokens + linked ad accounts | ✅ | `ad_accounts` table + `AdAccount` model; tokens encrypted; `meta_ad_account_id` unique. |
| Campaigns | ✅ | `campaigns` includes `meta_campaign_id`, `meta_link`, JSON `creatives`, etc. |
| Insights storage | ✅ | `campaign_insights` with daily granularity, metrics, **`raw_data`** for full API response — suitable for sync jobs. |
| Ads / ad sets as first-class tables | ❌ | **No** separate `ad_sets` / `ads` tables; creative structure is JSON on campaign. Enough for some products; **not** a full mirror of Meta hierarchy. |
| Sensitive fields encrypted | ✅ | Access/refresh tokens encrypted on `AdAccount`. |

**Blockers:** Decide if you need Meta object IDs for ad sets/ads; extend schema if you sync below campaign level.

---

## 9. Frontend / React dashboard

| Item | Status | Notes |
|------|--------|--------|
| Connect Meta (OAuth) | ⚠ | **`MetaIntegrationsPage`**: calls `GET /meta/auth-url`, opens URL; documents callback as external. **Won’t work end-to-end** until backend builds a valid URL and callback persists tokens. |
| List linked ad accounts (from Meta) | ⚠ | **`GET /meta/ad-accounts`** returns **[]** from stub. **Customer `AdAccountsPage`** lists **DB** ad accounts via `/customer/ad-accounts` or admin directory — good for **manual** linking, not live Graph list. |
| Campaigns UI | ✅ | Full CRUD/ops for **app campaigns** (customer + employee flows): pause, resume, approve, `set-link`, delete (role-gated). These update **local** status, **not** Meta Ads Manager API. |
| Ads & ad-level UI | ❌ | **No** dedicated ads/ad sets screens. |
| Insights from Meta | ⚠ | **`GET /customer/campaigns/:id/insights`** sums **`campaign_insights`** rows — **not** live Graph. Employee **sync** button calls **`POST .../sync`** which only bumps **`last_synced_at`** (no Graph pull in audited code). Customer **sync** on ad account similarly timestamps only. |
| API wiring | ✅ | Uses shared `api` client (Sanctum); Meta routes authenticated except callback. |
| Role-based access | ✅ | Meta routes under `auth:sanctum`; customer vs admin ad account paths differ. |

**Blockers:** After backend Graph integration, add UI for connection status, token expiry warnings, and optional “Refresh insights” that reflects real job progress.

---

## 10. Testing environment

| Item | Status | Notes |
|------|--------|--------|
| Sandbox / test ad accounts | ⚠ | **Meta provides** test users and ad accounts in Business Manager — **not** configured in repo. |
| Test without real spend | ⚠ | Possible with Meta test mode assets **once** OAuth + Graph calls work. |
| Automated tests for Meta | ❌ | No API contract tests against Graph (would use mocks or recorded fixtures). |

**Blockers:** Create BM test ad account + test user; register redirect URL for local/staging HTTPS (e.g. ngrok) as required by Meta.

---

## Summary table

| # | Area | Overall |
|---|------|--------|
| 1 | Meta Developer App | ⚠ Config placeholders only; app is external |
| 2 | Business Manager & ad accounts | ⚠ Operational |
| 3 | OAuth / tokens | ❌ Stubs; storage model ready |
| 4 | Scopes | ❌ Not wired |
| 5 | Webhooks | ❌ Not implemented |
| 6 | API version / SDK | ⚠ Version string exists; no client |
| 7 | Server (HTTP, limits, errors) | ⚠ HTTP yes; Meta-specific no |
| 8 | DB & models | ✅ Strong fit for sync pipeline |
| 9 | Dashboard | ⚠ UI shells; depends on backend |
| 10 | Testing | ⚠ External setup required |

---

## Main conclusion

The stack is **architecturally prepared** (routes, env keys, encrypted token columns, `campaign_insights.raw_data`, campaign/ad-account domain models, dashboard pages calling the right endpoints), but it is **not yet ready to call the Meta Ads API in production**. The **critical gap** is **real OAuth + Graph API client + persistence + (optional) webhooks and rate-limit handling**. Current “sync” and “insights” paths are **largely local DB operations**, not Meta pulls/pushes.

---

## Suggested next steps (before “starting integration”)

1. **Implement `MetaOAuthController`:** build `authUrl` from `META_*` env; signed `state` with user id; `callback` exchanges `code`, stores tokens on `ad_accounts` (or a dedicated `meta_connections` table if you prefer one-to-many).
2. **Add `config/services.php` entries** for Meta and a **`MetaGraphClient`** (Http facade) with versioned base URL and central error handling.
3. **Choose token strategy:** user long-lived tokens vs system user; document refresh (cron job + queue).
4. **Request scopes** aligned with features; plan **App Review** timeline.
5. **`GET /meta/ad-accounts`:** call Graph `me/adaccounts` (or BM edge) with stored token; optionally upsert `ad_accounts`.
6. **Insights pipeline:** job that calls `insights` edge for `meta_campaign_id`, normalizes into `campaign_insights` (respecting dedupe on `campaign_id` + `date`).
7. **Optional:** map employee pause/resume to Meta if campaigns must stay in sync (`campaign` status API) — **separate** from current DB-only pause/resume.
8. **Dashboard:** post-OAuth return path (deep link or SPA route); surface connection errors and token expiry.
9. **Document** redirect URIs for dev/staging/prod in the Meta app; use HTTPS everywhere Meta requires it.
10. Update **`docs/api-status.md`** when Meta endpoints move from stub to product behavior.

---

*This document is an engineering audit, not legal or Meta policy advice. Follow [Meta Platform Terms](https://developers.facebook.com/terms) and current Marketing API documentation.*
