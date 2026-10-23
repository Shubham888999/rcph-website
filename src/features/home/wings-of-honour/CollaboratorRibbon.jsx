import { useState } from "react";

// Shows the club logo, or the placeholder circle when the file is missing.
function ClubLogo({ src }) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <span className={`woh-ribbon__logo${showImage ? " has-image" : ""}`} aria-hidden="true">
      {showImage ? (
        <img src={src} alt="" height="44" loading="lazy" decoding="async" onError={() => setFailed(true)} />
      ) : (
        "Logo"
      )}
    </span>
  );
}

function ClubList({ clubs, hidden }) {
  return (
    <ul className="woh-ribbon__list" aria-hidden={hidden ? "true" : undefined}>
      {clubs.map((club) => (
        <li key={club.slug} className={`woh-ribbon__club${club.host ? " is-host" : ""}`}>
          <ClubLogo src={club.logo} />
          <span>
            <span className="woh-ribbon__of">Rotaract Club of</span>
            <span className="woh-ribbon__name">{club.name}</span>
            <span className="woh-ribbon__district">{club.district}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function CollaboratorRibbon({ clubs }) {
  const [paused, setPaused] = useState(false);

  return (
    <div className="woh-ribbon">
      <div className="woh-ribbon__head">
        <h3 className="woh-ribbon__title">Collaborated by</h3>
        <button type="button" className="woh-ribbon__pause" aria-pressed={paused} onClick={() => setPaused((value) => !value)}>
          {paused ? "Play" : "Pause"}
        </button>
      </div>
      <div className="woh-ribbon__viewport">
        <div className={`woh-ribbon__track${paused ? " is-paused" : ""}`}>
          <ClubList clubs={clubs} />
          {/* A second copy makes the scroll loop seamless; it is hidden from assistive technology. */}
          <ClubList clubs={clubs} hidden />
        </div>
      </div>
    </div>
  );
}
