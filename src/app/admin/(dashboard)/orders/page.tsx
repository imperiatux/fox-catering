"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import type { Order, AppSettings } from "@/types";

function isCustomOrder(order: Order): boolean {
  return order.menuType === "custom" || Boolean(order.note);
}

export default function AdminOrdersPage() {
  const t = useTranslations("admin");
  const tOrder = useTranslations("order");
  const locale = useLocale();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewAll, setViewAll] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settings, setSettingsState] = useState<Pick<AppSettings, "whatsappPhone" | "priceNonVeg" | "priceVeg" | "priceSoupNonVeg" | "priceSoupVeg" | "priceMainNonVeg" | "priceMainVeg" | "priceCustom">>({
    whatsappPhone: "",
    priceNonVeg: 0,
    priceVeg: 0,
    priceSoupNonVeg: 0,
    priceSoupVeg: 0,
    priceMainNonVeg: 0,
    priceMainVeg: 0,
    priceCustom: 0,
  });

  const [tipsTotal, setTipsTotal] = useState<number>(0);
  const [tips, setTips] = useState<Record<string, number>>({});

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/orders");
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders ?? []);
        setTipsTotal(data.tipsTotal ?? 0);
        setTips(data.tips ?? {});
      }
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 30_000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Load settings once (phone + prices)
  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((data: AppSettings) => setSettingsState({
        whatsappPhone: data.whatsappPhone ?? "",
        priceNonVeg: data.priceNonVeg ?? 0,
        priceVeg: data.priceVeg ?? 0,
        priceSoupNonVeg: data.priceSoupNonVeg ?? 0,
        priceSoupVeg: data.priceSoupVeg ?? 0,
        priceMainNonVeg: data.priceMainNonVeg ?? 0,
        priceMainVeg: data.priceMainVeg ?? 0,
        priceCustom: data.priceCustom ?? 0,
      }))
      .catch(() => {});
  }, []);

  async function handleDelete(id: string) {
    if (!window.confirm(t("delete_confirm"))) return;
    setDeletingId(id);
    try {
      await fetch(`/api/admin/orders/${id}`, { method: "DELETE" });
      await fetchOrders();
    } finally {
      setDeletingId(null);
    }
  }

  const nonVegCount    = orders.filter((o) => o.menuType === "non-veg" && !o.note).reduce((s, o) => s + o.qty, 0);
  const vegCount       = orders.filter((o) => o.menuType === "veg"     && !o.note).reduce((s, o) => s + o.qty, 0);
  const soupNonVeg     = orders.filter((o) => o.menuType === "soup-only" && o.soup === "non-veg").reduce((s, o) => s + o.qty, 0);
  const soupVeg        = orders.filter((o) => o.menuType === "soup-only" && o.soup === "veg").reduce((s, o) => s + o.qty, 0);
  const mainNonVeg     = orders.filter((o) => o.menuType === "main-only" && o.main === "non-veg").reduce((s, o) => s + o.qty, 0);
  const mainVeg        = orders.filter((o) => o.menuType === "main-only" && o.main === "veg").reduce((s, o) => s + o.qty, 0);
  const soupOnly       = soupNonVeg + soupVeg;
  const mainOnly       = mainNonVeg + mainVeg;
  const customCount    = orders.filter(isCustomOrder).reduce((s, o) => s + o.qty, 0);
  const customOrders   = orders.filter(isCustomOrder);

  // Price total — only categories with a non-zero price contribute
  const menuTotal =
    nonVegCount  * settings.priceNonVeg     +
    vegCount     * settings.priceVeg        +
    soupNonVeg   * settings.priceSoupNonVeg +
    soupVeg      * settings.priceSoupVeg    +
    mainNonVeg   * settings.priceMainNonVeg +
    mainVeg      * settings.priceMainVeg    +
    customCount  * settings.priceCustom;

  const orderTotal = menuTotal + tipsTotal;

  const hasPrices = settings.priceNonVeg > 0 || settings.priceVeg > 0 || settings.priceSoupNonVeg > 0 || settings.priceSoupVeg > 0 || settings.priceMainNonVeg > 0 || settings.priceMainVeg > 0 || settings.priceCustom > 0;

  const courseLabel = (v: string) =>
    v === "non-veg" ? tOrder("menu_type_nonveg")
    : v === "veg"   ? tOrder("menu_type_veg")
    : tOrder("menu_type_none");

  /** Build the WhatsApp message and open wa.me link */
  function handleSendWhatsapp() {
    const dateLocale = locale === "ro" ? "ro-RO" : "en-GB";
    const date = new Date().toLocaleDateString(dateLocale, {
      weekday: "long", day: "numeric", month: "long",
    });

    const lines: string[] = [`${t("whatsapp_order_header")} ${date}:`];
    if (nonVegCount > 0) lines.push(`- ${nonVegCount}x ${t("nonveg_group")}`);
    if (vegCount    > 0) lines.push(`- ${vegCount}x ${t("veg_group")}`);
    if (soupNonVeg  > 0) lines.push(`- ${soupNonVeg}x ${t("soup_nonveg")}`);
    if (soupVeg     > 0) lines.push(`- ${soupVeg}x ${t("soup_veg")}`);
    if (mainNonVeg  > 0) lines.push(`- ${mainNonVeg}x ${t("main_nonveg")}`);
    if (mainVeg     > 0) lines.push(`- ${mainVeg}x ${t("main_veg")}`);

    if (customOrders.length > 0) {
      lines.push(`\n${tOrder("menu_type_custom")}:`);
      customOrders.forEach((o) => {
        const soupLbl = courseLabel(o.soup);
        const mainLbl = courseLabel(o.main);
        const detail = o.soup !== o.main
          ? `${tOrder("soup")}: ${soupLbl}, ${tOrder("main")}: ${mainLbl}`
          : soupLbl;
        const note = o.note ? `, ${o.note}` : "";
        lines.push(`- ${o.qty}x (${detail}${note})`);
      });
    }

    const message = lines.join("\n");
    const phone = "+4" + settings.whatsappPhone.replace(/[^0-9]/g, "");
    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
      "_blank",
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">{t("orders")}</h1>
        <div className="flex items-center gap-2 text-sm text-gray-400 py-10">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("orders")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {new Date().toLocaleDateString(locale === "ro" ? "ro-RO" : "en-GB", {
              day: "numeric", month: "long", year: "numeric",
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setLoading(true);
              fetchOrders();
            }}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 border border-gray-300 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {t("refresh")}
          </button>

          {orders.length > 0 && (
            settings.whatsappPhone ? (
              <button
                onClick={handleSendWhatsapp}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors"
              >
                {/* WhatsApp icon */}
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.554 4.12 1.523 5.854L.057 23.885a.5.5 0 0 0 .613.612l6.089-1.456A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.882a9.875 9.875 0 0 1-5.031-1.378l-.36-.214-3.733.893.924-3.649-.235-.374A9.865 9.865 0 0 1 2.118 12C2.118 6.533 6.533 2.118 12 2.118c5.466 0 9.882 4.415 9.882 9.882 0 5.466-4.416 9.882-9.882 9.882z"/>
                </svg>
                {t("send_whatsapp")}
              </button>
            ) : (
              <p className="text-xs text-gray-400 italic">{t("whatsapp_no_phone")}</p>
            )
          )}
        </div>
      </div>

      {/* Row 1 — non-veg group */}
      <div>
        <p className="mb-2 text-xs font-semibold text-orange-600 uppercase tracking-wide">{t("nonveg_group")}</p>
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-orange-100 bg-orange-50 px-5 py-4 shadow-sm">
            <p className="text-xs font-medium text-orange-700 uppercase tracking-wide">{t("nonveg_group")}</p>
            <p className="mt-2 text-4xl font-bold text-orange-500">{nonVegCount}</p>
            {settings.priceNonVeg > 0 && (
              <p className="mt-1 text-xs text-orange-400">{settings.priceNonVeg} RON / buc.</p>
            )}
          </div>
          <div className="rounded-xl border border-orange-100 bg-orange-50 px-5 py-4 shadow-sm">
            <p className="text-xs font-medium text-orange-700 uppercase tracking-wide">{t("soup_nonveg")}</p>
            <p className="mt-2 text-4xl font-bold text-orange-500">{soupNonVeg}</p>
            {settings.priceSoupNonVeg > 0 && (
              <p className="mt-1 text-xs text-orange-400">{settings.priceSoupNonVeg} RON / buc.</p>
            )}
          </div>
          <div className="rounded-xl border border-orange-100 bg-orange-50 px-5 py-4 shadow-sm">
            <p className="text-xs font-medium text-orange-700 uppercase tracking-wide">{t("main_nonveg")}</p>
            <p className="mt-2 text-4xl font-bold text-orange-500">{mainNonVeg}</p>
            {settings.priceMainNonVeg > 0 && (
              <p className="mt-1 text-xs text-orange-400">{settings.priceMainNonVeg} RON / buc.</p>
            )}
          </div>
        </div>
      </div>

      {/* Row 2 — veg group */}
      <div>
        <p className="mb-2 text-xs font-semibold text-green-700 uppercase tracking-wide">{t("veg_group")}</p>
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-green-100 bg-green-50 px-5 py-4 shadow-sm">
            <p className="text-xs font-medium text-green-700 uppercase tracking-wide">{t("veg_group")}</p>
            <p className="mt-2 text-4xl font-bold text-green-600">{vegCount}</p>
            {settings.priceVeg > 0 && (
              <p className="mt-1 text-xs text-green-500">{settings.priceVeg} RON / buc.</p>
            )}
          </div>
          <div className="rounded-xl border border-green-100 bg-green-50 px-5 py-4 shadow-sm">
            <p className="text-xs font-medium text-green-700 uppercase tracking-wide">{t("soup_veg")}</p>
            <p className="mt-2 text-4xl font-bold text-green-600">{soupVeg}</p>
            {settings.priceSoupVeg > 0 && (
              <p className="mt-1 text-xs text-green-500">{settings.priceSoupVeg} RON / buc.</p>
            )}
          </div>
          <div className="rounded-xl border border-green-100 bg-green-50 px-5 py-4 shadow-sm">
            <p className="text-xs font-medium text-green-700 uppercase tracking-wide">{t("main_veg")}</p>
            <p className="mt-2 text-4xl font-bold text-green-600">{mainVeg}</p>
            {settings.priceMainVeg > 0 && (
              <p className="mt-1 text-xs text-green-500">{settings.priceMainVeg} RON / buc.</p>
            )}
          </div>
        </div>
      </div>

      {/* Row 3 — custom */}
      <div className="grid grid-cols-1 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t("custom_orders")}</p>
          <p className="mt-2 text-4xl font-bold text-purple-600">{customCount}</p>
          {settings.priceCustom > 0 && (
            <p className="mt-1 text-xs text-gray-400">{settings.priceCustom} RON / buc.</p>
          )}
        </div>
      </div>

      {/* Row 2 — financial summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            {t("tips_total")}
          </p>
          <p className="mt-2 text-4xl font-bold text-yellow-500">
            {tipsTotal > 0 ? tipsTotal.toFixed(2) : "0"}
          </p>
          <p className="mt-1 text-xs text-gray-400">RON</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Total
          </p>
          <p className="mt-2 text-4xl font-bold text-brand-500">
            {nonVegCount + vegCount + soupOnly + mainOnly + customCount}
          </p>
          {hasPrices && menuTotal > 0 && (
            <p className="mt-1 text-xs font-semibold text-brand-600">{menuTotal.toFixed(2)} RON</p>
          )}
        </div>
      </div>

      {/* Custom orders */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            {t("custom_orders")}
          </h2>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
            {customOrders.length}
          </span>
        </div>

        {customOrders.length === 0 ? (
          <p className="text-sm text-gray-400 italic">—</p>
        ) : (
          <OrderTable
            orders={customOrders}
            deletingId={deletingId}
            onDelete={handleDelete}
            t={t}
            tOrder={tOrder}
          />
        )}
      </div>

      {/* Toggle: view all orders */}
      <div>
        <button
          onClick={() => setViewAll((v) => !v)}
          className="mb-4 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-brand-600 border border-brand-200 hover:bg-brand-50 transition-colors"
        >
          {viewAll ? t("view_summary") : t("view_all")}
          <svg
            className={`w-4 h-4 transition-transform ${viewAll ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {viewAll && (
          orders.length === 0 ? (
            <p className="text-sm text-gray-400 italic">—</p>
          ) : (
            <OrderTable
              orders={orders}
              deletingId={deletingId}
              onDelete={handleDelete}
              t={t}
              tOrder={tOrder}
            />
          )
        )}
      </div>
    </div>
  );
}

// Extracted reusable table component
function OrderTable({
  orders,
  deletingId,
  onDelete,
  t,
  tOrder,
}: {
  orders: Order[];
  deletingId: string | null;
  onDelete: (id: string) => void;
  t: (key: string) => string;
  tOrder: (key: string) => string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
      <table className="min-w-full divide-y divide-gray-200 bg-white text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {tOrder("nickname")}
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {tOrder("menu_type")}
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {tOrder("note")}
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {tOrder("quantity")}
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {tOrder("tip")}
            </th>
            <th className="px-4 py-3 w-16" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {orders.map((order) => {
            const orderTip = order.tip ?? 0;
            return (
            <tr key={order.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-semibold text-gray-900">
                {order.nickname}
              </td>
              <td className="px-4 py-3">
                <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
                  order.menuType === "non-veg"  ? "bg-orange-100 text-orange-700"
                  : order.menuType === "veg"    ? "bg-green-100 text-green-700"
                  : order.menuType === "soup-only" || order.menuType === "main-only"
                                                ? "bg-sky-100 text-sky-700"
                                                : "bg-purple-100 text-purple-700"
                }`}>
                  {order.menuType === "non-veg"    ? tOrder("menu_type_nonveg")
                  : order.menuType === "veg"       ? tOrder("menu_type_veg")
                  : order.menuType === "soup-only" ? (order.soup === "veg" ? tOrder("menu_type_soup_veg") : tOrder("menu_type_soup_nonveg"))
                  : order.menuType === "main-only" ? (order.main === "veg" ? tOrder("menu_type_main_veg") : tOrder("menu_type_main_nonveg"))
                  :                                  tOrder("menu_type_custom")}
                </span>
                {order.menuType === "custom" && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    {tOrder("soup")}: <span className="font-medium">{order.soup === "non-veg" ? tOrder("menu_type_nonveg") : order.soup === "veg" ? tOrder("menu_type_veg") : tOrder("menu_type_none")}</span>
                    {" · "}
                    {tOrder("main")}: <span className="font-medium">{order.main === "non-veg" ? tOrder("menu_type_nonveg") : order.main === "veg" ? tOrder("menu_type_veg") : tOrder("menu_type_none")}</span>
                  </div>
                )}
              </td>
              <td className="px-4 py-3 text-gray-500 italic text-xs">
                {order.note || "—"}
              </td>
              <td className="px-4 py-3 text-right font-medium text-gray-900">
                {order.qty}
              </td>
              <td className="px-4 py-3 text-right text-xs">
                {orderTip > 0 ? (
                  <span className="font-semibold text-yellow-600">{orderTip} RON</span>
                ) : (
                  <span className="text-gray-300">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => onDelete(order.id)}
                  disabled={deletingId === order.id}
                  className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  {t("delete")}
                </button>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
