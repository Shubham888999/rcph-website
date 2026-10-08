import { useEffect, useState } from "react";
import { getLetterheadImagePreviewUrl } from "./letterheadExchangeService";

// Thumbnails load through the same short-lived protected access link used by "Open".
export default function LetterheadExchangePhotoThumb({ exchangeId, image }) {
  const imageId = image?.imageId || "";
  const [state, setState] = useState({ key: "", url: "", failed: false });
  const key = `${exchangeId}:${imageId}`;

  useEffect(() => {
    if (!exchangeId || !imageId) return undefined;
    let cancelled = false;
    getLetterheadImagePreviewUrl(exchangeId, imageId)
      .then((url) => { if (!cancelled) setState({ key, url, failed: false }); })
      .catch(() => { if (!cancelled) setState({ key, url: "", failed: true }); });
    return () => { cancelled = true; };
  }, [exchangeId, imageId, key]);

  const current = state.key === key ? state : { url: "", failed: false };
  return (
    <div className="letterhead-photo-thumb">
      {current.url ? (
        <img src={current.url} alt={`Letterhead Exchange photo ${image?.fileName || ""}`.trim()} referrerPolicy="no-referrer" onError={() => setState({ key, url: "", failed: true })} />
      ) : (
        <span>{current.failed ? "Preview unavailable" : "Loading preview..."}</span>
      )}
    </div>
  );
}
