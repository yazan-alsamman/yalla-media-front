# Task & notification flows

## Customer creates a campaign

```mermaid
sequenceDiagram
  participant C as Customer (app/dashboard)
  participant API as API
  participant L as Linking employee
  participant T as Tracking employee

  C->>API: POST /customer/campaigns
  API->>API: status = pending_linking
  API->>API: Task campaign_linking + notify customer
  API->>L: Notification + assigned task
  API->>API: Notify admins (optional digest)
  L->>API: POST .../complete-linking (meta_link)
  API->>API: status = active, complete linking task
  API->>C: Notification campaign live
  API->>T: Task campaign_tracking + notification
```

## Customer top-up with proof

```mermaid
sequenceDiagram
  participant C as Customer
  participant API as API
  participant A as Accountant

  C->>API: POST /customer/wallet/top-up-request (multipart proof)
  API->>API: TopUpRequest pending (no wallet change)
  API->>API: Task top_up_review
  API->>C: Notification submitted
  API->>A: Notifications (role) + assigned task
  A->>API: POST .../approve OR .../reject
  API->>API: Complete/cancel task
  API->>C: Notification approved/rejected
  Note over API: On approve: credit wallet + transaction
```

## Low balance (customer)

- On `GET /customer/dashboard` and `GET /customer/wallet`, if balance ≤ `low_balance_threshold` setting and no `low_balance` notification in the last 24h → create notification.

## Super admin inactivity digest

- `POST /admin/system/notify-inactive` creates one in-app notification per super admin summarizing dormant customer count (does not email users unless you extend it).
