import ClubIntroduction from "../../features/home/ClubIntroduction";
import FeaturedProjects from "../../features/home/FeaturedProjects";
import HomeHero from "../../features/home/HomeHero";
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
    </main>
  );
}
