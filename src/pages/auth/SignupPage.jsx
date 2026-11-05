import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthStateScreen from "../../features/auth/AuthStateScreen";
import DistrictOfficialSignupForm from "../../features/auth/DistrictOfficialSignupForm";
import ExistingMemberSignupForm from "../../features/auth/ExistingMemberSignupForm";
import ProspectSignupForm from "../../features/auth/ProspectSignupForm";
import ProspectWelcome from "../../features/auth/ProspectWelcome";
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
import { resolveAttribution } from "../../features/auth/signupAttribution";
import {
  PROSPECT_STEPS,
  SIGNUP_PATHS,
  applySignupAttribution,
  buildSignupPayload,
  classifySignupOutcome,
  clearProspectOptionalFields,
  clearSignupFieldError,
  clearSignupSensitiveFields,
  createSignupForm,
  getProfileCompletionPath,
  parseSignupPathParam,
  prefillSignupIdentity,
  selectSignupPath,
  updateSignupField,
  validateProspectStep,
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
  const location = useLocation();
  const { user, authLoading, accountState, isAuthenticated, refreshAccess, signOut } = useAuth();
  const [attribution] = useState(() => resolveAttribution(location));
  const [requestedPath] = useState(() => parseSignupPathParam(new URLSearchParams(location.search).get("path")));
  const [form, setForm] = useState(() => {
    // District Official waits for the availability check below before it opens.
    if (requestedPath === SIGNUP_PATHS.DISTRICT_OFFICIAL) return createSignupForm();
    return applySignupAttribution(selectSignupPath(createSignupForm(), requestedPath), attribution);
  });
  const [prospectStep, setProspectStep] = useState(PROSPECT_STEPS.DETAILS);
  const [prospectWelcome, setProspectWelcome] = useState(false);
  const [completionPathResolved, setCompletionPathResolved] = useState(false);
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState(null);
  const [busyAction, setBusyAction] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [pendingRole, setPendingRole] = useState("");
  const [districtOfficialAvailable, setDistrictOfficialAvailable] = useState(false);
  const [awaitingTrustedAccess, setAwaitingTrustedAccess] = useState(false);
  const submissionLockRef = useRef(false);
  const profileCompletion = isAuthenticated && accountState === "profile-missing";

  // Runs once per account, so "Back to account type" can still reach the chooser.
  if (profileCompletion && user && !completionPathResolved) {
    setCompletionPathResolved(true);
    if (form.path === SIGNUP_PATHS.CHOICE && requestedPath === SIGNUP_PATHS.CHOICE) {
      setForm(applySignupAttribution(selectSignupPath(form, getProfileCompletionPath(user)), attribution));
    }
  } else if (profileCompletion && user && form.path !== SIGNUP_PATHS.CHOICE) {
    const prefilled = prefillSignupIdentity(form, user);
    if (prefilled !== form) setForm(prefilled);
  }

  useEffect(() => {
    if (accountState === "approved" && !prospectWelcome) navigate("/access", { replace: true });
  }, [accountState, navigate, prospectWelcome]);

  useEffect(() => {
    let active = true;
    getVisitSignupAvailability()
      .then((result) => {
        if (!active) return;
        setDistrictOfficialAvailable(result?.available === true);
        if (result?.available === true && requestedPath === SIGNUP_PATHS.DISTRICT_OFFICIAL) {
          setForm((current) => current.path === SIGNUP_PATHS.CHOICE ? selectSignupPath(current, requestedPath) : current);
        }
      })
      .catch(() => {
        if (active) setDistrictOfficialAvailable(false);
      });
    return () => {
      active = false;
    };
  }, [requestedPath]);

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
      const next = applySignupAttribution(selectSignupPath(current, path), attribution);
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
    setProspectStep(PROSPECT_STEPS.DETAILS);
  }, [attribution, profileCompletion, user]);

  const handleFieldChange = useCallback((field, value) => {
    setForm((current) => updateSignupField(current, field, value));
    setErrors((current) => clearSignupFieldError(current, field));
    if (!submissionLockRef.current) setNotice(null);
  }, []);

  const handleBack = useCallback(() => {
    choosePath(SIGNUP_PATHS.CHOICE);
  }, [choosePath]);

  const handleSignOutOfCompletion = useCallback(async () => {
    await signOut();
    setForm((current) => ({ ...current, name: "", email: "" }));
    setErrors({});
    setNotice(null);
    setProspectStep(PROSPECT_STEPS.DETAILS);
    setCompletionPathResolved(false);
  }, [signOut]);

  const handleProspectNext = useCallback(() => {
    const validation = validateProspectStep(form, PROSPECT_STEPS.DETAILS, {
      requireCredentials: !profileCompletion,
      identityEmail: profileCompletion ? user?.email : "",
      profileCompletion,
    });
    setErrors(validation.errors);
    if (!validation.valid) {
      focusFirstError(validation.errors);
      return;
    }
    setNotice(null);
    setProspectStep(PROSPECT_STEPS.ABOUT);
  }, [focusFirstError, form, profileCompletion, user]);

  // Google comes first on the Prospect form, so only the identity is created here.
  // Auth state then reopens step 1 as profile completion (or leaves if an account exists).
  const handleProspectGoogle = useCallback(async () => {
    if (submissionLockRef.current) return;
    submissionLockRef.current = true;
    setBusyAction("google");
    setErrors({});
    setNotice(null);
    try {
      await signInOrCreateGoogleSignup();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Signup stage failed.", getSignupDiagnostic(error, "auth"));
      }
      setNotice({ tone: "error", message: getSignupError(error, { requestedRole: "prospect" }) });
    } finally {
      submissionLockRef.current = false;
      setBusyAction("");
    }
  }, []);

  const handleSignup = useCallback(async (method, options = {}) => {
    if (submissionLockRef.current) return;
    const isGoogle = method === "google";
    const completion = profileCompletion;
    const submitForm = options.skipOptional ? clearProspectOptionalFields(form, attribution) : form;
    const validation = validateSignup(submitForm, {
      requireCredentials: !isGoogle && !completion,
      identityEmail: completion ? user?.email : "",
      profileCompletion: completion,
    });
    setErrors(validation.errors);
    if (!validation.valid) {
      setProspectStep(PROSPECT_STEPS.DETAILS);
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
          return buildSignupPayload(submitForm, {
            provider: providerForUser(identity),
            identityEmail: identity.email || validation.values.email,
            profileCompletion: completion,
            attribution,
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
      if (outcome.role === "prospect" && !outcome.existing) {
        setProspectWelcome(true);
        // The account exists now. A failed refresh is retried by the route guard on /access.
        await applySignupOutcome(outcome, {
          refreshTrustedAccess: refreshAccess,
          signOut,
        }).catch(() => {});
        return;
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
      setProspectStep(PROSPECT_STEPS.DETAILS);
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
  }, [attribution, focusFirstError, form, profileCompletion, refreshAccess, signOut, user]);

  if (prospectWelcome) {
    return (
      <main className="login-page-react signup-page">
        <div className="signup-shell"><ProspectWelcome /></div>
      </main>
    );
  }
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
  {profileCompletion && user ? (
    <p className="signup-identity">
      Signed in as {user.email || "your account"}. Not you?{" "}
      <button type="button" disabled={Boolean(busyAction)} onClick={handleSignOutOfCompletion}>Sign out</button>
    </p>
  ) : null}
  {form.path === SIGNUP_PATHS.CHOICE ? (
    <SignupChoice districtOfficialAvailable={districtOfficialAvailable} onSelect={choosePath} />
  ) : null}

  {form.path === SIGNUP_PATHS.PROSPECT ? (
    <ProspectSignupForm
      {...formProps}
      onTogglePasswords={() => setShowPasswords((current) => !current)}
      step={prospectStep}
      invited={Boolean(attribution?.ref)}
      onChange={handleFieldChange}
      onNext={handleProspectNext}
      onPreviousStep={() => { setErrors({}); setNotice(null); setProspectStep(PROSPECT_STEPS.DETAILS); }}
      onSubmit={handleSignup}
      onSkip={() => handleSignup("password", { skipOptional: true })}
      onGoogle={handleProspectGoogle}
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
