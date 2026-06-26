import FaqCallToAction from "../../features/faq/FaqCallToAction";
import FaqHero from "../../features/faq/FaqHero";
import FaqList from "../../features/faq/FaqList";
import FaqOfficialAnswer from "../../features/faq/FaqOfficialAnswer";
import "../../styles/components/faq.css";

export default function FaqPage() {
  return (
    <main className="faq-page-react">
      <FaqHero />
      <FaqOfficialAnswer />
      <FaqList />
      <FaqCallToAction />
    </main>
  );
}
