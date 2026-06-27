import BodReveal from "./BodReveal";

export default function BodContact() {
  return (
    <BodReveal className="bod-section-react bod-contact-react" labelledBy="bod-contact-title">
      <div>
        <p className="bod-kicker">Reach the leadership team</p>
        <h2 id="bod-contact-title">Contact Us</h2>
      </div>
      <div className="bod-contact-react__leaders">
        <div><strong>Rtr. Aneesh Ladkat</strong><span>President</span></div>
        <div><strong>Rtr. Avani Joshi</strong><span>Club Service Director</span></div>
      </div>
      <address className="bod-contact-react__links">
        <a href="tel:+919175935956">+91 91759 35956</a>
        <a href="mailto:rcpuneheritage3131@gmail.com">rcpuneheritage3131@gmail.com</a>
        <a href="https://instagram.com/rc_pune_heritage/" target="_blank" rel="noreferrer">
          @rc_pune_heritage
        </a>
      </address>
    </BodReveal>
  );
}
