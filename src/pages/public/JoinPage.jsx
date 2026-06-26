import JoinCallToAction from "../../features/join/JoinCallToAction";
import JoinHero from "../../features/join/JoinHero";
import MembershipBenefits from "../../features/join/MembershipBenefits";
import MembershipCriteria from "../../features/join/MembershipCriteria";
import MembershipJourney from "../../features/join/MembershipJourney";
import "../../styles/components/join.css";

export default function JoinPage() {
  return (
    <main className="join-page">
      <JoinHero />
      <MembershipCriteria />
      <MembershipBenefits />
      <MembershipJourney />
      <JoinCallToAction />
    </main>
  );
}
