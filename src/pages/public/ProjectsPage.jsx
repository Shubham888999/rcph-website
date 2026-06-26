import ProjectsCallToAction from "../../features/projects/ProjectsCallToAction";
import ProjectsGrid from "../../features/projects/ProjectsGrid";
import ProjectsHero from "../../features/projects/ProjectsHero";
import "../../styles/components/projects.css";

export default function ProjectsPage() {
  return (
    <main className="projects-page">
      <ProjectsHero />
      <ProjectsGrid />
      <ProjectsCallToAction />
    </main>
  );
}
