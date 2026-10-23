import { useEffect, useId, useRef, useState } from "react";

// A ⋮ button that opens a small menu of row actions. The menu is placed against
// the window, so a scrolling table never clips it. Closes on outside click,
// Escape, scroll, resize, or after an action runs.
export default function RowActionsMenu({ label, items }) {
  const [position, setPosition] = useState(null);
  const ref = useRef(null);
  const menuId = useId();
  const open = Boolean(position);
  const setOpen = (next) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!next || !rect) {
      setPosition(null);
      return;
    }
    const below = window.innerHeight - rect.bottom > 140;
    setPosition({
      right: Math.max(8, window.innerWidth - rect.right),
      ...(below ? { top: rect.bottom + 4 } : { bottom: window.innerHeight - rect.top + 4 }),
    });
  };

  useEffect(() => {
    if (!open) return undefined;
    function closeOnOutsideClick(event) {
      if (ref.current && !ref.current.contains(event.target)) setPosition(null);
    }
    function closeOnEscape(event) {
      if (event.key === "Escape") setPosition(null);
    }
    function close() {
      setPosition(null);
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <div className="admin-row-menu" ref={ref}>
      <button
        type="button"
        className="admin-row-menu__trigger"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen(!open)}
      >
        <span className="admin-row-menu__dots" aria-hidden="true"><span></span><span></span><span></span></span>
      </button>
      {open ? (
        <div className="admin-row-menu__list" id={menuId} role="menu" aria-label={label} style={position}>
          {items.map((item) => (
            <button
              type="button"
              role="menuitem"
              key={item.label}
              className={item.danger ? "danger" : undefined}
              disabled={item.disabled}
              onClick={() => {
                setPosition(null);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
