# API endpoint status (dashboard parity)

Canonical backend: Laravel `routes/api.php` (prefix `/api`). This file records how the React dashboard treats each surface: **product UI**, **internal / redirect**, **legacy duplicate**, or **stub**.

## Process (PRs)

Pull requests that touch API routes or dashboard API usage should update this file when behavior or classification changes. The [PR template](.github/pull_request_template.md) includes an explicit checkbox as a reminder — not automated enforcement, but part of the review bar.

| Endpoint | Status | Notes |
|----------|--------|--------|
| `GET /dashboard` | **Preferred** | Single home payload by role; dashboard SPA should use this instead of calling role-specific dashboard URLs in parallel. **Employee** and **accountant** responses include `meta_stored_insights_summary` (7-day rollup from `campaign_insights`, no live Meta call). |
| `GET /customer/dashboard` | Legacy duplicate | Still valid for mobile or direct use; dashboard uses unified `GET /dashboard` for customers. |
| `GET /admin/dashboard` | Legacy duplicate | Same as above for admin roles. |
| `GET /meta/callback` | Internal / redirect | Browser hits Laravel; code exchanged for long-lived token; redirects to `META_FRONTEND_REDIRECT_URI` (SPA). |
| `GET|POST /meta/webhook` | Internal / optional | Meta subscription verify + signed POST; set `META_WEBHOOK_VERIFY_TOKEN` and configure in Meta app. |
| `GET /meta/auth-url` | Product | Signed `state`; opens Meta OAuth dialog (`META_SCOPES`, `META_APP_ID`, `META_REDIRECT_URI`). |
| `GET /meta/connection` | Product | Connection status, token expiry, last sync/error (no secret values). |
| `POST /meta/disconnect` | Product | Deletes `meta_connections` row for user. |
| `GET /meta/ad-accounts` | Product | DB-linked ad accounts for user (after sync). |
| `POST /meta/sync/ad-accounts` | Product | Graph `me/adaccounts` → upsert `ad_accounts`. |
| `GET /meta/graph/campaigns` | Product | Live Graph campaigns for `?ad_account_id=` (local row id). |
| `POST /meta/graph/campaigns/{id}/pause` \| `/activate` | Product | Updates campaign status on Meta (`ad_account_id` in JSON body). |
| `POST /meta/sync/insights` | Product | Pulls daily insights into `campaign_insights` for Yalla `campaign_id` (needs `meta_campaign_id`). |
| `POST /meta/sync/ad-insights` | Product | Pulls daily rows into `meta_ad_insights` for a synced ad (`meta_ad_row_id` = PK of `meta_ads`). |
| `GET /meta/campaign-insights-series` | Product | Time series from DB for charts (`?campaign_id=`). |
| `GET /meta/ad-insights-series` | Product | Time series from DB for one ad (`?meta_ad_row_id=`). |
| `GET /employee/meta/stored-insights-summary` | Product | Optional; `?days=` (1–90). Same aggregates as dashboard strip for staff tooling. |
| `GET /accountant/meta/stored-insights-summary` | Product | Optional; `?days=` (1–90). Stored Meta campaign insights rollup for finance views. |
| `POST /meta/sync/ad-sets` | Product | `meta_campaign_id` + `ad_account_id` → upsert `meta_ad_sets`. |
| `POST /meta/sync/ads` | Product | `meta_ad_set_row_id` (local PK) → upsert `meta_ads`. |
| `GET /meta/stored/ad-sets` \| `/stored/ads` | Product | Read synced structure from DB. |
| `GET/PUT /admin/settings` | Stub / partial | GET may return an empty or placeholder object; PUT is not treated as a full product feature until the backend defines persisted fields. UI: read-only inspection + “coming soon”. |
| `POST /accountant/receipts` | Not exposed in UI | Requires validated body; empty or incomplete requests return 422. Dashboard does not offer a create action until a form matches API rules. |
| `GET /reports/*` | Product | Reports area uses tables, charts, and timelines — not a raw JSON explorer. |

## Maintenance

- When adding a route that should **never** appear in the SPA, add a row here and optionally mirror the note in `src/lib/internalEndpoints.ts`.
- When deprecating a route, mark **Deprecated** and point to the replacement (e.g. unified dashboard).
