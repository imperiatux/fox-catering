"use client";

import { useState, useEffect, useRef, useCallback, DragEvent } from "react";
import { useTranslations } from "next-intl";

export default function AdminMenuPage() {
  const t = useTranslations("admin");
  const tError = useTranslations("error");

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load current photo on mount
  useEffect(() => {
    fetch("/api/admin/menu")
      .then((r) => r.json())
      .then((data) => {
        if (data.url) {
          setPreviewUrl(data.url);
        }
      })
      .catch(() => {});
  }, []);

  const uploadFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setFeedback({ type: "error", message: tError("upload_failed") });
        return;
      }

      setUploading(true);
      setFeedback(null);

      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/admin/menu", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          throw new Error("Upload failed");
        }

        const data = await res.json();
        // Bust cache by appending a timestamp
        setPreviewUrl(`${data.url}?t=${Date.now()}`);
        setFeedback({ type: "success", message: t("saved") });
      } catch {
        setFeedback({ type: "error", message: tError("upload_failed") });
      } finally {
        setUploading(false);
      }
    },
    [t, tError],
  );

  // Clipboard paste handler
  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            uploadFile(file);
          }
          break;
        }
      }
    }

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [uploadFile]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile(file);
    }
    // Reset so the same file can be re-selected
    e.target.value = "";
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      uploadFile(file);
    }
  }

  return (
    <div className="max-w-lg space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("menu_upload")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t("drag_drop")}</p>
      </div>

      {/* Drop / click zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label={t("drag_drop")}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            fileInputRef.current?.click();
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-16 text-center transition-colors ${
          isDragging
            ? "border-brand-500 bg-brand-50"
            : "border-gray-300 bg-white hover:border-brand-400 hover:bg-brand-50/50"
        } ${uploading ? "pointer-events-none opacity-60" : ""}`}
      >
        <div className={`rounded-full p-4 ${isDragging ? "bg-brand-100" : "bg-gray-100"}`}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-8 w-8 ${isDragging ? "text-brand-500" : "text-gray-400"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
            />
          </svg>
        </div>

        <div>
          <p className="text-sm font-semibold text-gray-700">
            {uploading ? (
              <span className="text-brand-500 animate-pulse">Uploading…</span>
            ) : (
              t("drag_drop")
            )}
          </p>
          <p className="text-xs text-gray-400 mt-1">{t("paste_hint")}</p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Feedback */}
      {feedback && (
        <div
          role="alert"
          className={`rounded-lg px-4 py-3 text-sm font-medium border ${
            feedback.type === "success"
              ? "bg-green-50 border-green-200 text-green-700"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Current photo preview */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">
          {t("current_photo")}
        </h2>

        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={t("current_photo")}
            className="rounded-xl border border-gray-200 shadow-sm max-w-full"
          />
        ) : (
          <p className="text-sm text-gray-400 italic">{t("no_photo")}</p>
        )}
      </div>
    </div>
  );
}
