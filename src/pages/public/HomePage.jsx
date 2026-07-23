import { useEffect, useState } from "react";
import ClubIntroduction from "../../features/home/ClubIntroduction";
import FeaturedProjects from "../../features/home/FeaturedProjects";
import HomeHero from "../../features/home/HomeHero";
import InstallationSection from "../../features/home/InstallationSection";
import HomeEventsPreview from "../../features/home/HomeEventsPreview";
import HomeGallery from "../../features/home/HomeGallery";
import HomeBoardSection from "../../features/home/HomeBoardSection";
import HomeJoinCallToAction from "../../features/home/HomeJoinCallToAction";
import MonthlyHighlight from "../../features/home/MonthlyHighlight";
import RecruitmentSection from "../../features/home/RecruitmentSection";
import "../../styles/components/home.css";

const HERO_AUTO_FADE_DELAY_MS = 1000;
const SHOW_RECRUITMENT_SECTION = true;

export default function HomePage() {
  const [heroDismissed, setHeroDismissed] = useState(false);

  useEffect(() => {
    const heroTimer = window.setTimeout(() => {
      setHeroDismissed(true);
    }, HERO_AUTO_FADE_DELAY_MS);

    return () => window.clearTimeout(heroTimer);
  }, []);

  return (
    <main className="home-page">
      <div
        className={`home-hero-shell${heroDismissed ? " home-hero-shell--dismissed" : ""}`}
        aria-hidden={heroDismissed ? "true" : undefined}
      >
        <HomeHero />
      </div>
      <InstallationSection autoRevealActive={heroDismissed} />
      <ClubIntroduction />
      {SHOW_RECRUITMENT_SECTION ? <RecruitmentSection /> : null}
      <MonthlyHighlight />
      <FeaturedProjects />
      <HomeBoardSection />
      <HomeEventsPreview />
      <HomeGallery />
      <HomeJoinCallToAction />
    </main>
  );
}
