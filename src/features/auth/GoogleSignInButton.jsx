export default function GoogleSignInButton({ busy, disabled, onClick }) {
  return (
    <button
      className="google-signin-button"
      type="button"
      disabled={disabled || busy}
      onClick={onClick}
    >
      <span aria-hidden="true">G</span>
      {busy ? "Connecting to Google&" : "Continue with Google"}
    </button>
  );
}
