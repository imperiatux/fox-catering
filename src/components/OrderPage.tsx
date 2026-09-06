"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import type { Order, MenuType } from "@/types";

const NICKNAME_KEY = "fox_catering_nickname";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MenuStatus {
  photoUrl: string | null;
  isOpen: boolean;
  reason: string | null;
}

interface DraftOrder {
  soupType: "non-veg" | "veg";
  mainType: "non-veg" | "veg";
  note: string;
  qty: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derive the stored MenuType from soup/main selections and optional note.
 * - soup !== main  → "custom"
 * - note non-empty → "custom"
 * - otherwise      → whichever type was selected (they're equal)
 */
function effectiveMenuType(
  soupType: "non-veg" | "veg",
  mainType: "non-veg" | "veg",
  note: string,
): MenuType {
  if (note.trim() || soupType !== mainType) return "custom";
  return soupType;
}

/**
 * For display in summary / placed-order rows: describe the courses when mixed.
 * Returns e.g. "Carne supă / Vegetarian fel principal" or just the type label.
 */
function courseDescription(
  soupType: "non-veg" | "veg",
  mainType: "non-veg" | "veg",
  tOrder: (k: string) => string,
): { mixed: boolean; soupLabel: string; mainLabel: string; typeLabel: string } {
  const labels: Record<"non-veg" | "veg", string> = {
    "non-veg": tOrder("menu_type_nonveg"),
    veg: tOrder("menu_type_veg"),
  };
  if (soupType !== mainType) {
    return {
      mixed: true,
      soupLabel: labels[soupType],
      mainLabel: labels[mainType],
      typeLabel: tOrder("menu_type_custom"),
    };
  }
  return { mixed: false, soupLabel: labels[soupType], mainLabel: labels[mainType], typeLabel: labels[soupType] };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function NicknamePrompt({ onSave }: { onSave: (nickname: string) => void }) {
  const t = useTranslations("order");
  const [value, setValue] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) onSave(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label htmlFor="nickname-input" className="font-semibold text-gray-800">
        {t("nickname")}
      </label>
      <div className="flex gap-2">
        <input
          id="nickname-input"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("nickname_placeholder")}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-0 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          autoFocus
        />
        <button
          type="submit"
          className="bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-600 disabled:opacity-40 shrink-0"
          disabled={!value.trim()}
        >
          {t("nickname_save")}
        </button>
      </div>
    </form>
  );
}

function MenuPhoto({ photoUrl }: { photoUrl: string | null }) {
  const t = useTranslations("order");
  if (!photoUrl) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400 italic text-sm bg-gray-100 rounded-xl border border-gray-200">
        {t("no_menu")}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photoUrl}
      alt="Menu"
      className="w-full rounded-xl object-contain max-h-[80vh] border border-gray-200 shadow-sm"
    />
  );
}

function QuantitySelector({
  qty,
  onChange,
}: {
  qty: number;
  onChange: (qty: number) => void;
}) {
  const t = useTranslations("order");
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-gray-700">{t("quantity")}</span>
      <div className="flex items-center gap-2 border border-gray-300 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => onChange(Math.max(1, qty - 1))}
          className="w-9 h-9 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-40 text-lg font-medium"
          disabled={qty <= 1}
          aria-label="Decrease quantity"
        >
          −
        </button>
        <span className="w-8 text-center font-bold text-gray-900">{qty}</span>
        <button
          type="button"
          onClick={() => onChange(qty + 1)}
          className="w-9 h-9 flex items-center justify-center text-gray-600 hover:bg-gray-100 text-lg font-medium"
          aria-label="Increase quantity"
        >
          +
        </button>
      </div>
    </div>
  );
}

