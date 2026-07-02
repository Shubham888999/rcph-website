import LegalDocument from "../../features/legal/LegalDocument";
import { LEGAL_VERSIONS } from "../../features/legal/legalConstants";
import { termsSections } from "../../features/legal/legalContent";
import "../../styles/components/legal.css";

export default function TermsPage() {
  return <LegalDocument title="RCPH Account, Prospect and Membership Terms" version={LEGAL_VERSIONS.terms} intro="Terms for RCPH accounts, prospect participation, and membership administration." sections={termsSections} />;
}
