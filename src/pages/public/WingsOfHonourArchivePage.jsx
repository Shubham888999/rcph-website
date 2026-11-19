import WingsOfHonourSection from "../../features/home/wings-of-honour/WingsOfHonourSection";
import "../../styles/components/home.css";

// Wings of Honour left the home page after Men's Day 2026. It stays here, unlisted and
// hidden from search engines, so it can be shown again or linked to later.
export default function WingsOfHonourArchivePage() {
  return (
    <main className="home-page">
      <WingsOfHonourSection />
    </main>
  );
}
