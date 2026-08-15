const IMAGE_EXTENSIONS = new Set([".jpeg", ".jpg", ".png", ".webp", ".avif"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".webm"]);

const FRAME_EXTENSIONS = [
  "jpeg", // 01
  "jpeg", // 02
  "jpeg", // 03
  "mp4", // 04
  "mp4", // 05
  "mp4", // 06
  "mp4", // 07
  "mp4", // 08
  "mp4", // 09
  "mp4", // 10
];

const installationPhotos = Array.from({ length: 10 }, (_, index) => {
  const frame = String(index + 1).padStart(2, "0");
  const extension = FRAME_EXTENSIONS[index];

  return {
    id: `vox26-installation-${frame}`,
    frame,
    src: `/media/installation/vox26-installation-${frame}.${extension}`,
    alt: "VOX // '26 installation ceremony moment",
    caption: "VOX // '26",
  };
});
export function getInstallationMediaType(src) {
  const path = String(src || "").split(/[?#]/)[0];
  const extensionIndex = path.lastIndexOf(".");

  if (extensionIndex === -1) return "unknown";

  const extension = path.slice(extensionIndex).toLowerCase();

  if (IMAGE_EXTENSIONS.has(extension)) return "image";
  if (VIDEO_EXTENSIONS.has(extension)) return "video";

  return "unknown";
}

export default installationPhotos;
