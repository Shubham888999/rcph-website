import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import installationPhotos, { getInstallationMediaType } from "./installationPhotos.js";

const componentSource = readFileSync(new URL("./InstallationFilmGallery.jsx", import.meta.url), "utf8");
const dataSource = readFileSync(new URL("./installationPhotos.js", import.meta.url), "utf8");
const homePageSource = readFileSync(new URL("../../pages/public/HomePage.jsx", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url), "utf8"));

const expectedFrames = Array.from({ length: 10 }, (_, index) => String(index + 1).padStart(2, "0"));
const expectedExtensions = ["jpeg", "jpeg", "jpeg", "mp4", "mp4", "mp4", "mp4", "mp4", "mp4", "mp4"];
const expectedFilenames = expectedFrames.map(
  (frame, index) => `/media/installation/vox26-installation-${frame}.${expectedExtensions[index]}`,
);

test("VOX installation media data keeps exactly ten mixed image and video frames", () => {
  assert.equal(installationPhotos.length, 10);
  assert.deepEqual(
    installationPhotos.map((photo) => photo.src),
    expectedFilenames,
  );
  assert.deepEqual(
    installationPhotos.map((photo) => photo.frame),
    expectedFrames,
  );

  for (const photo of installationPhotos) {
    assert.equal(photo.alt, "VOX // '26 installation ceremony moment");
    assert.equal(photo.caption, "VOX // '26");
  }
});

test("installation media type detection supports image extensions", () => {
  for (const extension of [".jpeg", ".jpg", ".png", ".webp", ".avif"]) {
    assert.equal(getInstallationMediaType(`/media/installation/example${extension}`), "image");
  }
});

test("installation media type detection supports video extensions", () => {
  for (const extension of [".mp4", ".webm"]) {
    assert.equal(getInstallationMediaType(`/media/installation/example${extension}`), "video");
  }
});

test("installation media type detection is case-insensitive and ignores suffixes", () => {
  assert.equal(getInstallationMediaType("/media/installation/example.JPEG?cache=1"), "image");
  assert.equal(getInstallationMediaType("/media/installation/example.WEBM#poster"), "video");
  assert.equal(getInstallationMediaType("/media/installation/example.MP4?cache=1#clip"), "video");
  assert.equal(getInstallationMediaType("/media/installation/example.txt?kind=.mp4"), "unknown");
});

test("HomePage imports and renders InstallationFilmGallery in the requested position", () => {
  assert.match(
    homePageSource,
    /import InstallationFilmGallery from "\.\.\/\.\.\/features\/home\/InstallationFilmGallery";/,
  );

  const recruitmentIndex = homePageSource.indexOf("<RecruitmentSection />");
  const galleryIndex = homePageSource.indexOf("<InstallationFilmGallery />");
  const monthlyHighlightIndex = homePageSource.indexOf("<MonthlyHighlight />");

  assert.ok(recruitmentIndex !== -1, "RecruitmentSection should remain on HomePage");
  assert.ok(galleryIndex > recruitmentIndex, "InstallationFilmGallery should render after RecruitmentSection");
  assert.ok(monthlyHighlightIndex > galleryIndex, "InstallationFilmGallery should render before MonthlyHighlight");
});

test("InstallationFilmGallery renders images and videos from detected media type", () => {
  assert.match(componentSource, /getInstallationMediaType\(photo\.src\)/);
  assert.match(componentSource, /mediaType === "image" \? \([\s\S]*<img/);
  assert.match(componentSource, /mediaType === "video" \? \([\s\S]*<video/);
  assert.match(componentSource, /installationPhotos\.map/);
});

test("video media uses muted looping metadata preload behavior", () => {
  const videoBlock = componentSource.match(/<video[\s\S]*?\/>/)?.[0] || "";

  assert.match(componentSource, /<video[\s\S]*src=\{photo\.src\}/);
  assert.match(componentSource, /autoPlay=\{!reduceMotion\}/);
  assert.match(componentSource, /loop/);
  assert.match(componentSource, /muted/);
  assert.match(componentSource, /playsInline/);
  assert.match(componentSource, /preload="metadata"/);
  assert.doesNotMatch(videoBlock, /\scontrols(?:[=>\s]|$)/);
});

test("broken image and broken video media share the themed fallback", () => {
  assert.match(componentSource, /markMediaMissing/);
  assert.match(componentSource, /home-film-gallery__placeholder/);
  assert.match(componentSource, /onError=\{\(\) => onMediaError\(photo\.id\)\}/);
  assert.match(componentSource, /mediaStatus === "missing"/);
});

test("InstallationFilmGallery exposes accessible controls, modal, and mixed viewer behavior", () => {
  assert.match(componentSource, /id="installation-cut"/);
  assert.match(componentSource, /The Installation Cut/);
  assert.match(componentSource, /aria-label="Previous installation photos"/);
  assert.match(componentSource, /aria-label="Next installation photos"/);
  assert.match(componentSource, /aria-label="Scrollable VOX installation film roll"/);
  assert.match(componentSource, /role="dialog"/);
  assert.match(componentSource, /aria-modal="true"/);
  assert.match(componentSource, /mode="viewer"/);
  assert.match(componentSource, /aria-label="Close installation media viewer"/);
  assert.match(componentSource, /aria-label="Previous installation media"/);
  assert.match(componentSource, /aria-label="Next installation media"/);
  assert.match(componentSource, /pauseVideo\(video\)/);
});

test("video playback stays lightweight and visibility-aware", () => {
  assert.match(componentSource, /IntersectionObserver/);
  assert.match(componentSource, /document\.visibilityState !== "hidden"/);
  assert.match(componentSource, /requestAnimationFrame/);
  assert.match(componentSource, /playVideo\(video\)/);
  assert.match(componentSource, /pauseVideo\(video\)/);
  assert.match(componentSource, /reduceMotion/);
});

test("no new media player dependency is introduced", () => {
  const dependencyNames = Object.keys({
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  });

  for (const bannedDependency of ["react-player", "video.js", "plyr", "hls.js"]) {
    assert.equal(dependencyNames.includes(bannedDependency), false);
  }
});

test("installationPhotos remains the only per-frame media path configuration", () => {
  assert.match(dataSource, /const FRAME_EXTENSIONS = \[/);
  assert.match(dataSource, /\/media\/installation\/vox26-installation-\$\{frame\}\.\$\{extension\}/);
  assert.doesNotMatch(dataSource, /\/images\/installation\//);
  assert.doesNotMatch(componentSource, /\/media\/installation\/vox26-installation-/);
  assert.doesNotMatch(componentSource, /\/images\/installation\//);
});

test("retired installation turntable promo code is not reintroduced", () => {
  const retiredComponent = "Installation" + "Section";

  assert.doesNotMatch(homePageSource, new RegExp(retiredComponent));
  assert.doesNotMatch(componentSource, new RegExp(retiredComponent));
  assert.doesNotMatch(componentSource, /turntable/i);
  assert.doesNotMatch(componentSource, /vinyl/i);
});
