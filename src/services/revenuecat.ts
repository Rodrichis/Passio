// RevenueCat integration helpers
import { Platform } from "react-native";
import { REVENUECAT_API_KEY } from "@env";
import type {
  PurchasesOffering,
  PurchasesPackage,
  CustomerInfo,
} from "react-native-purchases";

const API_KEY = (REVENUECAT_API_KEY || "").trim();
export const ENTITLEMENT_PRO = "Pro";

// Safe, platform-aware loading to avoid breaking web bundle
let Purchases: any = null;
let LOG_LEVEL: any = { INFO: "INFO" };
let presentPaywall: any = null;

if (Platform.OS !== "web") {
  try {
    const purchasesLib = require("react-native-purchases");
    const purchasesUiLib = require("react-native-purchases-ui");

    // RN Purchases v9 exposes default export for the SDK object.
    Purchases = purchasesLib?.default ?? purchasesLib?.Purchases ?? purchasesLib;
    LOG_LEVEL = purchasesLib?.LOG_LEVEL ?? purchasesLib?.default?.LOG_LEVEL ?? LOG_LEVEL;

    // RN Purchases UI exposes default export with static methods.
    const uiModule = purchasesUiLib?.default ?? purchasesUiLib;
    if (uiModule?.presentPaywall) {
      presentPaywall = (params: any) => uiModule.presentPaywall(params);
    }
  } catch (e) {
    console.log("RevenueCat native modules not available:", e);
  }
}

export function isRevenueCatAvailable() {
  return !!Purchases && typeof Purchases.configure === "function";
}

export function hasRevenueCatApiKey() {
  return API_KEY.length > 0;
}

export async function configureRevenueCat(appUserId?: string | null) {
  if (!isRevenueCatAvailable() || !hasRevenueCatApiKey()) return;
  try {
    await Purchases.configure({
      apiKey: API_KEY,
      appUserID: appUserId || undefined,
      useAmazon: false,
    });
    Purchases.setLogLevel(LOG_LEVEL.INFO);
    if (appUserId) {
      await Purchases.setEmail(appUserId);
    }
  } catch (e) {
    console.log("RevenueCat configure failed:", e);
  }
}

export async function syncRevenueCatUser(appUserId?: string | null) {
  if (!isRevenueCatAvailable()) return;
  try {
    if (!appUserId) {
      await Purchases.logOut();
    } else {
      await Purchases.logIn(appUserId);
    }
  } catch (e) {
    console.log("RevenueCat sync user failed:", e);
  }
}

export async function fetchOfferings() {
  if (!isRevenueCatAvailable()) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current;
  } catch (e) {
    console.log("RevenueCat getOfferings failed:", e);
    return null;
  }
}

export function hasProEntitlement(info?: CustomerInfo | null) {
  if (!info) return false;
  const ent = info.entitlements?.active?.[ENTITLEMENT_PRO];
  return !!ent;
}

export async function purchasePackage(pack: PurchasesPackage) {
  if (!isRevenueCatAvailable()) return { ok: false, error: "RevenueCat no disponible" } as const;
  try {
    const { customerInfo } = await Purchases.purchasePackage(pack);
    return { ok: true, customerInfo };
  } catch (e: any) {
    if (e?.userCancelled) return { ok: false, cancelled: true };
    return { ok: false, error: e };
  }
}

export async function restorePurchases() {
  if (!isRevenueCatAvailable()) return { ok: false, error: "RevenueCat no disponible" } as const;
  try {
    const info = await Purchases.restorePurchases();
    return { ok: true, customerInfo: info };
  } catch (e) {
    return { ok: false, error: e };
  }
}

export async function presentRCPlaywall(offering?: PurchasesOffering | null) {
  if (!presentPaywall) {
    throw new Error("RevenueCat paywall no disponible en este entorno (Expo Go / web)");
  }
  try {
    const res = await presentPaywall({
      offering: offering ?? undefined,
    });
    return res;
  } catch (e) {
    console.log("Paywall failed:", e);
    throw e;
  }
}

export async function getCustomerInfoSafe() {
  if (!isRevenueCatAvailable()) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch (e) {
    console.log("getCustomerInfo failed:", e);
    return null;
  }
}
