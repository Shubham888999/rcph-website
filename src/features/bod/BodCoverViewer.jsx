import { useState } from "react";
import { createPortal } from "react-dom";
import useAccessibleDialog from "../bod-tools/useAccessibleDialog.js";
import { formatRotaractorName } from "../../utils/memberName";

export default function BodCoverViewer({ member, onClose }) {
  const [zoomed, setZoomed] = useState(false);
  const dialogRef = useAccessibleDialog({ open: true, onClose });
  if (typeof document === "undefined") return null;
  const name = formatRotaractorName(member.name, true);
  return createPortal(<div className="bod-page-react--magazine bod-magazine-viewer-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} className="bod-magazine-viewer" role="dialog" aria-modal="true" aria-labelledby="bod-magazine-cover-title" tabIndex={-1}>
      <header><div><p className="bod-magazine-label">The cover</p><h2 id="bod-magazine-cover-title">{name}</h2></div><div className="bod-magazine-viewer__actions"><button type="button" aria-pressed={zoomed} onClick={() => setZoomed(value => !value)}>{zoomed ? "Fit cover" : "Zoom in"}</button><a href={member.image} target="_blank" rel="noopener noreferrer">Open original ↗</a><button type="button" onClick={onClose} aria-label="Close cover viewer">Close ×</button></div></header>
      <div className="bod-magazine-viewer__image"><img className={zoomed ? "is-zoomed" : ""} src={member.image} alt={`Full cover for ${name}, ${member.role}`} /></div>
    </section>
  </div>, document.body);
}
