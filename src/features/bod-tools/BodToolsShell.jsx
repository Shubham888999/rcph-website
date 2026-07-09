export default function BodToolsShell({ children }) {
  return (
    <div className="bod-tools-shell">
      <div className="bod-tools-shell__ambient" aria-hidden="true">
        <span className="bod-tools-shell__orb bod-tools-shell__orb--gold" />
        <span className="bod-tools-shell__orb bod-tools-shell__orb--teal" />
        <span className="bod-tools-shell__grid" />
      </div>

      <div className="bod-tools-shell__content">
        {children}
      </div>
    </div>
  );
}