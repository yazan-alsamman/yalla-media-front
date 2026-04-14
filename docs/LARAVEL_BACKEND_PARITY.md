# Laravel parity notes (Yalla Media)

The folder `C:\Users\LENOVO\Desktop\Yalla Media` is currently **empty** in this environment. **Production** is documented elsewhere as **Laravel** (`routes/api.php`, prefix `/api`).

The **reference implementation** for the enhancements in this iteration lives in:

`Yalla_Media_Dashboard/backend/` — **Express + Prisma + SQLite**.

When you implement or extend the **Laravel** app, mirror the following so mobile + dashboard stay compatible.

## Data model

| Concept | Prisma / Node | Laravel (suggested) |
|--------|-----------------|----------------------|
| Campaign workflow | `CampaignStatus.pending_linking` | Add enum value + migration |
| Top-up requests | `TopUpRequest` (`pending` / `approved` / `rejected`) | New table, no wallet credit until `approved` |
| Task linkage | `Task.topUpRequestId`, types `campaign_linking`, `campaign_tracking`, `top_up_review` | Same columns / `type` string |
| Stored Meta rollup | `CampaignInsight` (per campaign + UTC day) | Table `campaign_insights` or reuse existing |
| Settings | `Setting` keys `meta_app_id`, `meta_app_secret`, `meta_redirect_uri`, `meta_access_token`, `low_balance_threshold` | `settings` table or `config` |

## HTTP routes to mirror

- `POST /api/customer/campaigns` → create with `pending_linking`, create linking task, notifications.
- `POST /api/customer/wallet/top-up-request` → `multipart/form-data`, field `proof` (file), `amount`, optional `notes`, `payment_method`.
- `GET /api/customer/wallet/top-up-requests` → list own requests.
- `POST /api/employee/campaigns/:id/complete-linking` → body `meta_link`, optional `ad_account_id`; sets `active`, completes linking task, creates tracking task + notifications.
- `POST /api/employee/campaigns/:id/approve` → only for `pending_approval` (legacy path).
- `GET /api/employee/campaigns/:id/insights/stored` → stored insight rows.
- `GET|POST /api/accountant/top-up-requests/...` → list, get, approve, reject.
- `GET /api/admin/operations/pulse` → super admin only; queues + inactive + low balance + campaign counts.
- `POST /api/admin/system/notify-inactive` → super admin; creates in-app notifications for super admins.
- `GET /api/tasks/stats` → include `open` = `pending` + `in_progress`.

## Auth & roles

- Assign linking tasks to employees with `employee_type` in (`linking`, `campaign_linking`) or any employee fallback.
- Assign tracking tasks to (`tracking`, `campaign_tracking`) or fallback.
- Top-up tasks: prefer `accountant`, else first `admin` / `super_admin`.

## Static files

- Payment proofs: `/uploads/topups/*` (Node). Laravel: `storage` + symlink or S3.
