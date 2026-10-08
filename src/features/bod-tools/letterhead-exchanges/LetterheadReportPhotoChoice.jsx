import { useState } from "react";
import LetterheadExchangePhotoThumb from "./LetterheadExchangePhotoThumb";
import { getSafeLetterheadExchangeError, setLetterheadExchangeReportImage } from "./letterheadExchangeService";

// Shown after a new exchange uploads 2+ photos. The server already picked the first
// finalized photo; this lets the user confirm or change it, or skip.
export default function LetterheadReportPhotoChoice({ exchangeId, images, selectedImageId = "", onDone }) {
  const [selected, setSelected] = useState(selectedImageId || images[0]?.imageId || "");
  const [save, setSave] = useState({ status: "idle", message: "" });
  const saving = save.status === "saving";

  async function saveChoice() {
    if (!selected || saving) return;
    setSave({ status: "saving", message: "" });
    try {
      const result = await setLetterheadExchangeReportImage(exchangeId, selected);
      onDone?.({ saved: true, exchange: result.exchange });
    } catch (error) {
      setSave({ status: "error", message: getSafeLetterheadExchangeError(error, "The report photo could not be saved.") });
    }
  }

  return (
    <section className="letterhead-report-choice" aria-labelledby={`letterhead-report-choice-${exchangeId}`}>
      <h4 id={`letterhead-report-choice-${exchangeId}`}>Choose the report photo</h4>
      <fieldset disabled={saving}>
        <legend>This photo appears under the exchange in the BOD Avenue Report. You can change it later from Manage.</legend>
        <ul className="letterhead-photos__grid">
          {images.map((image) => {
            const inputId = `letterhead-report-choice-${exchangeId}-${image.imageId}`;
            return (
              <li key={image.imageId} className={`letterhead-photo-card ${selected === image.imageId ? "is-selected" : ""}`}>
                <LetterheadExchangePhotoThumb exchangeId={exchangeId} image={image} />
                <label htmlFor={inputId}>
                  <input
                    id={inputId}
                    type="radio"
                    name={`letterhead-report-choice-${exchangeId}`}
                    value={image.imageId}
                    checked={selected === image.imageId}
                    onChange={() => setSelected(image.imageId)}
                  />
                  <span>Use as report photo</span>
                </label>
                <small>{image.fileName}</small>
              </li>
            );
          })}
        </ul>
      </fieldset>
      {save.message ? <p className="letterhead-photos__status is-error" role="alert">{save.message}</p> : null}
      <div className="letterhead-photos__actions">
        <button type="button" className="bod-button--primary" onClick={saveChoice} disabled={saving || !selected}>
          {saving ? "Saving..." : "Save report photo"}
        </button>
        <button type="button" onClick={() => onDone?.({ saved: false })} disabled={saving}>Skip for now</button>
      </div>
    </section>
  );
}
