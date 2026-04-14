/**
 * Backend routes that are not meant to be driven from this SPA UI (or are browser/server-only).
 * Full registry: see repo `docs/api-status.md`.
 */
export const EXTERNAL_OR_REDIRECT_ONLY = {
  /** Facebook redirects the browser here; Laravel exchanges the code and redirects to META_FRONTEND_REDIRECT_URI. */
  metaOAuthCallback: 'GET /api/meta/callback',
  /** Meta webhook verification + delivery (configure in Meta app + META_WEBHOOK_VERIFY_TOKEN). */
  metaWebhook: 'GET|POST /api/meta/webhook',
} as const
