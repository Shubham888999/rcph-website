import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthStateScreen from "../../features/auth/AuthStateScreen";
import DistrictOfficialSignupForm from "../../features/auth/DistrictOfficialSignupForm";
import ExistingMemberSignupForm from "../../features/auth/ExistingMemberSignupForm";
import ProspectSignupForm from "../../features/auth/ProspectSignupForm";
import SignupChoice from "../../features/auth/SignupChoice";
import SignupSuccess from "../../features/auth/SignupSuccess";
import {
  createPasswordSignupAccount,
  createUserProfileAfterSignup,
  deleteCurrentAuthUserForFailedSignup,
  getVisitSignupAvailability,
  signInOrCreateGoogleSignup,
} from "../../features/auth/authService";
import {
  PARTIAL_PROFILE_MESSAGE,
  getSignupDiagnostic,
  getSignupError,
} from "../../features/auth/signupErrors";
import {
  SIGNUP_PATHS,
  buildSignupPayload,
  classifySignupOutcome,
  clearSignupFieldError,
  clearSignupSensitiveFields,
  createSignupForm,
  selectSignupPath,
  updateSignupField,
  validateSignup,
} from "../../features/auth/signupModel";
import {
  applySignupOutcome,
  cleanupFailedAdminPasswordSignup,
  runSignupWorkflow,
} from "../../features/auth/signupWorkflow";
import useAuth from "../../hooks/useAuth";
import "../../styles/components/login.css";
import "../../styles/components/signup.css";

function providerForUser(user) {
  return user?.providerData?.some((entry) => entry?.providerId === "google.com")
    ? "google"
    : "password";
}

const signupServices = {
  createPasswordAccount: createPasswordSignupAccount,
  openGoogleSignup: signInOrCreateGoogleSignup,
  createProfile: createUserProfileAfterSignup,
};

function SignupVerification({ message = "Checking your account setup..." }) {
  return (
    <main className="login-page-react">
      <section className="login-verification" role="status" aria-live="polite">
        <span className="login-verification-logo rcph-logo-mark" aria-hidden="true">
          <img src="/images/rcph-lakshya-logo.webp" alt="" />
        </span>
        <p className="login-kicker">Secure account creation</p>
        <h1>Verifying your account</h1>
        <p>{message}</p>
      </section>
    </main>
  );
}

