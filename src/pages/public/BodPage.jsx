import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";
import BodRevealPlaceholder from "../../features/bod/BodRevealPlaceholder";
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

const BodContact = lazy(
  () => import("../../features/bod/BodContact"),
);

const BodHero = lazy(
  () => import("../../features/bod/BodHero"),
);

const BodLeadership = lazy(
  () => import("../../features/bod/BodLeadership"),
);

const BodCouncil = lazy(
  () => import("../../features/bod/BodCouncil"),
);

export default function BodPage() {
  const [publicState, setPublicState] = useState(
    createDefaultPublicBodState,
  );

  const photoEndpoint = useMemo(
    () => getPublicBodPhotoEndpoint(),
    [],
  );

  useEffect(() => {
    let active = true;

    fetchPublicBodBoard().then((nextState) => {
      if (active) {
        setPublicState(nextState);
      }
    });

    return () => {
      active = false;
    };
  }, []);

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

  const showClubRevealFallback =
    shouldRenderBodRevealFallback(publicState)
    || clubMembers.length === 0;
  const showPublishedClubBoard = !showClubRevealFallback;

  const showLeadershipBeyondClub =
    publicState.leadershipBeyondClubState === "public"
    && leadershipMembers.length > 0;

  return (
    <main className="bod-page-react">
      {showClubRevealFallback ? (
        <BodRevealPlaceholder
          showPositionLabels={false}
        />
      ) : (
        <Suspense
          fallback={
            <BodRevealPlaceholder
              showPositionLabels={false}
            />
          }
        >
          <BodHero
            riyLabel={publicState.riyLabel}
          />

          <BodLeadership
            members={clubMembers}
          />
        </Suspense>
      )}

      {showLeadershipBeyondClub ? (
        <Suspense fallback={null}>
          <BodCouncil
            members={leadershipMembers}
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
