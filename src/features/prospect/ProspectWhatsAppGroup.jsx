import { getProspectWhatsAppGroupState } from "./prospectWhatsAppModel";

export default function ProspectWhatsAppGroup() {
  const group = getProspectWhatsAppGroupState();

  return (
    <section className="prospect-whatsapp" aria-labelledby="prospect-whatsapp-title">
      <div className="prospect-whatsapp__content">
        <p className="dashboard-eyebrow">Stay connected</p>
        <h2 id="prospect-whatsapp-title">Join the Prospect WhatsApp Group</h2>
        <p>Use the group to receive prospect updates, meeting reminders, event information, and guidance during your membership journey.</p>
        <p className="prospect-whatsapp__introduction">After joining, please introduce yourself briefly with your name, where you are from or currently based, and what interested you in RCPH.</p>
        <p className="prospect-whatsapp__note">Please use the same name you registered with so the team can identify you easily.</p>
      </div>

      {group.available ? (
        <a className="prospect-whatsapp__action" href={group.url} target="_blank" rel="noreferrer">
          Join WhatsApp Group
        </a>
      ) : (
        <span className="prospect-whatsapp__action is-unavailable" aria-disabled="true">
          Group link will be shared soon
        </span>
      )}
    </section>
  );
}
