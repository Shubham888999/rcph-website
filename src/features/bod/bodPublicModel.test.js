import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  PUBLIC_BOD_CLUB_SECTION,
  PUBLIC_BOD_LEADERSHIP_SECTION,
  buildPublicBodBoardEndpoint,
  buildPublicBodPhotoEndpoint,
  buildPublishedBodPhotoUrl,
  createDefaultPublicBodState,
  normalizePublicBodBoardResponse,
  publicProfilesForSection,
  shouldRenderBodRevealFallback,
  mapPublicClubProfilesToMembers,
  mapPublicLeadershipProfilesToMembers,
} from "./bodPublicModel.js";
import {
  fetchPublicBodBoard,
  getPublicBodPhotoEndpoint,
} from "./bodPublicService.js";

const bodPageSource = readFileSync(new URL("../../pages/public/BodPage.jsx", import.meta.url), "utf8");

function publicProfile(overrides = {}) {
  return {
    profileId: "profile-1",
    sectionKey: "clubBoard",
    name: "Rtr. Published Member",
    positionLabel: "President",
    summary: "Leads the club.",
    bio: "Published biography.",
    avenueLabels: ["Community"],
    instagramUsername: "published.member",
    instagramUrl:
      "https://www.instagram.com/published.member/",
    sortOrder: 10,
    photoVersion: 2,
    photoMimeType: "image/jpeg",
    ...overrides,
  };
}

function publicSection(
  profiles,
  overrides = {},
) {
  return {
    state: "public",
    publishedRevision: 3,
    publishedAt:
      "2026-07-17T00:00:00.000Z",
    profileCount: profiles.length,
    profiles,
    ...overrides,
  };
}

function draftPublicSection() {
  return {
    state: "draft",
    profiles: [],
  };
}

function publicLeadershipProfile(overrides = {}) {
  return publicProfile({
    profileId: "leader-1",
    sectionKey: "leadershipBeyondClub",
    positionLabel: "District Secretary",
    summary: "Serves beyond the club.",
    leadershipLevel: "district",
    leadershipLevelLabel: "District",
    organizationName:
      "Rotaract District 3131",
    termLabel: "RIY 2026-27",
    ...overrides,
  });
}

test(
  "valid Draft public BOD response normalizes to the safe fallback shape",
  () => {
    const state =
      normalizePublicBodBoardResponse({
        ok: true,
        boardId: "riy-2026-27",
        riyLabel: "RIY 2026\u201327",
        sections: {
          clubBoard: {
            state: "draft",
            profiles: [],
          },
          leadershipBeyondClub: {
            state: "draft",
            profiles: [],
          },
        },
      });

    assert.deepEqual(
      state,
      createDefaultPublicBodState(),
    );

    assert.equal(
      shouldRenderBodRevealFallback(state),
      true,
    );
  },
);

test(
  "valid sanitized Club BOD snapshot normalizes to ordered public profiles",
  () => {
    const state =
      normalizePublicBodBoardResponse({
        ok: true,
        boardId: "riy-2026-27",
        riyLabel: "RIY 2026\u201327",
        sections: {
          clubBoard: publicSection([
            publicProfile({
              profileId: "profile-2",
              name: "Second Member",
              sortOrder: 20,
            }),
            publicProfile({
              profileId: "profile-1",
              name: "First Member",
              sortOrder: 10,
            }),
          ]),
          leadershipBeyondClub: {
            state: "draft",
            profiles: [],
          },
        },
      });

    assert.equal(
      state.clubBoardState,
      "public",
    );

    assert.equal(
      state.leadershipBeyondClubState,
      "draft",
    );

    assert.deepEqual(
      publicProfilesForSection(
        state,
        PUBLIC_BOD_CLUB_SECTION,
      ).map((profile) => profile.profileId),
      ["profile-1", "profile-2"],
    );

    assert.equal(
      state.clubBoardPublishedRevision,
      3,
    );

    assert.equal(
      shouldRenderBodRevealFallback(state),
      false,
    );

    assert.equal(
      "driveFileId"
        in state.clubBoardProfiles[0],
      false,
    );
  },
);

