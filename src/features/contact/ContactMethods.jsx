import ContactReveal from "./ContactReveal";

export default function ContactMethods() {
  return (
    <ContactReveal className="contact-section" labelledBy="contact-methods-title">
      <div className="contact-section__heading">
        <p className="contact-kicker">Direct contact</p>
        <h2 id="contact-methods-title">Reach Us</h2>
      </div>

      <div className="contact-methods-card">
        <div className="contact-methods-card__identity">
          <p className="contact-kicker">Rotaract Club of Pune Heritage</p>
          <h3>RID 3131, Pune, Maharashtra</h3>
          <p>
            Reach the club directly by email or follow RCPH on Instagram for
            public updates.
          </p>
        </div>

        <address className="contact-methods-list">
          <a href="mailto:rcpuneheritage3131@gmail.com">
            <span>Email</span>
            <strong>rcpuneheritage3131@gmail.com</strong>
          </a>
          <a
            href="https://instagram.com/rc_pune_heritage/"
            target="_blank"
            rel="noreferrer"
          >
            <span>Instagram</span>
            <strong>@rc_pune_heritage</strong>
          </a>
        </address>
      </div>
    </ContactReveal>
  );
}
