import { useState } from "react";
import useAccessibleDialog from "../../bod-tools/useAccessibleDialog";
import { getProspectJourney } from "../dashboardPresentationModel";
import { normalizeDuesContact } from "./dashboardUpgradeModel";

function HowToPayDialog({ contact, onClose }) {
  const dialogRef = useAccessibleDialog({ open: true, onClose });
  return (
    <div className="dash-sheet-backdrop" onClick={onClose}>
      <section
        ref={dialogRef}
        className="dash-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dash-pay-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dash-sheet__head">
          <div>
            <p className="dash-kicker">Membership dues</p>
            <h2 id="dash-pay-title">How to pay</h2>
          </div>
          <button type="button" className="dash-sheet__close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <p className="dash-muted">Dues are payable at your 4th club activity. For how and where to pay, contact our {contact.role || "Membership Development Officer"}.</p>
        <div className="dash-contact">
          <span className="dash-contact__avatar" aria-hidden="true">{contact.name.replace(/^Rtr\.?\s+/i, "").split(/\s+/).map((part) => part[0]).join("").slice(0, 2)}</span>
          <div>
            <strong>{contact.name}</strong>
            <span>{contact.role}</span>
            <span className="dash-contact__phone">{contact.phone}</span>
          </div>
        </div>
        <div className="dash-sheet__actions">
          <a className="dash-button dash-button--whatsapp" href={contact.whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp</a>
          <a className="dash-button" href={contact.tel}>Call</a>
        </div>
      </section>
    </div>
  );
}

// The prospect's steps to membership, with How to pay on the dues step.
export default function RoadToMembership({ progress, duesContact }) {
  const [payOpen, setPayOpen] = useState(false);
  const steps = getProspectJourney(progress);
  const contact = normalizeDuesContact(duesContact);
  const remaining = steps.filter((step) => step.state !== "complete").length;

  return (
    <section className="dash-road" aria-labelledby="dash-road-title">
      <p className="dash-kicker">Road to membership</p>
      <h2 id="dash-road-title">{remaining === 0 ? "All steps complete" : remaining === 1 ? "You're 1 step away" : `You're ${remaining} steps away`}</h2>
      <ol>
        {steps.map((step, index) => (
          <li key={step.key} className={`is-${step.state}`}>
            <span className="dash-road__marker" aria-hidden="true">{step.state === "complete" ? "✓" : index + 1}</span>
            <div className="dash-road__body">
              <strong>{step.title}</strong>
              <span>{step.detail}</span>
              {step.key === "dues" && step.state === "current" && contact ? (
                <button type="button" className="dash-button" onClick={() => setPayOpen(true)}>How to pay</button>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      {payOpen && contact ? <HowToPayDialog contact={contact} onClose={() => setPayOpen(false)} /> : null}
    </section>
  );
}