test(
  "public profiles accept stable id fallback when profileId is absent",
  () => {
    const state =
      normalizePublicBodBoardResponse({
        ok: true,
        boardId: "riy-2026-27",
        sections: {
          clubBoard: publicSection([
            publicProfile({
              profileId: undefined,
              id: "stable-public-id",
            }),
          ]),
          leadershipBeyondClub: draftPublicSection(),
        },
      });

    assert.deepEqual(
      publicProfilesForSection(
        state,
        PUBLIC_BOD_CLUB_SECTION,
      ).map((profile) => profile.profileId),
      ["stable-public-id"],
    );

    assert.equal(
      mapPublicClubProfilesToMembers({
        state,
        photoEndpoint:
          "https://example.test/downloadPublishedBodPhoto",
      })[0].id,
      "stable-public-id",
    );
  },
);

test(
  "Leadership Beyond Our Club normalizes independently",
  () => {
    const leadershipProfile = publicProfile({
      profileId: "leader-1",
      sectionKey: "leadershipBeyondClub",
      positionLabel: "District Secretary",
      summary: "Serves beyond the club.",
      leadershipLevel: "district",
      leadershipLevelLabel: "District",
      organizationName:
        "Rotaract District 3131",
      termLabel: "RIY 2026-27",
    });

    const state =
      normalizePublicBodBoardResponse({
        ok: true,
        sections: {
          clubBoard: {
            state: "draft",
            profiles: [],
          },
          leadershipBeyondClub:
            publicSection(
              [leadershipProfile],
            ),
        },
      });

    assert.equal(
      state.clubBoardState,
      "draft",
    );

    assert.equal(
      state.leadershipBeyondClubState,
      "public",
    );

    assert.equal(
      publicProfilesForSection(
        state,
        PUBLIC_BOD_LEADERSHIP_SECTION,
      )[0].organizationName,
      "Rotaract District 3131",
    );

    assert.equal(
      shouldRenderBodRevealFallback(state),
      true,
    );
  },
);

test(
  "malformed public sections fall back independently",
  () => {
    const validLeadership = publicProfile({
      profileId: "leader-1",
      sectionKey: "leadershipBeyondClub",
      positionLabel: "District Secretary",
      summary: "Serves beyond the club.",
      leadershipLevel: "district",
      leadershipLevelLabel: "District",
      organizationName:
        "Rotaract District 3131",
      termLabel: "",
    });

    const state =
      normalizePublicBodBoardResponse({
        ok: true,
        sections: {
          clubBoard: publicSection([
            publicProfile({
              photoVersion: 0,
            }),
          ]),
          leadershipBeyondClub:
            publicSection([
              validLeadership,
            ]),
        },
      });

    assert.equal(
      state.clubBoardState,
      "draft",
    );

    assert.equal(
      state.leadershipBeyondClubState,
      "public",
    );

    assert.equal(
      publicProfilesForSection(
        state,
        PUBLIC_BOD_CLUB_SECTION,
      ).length,
      0,
    );
  },
);

test(
  "public render combinations keep Club Board and external leadership independent",
  () => {
    const photoEndpoint =
      "https://example.test/downloadPublishedBodPhoto";

    const cases = [
      {
        name: "Club Draft plus external Public",
        clubBoard: draftPublicSection(),
        leadershipBeyondClub: publicSection([
          publicLeadershipProfile(),
        ]),
        revealFallback: true,
        clubCards: 0,
        externalCards: 1,
      },
      {
        name: "Club Public plus external Hidden",
        clubBoard: publicSection([
          publicProfile(),
        ]),
        leadershipBeyondClub: draftPublicSection(),
        revealFallback: false,
        clubCards: 1,
        externalCards: 0,
      },
      {
        name: "Both sections Public",
        clubBoard: publicSection([
          publicProfile(),
        ]),
        leadershipBeyondClub: publicSection([
          publicLeadershipProfile(),
        ]),
        revealFallback: false,
        clubCards: 1,
        externalCards: 1,
      },
      {
        name: "Club Draft plus external Hidden",
        clubBoard: draftPublicSection(),
        leadershipBeyondClub: draftPublicSection(),
        revealFallback: true,
        clubCards: 0,
        externalCards: 0,
      },
      {
        name: "invalid Club snapshot plus external Public",
        clubBoard: publicSection([
          publicProfile({
            photoVersion: 0,
          }),
        ]),
        leadershipBeyondClub: publicSection([
          publicLeadershipProfile(),
        ]),
        revealFallback: true,
        clubCards: 0,
        externalCards: 1,
      },
    ];

    for (const item of cases) {
      const state =
        normalizePublicBodBoardResponse({
          ok: true,
          boardId: "riy-2026-27",
          sections: {
            clubBoard: item.clubBoard,
            leadershipBeyondClub:
              item.leadershipBeyondClub,
          },
        });

      assert.equal(
        shouldRenderBodRevealFallback(state),
        item.revealFallback,
        item.name,
      );

      assert.equal(
        mapPublicClubProfilesToMembers({
          state,
          photoEndpoint,
        }).length,
        item.clubCards,
        item.name,
      );

      assert.equal(
        mapPublicLeadershipProfilesToMembers({
          state,
          photoEndpoint,
        }).length,
        item.externalCards,
        item.name,
      );
    }
  },
);

