import AboutClubStory from "../../features/about/AboutClubStory";
import AboutHero from "../../features/about/AboutHero";
import AboutIdentity from "../../features/about/AboutIdentity";
import AboutMessages from "../../features/about/AboutMessages";
import AboutValues from "../../features/about/AboutValues";
import "../../styles/components/about.css";

export default function AboutPage() {
  return (
    <main className="about-page">
      <AboutHero />
      <AboutClubStory />
      <AboutIdentity />
      <AboutValues />
      <AboutMessages />
    </main>
  );
}
