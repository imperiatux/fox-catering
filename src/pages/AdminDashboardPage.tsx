import { useState, useEffect, useCallback, useRef } from 'react';
import type { DailyMenu, DailyOrders, Order, ParseMenuResponse } from '../types';

type Tab = 'menu' | 'orders';

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

// Aggregate orders into a summary string
function buildSummary(orders: Order[]): string[] {
  const counts: Record<string, number> = {};
  for (const o of orders) {
    const key = `${o.main} + ${o.secondary}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.entries(counts).map(([meal, n]) => `${n}× ${meal}`);
}

// ── Menu Tab ──────────────────────────────────────────────────────────────────

interface MenuTabProps {
  date: string;
  onDateChange: (d: string) => void;
}

function MenuTab({ date, onDateChange }: MenuTabProps) {
  const [vegMain, setVegMain] = useState('');
  const [vegSecondary, setVegSecondary] = useState('');
  const [nonVegMain, setNonVegMain] = useState('');
  const [nonVegSecondary, setNonVegSecondary] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'saving' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [parseStatus, setParseStatus] = useState<'idle' | 'parsing' | 'done' | 'error'>('idle');
  const [parseError, setParseError] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadMenu = useCallback(async (d: string) => {
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch(`/api/admin/menu?date=${d}`);
      if (res.status === 401) {
        window.location.href = '/admin';
        return;
      }
      const data: DailyMenu & { vegetarian: null | DailyMenu['vegetarian']; nonVegetarian: null | DailyMenu['nonVegetarian'] } = await res.json();
      setVegMain(data.vegetarian?.main ?? '');
      setVegSecondary(data.vegetarian?.secondary ?? '');
      setNonVegMain(data.nonVegetarian?.main ?? '');
      setNonVegSecondary(data.nonVegetarian?.secondary ?? '');
      setStatus('idle');
    } catch {
      setStatus('error');
      setErrorMsg('Failed to load menu.');
    }
  }, []);

  useEffect(() => {
    loadMenu(date);
  }, [date, loadMenu]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setStatus('saving');
    setErrorMsg('');
    try {
      const res = await fetch(`/api/admin/menu?date=${date}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          vegetarian: { main: vegMain.trim(), secondary: vegSecondary.trim() },
          nonVegetarian: { main: nonVegMain.trim(), secondary: nonVegSecondary.trim() },
        }),
      });
      if (res.status === 401) {
        window.location.href = '/admin';
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error ?? 'Failed to save menu.');
        setStatus('error');
        return;
      }
      setStatus('success');
    } catch {
      setStatus('error');
      setErrorMsg('Network error. Please try again.');
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview
    setPreviewUrl(URL.createObjectURL(file));
    setParseStatus('parsing');
    setParseError('');

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch('/api/admin/parse-menu', {
        method: 'POST',
        body: formData,
      });
      if (res.status === 401) { window.location.href = '/admin'; return; }
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setParseError(data.error ?? 'Failed to parse image.');
        setParseStatus('error');
        return;
      }
      const data: ParseMenuResponse = await res.json();
      setVegMain(data.vegetarian.main);
      setVegSecondary(data.vegetarian.secondary);
      setNonVegMain(data.nonVegetarian.main);
      setNonVegSecondary(data.nonVegetarian.secondary);
      setParseStatus('done');
      setStatus('idle'); // clear any previous save status
    } catch {
      setParseError('Network error while parsing image.');
      setParseStatus('error');
    }
  }

  function handleClearImage() {
    setPreviewUrl(null);
    setParseStatus('idle');
    setParseError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const isLoading = status === 'loading';
  const isSaving = status === 'saving';

  return (
    <section className="admin-section">
      <div className="admin-date-row">
        <label htmlFor="menu-date">Date</label>
        <input
          id="menu-date"
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          disabled={isLoading || isSaving}
        />
      </div>

      {/* ── Image upload / OCR ─────────────────────────────────── */}
      <div className="parse-menu-upload">
        <p className="parse-menu-upload__label">
          Upload the menu picture to auto-fill the fields below:
        </p>
        <div className="parse-menu-upload__row">
          <label className="btn btn-secondary parse-menu-upload__btn" htmlFor="menu-image-input">
            {parseStatus === 'parsing' ? 'Parsing…' : 'Upload menu image'}
          </label>
          <input
            id="menu-image-input"
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="parse-menu-upload__input"
            onChange={handleImageUpload}
            disabled={parseStatus === 'parsing' || isLoading || isSaving}
          />
          {previewUrl && (
            <button
              type="button"
              className="btn-link parse-menu-upload__clear"
              onClick={handleClearImage}
            >
              Clear
            </button>
          )}
        </div>
        {previewUrl && (
          <img
            src={previewUrl}
            alt="Uploaded menu preview"
            className="parse-menu-upload__preview"
          />
        )}
        {parseStatus === 'parsing' && (
          <p className="text-muted parse-menu-upload__status">Reading menu from image…</p>
        )}
        {parseStatus === 'done' && (
          <p className="text-success parse-menu-upload__status" role="status">
            Fields pre-filled from image — please review before saving.
          </p>
        )}
        {parseStatus === 'error' && parseError && (
          <p className="text-error parse-menu-upload__status" role="alert">{parseError}</p>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <form onSubmit={handleSave} className="admin-menu-form">
          <fieldset className="admin-fieldset">
            <legend className="admin-fieldset-legend">🥦 Vegetarian</legend>
            <div className="form-field">
              <label htmlFor="veg-main">Main course</label>
              <input
                id="veg-main"
                type="text"
                value={vegMain}
                onChange={(e) => setVegMain(e.target.value)}
                placeholder="e.g. Mushroom risotto"
                maxLength={200}
                disabled={isSaving}
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="veg-secondary">Secondary course</label>
              <input
                id="veg-secondary"
                type="text"
                value={vegSecondary}
                onChange={(e) => setVegSecondary(e.target.value)}
                placeholder="e.g. Garden salad"
                maxLength={200}
                disabled={isSaving}
                required
              />
            </div>
          </fieldset>

          <fieldset className="admin-fieldset">
            <legend className="admin-fieldset-legend">🥩 Non-Vegetarian</legend>
            <div className="form-field">
              <label htmlFor="nonveg-main">Main course</label>
              <input
                id="nonveg-main"
                type="text"
                value={nonVegMain}
                onChange={(e) => setNonVegMain(e.target.value)}
                placeholder="e.g. Grilled chicken"
                maxLength={200}
                disabled={isSaving}
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="nonveg-secondary">Secondary course</label>
              <input
                id="nonveg-secondary"
                type="text"
                value={nonVegSecondary}
                onChange={(e) => setNonVegSecondary(e.target.value)}
                placeholder="e.g. Caesar salad"
                maxLength={200}
                disabled={isSaving}
                required
              />
            </div>
          </fieldset>

          {status === 'success' && (
            <p className="text-success" role="status">Menu saved successfully.</p>
          )}
          {status === 'error' && errorMsg && (
            <p className="text-error" role="alert">{errorMsg}</p>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSaving}
          >
            {isSaving ? 'Saving…' : 'Save Menu'}
          </button>
        </form>
      )}
    </section>
  );
}

// ── Orders Tab ────────────────────────────────────────────────────────────────

interface OrdersTabProps {
  date: string;
  onDateChange: (d: string) => void;
}

function OrdersTab({ date, onDateChange }: OrdersTabProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const loadOrders = useCallback(async (d: string) => {
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch(`/api/admin/orders?date=${d}`);
      if (res.status === 401) {
        window.location.href = '/admin';
        return;
      }
      const data: DailyOrders = await res.json();
      setOrders(data.orders);
      setStatus('idle');
    } catch {
      setStatus('error');
      setErrorMsg('Failed to load orders.');
    }
  }, []);

  useEffect(() => {
    loadOrders(date);
  }, [date, loadOrders]);

  const summary = buildSummary(orders);

  return (
    <section className="admin-section">
      <div className="admin-date-row">
        <label htmlFor="orders-date">Date</label>
        <input
          id="orders-date"
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          disabled={status === 'loading'}
        />
      </div>

      {status === 'loading' ? (
        <p className="text-muted">Loading…</p>
      ) : status === 'error' ? (
        <p className="text-error" role="alert">{errorMsg}</p>
      ) : (
        <>
          {orders.length === 0 ? (
            <p className="text-muted">No orders for this date.</p>
          ) : (
            <>
              {summary.length > 0 && (
                <div className="admin-summary card">
                  <h3 className="admin-summary-title">Summary</h3>
                  <ul className="admin-summary-list">
                    {summary.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              )}

              <table className="admin-orders-table">
                <thead>
                  <tr>
                    <th>Nickname</th>
                    <th>Main Course</th>
                    <th>Secondary Course</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o, i) => (
                    <tr key={i}>
                      <td>{o.nickname}</td>
                      <td>{o.main}</td>
                      <td>{o.secondary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <div className="admin-export-row">
            <a
              href={`/api/admin/export?date=${date}`}
              className="btn btn-secondary"
              download
            >
              Export CSV
            </a>
            <span className="text-muted">{orders.length} order{orders.length !== 1 ? 's' : ''}</span>
          </div>
        </>
      )}
    </section>
  );
}

// ── Cutoff Toggle ─────────────────────────────────────────────────────────────

interface CutoffState {
  cutoffEnabled: boolean;
  cutoffHour: number;
  cutoffMinute: number;
  overrideActive: boolean;
}

function CutoffToggle() {
  const [state, setState] = useState<CutoffState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/cutoff')
      .then((r) => {
        if (r.status === 401) { window.location.href = '/admin'; return null; }
        return r.json();
      })
      .then((data: CutoffState | null) => { if (data) setState(data); })
      .catch(() => setError('Could not load cutoff state.'));
  }, []);

  async function toggle() {
    if (!state || busy) return;
    setBusy(true);
    setError('');
    const next = !state.cutoffEnabled;
    try {
      const res = await fetch('/api/admin/cutoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      });
      if (res.status === 401) { window.location.href = '/admin'; return; }
      if (!res.ok) throw new Error('Failed to update cutoff.');
      const data: CutoffState = await res.json();
      setState(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  if (!state) return null;

  const label = state.cutoffEnabled
    ? `Cutoff ON — ${String(state.cutoffHour).padStart(2, '0')}:${String(state.cutoffMinute).padStart(2, '0')}`
    : 'Cutoff OFF — ordering always open';

  return (
    <div className={`cutoff-toggle ${state.cutoffEnabled ? 'cutoff-toggle--on' : 'cutoff-toggle--off'}`}>
      <div className="cutoff-toggle__info">
        <span className="cutoff-toggle__label">{label}</span>
        {state.overrideActive && (
          <span className="cutoff-toggle__badge">runtime override</span>
        )}
      </div>
      <button
        type="button"
        className={`cutoff-toggle__btn ${state.cutoffEnabled ? 'cutoff-toggle__btn--on' : 'cutoff-toggle__btn--off'}`}
        onClick={toggle}
        disabled={busy}
        aria-pressed={state.cutoffEnabled}
        title={state.cutoffEnabled ? 'Disable cutoff (keep ordering open)' : 'Re-enable cutoff'}
      >
        {busy ? '…' : state.cutoffEnabled ? 'Disable cutoff' : 'Enable cutoff'}
      </button>
      {error && <p className="text-error cutoff-toggle__error">{error}</p>}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const [tab, setTab] = useState<Tab>('menu');
  const [menuDate, setMenuDate] = useState(todayString);
  const [ordersDate, setOrdersDate] = useState(todayString);

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    window.location.href = '/admin';
  }

  return (
    <div className="app">
      <header className="admin-header">
        <div className="container admin-header__inner">
          <h1 className="admin-header__title">Fox Catering — Admin</h1>
          <button className="btn btn-secondary admin-logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="container admin-main">
        <CutoffToggle />

        <nav className="admin-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'menu'}
            className={`admin-tab-btn${tab === 'menu' ? ' admin-tab-btn--active' : ''}`}
            onClick={() => setTab('menu')}
          >
            Menu Management
          </button>
          <button
            role="tab"
            aria-selected={tab === 'orders'}
            className={`admin-tab-btn${tab === 'orders' ? ' admin-tab-btn--active' : ''}`}
            onClick={() => setTab('orders')}
          >
            Orders
          </button>
        </nav>

        {tab === 'menu' && (
          <MenuTab date={menuDate} onDateChange={setMenuDate} />
        )}
        {tab === 'orders' && (
          <OrdersTab date={ordersDate} onDateChange={setOrdersDate} />
        )}
      </main>
    </div>
  );
}
