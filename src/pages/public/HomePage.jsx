import ClubIntroduction from "../../features/home/ClubIntroduction";
import FeaturedProjects from "../../features/home/FeaturedProjects";
import HomeHero from "../../features/home/HomeHero";
import HomeEventsPreview from "../../features/home/HomeEventsPreview";
import HomeGallery from "../../features/home/HomeGallery";
import HomeBoardSection from "../../features/home/HomeBoardSection";
import HomeJoinCallToAction from "../../features/home/HomeJoinCallToAction";
import InstallationFilmGallery from "../../features/home/InstallationFilmGallery";
import MonthlyHighlight from "../../features/home/MonthlyHighlight";
import RecruitmentSection from "../../features/home/RecruitmentSection";
import "../../styles/components/home.css";

const SHOW_RECRUITMENT_SECTION = true;

export default function HomePage() {
  return (
    <main className="home-page">
      <HomeHero />
      <ClubIntroduction />
      {SHOW_RECRUITMENT_SECTION ? <RecruitmentSection /> : null}
      <InstallationFilmGallery />
      <MonthlyHighlight />
      <FeaturedProjects />
      <HomeBoardSection />
      <HomeEventsPreview />
      <HomeGallery />
      <HomeJoinCallToAction />
    </main>
  );
}
