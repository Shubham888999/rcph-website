export default function GoogleSignupButton({ busy, disabled, onClick }) {
  return (
    <button
      className="signup-google-button"
      type="button"
      disabled={disabled}
      aria-busy={busy}
      onClick={onClick}
    >
      <span aria-hidden="true">G</span>
      {busy ? "Opening Google..." : "Continue with Google"}
    </button>
  );
}
