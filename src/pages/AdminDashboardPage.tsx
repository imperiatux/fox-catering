import { useState, useEffect, useCallback, useRef } from 'react';
import { MENU_OPTIONS } from '../types';
import type { DailyOrders, Order } from '../types';
import { formatDateDisplay } from '../utils/date';

type Tab = 'menu' | 'orders';

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

// Classify each order using the fixed course constants
interface OrderCounts {
  nonVeg: number;
  veg: number;
  custom: number;
}

function classifyOrder(o: Order): 'nonVeg' | 'veg' | 'custom' {
  if (o.note) return 'custom';
  if (o.main === MENU_OPTIONS.nonVegMain && o.secondary === MENU_OPTIONS.nonVegSoup) return 'nonVeg';
  if (o.main === MENU_OPTIONS.vegMain    && o.secondary === MENU_OPTIONS.vegSoup)    return 'veg';
  return 'custom';
}

function categoriseOrders(orders: Order[]): OrderCounts {
  const counts: OrderCounts = { nonVeg: 0, veg: 0, custom: 0 };
  for (const o of orders) counts[classifyOrder(o)] += o.quantity;
  return counts;
}

// ── Menu Tab (image upload only) ──────────────────────────────────────────────

interface MenuTabProps {
  date: string;
  onDateChange: (d: string) => void;
}

