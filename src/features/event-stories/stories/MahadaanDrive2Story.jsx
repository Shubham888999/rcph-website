import MahadaanStory from "./mahadaan/MahadaanStory";
import { mahadaanDrives } from "./mahadaan/mahadaanDrives";

export default function MahadaanDrive2Story() {
  return <MahadaanStory drive={mahadaanDrives[1]} drives={mahadaanDrives} />;
}
