import { useState, useEffect, useRef } from 'react';
import { useMenu } from '../hooks/useMenu';
import { useOrders } from '../hooks/useOrders';
import { useConfig } from '../hooks/useConfig';
import {
  getTodayBucharest,
  isWeekend,
  isCutoffPassed,
  minutesUntilCutoff,
  formatDateDisplay,
} from '../utils/date';
import type { Order } from '../types';

const NICKNAME_KEY = 'fox_nickname';

// ── Helpers ─────────────────────────────────────────────────────────────────

function loadNickname(): string {
  try {
    return localStorage.getItem(NICKNAME_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveNickname(value: string) {
  try {
    localStorage.setItem(NICKNAME_KEY, value);
  } catch {
    // ignore
  }
}

function formatCountdown(minutes: number): string {
  if (minutes <= 0) return '';
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function OrderPage() {
  const today = getTodayBucharest();
  const weekend = isWeekend(today);
  const { cutoffHour, cutoffMinute } = useConfig();
  const cutoff = isCutoffPassed(today, cutoffHour, cutoffMinute);
  const remaining = minutesUntilCutoff(cutoffHour, cutoffMinute);

  const { menu, loading: menuLoading, error: menuError } = useMenu();
  const { orders, loading: ordersLoading, refresh } = useOrders();

  // nickname state
  const [nickname, setNickname] = useState(loadNickname);
  const [editingNickname, setEditingNickname] = useState(!loadNickname());
  const nicknameRef = useRef<HTMLInputElement>(null);

  // selection state
  const [selectedMain, setSelectedMain] = useState('');
  const [selectedSecondary, setSelectedSecondary] = useState('');
  const [activeVariant, setActiveVariant] = useState<'veg' | 'nonveg' | null>(null);

  // submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Existing order for this nickname
  const normalizedNickname = nickname.trim().toLowerCase();
  const myOrder: Order | undefined = orders?.orders.find(
    (o) => o.nickname === normalizedNickname,
  );

  // When menu loads, default selections to veg variant
  useEffect(() => {
    if (menu && !selectedMain && !selectedSecondary) {
      setSelectedMain(menu.vegetarian.main);
      setSelectedSecondary(menu.vegetarian.secondary);
      setActiveVariant('veg');
    }
  }, [menu, selectedMain, selectedSecondary]);

  // When editing nickname, focus the input
  useEffect(() => {
    if (editingNickname && nicknameRef.current) {
      nicknameRef.current.focus();
    }
  }, [editingNickname]);

  function handleNicknameChange(val: string) {
    setNickname(val);
    saveNickname(val);
  }

  function handleNicknameCommit() {
    if (nickname.trim().length > 0) {
      setEditingNickname(false);
    }
  }

  function handleVariantSelect(variant: 'veg' | 'nonveg') {
    if (!menu) return;
    if (variant === 'veg') {
      setSelectedMain(menu.vegetarian.main);
      setSelectedSecondary(menu.vegetarian.secondary);
    } else {
      setSelectedMain(menu.nonVegetarian.main);
      setSelectedSecondary(menu.nonVegetarian.secondary);
    }
    setActiveVariant(variant);
  }

  function handleMainChange(val: string) {
    setSelectedMain(val);
    setActiveVariant(null);
  }

  function handleSecondaryChange(val: string) {
    setSelectedSecondary(val);
    setActiveVariant(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!menu || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      const res = await fetch(`/api/orders?date=${today}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname, main: selectedMain, secondary: selectedSecondary }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Error (${res.status})`);
      }
      setSubmitSuccess(true);
      refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      const res = await fetch(`/api/orders?date=${today}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname, date: today }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Error (${res.status})`);
      }
      setSubmitSuccess(false);
      refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setDeleting(false);
    }
  }

  // ── Render states ────────────────────────────────────────────────────────

  const isLoading = menuLoading || ordersLoading;

  return (
    <div className="app">
      {/* Header */}
      <header className="order-header">
        <div className="container">
          <div className="order-header__inner">
            <h1 className="order-header__title">🦊 Fox Catering</h1>
            <p className="order-header__date text-muted">{formatDateDisplay(today)}</p>
          </div>
        </div>
      </header>

      <main className="container order-main">
        {/* Loading */}
        {isLoading && (
          <div className="order-status">
            <p className="text-muted">Loading today's menu…</p>
          </div>
        )}

        {/* Error fetching menu */}
        {!isLoading && menuError && (
          <div className="order-status">
            <p className="text-error">Could not load menu: {menuError}</p>
          </div>
        )}

        {/* Weekend */}
        {!isLoading && !menuError && weekend && (
          <div className="order-status">
            <p className="text-muted">No orders on weekends. Enjoy your weekend! 🎉</p>
          </div>
        )}

        {/* Weekday content */}
        {!isLoading && !menuError && !weekend && (
          <>
            {/* Cutoff banner */}
            {cutoff ? (
              <div className="order-banner order-banner--closed">
                Ordering closed at {String(cutoffHour).padStart(2, '0')}:{String(cutoffMinute).padStart(2, '0')}.
              </div>
            ) : (
              remaining > 0 && (
                <div className="order-banner order-banner--open">
                  Orders close at {String(cutoffHour).padStart(2, '0')}:{String(cutoffMinute).padStart(2, '0')} · {formatCountdown(remaining)} remaining
                </div>
              )
            )}

            {/* No menu */}
            {!menu ? (
              <div className="order-status">
                <p className="text-muted">No menu available for today. Check back later.</p>
              </div>
            ) : (
              <>
                {/* Menu cards */}
                <section className="menu-grid">
                  <div className="card menu-card">
                    <h2 className="menu-card__title">🥦 Vegetarian</h2>
                    <dl className="menu-card__list">
                      <dt>Main</dt>
                      <dd>{menu.vegetarian.main}</dd>
                      <dt>Secondary</dt>
                      <dd>{menu.vegetarian.secondary}</dd>
                    </dl>
                  </div>
                  <div className="card menu-card">
                    <h2 className="menu-card__title">🥩 Non-Vegetarian</h2>
                    <dl className="menu-card__list">
                      <dt>Main</dt>
                      <dd>{menu.nonVegetarian.main}</dd>
                      <dt>Secondary</dt>
                      <dd>{menu.nonVegetarian.secondary}</dd>
                    </dl>
                  </div>
                </section>

                {/* Order form — hidden after cutoff */}
                {!cutoff && (
                  <section className="order-form-section">
                    {/* Nickname */}
                    <div className="order-nickname">
                      {editingNickname ? (
                        <div className="form-field">
                          <label htmlFor="nickname">Your nickname</label>
                          <div className="nickname-input-row">
                            <input
                              id="nickname"
                              ref={nicknameRef}
                              type="text"
                              maxLength={40}
                              placeholder="e.g. maria"
                              value={nickname}
                              onChange={(e) => handleNicknameChange(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleNicknameCommit();
                              }}
                            />
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={handleNicknameCommit}
                              disabled={nickname.trim().length === 0}
                            >
                              OK
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="nickname-display">
                          <span>
                            Ordering as <strong>{nickname}</strong>
                          </span>
                          <button
                            type="button"
                            className="btn-link"
                            onClick={() => setEditingNickname(true)}
                          >
                            Change
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Show form only when nickname is set */}
                    {!editingNickname && nickname.trim().length > 0 && (
                      <form onSubmit={handleSubmit} className="order-form">
                        {/* Existing order summary */}
                        {myOrder && (
                          <div className="card order-existing">
                            <p className="text-muted order-existing__label">Your current order</p>
                            <p>
                              <strong>Main:</strong> {myOrder.main}
                            </p>
                            <p>
                              <strong>Secondary:</strong> {myOrder.secondary}
                            </p>
                          </div>
                        )}

                        {/* Quick-select variant buttons */}
                        <div className="form-field">
                          <label>Quick select</label>
                          <div className="variant-buttons">
                            <button
                              type="button"
                              className={`btn ${activeVariant === 'veg' ? 'btn-primary' : 'btn-secondary'}`}
                              onClick={() => handleVariantSelect('veg')}
                            >
                              🥦 Vegetarian Menu
                            </button>
                            <button
                              type="button"
                              className={`btn ${activeVariant === 'nonveg' ? 'btn-primary' : 'btn-secondary'}`}
                              onClick={() => handleVariantSelect('nonveg')}
                            >
                              🥩 Non-Vegetarian Menu
                            </button>
                          </div>
                        </div>

                        {/* Custom dropdowns */}
                        <div className="form-field">
                          <label htmlFor="main-select">Main course</label>
                          <select
                            id="main-select"
                            value={selectedMain}
                            onChange={(e) => handleMainChange(e.target.value)}
                          >
                            <option value={menu.vegetarian.main}>
                              Veg main: {menu.vegetarian.main}
                            </option>
                            <option value={menu.nonVegetarian.main}>
                              Non-veg main: {menu.nonVegetarian.main}
                            </option>
                          </select>
                        </div>

                        <div className="form-field">
                          <label htmlFor="secondary-select">Secondary course</label>
                          <select
                            id="secondary-select"
                            value={selectedSecondary}
                            onChange={(e) => handleSecondaryChange(e.target.value)}
                          >
                            <option value={menu.vegetarian.secondary}>
                              Veg secondary: {menu.vegetarian.secondary}
                            </option>
                            <option value={menu.nonVegetarian.secondary}>
                              Non-veg secondary: {menu.nonVegetarian.secondary}
                            </option>
                          </select>
                        </div>

                        {/* Feedback */}
                        {submitError && <p className="text-error">{submitError}</p>}
                        {submitSuccess && (
                          <p className="text-success">
                            {myOrder ? 'Order updated!' : 'Order placed!'}
                          </p>
                        )}

                        {/* Actions */}
                        <div className="order-actions">
                          <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={submitting || !selectedMain || !selectedSecondary}
                          >
                            {submitting
                              ? 'Saving…'
                              : myOrder
                              ? 'Update Order'
                              : 'Place Order'}
                          </button>
                          {myOrder && (
                            <button
                              type="button"
                              className="btn-link btn-link--danger"
                              onClick={handleDelete}
                              disabled={deleting}
                            >
                              {deleting ? 'Removing…' : 'Remove my order'}
                            </button>
                          )}
                        </div>
                      </form>
                    )}
                  </section>
                )}

                {/* Orders list — always visible */}
                {orders && orders.orders.length > 0 && (
                  <section className="orders-list-section">
                    <h2 className="orders-list-section__title">
                      Today's orders ({orders.orders.length})
                    </h2>
                    <ul className="orders-list">
                      {orders.orders.map((order) => (
                        <li key={order.nickname} className="orders-list__item">
                          <span className="orders-list__name">{order.nickname}</span>
                          <span className="orders-list__meal">
                            {order.main} · {order.secondary}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="order-footer">
        <div className="container">
          <p className="text-muted order-footer__privacy">
            Only your nickname and meal selection are stored. Data is automatically deleted after
            the order date. No database, no accounts.
          </p>
        </div>
      </footer>
    </div>
  );
}
