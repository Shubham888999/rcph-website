import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";

export default function SignupSuccess({ requestedRole }) {
  const headingRef = useRef(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  const role = requestedRole === "admin"
    ? "Admin"
    : requestedRole === "districtOfficial"
      ? "District Official"
      : "BOD";
  return (
    <section className="signup-success" role="status" aria-live="polite">
      <p className="login-kicker">Request submitted</p>
      <h2 ref={headingRef} tabIndex={-1}>Your {role} request is pending</h2>
      <p>Your account request was created successfully. Protected tools remain locked until an authorized club officer approves it.</p>
      <Link className="signup-primary-button" to="/login">Return to sign in</Link>
      <Link className="signup-text-link" to="/">Public homepage</Link>
    </section>
  );
}
