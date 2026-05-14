"use client";

import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";

/** True when HTML has no visible text (handles `<br>`, empty divs). */
export function isEffectivelyEmptyHtml(html: string): boolean {
  const t = html.trim();
  if (!t) return true;
  if (typeof document === "undefined") {
    return !t.replace(/<[^>]+>/g, "").trim();
  }
  const d = document.createElement("div");
  d.innerHTML = t;
  return !(d.textContent || "").trim();
}

/** Plain-text preview for list cells (strips tags). */
export function htmlToPlainPreview(html: string, maxLen: number): string {
  if (!html.trim()) return "";
  if (typeof document === "undefined") {
    const plain = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return plain.length > maxLen ? `${plain.slice(0, maxLen)}…` : plain;
  }
  const d = document.createElement("div");
  d.innerHTML = html;
  const plain = (d.textContent || "").replace(/\s+/g, " ").trim();
  return plain.length > maxLen ? `${plain.slice(0, maxLen)}…` : plain;
}

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/ on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
}

function tryRestoreRange(r: Range | null): boolean {
  if (!r) return false;
  try {
    const sel = window.getSelection();
    if (!sel) return false;
    sel.removeAllRanges();
    sel.addRange(r);
    return true;
  } catch {
    return false;
  }
}

/** Apply pixel font size to selection, or insert a styled span at caret for text that follows. */
function applyFontSizePx(px: string): void {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (!range.collapsed) {
    try {
      const span = document.createElement("span");
      span.style.fontSize = `${px}px`;
      span.appendChild(range.extractContents());
      range.insertNode(span);
      sel.removeAllRanges();
      const next = document.createRange();
      next.selectNodeContents(span);
      next.collapse(false);
      sel.addRange(next);
    } catch {
      /* ignore */
    }
    return;
  }
  const span = document.createElement("span");
  span.style.fontSize = `${px}px`;
  const z = document.createTextNode("\u200b");
  span.appendChild(z);
  range.insertNode(span);
  const nr = document.createRange();
  nr.setStart(z, 1);
  nr.collapse(true);
  sel.removeAllRanges();
  sel.addRange(nr);
}

const toolbarBtn: CSSProperties = {
  padding: "0.35rem 0.55rem",
  borderRadius: 6,
  border: "1px solid #cbd5e1",
  background: "#fff",
  fontWeight: 700,
  fontSize: "0.82rem",
  color: "#0f172a",
  cursor: "pointer",
  lineHeight: 1.2,
};

const toolbarDivider: CSSProperties = {
  width: 1,
  height: 22,
  background: "#e2e8f0",
  margin: "0 0.1rem",
  flexShrink: 0,
};

type Props = {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  minHeight?: number;
  id?: string;
  "aria-label"?: string;
};

