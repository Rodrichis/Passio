import { StyleSheet } from "react-native";
import { COLORS } from "./theme";

export const dashboardStyles = StyleSheet.create({
  sidebar: {
    width: 280,
    backgroundColor: COLORS.textDark,
    paddingTop: 28,
    paddingHorizontal: 18,
    paddingBottom: 18,
    justifyContent: "space-between",
  },
  sidebarTitle: {
    fontSize: 30,
    fontWeight: "800",
    marginBottom: 6,
    color: COLORS.secondary,
  },
  sidebarSubtitle: {
    fontSize: 14,
    color: "#B5C7D4",
    marginBottom: 28,
  },
  sidebarBrand: {
    marginBottom: 18,
  },
  menuList: {
    gap: 10,
  },
  menuButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 14,
    marginBottom: 4,
  },
  menuText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  activeMenuMarker: {
    position: "absolute",
    left: 0,
    top: 12,
    bottom: 12,
    width: 4,
    borderRadius: 999,
    backgroundColor: "#A86D00",
  },
  sidebarFooter: {
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.10)",
  },
  contentContainer: {
    flex: 1,
    padding: 28,
    backgroundColor: "#F6FAFF",
  },
  contentContainerMobile: {
    padding: 16,
    backgroundColor: "#F6FAFF",
  },
  contentTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  mobileBottomMenu: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: COLORS.textDark,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  bottomMenuButton: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  smallLogoutButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#C91919",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignSelf: "stretch",
    justifyContent: "center",
  },
  logoutText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },

  // 🔹 NUEVOS estilos para el panel de Ajustes
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 16,
    color: "#023047",
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    marginTop: 10,
    marginBottom: 4,
    color: "#333",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    backgroundColor: "#fff",
    color: "#023047",
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    backgroundColor: "#219ebc",
    paddingVertical: 10,
    borderRadius: 8,
  },
});