export default function SignupPage() {
  const navigate = useNavigate();
  const { user, authLoading, accountState, isAuthenticated, refreshAccess, signOut } = useAuth();
  const [form, setForm] = useState(() => createSignupForm());
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState(null);
  const [busyAction, setBusyAction] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [pendingRole, setPendingRole] = useState("");
  const [districtOfficialAvailable, setDistrictOfficialAvailable] = useState(false);
  const [awaitingTrustedAccess, setAwaitingTrustedAccess] = useState(false);
  const submissionLockRef = useRef(false);
  const profileCompletion = isAuthenticated && accountState === "profile-missing";

  useEffect(() => {
    if (accountState === "approved") navigate("/access", { replace: true });
  }, [accountState, navigate]);

  useEffect(() => {
    let active = true;
    getVisitSignupAvailability()
      .then((result) => {
        if (active) setDistrictOfficialAvailable(result?.available === true);
      })
      .catch(() => {
        if (active) setDistrictOfficialAvailable(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const formProps = useMemo(() => ({
    form,
    errors,
    busy: busyAction,
    notice,
    profileCompletion,
    showPasswords,
  }), [busyAction, errors, form, notice, profileCompletion, showPasswords]);

  const focusFirstError = useCallback((validationErrors) => {
    const firstField = Object.keys(validationErrors)[0];
    if (!firstField || firstField === "path") return;
    window.setTimeout(() => document.getElementById(`signup-${firstField}`)?.focus(), 0);
  }, []);

  const choosePath = useCallback((path) => {
    setForm((current) => {
      const next = selectSignupPath(current, path);
      if (!profileCompletion || !user) return next;
      return {
        ...next,
        name: current.name || user.displayName || "",
        email: user.email || "",
      };
    });
    setErrors({});
    setNotice(null);
    setShowPasswords(false);
  }, [profileCompletion, user]);

  const handleFieldChange = useCallback((field, value) => {
    setForm((current) => updateSignupField(current, field, value));
    setErrors((current) => clearSignupFieldError(current, field));
    if (!submissionLockRef.current) setNotice(null);
  }, []);

  const handleBack = useCallback(() => {
    choosePath(SIGNUP_PATHS.CHOICE);
  }, [choosePath]);

  const handleSignup = useCallback(async (method) => {
    if (submissionLockRef.current) return;
    const isGoogle = method === "google";
    const completion = profileCompletion;
    const validation = validateSignup(form, {
      requireCredentials: !isGoogle && !completion,
      identityEmail: completion ? user?.email : "",
      profileCompletion: completion,
    });
    setErrors(validation.errors);
    if (!validation.valid) {
      focusFirstError(validation.errors);
      return;
    }

    submissionLockRef.current = true;
    setBusyAction(isGoogle ? "google" : completion ? "profile" : "password");
    setNotice(null);
    let newlyCreatedPasswordUser = null;
    let stage = completion ? "profile" : "auth";

    try {
      const workflow = await runSignupWorkflow({
        mode: completion ? "completion" : isGoogle ? "google" : "password",
        currentUser: completion ? user : null,
        authDetails: {
          email: validation.values.email,
          password: validation.values.password,
          name: validation.values.name,
        },
        buildPayload: (identity) => {
          stage = "profile";
          return buildSignupPayload(form, {
            provider: providerForUser(identity),
            identityEmail: identity.email || validation.values.email,
            profileCompletion: completion,
          });
        },
        services: signupServices,
        onIdentity: (identity) => {
          newlyCreatedPasswordUser = identity.createdPasswordUser;
        },
      });
      newlyCreatedPasswordUser = workflow.createdPasswordUser;
      const outcome = classifySignupOutcome(workflow.profileResult);
      setForm((current) => clearSignupSensitiveFields(current));

      if (outcome.kind === "pending") {
        await applySignupOutcome(outcome, {
          refreshTrustedAccess: refreshAccess,
          signOut,
        });
        setPendingRole(outcome.requestedRole);
        return;
      }
      if (outcome.kind !== "approved") {
        throw new Error("Signup response did not include a trusted account outcome.");
      }
      setAwaitingTrustedAccess(true);
      await applySignupOutcome(outcome, {
        refreshTrustedAccess: refreshAccess,
        signOut,
      });
    } catch (error) {
      const requestedRole = form.path === SIGNUP_PATHS.PROSPECT
        ? "prospect"
        : form.path === SIGNUP_PATHS.DISTRICT_OFFICIAL
          ? "districtOfficial"
          : form.requestedRole;
      let cleanupFailed = false;
      let cleanupAttempted = false;
      const shouldCleanup = Boolean(
        newlyCreatedPasswordUser
        && stage === "profile"
        && (
          ["functions/failed-precondition", "functions/invalid-argument"].includes(error?.code)
          || (requestedRole === "admin" && error?.code === "functions/permission-denied")
        )
      );
      if (shouldCleanup) {
        cleanupAttempted = true;
        const cleanup = await cleanupFailedAdminPasswordSignup({
          shouldCleanup,
          uid: newlyCreatedPasswordUser.uid,
          deleteCurrentUser: deleteCurrentAuthUserForFailedSignup,
          signOut,
        });
        cleanupFailed = cleanup.cleanupFailed;
        if (cleanupFailed && import.meta.env.DEV) {
          console.error("Partial signup cleanup failed.", { code: "cleanup-failed", stage: "cleanup" });
        }
      }
      if (import.meta.env.DEV) {
        console.error("Signup stage failed.", getSignupDiagnostic(error, stage));
      }
      setForm((current) => clearSignupSensitiveFields(current));
      const baseMessage = getSignupError(error, { requestedRole });
      setNotice({
        tone: "error",
        message: cleanupFailed || (newlyCreatedPasswordUser && !cleanupAttempted && stage === "profile" && error?.code !== "functions/permission-denied")
          ? `${baseMessage} ${PARTIAL_PROFILE_MESSAGE}`
          : baseMessage,
      });
    } finally {
      submissionLockRef.current = false;
      setBusyAction("");
    }
  }, [focusFirstError, form, profileCompletion, refreshAccess, signOut, user]);

  if (pendingRole) {
    return (
      <main className="login-page-react signup-page">
        <div className="signup-shell"><SignupSuccess requestedRole={pendingRole} /></div>
      </main>
    );
  }
  if (authLoading) return <SignupVerification />;
  if (awaitingTrustedAccess) {
    if (
      !["access-loading", "auth-loading", "approved"].includes(accountState)
    ) {
      return <AuthStateScreen state={accountState} />;
    }
    return <SignupVerification message="Confirming your approved RCPH access..." />;
  }
  if (isAuthenticated && !busyAction && accountState === "access-loading") return <SignupVerification />;
  if (
    isAuthenticated
    && !busyAction
    && ["pending", "rejected", "inactive", "access-error"].includes(accountState)
  ) {
    return <AuthStateScreen state={accountState} />;
  }

return (
  <main className="login-page-react signup-page">
    <div
      className={`signup-shell ${
        form.path === SIGNUP_PATHS.CHOICE ? "signup-shell--choice" : ""
      }`}
    >
      <header className="signup-brand-header">
        <Link className="login-brand" to="/" aria-label="RCPH public homepage">
          <span className="login-brand-logo rcph-logo-mark">
            <img
              src="/images/rcph-lakshya-logo.webp"
              alt="Rotaract Club of Pune Heritage — Lakshya RIY 2026-27"
            />
          </span>
          <span>
            <strong>RCPH</strong>
            <small>RID 3131 - Zone 4</small>
          </span>
        </Link>

        <div>
          <p className="login-kicker">LAKSHYA · RIY 2026-27</p>
          <h1>Create your RCPH account</h1>
        </div>
      </header>

<section className="signup-card">
  {form.path === SIGNUP_PATHS.CHOICE ? (
    <SignupChoice districtOfficialAvailable={districtOfficialAvailable} onSelect={choosePath} />
  ) : null}

  {form.path === SIGNUP_PATHS.PROSPECT ? (
    <ProspectSignupForm
      {...formProps}
      onTogglePasswords={() => setShowPasswords((current) => !current)}
      onChange={handleFieldChange}
      onSubmit={handleSignup}
      onGoogle={() => handleSignup("google")}
      onBack={handleBack}
    />
  ) : null}

  {form.path === SIGNUP_PATHS.EXISTING_MEMBER ? (
    <ExistingMemberSignupForm
      {...formProps}
      onTogglePasswords={() => setShowPasswords((current) => !current)}
      onChange={handleFieldChange}
      onSubmit={handleSignup}
      onGoogle={() => handleSignup("google")}
      onBack={handleBack}
    />
  ) : null}

  {form.path === SIGNUP_PATHS.DISTRICT_OFFICIAL ? (
    <DistrictOfficialSignupForm
      {...formProps}
      onTogglePasswords={() => setShowPasswords((current) => !current)}
      onChange={handleFieldChange}
      onSubmit={handleSignup}
      onGoogle={() => handleSignup("google")}
      onBack={handleBack}
    />
  ) : null}
</section>
    </div>
  </main>
);
}
