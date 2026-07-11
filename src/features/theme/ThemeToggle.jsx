import useTheme from "./useTheme";

function SunIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <circle cx="12" cy="12" r="4.25" />
      <path d="M12 2.5v2.25M12 19.25v2.25M4.75 4.75l1.6 1.6M17.65 17.65l1.6 1.6M2.5 12h2.25M19.25 12h2.25M4.75 19.25l1.6-1.6M17.65 6.35l1.6-1.6" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M20.1 14.35A7.4 7.4 0 0 1 9.65 3.9 8.3 8.3 0 1 0 20.1 14.35Z" />
    </svg>
  );
}

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";
  const tooltip = isDark ? "Light mode" : "Dark mode";

  return (
    <button
      aria-label={label}
      aria-pressed={!isDark}
      className={`theme-toggle theme-toggle--${theme}`}
      title={label}
      type="button"
      onClick={toggleTheme}
    >
      <span className="theme-toggle__icon" aria-hidden="true">
        {isDark ? <SunIcon /> : <MoonIcon />}
      </span>
      <span className="theme-toggle__tooltip" aria-hidden="true">{tooltip}</span>
    </button>
  );
}
