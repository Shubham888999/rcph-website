import ClubIntroduction from "../../features/home/ClubIntroduction";
import FeaturedProjects from "../../features/home/FeaturedProjects";
import HomeHero from "../../features/home/HomeHero";
import HomeEventsPreview from "../../features/home/HomeEventsPreview";
import HomeGallery from "../../features/home/HomeGallery";
import HomeJoinCallToAction from "../../features/home/HomeJoinCallToAction";
import MonthlyHighlight from "../../features/home/MonthlyHighlight";
import RecruitmentSection from "../../features/home/RecruitmentSection";
import "../../styles/components/home.css";

export default function HomePage() {
  return (
    <main className="home-page">
      <HomeHero />
      <ClubIntroduction />
      <RecruitmentSection />
      <MonthlyHighlight />
      <FeaturedProjects />
      <HomeEventsPreview />
      <HomeGallery />
      <HomeJoinCallToAction />
    </main>
  );
}