function MenuTab({ date, onDateChange }: MenuTabProps) {
  const [storedUrl, setStoredUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadDone, setUploadDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load the already-stored image for this date
  useEffect(() => {
    setStoredUrl(null);
    fetch(`/api/menu-image?date=${date}`)
      .then(async (res) => {
        if (res.status === 401) { window.location.href = '/admin'; return; }
        if (!res.ok) return; // 404 = no image yet
        const data: { dataUrl: string } = await res.json();
        setStoredUrl(data.dataUrl);
      })
      .catch(() => { /* no image available */ });
  }, [date]);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPreviewUrl(URL.createObjectURL(file));
    setUploading(true);
    setUploadError('');
    setUploadDone(false);

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch(`/api/admin/parse-menu?date=${date}`, {
        method: 'POST',
        body: formData,
      });
      if (res.status === 401) { window.location.href = '/admin'; return; }
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setUploadError(data.error ?? 'Failed to upload image.');
      } else {
        setUploadDone(true);
        setStoredUrl(null); // will be superseded by the new previewUrl
      }
    } catch {
      setUploadError('Network error while uploading image.');
    } finally {
      setUploading(false);
    }
  }

  function handleClearImage() {
    setPreviewUrl(null);
    setUploadError('');
    setUploadDone(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // The image to display: fresh local preview takes priority over stored
  const displayUrl = previewUrl ?? storedUrl;

  return (
    <section className="admin-section">
      <div className="admin-date-row">
        <label htmlFor="menu-date">Date</label>
        <input
          id="menu-date"
          type="date"
          value={date}
          onChange={(e) => { onDateChange(e.target.value); handleClearImage(); }}
        />
      </div>

      <div className="parse-menu-upload">
        <p className="parse-menu-upload__label">
          Upload the menu picture to display it on the order page:
        </p>
        <div className="parse-menu-upload__row">
          <label className="btn btn-secondary parse-menu-upload__btn" htmlFor="menu-image-input">
            {uploading ? 'Uploading…' : 'Upload menu image'}
          </label>
          <input
            id="menu-image-input"
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="parse-menu-upload__input"
            onChange={handleImageUpload}
            disabled={uploading}
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
        {displayUrl && (
          <img
            src={displayUrl}
            alt="Menu image"
            className="parse-menu-upload__preview"
          />
        )}
        {uploading && (
          <p className="text-muted parse-menu-upload__status">Uploading…</p>
        )}
        {!uploading && uploadDone && !uploadError && (
          <p className="text-success parse-menu-upload__status" role="status">
            Image saved — it will be shown on the order page.
          </p>
        )}
        {!uploading && storedUrl && !previewUrl && !uploadError && (
          <p className="text-muted parse-menu-upload__status">
            Image already uploaded for this date.
          </p>
        )}
        {uploadError && (
          <p className="text-error parse-menu-upload__status" role="alert">{uploadError}</p>
        )}
      </div>
    </section>
  );
}

// ── WhatsApp message builder ──────────────────────────────────────────────────

function buildWhatsAppUrl(number: string, date: string, orders: Order[]): string {
  const dateLabel = formatDateDisplay(date);
  const counts = categoriseOrders(orders);
  const total = orders.reduce((s, o) => s + o.quantity, 0);

  const customOrders = orders.filter((o) => classifyOrder(o) === 'custom');

  const lines: string[] = [
    `🍽 Fox Catering order for ${dateLabel}`,
    '',
    `Non-vegetarian: ${counts.nonVeg}`,
    `Vegetarian: ${counts.veg}`,
    `Custom: ${counts.custom}`,
    `Total: ${total}`,
  ];

  if (customOrders.length > 0) {
    lines.push('', 'Custom requests:');
    for (const o of customOrders) {
      const qty = `${o.quantity}× `;
      const note = o.note ? ` — ${o.note}` : '';
      lines.push(`- ${qty}${o.secondary} · ${o.main}${note}`);
    }
  }

  const text = encodeURIComponent(lines.join('\n'));
  const clean = number.replace(/\D/g, '');
  return `https://wa.me/${clean}?text=${text}`;
}

// ── Orders Tab ────────────────────────────────────────────────────────────────

interface OrdersTabProps {
  date: string;
  onDateChange: (d: string) => void;
  whatsappNumber: string;
}

function OrdersTab({ date, onDateChange, whatsappNumber }: OrdersTabProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuImageUrl, setMenuImageUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [showAll, setShowAll] = useState(false);

  const loadOrders = useCallback(async (d: string) => {
    setStatus('loading');
    setErrorMsg('');
    setMenuImageUrl(null);
    try {
      const [ordersRes, imageRes] = await Promise.all([
        fetch(`/api/admin/orders?date=${d}`),
        fetch(`/api/menu-image?date=${d}`),
      ]);
      if (ordersRes.status === 401) {
        window.location.href = '/admin';
        return;
      }
      const data: DailyOrders = await ordersRes.json();
      setOrders(data.orders);
      if (imageRes.ok) {
        const img: { dataUrl: string } = await imageRes.json();
        setMenuImageUrl(img.dataUrl);
      }
      setStatus('idle');
    } catch {
      setStatus('error');
      setErrorMsg('Failed to load orders.');
    }
  }, []);

  useEffect(() => {
    loadOrders(date);
  }, [date, loadOrders]);

  const counts = categoriseOrders(orders);
  const customOrders = orders.filter((o) => classifyOrder(o) === 'custom');
  const visibleOrders = showAll ? orders : customOrders;

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

      {menuImageUrl && (
        <div className="menu-image-wrapper">
          <img src={menuImageUrl} alt="Today's menu" className="menu-image" />
        </div>
      )}

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
              <div className="admin-summary card">
                <h3 className="admin-summary-title">Summary</h3>
                <ul className="admin-summary-counts">
                  <li><span className="count-label">Non-vegetarian</span><span className="count-value">{counts.nonVeg}</span></li>
                  <li><span className="count-label">Vegetarian</span><span className="count-value">{counts.veg}</span></li>
                  <li><span className="count-label">Custom</span><span className="count-value">{counts.custom}</span></li>
                </ul>
              </div>

              <div className="admin-orders-header">
                <h3 className="admin-orders-header__title">
                  {showAll ? 'All orders' : 'Custom orders'}
                  <span className="text-muted"> ({visibleOrders.reduce((s, o) => s + o.quantity, 0)})</span>
                </h3>
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => setShowAll((v) => !v)}
                >
                  {showAll ? 'Show custom only' : 'Show all orders'}
                </button>
              </div>

              {visibleOrders.length === 0 ? (
                <p className="text-muted">No custom orders for this date.</p>
              ) : (
                <table className="admin-orders-table">
                  <thead>
                    <tr>
                      <th>Nickname</th>
                      <th>Qty</th>
                      <th>Soup Course</th>
                      <th>Main Course</th>
                      <th>Note</th>
                      {showAll && <th>Type</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleOrders.map((o, i) => {
                      const cls = classifyOrder(o);
                      const typeLabel = cls === 'nonVeg' ? 'Non-veg' : cls === 'veg' ? 'Veg' : 'Custom';
                      return (
                        <tr key={i}>
                          <td>{o.nickname}</td>
                          <td>{o.quantity ?? 1}</td>
                          <td>{o.secondary}</td>
                          <td>{o.main}</td>
                          <td className="text-muted">{o.note ?? '—'}</td>
                          {showAll && <td>{typeLabel}</td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
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
            <WhatsAppSendButton date={date} orders={orders} number={whatsappNumber} />
            <span className="text-muted">{orders.length} order{orders.length !== 1 ? 's' : ''}</span>
          </div>
        </>
      )}
    </section>
  );
}

// ── WhatsApp ──────────────────────────────────────────────────────────────────

interface WhatsAppSendButtonProps {
  date: string;
  orders: Order[];
  number: string;
}

function WhatsAppSendButton({ date, orders, number }: WhatsAppSendButtonProps) {
  if (!number || orders.length === 0) return null;
  return (
    <a
      href={buildWhatsAppUrl(number, date, orders)}
      target="_blank"
      rel="noopener noreferrer"
      className="btn btn-primary"
    >
      Send to WhatsApp
    </a>
  );
}

interface WhatsAppSettingsProps {
  number: string;
  onNumberChange: (n: string) => void;
}

function WhatsAppSettings({ number, onNumberChange }: WhatsAppSettingsProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsappNumber: draft }),
      });
      if (res.status === 401) { window.location.href = '/admin'; return; }
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? 'Failed to save.');
      }
      const d: { whatsappNumber?: string } = await res.json();
      onNumberChange(d.whatsappNumber ?? '');
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  function startEdit() {
    setDraft(number);
    setEditing(true);
  }

  const label = number
    ? `WhatsApp: +${number}`
    : 'WhatsApp number not set — Send button hidden';

  return (
    <div className={`cutoff-toggle ${number ? 'cutoff-toggle--on' : 'cutoff-toggle--off'}`}>
      <div className="cutoff-toggle__info">
        <span className="cutoff-toggle__label">{label}</span>
      </div>
      {editing ? (
        <div className="whatsapp-edit-row">
          <input
            type="tel"
            className="whatsapp-number-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. 40712345678"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') void save(); if (e.key === 'Escape') setEditing(false); }}
          />
          <button type="button" className="cutoff-toggle__btn cutoff-toggle__btn--on" onClick={() => void save()} disabled={busy}>
            {busy ? '…' : 'Save'}
          </button>
          <button type="button" className="cutoff-toggle__btn cutoff-toggle__btn--off" onClick={() => setEditing(false)} disabled={busy}>
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={`cutoff-toggle__btn ${number ? 'cutoff-toggle__btn--on' : 'cutoff-toggle__btn--off'}`}
          onClick={startEdit}
        >
          {number ? 'Change number' : 'Set number'}
        </button>
      )}
      {error && <p className="text-error cutoff-toggle__error">{error}</p>}
    </div>
  );
}

