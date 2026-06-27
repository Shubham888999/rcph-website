import CollaborationOptions from "../../features/contact/CollaborationOptions";
import ContactCallToAction from "../../features/contact/ContactCallToAction";
import ContactHero from "../../features/contact/ContactHero";
import ContactMethods from "../../features/contact/ContactMethods";
import "../../styles/components/contact.css";

export default function ContactPage() {
  return (
    <main className="contact-page-react">
      <ContactHero />
      <CollaborationOptions />
      <ContactMethods />
      <ContactCallToAction />
    </main>
  );
}
