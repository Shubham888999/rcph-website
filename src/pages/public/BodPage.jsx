import BodContact from "../../features/bod/BodContact";
import BodHero from "../../features/bod/BodHero";
import BodLeadership from "../../features/bod/BodLeadership";
import BodCouncil from "../../features/bod/BodCouncil";
import "../../styles/components/bod.css";

export default function BodPage() {
  return (
    <main className="bod-page-react">
      <BodHero />
      <BodLeadership />
      <BodCouncil />
      <BodContact />
    </main>
  );
}