/** Two-button toggle (non-veg / veg) for a single course row. */
function CourseToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: "non-veg" | "veg";
  onChange: (v: "non-veg" | "veg") => void;
}) {
  const t = useTranslations("order");
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-gray-700 w-28 shrink-0">{label}</span>
      <div className="flex flex-1 gap-2">
        {(["non-veg", "veg"] as const).map((mt) => (
          <button
            key={mt}
            type="button"
            onClick={() => onChange(mt)}
            className={`flex-1 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
              value === mt
                ? "bg-brand-500 text-white border-brand-500"
                : "border-gray-300 text-gray-700 hover:border-brand-400 hover:text-brand-600"
            }`}
          >
            {mt === "non-veg" ? t("menu_type_nonveg") : t("menu_type_veg")}
          </button>
        ))}
      </div>
    </div>
  );
}

// Summary row: a pending draft waiting to be confirmed
function OrderSummaryRow({
  draft,
  onRemove,
}: {
  draft: DraftOrder;
  onRemove: () => void;
}) {
  const t = useTranslations("order");
  const { mixed, soupLabel, mainLabel, typeLabel } = courseDescription(
    draft.soupType,
    draft.mainType,
    t,
  );

  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-gray-100 last:border-0">
      <div className="text-sm space-y-0.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-bold text-gray-900">{draft.qty}×</span>
          <span className="inline-block bg-brand-100 text-brand-700 text-xs font-medium px-2 py-0.5 rounded-full">
            {typeLabel}
          </span>
        </div>
        {mixed && (
          <div className="text-xs text-gray-500">
            {t("soup")}: <span className="font-medium text-gray-700">{soupLabel}</span>
            {" · "}
            {t("main")}: <span className="font-medium text-gray-700">{mainLabel}</span>
          </div>
        )}
        {draft.note && (
          <div className="text-gray-500 italic text-xs">
            {t("note")}: {draft.note}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="text-red-500 hover:text-red-700 text-xs font-medium shrink-0 mt-0.5"
      >
        {t("cancel")}
      </button>
    </div>
  );
}

// A placed order row in "My orders" section
function PlacedOrderRow({
  order,
  onEdit,
  onDelete,
}: {
  order: Order;
  onEdit?: (order: Order) => void;
  onDelete?: (id: string) => void;
}) {
  const t = useTranslations("order");

  // Decode stored soupType/mainType from soup/main fields (stored as type labels) or fall back
  const soupType = (order.soup === "veg" ? "veg" : order.soup === "non-veg" ? "non-veg" : null);
  const mainType = (order.main === "veg" ? "veg" : order.main === "non-veg" ? "non-veg" : null);

  const typeLabel =
    order.menuType === "non-veg"
      ? t("menu_type_nonveg")
      : order.menuType === "veg"
        ? t("menu_type_veg")
        : t("menu_type_custom");

  const mixed = soupType !== null && mainType !== null && soupType !== mainType;

  return (
    <div className="py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm space-y-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-gray-900">{order.qty}×</span>
            <span className="inline-block bg-gray-100 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">
              {typeLabel}
            </span>
          </div>
          {mixed && (
            <div className="text-xs text-gray-500">
              {t("soup")}: <span className="font-medium text-gray-700">{soupType === "non-veg" ? t("menu_type_nonveg") : t("menu_type_veg")}</span>
              {" · "}
              {t("main")}: <span className="font-medium text-gray-700">{mainType === "non-veg" ? t("menu_type_nonveg") : t("menu_type_veg")}</span>
            </div>
          )}
          {order.note && (
            <div className="text-gray-500 italic text-xs">
              {t("note")}: {order.note}
            </div>
          )}
        </div>
        {(onEdit || onDelete) && (
          <div className="flex gap-3 shrink-0 mt-0.5">
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(order)}
                className="text-brand-600 hover:text-brand-700 text-xs font-medium"
              >
                {t("edit")}
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(order.id)}
                className="text-red-500 hover:text-red-700 text-xs font-medium"
              >
                {t("delete")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main OrderPage component
// ---------------------------------------------------------------------------

export default function OrderPage({ initialMenu }: { initialMenu: MenuStatus }) {
  const t = useTranslations("order");
  const tErr = useTranslations("error");

  const [menu, setMenu] = useState<MenuStatus>(initialMenu);
  const [nickname, setNickname] = useState<string>("");
  const [nicknameReady, setNicknameReady] = useState(false);

  const [draft, setDraft] = useState<DraftOrder>({
    soupType: "non-veg",
    mainType: "non-veg",
    note: "",
    qty: 1,
  });

  const [pendingItems, setPendingItems] = useState<DraftOrder[]>([]);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    const stored = localStorage.getItem(NICKNAME_KEY) ?? "";
    setNickname(stored);
    setNicknameReady(true);
  }, []);

  const loadMyOrders = useCallback(async (nick: string) => {
    if (!nick) return;
    setOrdersLoading(true);
    try {
      const res = await fetch(`/api/orders?nickname=${encodeURIComponent(nick)}`);
      if (res.ok) setMyOrders(await res.json());
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (nicknameReady && nickname) loadMyOrders(nickname);
  }, [nicknameReady, nickname, loadMyOrders]);

  function handleNicknameSave(nick: string) {
    localStorage.setItem(NICKNAME_KEY, nick);
    setNickname(nick);
  }

  function handleAddToOrder() {
    setError(null);
    setPendingItems((prev) => [...prev, { ...draft }]);
    setDraft({ soupType: draft.soupType, mainType: draft.mainType, note: "", qty: 1 });
  }

  async function handleConfirmOrder() {
    if (pendingItems.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      for (const item of pendingItems) {
        const body = {
          nickname,
          menuType: effectiveMenuType(item.soupType, item.mainType, item.note),
          // store soupType/mainType in soup/main fields so admin & edit can decode them
          soup: item.soupType,
          main: item.mainType,
          note: item.note.trim() || undefined,
          qty: item.qty,
        };
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(
            data.error === "not_active_day"
              ? tErr("not_active_day")
              : data.error === "order_closed"
                ? tErr("order_closed")
                : tErr("generic"),
          );
          const menuRes = await fetch("/api/menu");
          if (menuRes.ok) setMenu(await menuRes.json());
          return;
        }
      }
      setPendingItems([]);
      await loadMyOrders(nickname);
      setToast(t("order_placed"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEditSave(order: Order) {
    setSubmitting(true);
    setError(null);
    try {
      const soupType: "non-veg" | "veg" = order.soup === "veg" ? "veg" : "non-veg";
      const mainType: "non-veg" | "veg" = order.main === "veg" ? "veg" : "non-veg";
      const body = {
        nickname,
        menuType: effectiveMenuType(soupType, mainType, order.note ?? ""),
        soup: soupType,
        main: mainType,
        note: order.note?.trim() || undefined,
        qty: order.qty,
      };
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError(tErr("generic"));
        return;
      }
      setEditingOrder(null);
      await loadMyOrders(nickname);
      setToast(t("order_saved"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname }),
      });
      if (!res.ok) {
        setError(tErr("generic"));
        return;
      }
      await loadMyOrders(nickname);
      setToast(t("order_deleted"));
    } finally {
      setSubmitting(false);
    }
  }

  if (!nicknameReady) return null;

  return (
    <main className="flex flex-col flex-1 w-full max-w-2xl mx-auto px-4 py-6 gap-5">

      {/* Menu photo */}
      <section>
        <MenuPhoto photoUrl={menu.photoUrl} />
      </section>

      {/* Closed banner */}
      {!menu.isOpen && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-4">
          <p className="font-semibold text-amber-800">{t("closed")}</p>
          <p className="text-sm text-amber-700 mt-0.5">
            {menu.reason === "not_active_day"
              ? tErr("not_active_day")
              : t("closed_message")}
          </p>
        </div>
      )}

      {/* Open: order flow */}
      {menu.isOpen && (
        <>
          {/* Nickname */}
          {!nickname ? (
            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <NicknamePrompt onSave={handleNicknameSave} />
            </section>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">{t("nickname")}:</span>
              <span className="font-semibold bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full text-xs">
                {nickname}
              </span>
              <button
                type="button"
                className="text-xs text-gray-400 hover:text-gray-600 ml-1"
                aria-label="Change nickname"
                onClick={() => {
                  localStorage.removeItem(NICKNAME_KEY);
                  setNickname("");
                }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Order form */}
          {nickname && (
            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm flex flex-col gap-4">
              <h2 className="font-semibold text-gray-900 text-base">{t("order_form_title")}</h2>

              {/* Quick full-menu selector */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">{t("menu_type")}</label>
                <div className="flex gap-2">
                  {(["non-veg", "veg"] as const).map((mt) => {
                    const active = draft.soupType === mt && draft.mainType === mt;
                    return (
                      <button
                        key={mt}
                        type="button"
                        onClick={() => setDraft((d) => ({ ...d, soupType: mt, mainType: mt }))}
                        className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                          active
                            ? "bg-brand-500 text-white border-brand-500"
                            : "border-gray-300 text-gray-700 hover:border-brand-400 hover:text-brand-600"
                        }`}
                      >
                        {mt === "non-veg" ? t("menu_type_nonveg") : t("menu_type_veg")}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Per-course overrides */}
              <div className="flex flex-col gap-2 border-t border-gray-100 pt-3">
                <p className="text-xs text-gray-400">{t("mix_courses")}</p>
                <CourseToggle
                  label={t("soup")}
                  value={draft.soupType}
                  onChange={(v) => setDraft((d) => ({ ...d, soupType: v }))}
                />
                <CourseToggle
                  label={t("main")}
                  value={draft.mainType}
                  onChange={(v) => setDraft((d) => ({ ...d, mainType: v }))}
                />
              </div>

              {/* Mixed indicator */}
              {draft.soupType !== draft.mainType && (
                <p className="text-xs text-purple-600 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                  {t("menu_type_custom")}
                </p>
              )}

              {/* Special request note */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="note-input" className="text-sm font-medium text-gray-700">
                  {t("note")}
                  <span className="text-gray-400 font-normal ml-1 text-xs">({t("note_optional")})</span>
                </label>
                <input
                  id="note-input"
                  type="text"
                  value={draft.note}
                  onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
                  placeholder={t("note_placeholder")}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>

              {/* Quantity */}
              <QuantitySelector
                qty={draft.qty}
                onChange={(qty) => setDraft((d) => ({ ...d, qty }))}
              />

              {error && (
                <p role="alert" className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={handleAddToOrder}
                className="bg-brand-500 text-white px-4 py-2.5 rounded-lg font-semibold hover:bg-brand-600 text-sm"
              >
                {t("add_to_order")}
              </button>
            </section>
          )}

          {/* Order summary */}
          {pendingItems.length > 0 && (
            <section className="rounded-xl border border-brand-200 bg-brand-50 p-5 shadow-sm">
              <h2 className="font-semibold text-brand-900 text-base mb-3">{t("summary")}</h2>
              {pendingItems.map((item, idx) => (
                <OrderSummaryRow
                  key={idx}
                  draft={item}
                  onRemove={() =>
                    setPendingItems((prev) => prev.filter((_, i) => i !== idx))
                  }
                />
              ))}
              <button
                type="button"
                onClick={handleConfirmOrder}
                disabled={submitting}
                className="mt-4 w-full bg-green-600 text-white px-4 py-2.5 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 text-sm"
              >
                {submitting ? "…" : t("confirm")}
              </button>
            </section>
          )}
        </>
      )}

      {/* My orders — always shown when nickname is set; edit/delete only when open */}
      {nickname && (
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-gray-900 text-base mb-3">{t("my_orders")}</h2>
          {ordersLoading && (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              …
            </div>
          )}
          {!ordersLoading && myOrders.length === 0 && (
            <p className="text-sm text-gray-400 italic py-2">{t("no_orders")}</p>
          )}
          {!ordersLoading &&
            myOrders.map((order) =>
              menu.isOpen && editingOrder?.id === order.id ? (
                <EditOrderForm
                  key={order.id}
                  order={editingOrder}
                  onChange={setEditingOrder}
                  onSave={() => handleEditSave(editingOrder)}
                  onCancel={() => setEditingOrder(null)}
                  submitting={submitting}
                />
              ) : (
                <PlacedOrderRow
                  key={order.id}
                  order={order}
                  onEdit={menu.isOpen ? (o) => setEditingOrder({ ...o }) : undefined}
                  onDelete={menu.isOpen ? handleDelete : undefined}
                />
              ),
            )}
        </section>
      )}

      {/* Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm font-medium px-5 py-3 rounded-full shadow-lg z-50"
        >
          {toast}
        </div>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Inline edit form for placed orders
// ---------------------------------------------------------------------------

function EditOrderForm({
  order,
  onChange,
  onSave,
  onCancel,
  submitting,
}: {
  order: Order;
  onChange: (o: Order) => void;
  onSave: () => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const t = useTranslations("order");

  // Decode soupType/mainType from stored soup/main fields
  const soupType: "non-veg" | "veg" = order.soup === "veg" ? "veg" : "non-veg";
  const mainType: "non-veg" | "veg" = order.main === "veg" ? "veg" : "non-veg";

  function setSoupType(v: "non-veg" | "veg") {
    onChange({
      ...order,
      soup: v,
      menuType: effectiveMenuType(v, mainType, order.note ?? ""),
    });
  }

  function setMainType(v: "non-veg" | "veg") {
    onChange({
      ...order,
      main: v,
      menuType: effectiveMenuType(soupType, v, order.note ?? ""),
    });
  }

  function setNote(note: string) {
    onChange({
      ...order,
      note: note || undefined,
      menuType: effectiveMenuType(soupType, mainType, note),
    });
  }

  return (
    <div className="border border-brand-200 rounded-xl p-4 mb-3 flex flex-col gap-3 bg-brand-50">
      {/* Quick selector */}
      <div className="flex gap-2">
        {(["non-veg", "veg"] as const).map((mt) => {
          const active = soupType === mt && mainType === mt;
          return (
            <button
              key={mt}
              type="button"
              onClick={() => {
                onChange({
                  ...order,
                  soup: mt,
                  main: mt,
                  menuType: effectiveMenuType(mt, mt, order.note ?? ""),
                });
              }}
              className={`flex-1 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                active
                  ? "bg-brand-500 text-white border-brand-500"
                  : "border-gray-300 text-gray-700 hover:border-brand-400"
              }`}
            >
              {mt === "non-veg" ? t("menu_type_nonveg") : t("menu_type_veg")}
            </button>
          );
        })}
      </div>

      {/* Per-course overrides */}
      <div className="flex flex-col gap-2 border-t border-gray-100 pt-2">
        <p className="text-xs text-gray-400">{t("mix_courses")}</p>
        <CourseToggle label={t("soup")} value={soupType} onChange={setSoupType} />
        <CourseToggle label={t("main")} value={mainType} onChange={setMainType} />
      </div>

      {soupType !== mainType && (
        <p className="text-xs text-purple-600 bg-purple-50 border border-purple-200 rounded-lg px-3 py-1.5">
          {t("menu_type_custom")}
        </p>
      )}

      <input
        type="text"
        value={order.note ?? ""}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t("note_placeholder")}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white"
      />

      <QuantitySelector
        qty={order.qty}
        onChange={(qty) => onChange({ ...order, qty })}
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={submitting}
          className="bg-brand-500 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-brand-600 disabled:opacity-50"
        >
          {submitting ? "…" : t("confirm")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="border border-gray-300 px-4 py-1.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}
