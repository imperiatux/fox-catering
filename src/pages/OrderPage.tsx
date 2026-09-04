import { useState, useEffect, useRef } from 'react';
import { useMenuImage } from '../hooks/useMenuImage';
import { useOrders } from '../hooks/useOrders';
import { useConfig } from '../hooks/useConfig';
import {
  getTodayBucharest,
  isWeekend,
  isCutoffPassed,
  minutesUntilCutoff,
  formatDateDisplay,
} from '../utils/date';
import { MENU_OPTIONS } from '../types';
import type { Order, MenuOption } from '../types';

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

  const { dataUrl: menuImageUrl } = useMenuImage();
  const { orders, loading: ordersLoading, refresh } = useOrders();

  // nickname state
  const [nickname, setNickname] = useState(loadNickname);
  const [editingNickname, setEditingNickname] = useState(!loadNickname());
  const nicknameRef = useRef<HTMLInputElement>(null);

  // selection state — default to full vegetarian menu
  const [selectedMain, setSelectedMain] = useState<MenuOption>(MENU_OPTIONS.vegMain);
  const [selectedSecondary, setSelectedSecondary] = useState<MenuOption>(MENU_OPTIONS.vegSoup);
  const [activeVariant, setActiveVariant] = useState<'veg' | 'nonveg' | null>('veg');

  // note state
  const [note, setNote] = useState('');

  // submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Existing order for this nickname
  const normalizedNickname = nickname.trim();
  const myOrder: Order | undefined = orders?.orders.find(
    (o) => o.nickname === normalizedNickname,
  );

  // Pre-fill selections from existing order when it loads
  useEffect(() => {
    if (myOrder) {
      setSelectedMain(myOrder.main);
      setSelectedSecondary(myOrder.secondary);
      setNote(myOrder.note ?? '');
      // Determine active variant from saved choices
      if (myOrder.main === MENU_OPTIONS.vegMain && myOrder.secondary === MENU_OPTIONS.vegSoup) {
        setActiveVariant('veg');
      } else if (myOrder.main === MENU_OPTIONS.nonVegMain && myOrder.secondary === MENU_OPTIONS.nonVegSoup) {
        setActiveVariant('nonveg');
      } else {
        setActiveVariant(null);
      }
    }
  }, [myOrder?.nickname]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (variant === 'veg') {
      setSelectedMain(MENU_OPTIONS.vegMain);
      setSelectedSecondary(MENU_OPTIONS.vegSoup);
    } else {
      setSelectedMain(MENU_OPTIONS.nonVegMain);
      setSelectedSecondary(MENU_OPTIONS.nonVegSoup);
    }
    setActiveVariant(variant);
  }

  function handleMainChange(val: MenuOption) {
    setSelectedMain(val);
    setActiveVariant(null);
  }

  function handleSecondaryChange(val: MenuOption) {
    setSelectedSecondary(val);
    setActiveVariant(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      const res = await fetch(`/api/orders?date=${today}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname, main: selectedMain, secondary: selectedSecondary, ...(note.trim() ? { note: note.trim() } : {}) }),
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

  // ── Render ───────────────────────────────────────────────────────────────

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
        {ordersLoading && (
          <div className="order-status">
            <p className="text-muted">Loading…</p>
          </div>
        )}

        {/* Weekend */}
        {!ordersLoading && weekend && (
          <div className="order-status">
            <p className="text-muted">No orders on weekends. Enjoy your weekend! 🎉</p>
          </div>
        )}

        {/* Weekday content */}
        {!ordersLoading && !weekend && (
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

            {/* Menu image */}
            {menuImageUrl && (
              <div className="menu-image-wrapper">
                <img
                  src={menuImageUrl}
                  alt="Today's menu"
                  className="menu-image"
                />
              </div>
            )}

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
                          <strong>Soup:</strong> {myOrder.secondary}
                        </p>
                        <p>
                          <strong>Main:</strong> {myOrder.main}
                          {myOrder.note && <span className="order-note-display"> — {myOrder.note}</span>}
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

                    {/* Course selects */}
                    <div className="form-field">
                      <label htmlFor="secondary-select">Soup course</label>
                      <select
                        id="secondary-select"
                        value={selectedSecondary}
                        onChange={(e) => handleSecondaryChange(e.target.value as MenuOption)}
                      >
                        <option value={MENU_OPTIONS.vegSoup}>{MENU_OPTIONS.vegSoup}</option>
                        <option value={MENU_OPTIONS.nonVegSoup}>{MENU_OPTIONS.nonVegSoup}</option>
                      </select>
                    </div>

                    <div className="form-field">
                      <label htmlFor="main-select">Main course</label>
                      <select
                        id="main-select"
                        value={selectedMain}
                        onChange={(e) => handleMainChange(e.target.value as MenuOption)}
                      >
                        <option value={MENU_OPTIONS.vegMain}>{MENU_OPTIONS.vegMain}</option>
                        <option value={MENU_OPTIONS.nonVegMain}>{MENU_OPTIONS.nonVegMain}</option>
                      </select>
                    </div>

                    <div className="form-field">
                      <label htmlFor="note-input">
                        Special request for main course <span className="text-muted">(optional)</span>
                      </label>
                      <input
                        id="note-input"
                        type="text"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="e.g. without potatoes"
                        maxLength={100}
                      />
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
                        disabled={submitting}
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
                        {order.main}
                        {order.note && <span className="order-note-display"> — {order.note}</span>}
                        {' · '}{order.secondary}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>

      <footer className="order-footer">
        <div className="container">
          <p className="text-muted order-footer__text">
            Only your nickname and selected courses are stored. Data is automatically
            deleted after a few days. No account or personal information required.
          </p>
        </div>
      </footer>
    </div>
  );
}
