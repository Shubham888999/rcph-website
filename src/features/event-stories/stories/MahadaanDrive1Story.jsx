import MahadaanStory from "./mahadaan/MahadaanStory";
import { mahadaanDrives } from "./mahadaan/mahadaanDrives";

export default function MahadaanDrive1Story() {
  return <MahadaanStory drive={mahadaanDrives[0]} drives={mahadaanDrives} />;
}
