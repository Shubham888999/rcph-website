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

// Temporarily hidden while VOX // '26 Installation is promoted on the homepage.
const SHOW_RECRUITMENT_SECTION = false;

export default function HomePage() {
  return (
    <main className="home-page">
      <HomeHero />
      <ClubIntroduction />
      <InstallationSection />
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
