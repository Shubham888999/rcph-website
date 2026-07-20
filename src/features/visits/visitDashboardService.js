import { httpsCallable } from "firebase/functions";
import { auth, functions } from "../../app/firebase";
import { normalizeVisitDashboardData } from "./visitDashboardModel.js";

export async function loadVisitDashboardData(uid, visitType) {
  if (!auth.currentUser || auth.currentUser.uid !== uid) {
    throw new Error("An authenticated user is required.");
  }
  const callable = httpsCallable(functions, "getVisitDashboardData");
  const result = await callable({ visitType });
  return normalizeVisitDashboardData(result?.data, visitType);
}
