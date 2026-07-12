const GENDER_OPTIONS = [
  ["", "Select an option"],
  ["woman", "Woman"],
  ["man", "Man"],
  ["non-binary", "Non-binary"],
  ["self-describe", "Prefer to self-describe"],
  ["prefer-not-to-say", "Prefer not to say"],
];

function todayDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function FieldError({ id, message }) {
  return message ? <p id={id} className="signup-field-error" role="alert">{message}</p> : null;
}

export default function SignupCommonFields({
  form,
  errors,
  disabled,
  emailLocked,
  compactProfile,
  showCredentials,
  showPasswords,
  onTogglePasswords,
  onChange,
}) {
  return (
    <fieldset className="signup-fieldset">
      <legend>Basic details</legend>
      <div className="signup-field">
        <label htmlFor="signup-name">Full name</label>
        <input
          id="signup-name"
          type="text"
          autoComplete="name"
          value={form.name}
          disabled={disabled}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? "signup-name-error" : undefined}
          onChange={(event) => onChange("name", event.target.value)}
        />
        <FieldError id="signup-name-error" message={errors.name} />
      </div>
      {!compactProfile ? (
        <>
          <div className="signup-field">
            <label htmlFor="signup-phone">Phone number</label>
            <input
              id="signup-phone"
              type="tel"
              autoComplete="tel"
              value={form.phone}
              disabled={disabled}
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? "signup-phone-error" : "signup-phone-help"}
              onChange={(event) => onChange("phone", event.target.value)}
            />
            <FieldError id="signup-phone-error" message={errors.phone} />
          </div>
          <div className="signup-field">
            <label htmlFor="signup-dateOfBirth">Date of birth</label>
            <input
              id="signup-dateOfBirth"
              type="date"
              min="1900-01-01"
              max={todayDateString()}
              value={form.dateOfBirth}
              disabled={disabled}
              aria-invalid={Boolean(errors.dateOfBirth)}
              aria-describedby={errors.dateOfBirth ? "signup-dateOfBirth-error" : undefined}
              onChange={(event) => onChange("dateOfBirth", event.target.value)}
            />
            <FieldError id="signup-dateOfBirth-error" message={errors.dateOfBirth} />
          </div>
        </>
      ) : null}
      <div className="signup-field">
        <label htmlFor="signup-email">Email address</label>
        <input
          id="signup-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={form.email}
          readOnly={emailLocked}
          disabled={disabled}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "signup-email-error" : emailLocked ? "signup-email-help" : undefined}
          onChange={(event) => onChange("email", event.target.value)}
        />
        {emailLocked ? <p id="signup-email-help" className="signup-help">This email comes from your signed-in account.</p> : null}
        <FieldError id="signup-email-error" message={errors.email} />
      </div>
      {!compactProfile ? (
        <>
          <div className="signup-field">
            <label htmlFor="signup-gender">Gender</label>
            <select
              id="signup-gender"
              value={form.gender}
              disabled={disabled}
              aria-invalid={Boolean(errors.gender)}
              aria-describedby={errors.gender ? "signup-gender-error" : undefined}
              onChange={(event) => onChange("gender", event.target.value)}
            >
              {GENDER_OPTIONS.map(([value, label]) => <option key={value || "empty"} value={value}>{label}</option>)}
            </select>
            <FieldError id="signup-gender-error" message={errors.gender} />
          </div>
          {form.gender === "self-describe" ? (
            <div className="signup-field">
              <label htmlFor="signup-genderSelfDescribe">Please self-describe</label>
              <input
                id="signup-genderSelfDescribe"
                type="text"
                value={form.genderSelfDescribe}
                disabled={disabled}
                aria-invalid={Boolean(errors.genderSelfDescribe)}
                aria-describedby={errors.genderSelfDescribe ? "signup-gender-self-error" : undefined}
                onChange={(event) => onChange("genderSelfDescribe", event.target.value)}
              />
              <FieldError id="signup-gender-self-error" message={errors.genderSelfDescribe} />
            </div>
          ) : null}
        </>
      ) : null}
      {showCredentials ? (
        <>
          <div className="signup-field">
            <label htmlFor="signup-password">Password</label>
            <div className="signup-password-control">
              <input
                id="signup-password"
                type={showPasswords ? "text" : "password"}
                autoComplete="new-password"
                value={form.password}
                disabled={disabled}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? "signup-password-error" : "signup-password-help"}
                onChange={(event) => onChange("password", event.target.value)}
              />
              <button
                type="button"
                aria-pressed={showPasswords}
                aria-label={showPasswords ? "Hide signup passwords" : "Show signup passwords"}
                disabled={disabled}
                onClick={onTogglePasswords}
              >
                {showPasswords ? "Hide" : "Show"}
              </button>
            </div>
            <p id="signup-password-help" className="signup-help">Use at least 6 characters.</p>
            <FieldError id="signup-password-error" message={errors.password} />
          </div>
          <div className="signup-field">
            <label htmlFor="signup-confirmPassword">Confirm password</label>
            <input
              id="signup-confirmPassword"
              type={showPasswords ? "text" : "password"}
              autoComplete="new-password"
              value={form.confirmPassword}
              disabled={disabled}
              aria-invalid={Boolean(errors.confirmPassword)}
              aria-describedby={errors.confirmPassword ? "signup-confirm-error" : undefined}
              onChange={(event) => onChange("confirmPassword", event.target.value)}
            />
            <FieldError id="signup-confirm-error" message={errors.confirmPassword} />
          </div>
        </>
      ) : null}
    </fieldset>
  );
}
