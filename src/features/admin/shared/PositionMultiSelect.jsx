import { useMemo } from "react";
import { filterPositionCatalog, groupedPositionOptions } from "./positionModel.js";

export default function PositionMultiSelect({
  selectedKeys,
  onChange,
  disabled = false,
  disabledKeys = [],
  searchValue,
  onSearchChange,
  error = "",
  unknownValues = [],
}) {
  const selected = useMemo(() => new Set(selectedKeys), [selectedKeys]);
  const restricted = useMemo(() => new Set(disabledKeys), [disabledKeys]);
  const groups = groupedPositionOptions(filterPositionCatalog(searchValue));

  function toggle(key) {
    if (disabled || restricted.has(key)) return;
    onChange(selected.has(key) ? selectedKeys.filter((item) => item !== key) : [...selectedKeys, key]);
  }

  return (
    <fieldset className="admin-position-picker" disabled={disabled} aria-describedby="admin-position-picker-help">
      <legend>Position assignments</legend>
      <p id="admin-position-picker-help" className="admin-position-picker__help">
        Select one or more club positions. Canonical keys are submitted automatically.
      </p>

      <div className="admin-position-picker__selected" aria-live="polite">
        <strong>Selected</strong>
        {selectedKeys.length ? (
          <ul>
            {filterPositionCatalog("").filter((position) => selected.has(position.key)).map((position) => (
              <li key={position.key}>{position.displayTitle}</li>
            ))}
          </ul>
        ) : <p>No positions selected.</p>}
      </div>

      {unknownValues.length ? (
        <div className="admin-position-picker__warning" role="alert">
          <strong>Unresolved saved position data</strong>
          <p>{unknownValues.join(", ")}</p>
          <p>Select the correct canonical positions before saving. These values will not be submitted as keys.</p>
        </div>
      ) : null}

      <label className="admin-position-picker__search">
        Search positions
        <input
          type="search"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search by title, code, or key"
          autoComplete="off"
        />
      </label>

      <div className="admin-position-picker__options">
        {groups.length ? groups.map((group) => (
          <section key={group.key} aria-labelledby={`position-group-${group.key}`}>
            <h3 id={`position-group-${group.key}`}>{group.label}</h3>
            {group.options.map((position) => {
              const optionDisabled = restricted.has(position.key);
              return (
                <label className={`admin-position-option${selected.has(position.key) ? " is-selected" : ""}${optionDisabled ? " is-restricted" : ""}`} key={position.key}>
                  <input
                    type="checkbox"
                    checked={selected.has(position.key)}
                    disabled={optionDisabled}
                    onChange={() => toggle(position.key)}
                  />
                  <span><strong>{position.displayTitle}</strong><small>{position.avenueCode}</small></span>
                  {optionDisabled ? <em>President authority required</em> : null}
                </label>
              );
            })}
          </section>
        )) : <p className="admin-position-picker__empty">No positions match this search.</p>}
      </div>
      {error ? <p className="admin-position-picker__error" role="alert">{error}</p> : null}
    </fieldset>
  );
}