// ── Weekend Toggle ────────────────────────────────────────────────────────────

const WEEKEND_KEY = 'fox_disable_weekend_check';

function WeekendToggle() {
  const [disabled, setDisabled] = useState(() => {
    try { return localStorage.getItem(WEEKEND_KEY) === 'true'; } catch { return false; }
  });

  function toggle() {
    const next = !disabled;
    try { next ? localStorage.setItem(WEEKEND_KEY, 'true') : localStorage.removeItem(WEEKEND_KEY); } catch { /* ignore */ }
    setDisabled(next);
  }

  const label = disabled ? 'Weekend check OFF — ordering open on weekends' : 'Weekend check ON — weekends blocked';

  return (
    <div className={`cutoff-toggle ${disabled ? 'cutoff-toggle--off' : 'cutoff-toggle--on'}`}>
      <div className="cutoff-toggle__info">
        <span className="cutoff-toggle__label">{label}</span>
        {disabled && <span className="cutoff-toggle__badge">testing mode</span>}
      </div>
      <button
        type="button"
        className={`cutoff-toggle__btn ${disabled ? 'cutoff-toggle__btn--off' : 'cutoff-toggle__btn--on'}`}
        onClick={toggle}
        aria-pressed={disabled}
        title={disabled ? 'Re-enable weekend block' : 'Disable weekend block for testing'}
      >
        {disabled ? 'Enable weekend check' : 'Disable weekend check'}
      </button>
    </div>
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
  const [whatsappNumber, setWhatsappNumber] = useState('');

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => {
        if (r.status === 401) { window.location.href = '/admin'; return null; }
        return r.json();
      })
      .then((data: { whatsappNumber?: string } | null) => {
        if (data) setWhatsappNumber(data.whatsappNumber ?? '');
      })
      .catch(() => { /* non-critical */ });
  }, []);

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
        <WeekendToggle />
        <WhatsAppSettings number={whatsappNumber} onNumberChange={setWhatsappNumber} />

        <nav className="admin-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'menu'}
            className={`admin-tab-btn${tab === 'menu' ? ' admin-tab-btn--active' : ''}`}
            onClick={() => setTab('menu')}
          >
            Menu Image
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
          <OrdersTab date={ordersDate} onDateChange={setOrdersDate} whatsappNumber={whatsappNumber} />
        )}
      </main>
    </div>
  );
}