test(
  "BodPage source renders external leadership outside the Club fallback branch",
  () => {
    assert.match(bodPageSource, /showClubRevealFallback/);
    assert.match(bodPageSource, /showPublishedClubBoard/);
    assert.match(bodPageSource, /showLeadershipBeyondClub/);
    assert.ok(
      bodPageSource.indexOf("{showLeadershipBeyondClub ? (")
        > bodPageSource.indexOf("{showClubRevealFallback ? ("),
    );
    const clubBranchSource = bodPageSource.slice(
      bodPageSource.indexOf("{showClubRevealFallback ? ("),
      bodPageSource.indexOf("{showLeadershipBeyondClub ? ("),
    );
    assert.doesNotMatch(clubBranchSource, /<BodCouncil/);
  },
);

test(
  "invalid and non-ok responses return the complete Draft fallback",
  () => {
    assert.deepEqual(
      normalizePublicBodBoardResponse(null),
      createDefaultPublicBodState(),
    );

    assert.deepEqual(
      normalizePublicBodBoardResponse({
        ok: false,
      }),
      createDefaultPublicBodState(),
    );
  },
);

test(
  "external leadership profiles adapt independently to the council card shape",
  () => {
    const leadershipProfile = publicProfile({
      profileId: "leader-1",
      sectionKey: "leadershipBeyondClub",
      positionLabel: "District Secretary",
      summary: "Serves beyond the club.",
      leadershipLevel: "district",
      leadershipLevelLabel: "District",
      organizationName:
        "Rotaract District 3131",
      termLabel: "RIY 2026-27",
    });

    const state =
      normalizePublicBodBoardResponse({
        ok: true,
        boardId: "riy-2026-27",
        sections: {
          clubBoard: {
            state: "draft",
            profiles: [],
          },
          leadershipBeyondClub:
            publicSection([
              leadershipProfile,
            ]),
        },
      });

    const members =
      mapPublicLeadershipProfilesToMembers({
        state,
        photoEndpoint:
          "https://example.test/downloadPublishedBodPhoto",
      });

    assert.deepEqual(members, [
      {
        id: "leader-1",
        profileId: "leader-1",
        name: "Rtr. Published Member",
        role: "District Secretary",
        responsibility:
          "Serves beyond the club.",
        bio: "Published biography.",
        councilGroup: "District",
        context:
          "Rotaract District 3131 \u00b7 RIY 2026-27",
        image:
          "https://example.test/downloadPublishedBodPhoto?boardId=riy-2026-27&sectionKey=leadershipBeyondClub&profileId=leader-1&version=2",
        instagram:
          "https://www.instagram.com/published.member/",
        handle: "@published.member",
      },
    ]);
  },
);

test(
  "renderer adapters return no cards when the secure photo endpoint is unavailable",
  () => {
    const state =
      normalizePublicBodBoardResponse({
        ok: true,
        sections: {
          clubBoard: publicSection([
            publicProfile(),
          ]),
          leadershipBeyondClub: {
            state: "draft",
            profiles: [],
          },
        },
      });

    assert.deepEqual(
      mapPublicClubProfilesToMembers({
        state,
        photoEndpoint: "",
      }),
      [],
    );
  },
);

test(
  "Club snapshot profiles adapt to the existing public card shape",
  () => {
    const state =
      normalizePublicBodBoardResponse({
        ok: true,
        boardId: "riy-2026-27",
        riyLabel: "RIY 2026\u201327",
        sections: {
          clubBoard: publicSection([
            publicProfile(),
          ]),
          leadershipBeyondClub: {
            state: "draft",
            profiles: [],
          },
        },
      });

    const members =
      mapPublicClubProfilesToMembers({
        state,
        photoEndpoint:
          "https://example.test/downloadPublishedBodPhoto",
      });

    assert.deepEqual(members, [
      {
        id: "profile-1",
        profileId: "profile-1",
        name: "Rtr. Published Member",
        role: "President",
        responsibility: "Leads the club.",
        bio: "Published biography.",
        avenue: ["Community"],
        image:
          "https://example.test/downloadPublishedBodPhoto?boardId=riy-2026-27&sectionKey=clubBoard&profileId=profile-1&version=2",
        instagram:
          "https://www.instagram.com/published.member/",
        handle: "@published.member",
      },
    ]);

    assert.equal(
      "driveFileId" in members[0],
      false,
    );
  },
);

