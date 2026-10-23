import { useState } from "react";

// Shows the club logo once its file exists; a club without one shows its name only.
function ClubLogo({ src }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;

  return (
    <span className="woh-ribbon__logo" aria-hidden="true">
      <img src={src} alt="" height="44" loading="lazy" decoding="async" onError={() => setFailed(true)} />
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
  return (
    <div className="woh-ribbon">
      <div className="woh-ribbon__head">
        <h3 className="woh-ribbon__title">In Collaboration With</h3>
      </div>
      <div className="woh-ribbon__viewport">
        <div className="woh-ribbon__track">
          <ClubList clubs={clubs} />
          {/* A second copy makes the scroll loop seamless; it is hidden from assistive technology. */}
          <ClubList clubs={clubs} hidden />
        </div>
      </div>
    </div>
  );
}
