import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";
import BodRevealPlaceholder from "../../features/bod/BodRevealPlaceholder";
import BodHero from "../../features/bod/BodBookHero.jsx";
import BodLeadership from "../../features/bod/BodLeadership";
import BodReadingProgress from "../../features/bod/BodReadingProgress.jsx";
import {
  createDefaultPublicBodState,
  mapPublicClubProfilesToMembers,
  mapPublicLeadershipProfilesToMembers,
  shouldRenderBodRevealFallback,
} from "../../features/bod/bodPublicModel";
import {
  fetchPublicBodBoard,
  getPublicBodPhotoEndpoint,
} from "../../features/bod/bodPublicService";
import "../../styles/components/bod.css";
import "../../styles/components/bod-books.css";

const BodContact = lazy(
  () => import("../../features/bod/BodContact"),
);

const BodCouncil = lazy(
  () => import("../../features/bod/BodCouncil"),
);

export default function BodPage() {
  const [publicState, setPublicState] = useState(
    createDefaultPublicBodState,
  );
  const [loadStatus, setLoadStatus] = useState("loading");
  const [requestVersion, setRequestVersion] = useState(0);

  const photoEndpoint = useMemo(
    () => getPublicBodPhotoEndpoint(),
    [],
  );

  useEffect(() => {
    let active = true;

    fetchPublicBodBoard({ throwOnError: true }).then((nextState) => {
      if (active) {
        setPublicState(nextState);
        setLoadStatus("ready");
      }
    }).catch(() => {
      if (active) setLoadStatus("error");
    });

    return () => {
      active = false;
    };
  }, [requestVersion]);

  const clubMembers = useMemo(
    () =>
      mapPublicClubProfilesToMembers({
        state: publicState,
        photoEndpoint,
      }),
    [photoEndpoint, publicState],
  );

  const leadershipMembers = useMemo(
    () =>
      mapPublicLeadershipProfilesToMembers({
        state: publicState,
        photoEndpoint,
      }),
    [photoEndpoint, publicState],
  );

  if (loadStatus !== "ready") {
    return <main className="bod-page-react bod-page-react--books" aria-busy={loadStatus === "loading"}>
      <BodHero riyLabel={publicState.riyLabel} editorial />
      <section className="bod-section-react bod-leadership-react bod-board-loading" aria-label="Board loading status">
        {loadStatus === "loading" ? <>
          <p role="status" className="bod-board-loading__message">Loading the board…</p>
          <div className="bod-interactive-grid" aria-hidden="true">{[0, 1, 2, 3].map(index => <div className="bod-member-card bod-board-loading__card" key={index} />)}</div>
        </> : <>
          <p role="alert" className="bod-board-loading__message">The board could not be loaded right now.</p>
          <button className="bod-board-loading__retry" type="button" onClick={() => { setLoadStatus("loading"); setRequestVersion(version => version + 1); }}>Try again</button>
        </>}
      </section>
    </main>;
  }

  const showClubRevealFallback =
    shouldRenderBodRevealFallback(publicState)
    || clubMembers.length === 0;
  const showPublishedClubBoard = !showClubRevealFallback;

  const showLeadershipBeyondClub =
    publicState.leadershipBeyondClubState === "public"
    && leadershipMembers.length > 0;

  return (
    <main className="bod-page-react bod-page-react--books">
      <BodReadingProgress />
      {showClubRevealFallback ? (
        <BodRevealPlaceholder
          showPositionLabels={false}
        />
      ) : (
        <>
          <BodHero
            riyLabel={publicState.riyLabel}
            editorial
          />

          <BodLeadership
            members={clubMembers}
            editorial
          />
        </>
      )}

      {showLeadershipBeyondClub ? (
        <Suspense fallback={null}>
          <BodCouncil
            members={leadershipMembers}
            editorial
          />
        </Suspense>
      ) : null}

      {showPublishedClubBoard || showLeadershipBeyondClub ? (
        <Suspense fallback={null}>
          <BodContact />
        </Suspense>
      ) : null}
    </main>
  );
}
