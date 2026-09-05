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

const DEFAULT_MAIN: MenuOption = MENU_OPTIONS.nonVegMain;
const DEFAULT_SECONDARY: MenuOption = MENU_OPTIONS.nonVegSoup;

// ── Component ────────────────────────────────────────────────────────────────

export default function OrderPage() {
  const today = getTodayBucharest();
  const weekend = isWeekend(today);
  const { cutoffHour, cutoffMinute } = useConfig();
  const cutoff = isCutoffPassed(today, cutoffHour, cutoffMinute);
  const remaining = minutesUntilCutoff(cutoffHour, cutoffMinute);

  const { dataUrl: menuImageUrl, loading: menuLoading } = useMenuImage();
  const { orders, loading: ordersLoading, refresh } = useOrders();

  // nickname state
  const [nickname, setNickname] = useState(loadNickname);
  const [editingNickname, setEditingNickname] = useState(!loadNickname());
  const nicknameRef = useRef<HTMLInputElement>(null);

  // selection state — default to full non-vegetarian menu
  const [selectedMain, setSelectedMain] = useState<MenuOption>(DEFAULT_MAIN);
  const [selectedSecondary, setSelectedSecondary] = useState<MenuOption>(DEFAULT_SECONDARY);
  const [activeVariant, setActiveVariant] = useState<'veg' | 'nonveg' | null>('nonveg');

  // quantity + note state
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');

  // submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // All orders for this nickname
  const normalizedNickname = nickname.trim();
  const myOrders: Order[] = orders?.orders.filter(
    (o) => o.nickname === normalizedNickname,
  ) ?? [];

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

  function resetForm() {
    setSelectedMain(DEFAULT_MAIN);
    setSelectedSecondary(DEFAULT_SECONDARY);
    setActiveVariant('nonveg');
    setQuantity(1);
    setNote('');
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
        body: JSON.stringify({ nickname, main: selectedMain, secondary: selectedSecondary, quantity, ...(note.trim() ? { note: note.trim() } : {}) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Error (${res.status})`);
      }
      setSubmitSuccess(true);
      resetForm();
      refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (deletingId) return;
    setDeletingId(id);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      const res = await fetch(`/api/orders?date=${today}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, date: today }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Error (${res.status})`);
      }
      refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setDeletingId(null);
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
        {(ordersLoading || menuLoading) && (
          <div className="order-status">
            <p className="text-muted">Loading…</p>
          </div>
        )}

        {/* Weekend */}
        {!ordersLoading && !menuLoading && weekend && (
          <div className="order-status">
            <p className="text-muted">No orders on weekends. Enjoy your weekend! 🎉</p>
          </div>
        )}

        {/* No menu uploaded yet */}
        {!ordersLoading && !menuLoading && !weekend && !menuImageUrl && (
          <div className="order-status">
            <p className="text-muted">No menu available yet for today. Check back soon!</p>
          </div>
        )}

        {/* Weekday content */}
        {!ordersLoading && !menuLoading && !weekend && menuImageUrl && (
          <>
            {/* Cutoff banner */}
            {cutoff ? (
              <div className="order-banner order-banner--closed">
                Ordering closed at {String(cutoffHour).padStart(2, '0')}:{String(cutoffMinute).padStart(2, '0')}.
              </div>
            ) : (
              <>
                {remaining > 0 && (
                  <div className="order-banner order-banner--open">
                    Orders close at {String(cutoffHour).padStart(2, '0')}:{String(cutoffMinute).padStart(2, '0')} · {formatCountdown(remaining)} remaining
                  </div>
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
                    {/* My existing orders list */}
                    {myOrders.length > 0 && (
                      <div className="card order-existing">
                        <p className="text-muted order-existing__label">
                          Your order{myOrders.length > 1 ? 's' : ''} today
                        </p>
                        <ul className="my-orders-list">
                          {myOrders.map((o) => (
                            <li key={o.id} className="my-orders-list__item">
                              <span className="my-orders-list__detail">
                                <span className="order-qty">×{o.quantity ?? 1} </span>
                                {o.secondary}
                                {' · '}{o.main}
                                {o.note && <span className="order-note-display"> — {o.note}</span>}
                              </span>
                              <button
                                type="button"
                                className="btn-link btn-link--danger"
                                onClick={() => handleDelete(o.id)}
                                disabled={deletingId === o.id}
                              >
                                {deletingId === o.id ? 'Removing…' : 'Remove'}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Quick-select variant buttons */}
                    <div className="form-field">
                      <label>Quick select</label>
                      <div className="variant-buttons">
                        <button
                          type="button"
                          className={`btn ${activeVariant === 'nonveg' ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => handleVariantSelect('nonveg')}
                        >
                          🥩 Non-Vegetarian Menu
                        </button>
                        <button
                          type="button"
                          className={`btn ${activeVariant === 'veg' ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => handleVariantSelect('veg')}
                        >
                          🥦 Vegetarian Menu
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
                        <option value={MENU_OPTIONS.nonVegSoup}>{MENU_OPTIONS.nonVegSoup}</option>
                        <option value={MENU_OPTIONS.vegSoup}>{MENU_OPTIONS.vegSoup}</option>
                      </select>
                    </div>

                    <div className="form-field">
                      <label htmlFor="main-select">Main course</label>
                      <select
                        id="main-select"
                        value={selectedMain}
                        onChange={(e) => handleMainChange(e.target.value as MenuOption)}
                      >
                        <option value={MENU_OPTIONS.nonVegMain}>{MENU_OPTIONS.nonVegMain}</option>
                        <option value={MENU_OPTIONS.vegMain}>{MENU_OPTIONS.vegMain}</option>
                      </select>
                    </div>

                    <div className="form-field">
                      <label>Quantity</label>
                      <div className="qty-stepper">
                        <button
                          type="button"
                          className="qty-stepper__btn"
                          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                          disabled={quantity <= 1}
                          aria-label="Decrease quantity"
                        >−</button>
                        <span className="qty-stepper__value">{quantity}</span>
                        <button
                          type="button"
                          className="qty-stepper__btn"
                          onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                          disabled={quantity >= 10}
                          aria-label="Increase quantity"
                        >+</button>
                      </div>
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
                    {submitSuccess && <p className="text-success">Order placed!</p>}

                    {/* Actions */}
                    <div className="order-actions">
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={submitting}
                      >
                        {submitting ? 'Saving…' : 'Place Order'}
                      </button>
                    </div>
                  </form>
                )}
              </section>

            </>
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
