import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebaseConfig";
import { normalizeNombrePlan, NombrePlan } from "../utils/subscription";

export type PlanInfo = {
  nombrePlan?: string;
  limiteUsuarios?: number;
  limiteNotificacion?: number;
  limiteCorreo?: number;
  precio?: number;
};

export async function getPlanByName(nombrePlan: unknown): Promise<PlanInfo | null> {
  const normalizedPlan = normalizeNombrePlan(nombrePlan);
  const planSnap = await getDocs(
    query(collection(db, "Planes"), where("nombrePlan", "==", normalizedPlan))
  );

  const exact = planSnap.docs[0];
  if (exact) {
    return exact.data() as PlanInfo;
  }

  const allPlans = await getDocs(collection(db, "Planes"));
  const fallback = allPlans.docs.find(
    (planDoc) =>
      normalizeNombrePlan(planDoc.data().nombrePlan) === (normalizedPlan as NombrePlan)
  );

  return fallback ? (fallback.data() as PlanInfo) : null;
}

export async function getUserLimitByPlanName(nombrePlan: unknown): Promise<number | null> {
  const plan = await getPlanByName(nombrePlan);
  const limit = plan?.limiteUsuarios;
  return typeof limit === "number" ? limit : null;
}
