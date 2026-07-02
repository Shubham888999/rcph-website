import LegalDocument from "../../features/legal/LegalDocument";
import { LEGAL_VERSIONS } from "../../features/legal/legalConstants";
import { privacySections } from "../../features/legal/legalContent";
import "../../styles/components/legal.css";

export default function PrivacyPage() {
  return <LegalDocument title="RCPH Account and Membership Privacy Notice" version={LEGAL_VERSIONS.privacy} intro="How RCPH handles personal data for accounts, club participation, and administration." sections={privacySections} />;
}