test(
  "public board and photo endpoints derive from config or emulator origin",
  () => {
    assert.equal(
      buildPublicBodBoardEndpoint({
        env: {
          VITE_PUBLIC_BOD_BOARD_ENDPOINT:
            "https://example.test/getPublicBodBoard/",
        },
      }),
      "https://example.test/getPublicBodBoard",
    );

    assert.equal(
      buildPublicBodPhotoEndpoint({
        env: {
          VITE_PUBLIC_BOD_PHOTO_ENDPOINT:
            "https://example.test/downloadPublishedBodPhoto/",
        },
      }),
      "https://example.test/downloadPublishedBodPhoto",
    );

    assert.equal(
      buildPublicBodBoardEndpoint({
        env: {
          VITE_FIREBASE_FUNCTIONS_EMULATOR_ORIGIN:
            "http://127.0.0.1:5001",
        },
        projectId: "demo-rcph",
      }),
      "http://127.0.0.1:5001/demo-rcph/us-central1/getPublicBodBoard",
    );

    assert.equal(
      buildPublicBodPhotoEndpoint({
        env: {
          VITE_FIREBASE_PROJECT_ID:
            "staging-rcph",
        },
      }),
      "https://us-central1-staging-rcph.cloudfunctions.net/downloadPublishedBodPhoto",
    );
  },
);

test(
  "published photo URL contains only public lookup fields",
  () => {
    assert.equal(
      buildPublishedBodPhotoUrl({
        endpoint:
          "https://example.test/downloadPublishedBodPhoto",
        boardId: "riy-2026-27",
        sectionKey: "clubBoard",
        profileId: "profile-1",
        photoVersion: 4,
      }),
      "https://example.test/downloadPublishedBodPhoto?boardId=riy-2026-27&sectionKey=clubBoard&profileId=profile-1&version=4",
    );

    assert.equal(
      buildPublishedBodPhotoUrl({
        endpoint:
          "https://example.test/downloadPublishedBodPhoto",
        boardId: "riy-2026-27",
        sectionKey: "invalid-section",
        profileId: "profile-1",
        photoVersion: 4,
      }),
      "",
    );
  },
);

test(
  "public service resolves the secure photo endpoint from the active environment",
  () => {
    assert.equal(
      getPublicBodPhotoEndpoint({
        env: {
          VITE_PUBLIC_BOD_PHOTO_ENDPOINT:
            "https://example.test/downloadPublishedBodPhoto/",
        },
      }),
      "https://example.test/downloadPublishedBodPhoto",
    );

    assert.equal(
      getPublicBodPhotoEndpoint({
        env: {
          VITE_FIREBASE_PROJECT_ID:
            "rcph-admin-staging-2",
        },
      }),
      "https://us-central1-rcph-admin-staging-2.cloudfunctions.net/downloadPublishedBodPhoto",
    );

    assert.equal(
      getPublicBodPhotoEndpoint({
        env: {},
      }),
      "",
    );
  },
);

test(
  "public service returns Draft fallback on network, HTTP, JSON, and schema failures",
  async () => {
    assert.deepEqual(
      await fetchPublicBodBoard({
        endpoint: "https://example.test",
        fetchImpl: async () => {
          throw new Error("offline");
        },
      }),
      createDefaultPublicBodState(),
    );

    assert.deepEqual(
      await fetchPublicBodBoard({
        endpoint: "https://example.test",
        fetchImpl: async () => ({
          ok: false,
          json: async () => ({}),
        }),
      }),
      createDefaultPublicBodState(),
    );

    assert.deepEqual(
      await fetchPublicBodBoard({
        endpoint: "https://example.test",
        fetchImpl: async () => ({
          ok: true,
          json: async () => {
            throw new Error("bad json");
          },
        }),
      }),
      createDefaultPublicBodState(),
    );
  },
);
