import { BarChart3, ExternalLink, KeyRound, Pause, Play, RefreshCw, Unplug } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ConfirmDialog } from '../components/AppDialog'
import { SectionCard } from '../components/SectionCard'
import { useAppContext } from '../context/AppContext'
import { t } from '../i18n'
import { api } from '../lib/api'
import { EXTERNAL_OR_REDIRECT_ONLY } from '../lib/internalEndpoints'
import { currency } from '../utils/format'

type Conn = {
  connected?: boolean
  token_expires_at?: string | null
  scopes?: string | null
  last_error?: string | null
  last_ad_accounts_sync_at?: string | null
}

function pickStr(r: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = r[k]
    if (v != null && v !== '') return String(v)
  }
  return '—'
}

function settingsMap(rows: { key: string; value: string }[]): Record<string, string> {
  const m: Record<string, string> = {}
  for (const r of rows) m[r.key] = r.value
  return m
}

export function MetaIntegrationsPage() {
  const { theme, role, language } = useAppContext()
  const canEditMetaConfig = role === 'admin' || role === 'super_admin'

  const [metaAppId, setMetaAppId] = useState('')
  const [metaAppSecret, setMetaAppSecret] = useState('')
  const [metaRedirectUri, setMetaRedirectUri] = useState('')
  const [metaAccessToken, setMetaAccessToken] = useState('')
  const [configLoading, setConfigLoading] = useState(false)
  const [configBusy, setConfigBusy] = useState(false)
  const [configMsg, setConfigMsg] = useState<string | null>(null)
  const [connection, setConnection] = useState<Conn | null>(null)
  const [accounts, setAccounts] = useState<Record<string, unknown>[]>([])
  const [graphCampaigns, setGraphCampaigns] = useState<Record<string, unknown>[]>([])
  const [adSets, setAdSets] = useState<Record<string, unknown>[]>([])
  const [ads, setAds] = useState<Record<string, unknown>[]>([])
  const [insightSeries, setInsightSeries] = useState<{ date: string; spend: number; impressions: number; clicks: number }[]>([])
  const [adInsightRowId, setAdInsightRowId] = useState('')
  const [adInsightSeries, setAdInsightSeries] = useState<
    { date: string; spend: number; impressions: number; clicks: number; conversions?: number }[]
  >([])

  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null)
  const [selectedMetaCampaignId, setSelectedMetaCampaignId] = useState<string>('')
  const [insightCampaignId, setInsightCampaignId] = useState('')

  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [disconnectConfirmOpen, setDisconnectConfirmOpen] = useState(false)

  const loadConnection = useCallback(async () => {
    try {
      const res = (await api.get('/meta/connection')) as { data?: Conn }
      setConnection(res.data ?? null)
    } catch {
      setConnection(null)
    }
  }, [])

  const loadAccounts = useCallback(async () => {
    setLoading(true)
    setMsg(null)
    try {
      await loadConnection()
      const acc = (await api.get('/meta/ad-accounts')) as { data?: Record<string, unknown>[] }
      setAccounts(Array.isArray(acc.data) ? acc.data : [])
    } catch (e) {
      setAccounts([])
      setMsg(e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [loadConnection])

  useEffect(() => {
    void loadAccounts()
  }, [loadAccounts])

  const loadMetaConfig = useCallback(async () => {
    if (!canEditMetaConfig) return
    setConfigLoading(true)
    setConfigMsg(null)
    try {
      const res = (await api.get('/admin/settings')) as { data?: { settings?: { key: string; value: string }[] } }
      const map = settingsMap(res.data?.settings ?? [])
      setMetaAppId(map.meta_app_id ?? '')
      setMetaAppSecret(map.meta_app_secret ?? '')
      setMetaRedirectUri(map.meta_redirect_uri ?? '')
      setMetaAccessToken(map.meta_access_token ?? '')
    } catch {
      setConfigMsg(t(language, 'metaIntegrations.loadSettingsFail'))
    } finally {
      setConfigLoading(false)
    }
  }, [canEditMetaConfig, language])

  useEffect(() => {
    void loadMetaConfig()
  }, [loadMetaConfig])

  async function saveMetaConfig() {
    if (!canEditMetaConfig) return
    setConfigBusy(true)
    setConfigMsg(null)
    try {
      await api.put('/admin/settings', {
        settings: [
          { key: 'meta_app_id', value: metaAppId.trim(), type: 'string' },
          { key: 'meta_app_secret', value: metaAppSecret.trim(), type: 'secret' },
          { key: 'meta_redirect_uri', value: metaRedirectUri.trim(), type: 'string' },
          { key: 'meta_access_token', value: metaAccessToken.trim(), type: 'secret' },
        ],
      })
      setConfigMsg(t(language, 'metaIntegrations.savedRestartHint'))
    } catch (e) {
      setConfigMsg(e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : t(language, 'metaIntegrations.saveFail'))
    } finally {
      setConfigBusy(false)
    }
  }

  async function fetchAuthUrl() {
    setBusy('auth')
    setMsg(null)
    try {
      const res = (await api.get('/meta/auth-url')) as { data?: { url?: string } }
      const url = res?.data?.url
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
      else setMsg(t(language, 'metaIntegrations.noOAuthUrl'))
    } catch (e) {
      setMsg(e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Failed')
    } finally {
      setBusy(null)
    }
  }

  async function performDisconnect() {
    setDisconnectConfirmOpen(false)
    setBusy('disconnect')
    try {
      await api.post('/meta/disconnect')
      await loadAccounts()
      setGraphCampaigns([])
      setAdSets([])
      setAds([])
    } catch (e) {
      setMsg(e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Failed')
    } finally {
      setBusy(null)
    }
  }

  async function syncAdAccounts() {
    setBusy('sync-acc')
    setMsg(null)
    try {
      await api.post('/meta/sync/ad-accounts')
      await loadAccounts()
    } catch (e) {
      setMsg(e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Sync failed')
    } finally {
      setBusy(null)
    }
  }

  async function loadGraphCampaigns() {
    if (selectedAccountId == null) return
    setBusy('graph-camp')
    setMsg(null)
    try {
      const res = (await api.get('/meta/graph/campaigns', { params: { ad_account_id: selectedAccountId } })) as {
        data?: Record<string, unknown>[]
      }
      setGraphCampaigns(Array.isArray(res.data) ? res.data : [])
    } catch (e) {
      setGraphCampaigns([])
      setMsg(e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Failed')
    } finally {
      setBusy(null)
    }
  }

  async function pauseGraph(metaId: string) {
    if (selectedAccountId == null) return
    setBusy(`pause-${metaId}`)
    try {
      await api.post(`/meta/graph/campaigns/${encodeURIComponent(metaId)}/pause`, { ad_account_id: selectedAccountId })
      await loadGraphCampaigns()
    } catch (e) {
      setMsg(e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Failed')
    } finally {
      setBusy(null)
    }
  }

  async function activateGraph(metaId: string) {
    if (selectedAccountId == null) return
    setBusy(`act-${metaId}`)
    try {
      await api.post(`/meta/graph/campaigns/${encodeURIComponent(metaId)}/activate`, { ad_account_id: selectedAccountId })
      await loadGraphCampaigns()
    } catch (e) {
      setMsg(e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Failed')
    } finally {
      setBusy(null)
    }
  }

  async function syncAdSets() {
    if (selectedAccountId == null || !selectedMetaCampaignId.trim()) return
    setBusy('adsets')
    try {
      await api.post('/meta/sync/ad-sets', {
        ad_account_id: selectedAccountId,
        meta_campaign_id: selectedMetaCampaignId.trim(),
      })
      await loadStoredAdSets()
    } catch (e) {
      setMsg(e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Failed')
    } finally {
      setBusy(null)
    }
  }

  async function loadStoredAdSets() {
    if (!selectedMetaCampaignId.trim()) {
      setAdSets([])
      return
    }
    try {
      const res = (await api.get('/meta/stored/ad-sets', { params: { meta_campaign_id: selectedMetaCampaignId.trim() } })) as {
        data?: Record<string, unknown>[]
      }
      setAdSets(Array.isArray(res.data) ? res.data : [])
    } catch {
      setAdSets([])
    }
  }

  async function syncAdsForSet(rowId: number) {
    setBusy(`ads-${rowId}`)
    try {
      await api.post('/meta/sync/ads', { meta_ad_set_row_id: rowId })
      await loadStoredAds(rowId)
    } catch (e) {
      setMsg(e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Failed')
    } finally {
      setBusy(null)
    }
  }

  async function loadStoredAds(rowId: number) {
    try {
      const res = (await api.get('/meta/stored/ads', { params: { meta_ad_set_row_id: rowId } })) as {
        data?: Record<string, unknown>[]
      }
      setAds(Array.isArray(res.data) ? res.data : [])
    } catch {
      setAds([])
    }
  }

  async function syncInsightsPull() {
    const id = Number(insightCampaignId)
    if (!id) {
      setMsg(t(language, 'metaIntegrations.enterYallaCampaignId'))
      return
    }
    setBusy('insights-sync')
    try {
      await api.post('/meta/sync/insights', { campaign_id: id })
      await loadInsightSeries(id)
    } catch (e) {
      setMsg(e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Failed')
    } finally {
      setBusy(null)
    }
  }

  async function loadInsightSeries(id: number) {
    try {
      const res = (await api.get('/meta/campaign-insights-series', { params: { campaign_id: id } })) as {
        data?: { date: string; spend: number; impressions: number; clicks: number }[]
      }
      setInsightSeries(Array.isArray(res.data) ? res.data : [])
    } catch {
      setInsightSeries([])
    }
  }

  async function syncAdInsightsPull() {
    const id = Number(adInsightRowId)
    if (!id) {
      setMsg(t(language, 'metaIntegrations.enterAdRowId'))
      return
    }
    setBusy('ad-insights-sync')
    try {
      await api.post('/meta/sync/ad-insights', { meta_ad_row_id: id })
      await loadAdInsightSeries(id)
    } catch (e) {
      setMsg(e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Failed')
    } finally {
      setBusy(null)
    }
  }

  async function loadAdInsightSeries(id: number) {
    try {
      const res = (await api.get('/meta/ad-insights-series', { params: { meta_ad_row_id: id } })) as {
        data?: { date: string; spend: number; impressions: number; clicks: number; conversions?: number }[]
      }
      setAdInsightSeries(Array.isArray(res.data) ? res.data : [])
    } catch {
      setAdInsightSeries([])
    }
  }

  const gridStroke = theme === 'dark' ? '#2b3952' : '#eceff4'

  return (
    <section className="page-grid">
      <div className="page-title page-title--row">
        <div>
          <h2>{t(language, 'metaIntegrations.pageTitle')}</h2>
          <p>{t(language, 'metaIntegrations.pageSubtitle')}</p>
          <ol className="type-caption" style={{ margin: '10px 0 0', paddingRight: 18, paddingLeft: 18, maxWidth: 'min(100%, 38rem)' }}>
            <li style={{ marginBottom: 4 }}>{t(language, 'metaIntegrations.stepConnect')}</li>
            <li style={{ marginBottom: 4 }}>{t(language, 'metaIntegrations.stepSyncAccounts')}</li>
            <li style={{ marginBottom: 4 }}>{t(language, 'metaIntegrations.stepPickCampaign')}</li>
            <li>{t(language, 'metaIntegrations.stepInsights')}</li>
          </ol>
          <p className="type-caption muted" style={{ marginTop: 10, maxWidth: 'min(100%, 40rem)' }}>
            {t(language, 'metaIntegrations.prerequisitesHint')}
          </p>
        </div>
        <span className="pill pill--gray" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <BarChart3 size={14} /> {t(language, 'metaIntegrations.badgeAdsManager')}
        </span>
      </div>

      <SectionCard
        title={t(language, 'metaIntegrations.connectionTitle')}
        description={t(language, 'metaIntegrations.connectionDesc')}
        action={
          <div className="row-actions" style={{ flexWrap: 'wrap', gap: 8 }}>
            <button type="button" className="primary-btn" disabled={busy != null} onClick={() => void fetchAuthUrl()}>
              <ExternalLink size={16} /> {busy === 'auth' ? '…' : t(language, 'metaIntegrations.connectMeta')}
            </button>
            <button type="button" className="ghost-btn" disabled={busy != null || !connection?.connected} onClick={() => setDisconnectConfirmOpen(true)}>
              <Unplug size={16} /> {t(language, 'metaIntegrations.disconnect')}
            </button>
            <button type="button" className="ghost-btn" disabled={loading || busy != null} onClick={() => void loadAccounts()}>
              <RefreshCw size={16} /> {t(language, 'metaIntegrations.refresh')}
            </button>
          </div>
        }
      >
        {loading ? (
          <p className="muted">{t(language, 'metaIntegrations.loadingConnection')}</p>
        ) : (
          <dl className="detail-grid">
            <div className="detail-row">
              <dt>{t(language, 'metaIntegrations.status')}</dt>
              <dd>
                {connection?.connected ? (
                  <span className="pill pill--green">{t(language, 'metaIntegrations.connected')}</span>
                ) : (
                  <span className="pill pill--gray">{t(language, 'metaIntegrations.notConnected')}</span>
                )}
              </dd>
            </div>
            <div className="detail-row">
              <dt>{t(language, 'metaIntegrations.tokenExpires')}</dt>
              <dd className="muted">{connection?.token_expires_at ?? '—'}</dd>
            </div>
            <div className="detail-row">
              <dt>{t(language, 'metaIntegrations.lastAdAccountSync')}</dt>
              <dd className="muted">{connection?.last_ad_accounts_sync_at ?? '—'}</dd>
            </div>
            <div className="detail-row">
              <dt>{t(language, 'metaIntegrations.scopes')}</dt>
              <dd className="muted" style={{ fontSize: 12 }}>
                {connection?.scopes ?? '—'}
              </dd>
            </div>
            {connection?.last_error ? (
              <div className="detail-row">
                <dt>{t(language, 'metaIntegrations.lastError')}</dt>
                <dd className="login-error" style={{ fontSize: 13 }}>
                  {connection.last_error}
                </dd>
              </div>
            ) : null}
          </dl>
        )}
        <details className="advanced-details" style={{ marginTop: 12 }}>
          <summary>{t(language, 'metaIntegrations.techNoteTitle')}</summary>
          <p className="type-caption" style={{ margin: '0 0 8px' }}>
            {EXTERNAL_OR_REDIRECT_ONLY.metaOAuthCallback}. {t(language, 'metaIntegrations.techNoteBody')}
          </p>
        </details>
        {msg ? <p className="login-error" style={{ marginTop: 12 }}>{msg}</p> : null}
      </SectionCard>

      {canEditMetaConfig ? (
        <SectionCard
          title={t(language, 'metaIntegrations.metaConfigTitle')}
          description={t(language, 'metaIntegrations.metaConfigDesc')}
          action={
            <div className="row-actions" style={{ gap: 8 }}>
              <button type="button" className="ghost-btn" disabled={configLoading || configBusy} onClick={() => void loadMetaConfig()}>
                <RefreshCw size={16} /> {t(language, 'metaIntegrations.reload')}
              </button>
              <button type="button" className="primary-btn" disabled={configBusy || configLoading} onClick={() => void saveMetaConfig()}>
                <KeyRound size={16} /> {configBusy ? '…' : t(language, 'metaIntegrations.saveConfig')}
              </button>
            </div>
          }
        >
          {configLoading ? (
            <p className="muted">{t(language, 'metaIntegrations.loadingSettings')}</p>
          ) : (
            <div className="settings-grid" style={{ maxWidth: 'min(100%, 40rem)' }}>
              <label>
                <span>{t(language, 'metaIntegrations.appId')}</span>
                <input value={metaAppId} onChange={(e) => setMetaAppId(e.target.value)} autoComplete="off" />
              </label>
              <label>
                <span>{t(language, 'metaIntegrations.appSecret')}</span>
                <input
                  type="password"
                  value={metaAppSecret}
                  onChange={(e) => setMetaAppSecret(e.target.value)}
                  autoComplete="new-password"
                />
              </label>
              <label>
                <span>{t(language, 'metaIntegrations.oauthRedirect')}</span>
                <input value={metaRedirectUri} onChange={(e) => setMetaRedirectUri(e.target.value)} placeholder="https://..." />
              </label>
              <label>
                <span>{t(language, 'metaIntegrations.systemToken')}</span>
                <input
                  type="password"
                  value={metaAccessToken}
                  onChange={(e) => setMetaAccessToken(e.target.value)}
                  autoComplete="new-password"
                />
              </label>
            </div>
          )}
          {configMsg ? <p className="type-caption muted" style={{ marginTop: 12 }}>{configMsg}</p> : null}
        </SectionCard>
      ) : null}

      <SectionCard
        title={t(language, 'metaIntegrations.adAccountsTitle')}
        description={t(language, 'metaIntegrations.adAccountsDesc')}
        action={
          <button type="button" className="primary-btn" disabled={busy != null || !connection?.connected} onClick={() => void syncAdAccounts()}>
            {busy === 'sync-acc' ? '…' : t(language, 'metaIntegrations.syncFromMeta')}
          </button>
        }
      >
        {loading ? (
          <p className="muted">{t(language, 'metaIntegrations.loading')}</p>
        ) : accounts.length === 0 ? (
          <p className="muted">{t(language, 'metaIntegrations.noAdAccountsYet')}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th />
                  <th>{t(language, 'metaIntegrations.tableName')}</th>
                  <th>{t(language, 'metaIntegrations.tableAccountId')}</th>
                  <th>{t(language, 'metaIntegrations.tableMetaStatus')}</th>
                  <th>{t(language, 'metaIntegrations.tableLastSynced')}</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((r) => {
                  const id = Number(r.id)
                  return (
                    <tr key={id}>
                      <td>
                        <input
                          type="radio"
                          name="adacc"
                          checked={selectedAccountId === id}
                          onChange={() => {
                            setSelectedAccountId(id)
                            setGraphCampaigns([])
                            setAdSets([])
                            setAds([])
                          }}
                        />
                      </td>
                      <td>
                        <strong>{pickStr(r, 'name')}</strong>
                      </td>
                      <td className="muted">{pickStr(r, 'meta_ad_account_id')}</td>
                      <td>{pickStr(r, 'account_status', 'status')}</td>
                      <td className="muted">{pickStr(r, 'last_synced_at')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title={t(language, 'metaIntegrations.graphCampaignsTitle')}
        description={t(language, 'metaIntegrations.graphCampaignsDesc')}
        action={
          <button type="button" className="primary-btn" disabled={busy != null || selectedAccountId == null} onClick={() => void loadGraphCampaigns()}>
            {busy === 'graph-camp' ? '…' : t(language, 'metaIntegrations.loadCampaigns')}
          </button>
        }
      >
        {graphCampaigns.length === 0 ? (
          <p className="muted">{t(language, 'metaIntegrations.selectAccountFirst')}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t(language, 'metaIntegrations.tableId')}</th>
                  <th>{t(language, 'metaIntegrations.tableName')}</th>
                  <th>{t(language, 'metaIntegrations.status')}</th>
                  <th>{t(language, 'metaIntegrations.tableActions')}</th>
                </tr>
              </thead>
              <tbody>
                {graphCampaigns.map((c) => {
                  const mid = pickStr(c, 'id')
                  return (
                    <tr key={mid}>
                      <td className="muted">{mid}</td>
                      <td>{pickStr(c, 'name')}</td>
                      <td>{pickStr(c, 'effective_status', 'status')}</td>
                      <td>
                        <div className="row-actions">
                          <button type="button" className="icon-btn" title={t(language, 'metaIntegrations.useForAdSets')} onClick={() => setSelectedMetaCampaignId(mid)}>
                            {t(language, 'metaIntegrations.select')}
                          </button>
                          <button type="button" className="icon-btn" disabled={busy != null} onClick={() => void pauseGraph(mid)}>
                            <Pause size={14} />
                          </button>
                          <button type="button" className="icon-btn" disabled={busy != null} onClick={() => void activateGraph(mid)}>
                            <Play size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title={t(language, 'metaIntegrations.adSetsTitle')}
        description={t(language, 'metaIntegrations.adSetsDesc')}
        action={
          <div className="row-actions">
            <input
              placeholder={t(language, 'metaIntegrations.placeholderMetaCampaignId')}
              value={selectedMetaCampaignId}
              onChange={(e) => setSelectedMetaCampaignId(e.target.value)}
              style={{ maxWidth: 200 }}
            />
            <button type="button" className="primary-btn" disabled={busy != null || selectedAccountId == null || !selectedMetaCampaignId.trim()} onClick={() => void syncAdSets()}>
              {busy === 'adsets' ? '…' : t(language, 'metaIntegrations.syncAdSets')}
            </button>
            <button type="button" className="ghost-btn" disabled={!selectedMetaCampaignId.trim()} onClick={() => void loadStoredAdSets()}>
              {t(language, 'metaIntegrations.reloadAdSets')}
            </button>
          </div>
        }
      >
        {adSets.length === 0 ? (
          <p className="muted">{t(language, 'metaIntegrations.noAdSets')}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t(language, 'metaIntegrations.adSetCol')}</th>
                  <th>{t(language, 'metaIntegrations.status')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {adSets.map((s) => {
                  const rowId = Number(s.id)
                  return (
                    <tr key={rowId}>
                      <td>
                        <strong>{pickStr(s, 'name')}</strong>
                        <div className="muted">{pickStr(s, 'meta_ad_set_id')}</div>
                      </td>
                      <td>{pickStr(s, 'effective_status', 'status')}</td>
                      <td>
                        <button type="button" className="ghost-btn" disabled={busy != null} onClick={() => void syncAdsForSet(rowId)}>
                          {busy === `ads-${rowId}` ? '…' : t(language, 'metaIntegrations.syncAds')}
                        </button>
                        <button type="button" className="ghost-btn" style={{ marginLeft: 8 }} onClick={() => void loadStoredAds(rowId)}>
                          {t(language, 'metaIntegrations.showAds')}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {ads.length > 0 ? (
          <div style={{ marginTop: 16 }}>
            <h4 style={{ marginBottom: 8 }}>{t(language, 'metaIntegrations.adsLastLoaded')}</h4>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t(language, 'metaIntegrations.rowId')}</th>
                    <th>{t(language, 'metaIntegrations.tableName')}</th>
                    <th>{t(language, 'metaIntegrations.status')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {ads.map((a) => {
                    const rowId = Number(a.id)
                    return (
                      <tr key={pickStr(a, 'meta_ad_id')}>
                        <td className="muted">{Number.isFinite(rowId) ? rowId : '—'}</td>
                        <td>{pickStr(a, 'name')}</td>
                        <td>{pickStr(a, 'effective_status', 'status')}</td>
                        <td>
                          <button
                            type="button"
                            className="ghost-btn"
                            disabled={!Number.isFinite(rowId)}
                            onClick={() => {
                              setAdInsightRowId(String(rowId))
                              setMsg(null)
                            }}
                          >
                            {t(language, 'metaIntegrations.useForAdInsights')}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        title={t(language, 'metaIntegrations.adInsightsTitle')}
        description={t(language, 'metaIntegrations.adInsightsDesc')}
        action={
          <div className="row-actions" style={{ flexWrap: 'wrap', gap: 8 }}>
            <input
              placeholder={t(language, 'metaIntegrations.placeholderAdRowId')}
              value={adInsightRowId}
              onChange={(e) => setAdInsightRowId(e.target.value)}
              style={{ maxWidth: 140 }}
            />
            <button type="button" className="primary-btn" disabled={busy != null} onClick={() => void syncAdInsightsPull()}>
              {busy === 'ad-insights-sync' ? '…' : t(language, 'metaIntegrations.pullFromMeta')}
            </button>
            <button
              type="button"
              className="ghost-btn"
              disabled={!adInsightRowId.trim()}
              onClick={() => void loadAdInsightSeries(Number(adInsightRowId))}
            >
              {t(language, 'metaIntegrations.loadChart')}
            </button>
          </div>
        }
      >
        {adInsightSeries.length === 0 ? (
          <p className="muted">{t(language, 'metaIntegrations.adChartEmpty')}</p>
        ) : (
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={adInsightSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(value, name, item) => {
                    const label = String(name ?? '')
                    const dataKey = item && typeof item === 'object' && 'dataKey' in item ? String((item as { dataKey?: string }).dataKey ?? '') : ''
                    const num = typeof value === 'number' ? value : Number(value)
                    if (value == null || Number.isNaN(num)) return ['—', label]
                    return dataKey === 'spend' ? [currency(num), label] : [num, label]
                  }}
                />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="impressions" name={t(language, 'metaIntegrations.chartImpressions')} stroke="#a855f7" dot={false} strokeWidth={2} />
                <Line yAxisId="left" type="monotone" dataKey="clicks" name={t(language, 'metaIntegrations.chartClicks')} stroke="#0ea5e9" dot={false} strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="spend" name={t(language, 'metaIntegrations.chartSpend')} stroke="#10b981" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title={t(language, 'metaIntegrations.campaignInsightsTitle')}
        description={t(language, 'metaIntegrations.campaignInsightsDesc')}
        action={
          <div className="row-actions" style={{ flexWrap: 'wrap', gap: 8 }}>
            <input
              placeholder={t(language, 'metaIntegrations.placeholderYallaCampaignId')}
              value={insightCampaignId}
              onChange={(e) => setInsightCampaignId(e.target.value)}
              style={{ maxWidth: 160 }}
            />
            <button type="button" className="primary-btn" disabled={busy != null} onClick={() => void syncInsightsPull()}>
              {busy === 'insights-sync' ? '…' : t(language, 'metaIntegrations.pullFromMeta')}
            </button>
            <button
              type="button"
              className="ghost-btn"
              disabled={!insightCampaignId.trim()}
              onClick={() => void loadInsightSeries(Number(insightCampaignId))}
            >
              {t(language, 'metaIntegrations.loadChart')}
            </button>
          </div>
        }
      >
        {insightSeries.length === 0 ? (
          <p className="muted">{t(language, 'metaIntegrations.campaignChartEmpty')}</p>
        ) : (
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={insightSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(value, name, item) => {
                    const label = String(name ?? '')
                    const dataKey = item && typeof item === 'object' && 'dataKey' in item ? String((item as { dataKey?: string }).dataKey ?? '') : ''
                    const num = typeof value === 'number' ? value : Number(value)
                    if (value == null || Number.isNaN(num)) return ['—', label]
                    return dataKey === 'spend' ? [currency(num), label] : [num, label]
                  }}
                />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="impressions" name={t(language, 'metaIntegrations.chartImpressions')} stroke="#6366f1" dot={false} strokeWidth={2} />
                <Line yAxisId="left" type="monotone" dataKey="clicks" name={t(language, 'metaIntegrations.chartClicks')} stroke="#0ea5e9" dot={false} strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="spend" name={t(language, 'metaIntegrations.chartSpend')} stroke="#10b981" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      <ConfirmDialog
        open={disconnectConfirmOpen}
        title={t(language, 'metaIntegrations.disconnect')}
        message={t(language, 'metaIntegrations.disconnectConfirm')}
        confirmLabel={t(language, 'dialog.confirm')}
        cancelLabel={t(language, 'users.cancel')}
        danger
        onCancel={() => setDisconnectConfirmOpen(false)}
        onConfirm={() => void performDisconnect()}
      />
    </section>
  )
}