export function RichTextEditor({ value, onChange, disabled, minHeight = 200, id, "aria-label": ariaLabel }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);
  const savedRange = useRef<Range | null>(null);

  const emit = useCallback(() => {
    const el = ref.current;
    if (!el || syncing.current) return;
    onChange(sanitizeHtml(el.innerHTML));
  }, [onChange]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return;
    if (el.innerHTML !== value) {
      syncing.current = true;
      el.innerHTML = value || "";
      syncing.current = false;
    }
  }, [value]);

  const stashSelection = useCallback(() => {
    const el = ref.current;
    const sel = window.getSelection();
    if (!el || !sel?.rangeCount) return;
    const r = sel.getRangeAt(0);
    if (el.contains(r.commonAncestorContainer)) {
      savedRange.current = r.cloneRange();
    }
  }, []);

  const keepEditorSelectionOnToolbar = useCallback(
    (e: MouseEvent) => {
      if (disabled) return;
      e.preventDefault();
      stashSelection();
    },
    [disabled, stashSelection],
  );

  const run = useCallback(
    (fn: () => void) => {
      if (disabled) return;
      ref.current?.focus();
      tryRestoreRange(savedRange.current);
      fn();
      emit();
    },
    [disabled, emit],
  );

  const [sizePx, setSizePx] = useState("16");

  const onFontSizeChange = useCallback(
    (px: string) => {
      if (disabled) return;
      setSizePx(px);
      ref.current?.focus();
      tryRestoreRange(savedRange.current);
      applyFontSizePx(px);
      emit();
    },
    [disabled, emit],
  );

  return (
    <div
      style={{
        borderRadius: 10,
        border: "1px solid #cbd5e1",
        background: "#f8fafc",
        overflow: "hidden",
      }}
    >
      <div
        role="toolbar"
        aria-label="Text formatting"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "0.35rem",
          padding: "0.45rem 0.55rem",
          borderBottom: "1px solid #e2e8f0",
          background: "#fff",
        }}
      >
        <button
          type="button"
          disabled={disabled}
          onMouseDown={keepEditorSelectionOnToolbar}
          onClick={() => run(() => document.execCommand("bold", false))}
          style={{ ...toolbarBtn, fontFamily: "Georgia, serif" }}
          title="Bold (Ctrl+B)"
          aria-label="Bold"
        >
          B
        </button>
        <button
          type="button"
          disabled={disabled}
          onMouseDown={keepEditorSelectionOnToolbar}
          onClick={() => run(() => document.execCommand("italic", false))}
          style={{ ...toolbarBtn, fontStyle: "italic", fontFamily: "Georgia, serif" }}
          title="Italic (Ctrl+I)"
          aria-label="Italic"
        >
          I
        </button>
        <button
          type="button"
          disabled={disabled}
          onMouseDown={keepEditorSelectionOnToolbar}
          onClick={() => run(() => document.execCommand("underline", false))}
          style={{ ...toolbarBtn, textDecoration: "underline", fontFamily: "Georgia, serif" }}
          title="Underline (Ctrl+U)"
          aria-label="Underline"
        >
          U
        </button>
        <span style={toolbarDivider} aria-hidden />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem", color: "#475569", fontWeight: 600 }}>
          Size
          <select
            disabled={disabled}
            value={sizePx}
            onMouseDown={stashSelection}
            onChange={(e) => onFontSizeChange(e.target.value)}
            style={{
              padding: "0.3rem 0.4rem",
              borderRadius: 6,
              border: "1px solid #cbd5e1",
              fontSize: "0.82rem",
              background: "#fff",
              cursor: disabled ? "not-allowed" : "pointer",
            }}
            title="Apply to selected text, or set size for text you type next"
            aria-label="Font size"
          >
            <option value="12">12px</option>
            <option value="14">14px</option>
            <option value="16">16px</option>
            <option value="18">18px</option>
            <option value="22">22px</option>
            <option value="28">28px</option>
          </select>
        </label>
        <span style={toolbarDivider} aria-hidden />
        <button
          type="button"
          disabled={disabled}
          onMouseDown={keepEditorSelectionOnToolbar}
          onClick={() => run(() => document.execCommand("insertUnorderedList", false))}
          style={toolbarBtn}
          title="Bullet list"
          aria-label="Bullet list"
        >
          • List
        </button>
        <button
          type="button"
          disabled={disabled}
          onMouseDown={keepEditorSelectionOnToolbar}
          onClick={() => run(() => document.execCommand("insertOrderedList", false))}
          style={toolbarBtn}
          title="Numbered list"
          aria-label="Numbered list"
        >
          1. List
        </button>
      </div>
      <div
        ref={ref}
        id={id}
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel ?? "Report body"}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onKeyUp={stashSelection}
        onMouseUp={stashSelection}
        onInput={emit}
        onBlur={emit}
        style={{
          minHeight,
          padding: "0.65rem 0.75rem",
          fontSize: "0.9rem",
          lineHeight: 1.55,
          outline: "none",
          color: "#0f172a",
          opacity: disabled ? 0.65 : 1,
        }}
      />
    </div>
  );
}
