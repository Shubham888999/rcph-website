import { useEffect, useRef } from "react";

export default function AdminDialog({ title, children, onClose, busy = false, className = "" }) {
  const ref = useRef(null); const closeRef = useRef(onClose); const busyRef = useRef(busy);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => { busyRef.current = busy; }, [busy]);
  useEffect(() => {
    const previous = document.activeElement; const overflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    const dialog = ref.current; const selector = 'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'; dialog.querySelector(selector)?.focus();
    function keydown(event) { if (event.key === "Escape" && !busyRef.current) closeRef.current(); if (event.key !== "Tab") return; const items = [...dialog.querySelectorAll(selector)]; if (!items.length) return; const first = items[0], last = items.at(-1); if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } }
    document.addEventListener("keydown", keydown); return () => { document.removeEventListener("keydown", keydown); document.body.style.overflow = overflow; previous?.focus?.(); };
  }, []);
  return <div className="admin-dialog-backdrop" onMouseDown={(event) => { if (!busy && event.target === event.currentTarget) onClose(); }}><section ref={ref} className={`admin-dialog ${className}`} role="dialog" aria-modal="true" aria-labelledby="admin-dialog-title" tabIndex="-1"><header><h2 id="admin-dialog-title">{title}</h2><button type="button" onClick={onClose} disabled={busy} aria-label="Close dialog">×</button></header>{children}</section></div>;
}
