export default function AuthNotice({ message, tone = "error" }) {
  if (!message) return null;
  const isError = tone === "error";
  return (
    <p
      className={`login-notice login-notice--${tone}`}
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
    >
      {message}
    </p>
  );
}
