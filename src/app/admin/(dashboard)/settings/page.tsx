"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import type { AppSettings } from "@/types";

const WEEKDAYS: { key: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"; iso: number }[] =
  [
    { key: "mon", iso: 1 },
    { key: "tue", iso: 2 },
    { key: "wed", iso: 3 },
    { key: "thu", iso: 4 },
    { key: "fri", iso: 5 },
    { key: "sat", iso: 6 },
    { key: "sun", iso: 7 },
  ];

export default function AdminSettingsPage() {
  const t = useTranslations("admin");
  const tDay = useTranslations("day");
  const tError = useTranslations("error");

  const [settings, setSettings] = useState<AppSettings>({
    cutoffHour: 10,
    cutoffMinute: 30,
    cutoffEnabled: true,
    activeDays: [1, 2, 3, 4, 5, 6, 7],
    whatsappPhone: '',
    priceNonVeg: 0,
    priceVeg: 0,
    priceSoupNonVeg: 0,
    priceSoupVeg: 0,
    priceMainNonVeg: 0,
    priceMainVeg: 0,
    priceCustom: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((data: AppSettings) => setSettings(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function toggleDay(iso: number) {
    setSettings((prev) => {
      const has = prev.activeDays.includes(iso);
      return {
        ...prev,
        activeDays: has
          ? prev.activeDays.filter((d) => d !== iso)
          : [...prev.activeDays, iso].sort((a, b) => a - b),
      };
    });
  }

  async function handleSave() {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Save failed");
      const updated: AppSettings = await res.json();
      setSettings(updated);
      setFeedback({ type: "success", message: t("saved") });
    } catch {
      setFeedback({ type: "error", message: tError("generic") });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-lg space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("settings")}</h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("settings")}</h1>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100">
        {/* Cutoff enabled toggle */}
        <div className="flex items-center justify-between px-6 py-5">
          <div>
            <p className="text-sm font-semibold text-gray-800">{t("cutoff_enabled")}</p>
            <p className="text-xs text-gray-400 mt-0.5">{t("cutoff_time")}</p>
          </div>
          <button
            id="cutoff-enabled"
            type="button"
            role="switch"
            aria-checked={settings.cutoffEnabled}
            onClick={() =>
              setSettings((prev) => ({
                ...prev,
                cutoffEnabled: !prev.cutoffEnabled,
              }))
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
              settings.cutoffEnabled ? "bg-brand-500" : "bg-gray-200"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                settings.cutoffEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Cutoff time */}
        <div className="px-6 py-5">
          <p className="text-sm font-semibold text-gray-800 mb-3">{t("cutoff_time")}</p>
          <div className="flex items-center gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">HH</label>
              <input
                type="number"
                min={0}
                max={23}
                value={settings.cutoffHour}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    cutoffHour: Math.min(23, Math.max(0, Number(e.target.value))),
                  }))
                }
                className="w-20 rounded-lg border border-gray-300 px-3 py-2 text-sm text-center focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <span className="text-gray-400 font-bold text-lg mt-4">:</span>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">MM</label>
              <input
                type="number"
                min={0}
                max={59}
                value={settings.cutoffMinute}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    cutoffMinute: Math.min(
                      59,
                      Math.max(0, Number(e.target.value)),
                    ),
                  }))
                }
                className="w-20 rounded-lg border border-gray-300 px-3 py-2 text-sm text-center focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
        </div>

        {/* Active weekdays */}
        <div className="px-6 py-5">
          <p className="text-sm font-semibold text-gray-800 mb-3">{t("active_days")}</p>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map(({ key, iso }) => {
              const checked = settings.activeDays.includes(iso);
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => toggleDay(iso)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    checked
                      ? "bg-brand-500 text-white border-brand-500"
                      : "border-gray-300 text-gray-600 hover:border-brand-400 hover:text-brand-600"
                  }`}
                >
                  {tDay(key)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Prices */}
        <div className="px-6 py-5">
          <p className="text-sm font-semibold text-gray-800 mb-1">{t("prices")}</p>
          <p className="text-xs text-gray-400 mb-4">{t("price_hint")}</p>
          <div className="grid grid-cols-2 gap-4">
            {(
              [
                { key: "priceNonVeg",     label: t("price_nonveg") },
                { key: "priceVeg",        label: t("price_veg") },
                { key: "priceSoupNonVeg", label: t("price_soup_nonveg") },
                { key: "priceSoupVeg",    label: t("price_soup_veg") },
                { key: "priceMainNonVeg", label: t("price_main_nonveg") },
                { key: "priceMainVeg",    label: t("price_main_veg") },
                { key: "priceCustom",     label: t("price_custom") },
              ] as { key: keyof AppSettings; label: string }[]
            ).map(({ key, label }) => (
              <div key={key} className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">{label}</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    placeholder="0"
                    value={(settings[key] as number) === 0 ? "" : (settings[key] as number)}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        [key]: e.target.value === "" ? 0 : Math.max(0, Number(e.target.value)),
                      }))
                    }
                    className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm text-right focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <span className="text-xs text-gray-500">RON</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* WhatsApp phone number */}
        <div className="px-6 py-5">
          <p className="text-sm font-semibold text-gray-800 mb-1">{t("whatsapp_phone")}</p>
          <p className="text-xs text-gray-400 mb-3">{t("whatsapp_phone_hint")}</p>
          <div className="flex items-center gap-0">
            <span className="inline-flex items-center px-3 py-2 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-sm text-gray-500 select-none">
              +4
            </span>
            <input
              type="tel"
              inputMode="numeric"
              value={settings.whatsappPhone}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  whatsappPhone: e.target.value.replace(/[^0-9]/g, ""),
                }))
              }
              placeholder="724241222"
              className="flex-1 rounded-r-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>
      </div>

      {/* Save button + feedback */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-60 flex items-center gap-2"
        >
          {saving && (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          )}
          {t("save")}
        </button>
        {feedback && (
          <p
            role="alert"
            className={`text-sm font-medium ${
              feedback.type === "success" ? "text-green-600" : "text-red-600"
            }`}
          >
            {feedback.message}
          </p>
        )}
      </div>
    </div>
  );
}
