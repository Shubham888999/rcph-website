import { useState } from "react";
import {
  buildClubSummary,
  buildRepresentativeSummary,
  formatExchangeDate,
  formatLetterheadFileSize,
  imageCountLabel,
} from "./letterheadExchangeModel";
import {
  getSafeLetterheadExchangeError,
  openProtectedLetterheadImage,
} from "./letterheadExchangeService";

function eventLabel(event) {
  if (!event) return "No associated event";
  return event.label || event.name || `${event.source}:${event.id}`;
}

export default function LetterheadExchangeHistory({ status, error, exchanges, onRetry }) {
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [openingImageId, setOpeningImageId] = useState("");
  const [openError, setOpenError] = useState("");

  function toggle(id) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function openImage(exchange, image) {
    const key = `${exchange.id}:${image.imageId}`;
    setOpeningImageId(key);
    setOpenError("");
    try {
      await openProtectedLetterheadImage(exchange.id, image);
    } catch (openActionError) {
      setOpenError(getSafeLetterheadExchangeError(openActionError, "Unable to open this image."));
    } finally {
      setOpeningImageId("");
    }
  }

  return (
    <section className="letterhead-history" aria-labelledby="letterhead-history-title">
      <div className="letterhead-subsection-heading">
        <p className="bod-tools-kicker">History</p>
        <h3 id="letterhead-history-title">Previous Letterhead Exchanges</h3>
      </div>

      {status === "loading" ? <p className="letterhead-muted">Loading previous exchanges...</p> : null}
      {status === "error" ? (
        <div className="letterhead-inline-error" role="alert">
          <p>{error || "Unable to load previous Letterhead Exchanges."}</p>
          <button type="button" onClick={onRetry}>Retry</button>
        </div>
      ) : null}
      {openError ? <p className="letterhead-inline-error" role="alert">{openError}</p> : null}

      {status === "success" && !exchanges.length ? (
        <p className="letterhead-muted">No Letterhead Exchanges have been recorded yet.</p>
      ) : null}

      {status === "success" && exchanges.length ? (
        <div className="letterhead-history__list">
          {exchanges.map((exchange) => {
            const expanded = expandedIds.has(exchange.id);
            const panelId = `letterhead-history-${exchange.id}`;
            return (
              <article className="letterhead-history-card" key={exchange.id}>
                <button
                  type="button"
                  className="letterhead-history-card__summary"
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  onClick={() => toggle(exchange.id)}
                >
                  <span>
                    <strong>{formatExchangeDate(exchange.exchangeDate)}</strong>
                    <small>{buildClubSummary(exchange)}</small>
                  </span>
                  <span>{buildRepresentativeSummary(exchange)}</span>
                  <span>{eventLabel(exchange.associatedEvent)}</span>
                  <span>{imageCountLabel(exchange.imageCount)}</span>
                </button>

                {expanded ? (
                  <div id={panelId} className="letterhead-history-card__details">
                    <dl className="letterhead-history-meta">
                      <div><dt>Exchange Date</dt><dd>{formatExchangeDate(exchange.exchangeDate)}</dd></div>
                      <div><dt>RCPH Representative(s)</dt><dd>{buildRepresentativeSummary(exchange)}</dd></div>
                      <div><dt>Associated Event</dt><dd>{eventLabel(exchange.associatedEvent)}</dd></div>
                      {exchange.createdByName ? <div><dt>Created by</dt><dd>{exchange.createdByName}</dd></div> : null}
                    </dl>

                    <div className="letterhead-history-block">
                      <h4>External participants</h4>
                      <ul className="letterhead-history-participants">
                        {exchange.externalParticipants.map((participant, index) => (
                          <li key={`${participant.clubName}-${participant.rotaractorName}-${index}`}>
                            <strong>{participant.clubName}</strong>
                            <span>{participant.rotaractorName}</span>
                            {participant.position ? <span>{participant.position}</span> : null}
                            {participant.rotaractDistrictId ? <span>Rotaract District ID (RID): {participant.rotaractDistrictId}</span> : null}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {exchange.other ? (
                      <div className="letterhead-history-block">
                        <h4>Other</h4>
                        <p>{exchange.other}</p>
                      </div>
                    ) : null}

                    <div className="letterhead-history-block">
                      <h4>Images</h4>
                      {exchange.images.length ? (
                        <ul className="letterhead-history-images">
                          {exchange.images.map((image) => {
                            const key = `${exchange.id}:${image.imageId}`;
                            return (
                              <li key={image.imageId}>
                                <span>
                                  <strong>{image.fileName}</strong>
                                  <small>{formatLetterheadFileSize(image.sizeBytes)} / {image.mimeType}</small>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => openImage(exchange, image)}
                                  disabled={openingImageId === key}
                                >
                                  {openingImageId === key ? "Opening..." : "Open"}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="letterhead-muted">No images uploaded.</p>
                      )}
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
