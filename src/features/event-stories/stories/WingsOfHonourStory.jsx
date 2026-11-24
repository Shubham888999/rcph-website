import WingsOfHonourSection from "../../home/wings-of-honour/WingsOfHonourSection";
import "../../../styles/components/home.css";

export default function WingsOfHonourStory() {
  return (
    <>
      <WingsOfHonourSection />
      <section className="event-story-about event-story-about--wings" aria-labelledby="woh-about-title">
        <h2 id="woh-about-title">About the campaign</h2>
        <p>
          A multi-district tribute campaign on Indian Air Force Day, where RCPH, along with 13 collaborating
          clubs, came together on social media to express our gratitude, in our mother tongue, to the heroes
          who guard our skies. The campaign showcased the diversity of India and how Rotaractors are still
          united by its Air Force.
        </p>
      </section>
    </>
  );
}
