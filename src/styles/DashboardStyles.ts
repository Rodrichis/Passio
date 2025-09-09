import { StyleSheet } from "react-native";

export const dashboardStyles = StyleSheet.create({
  sidebar: {
    width: 200,
    backgroundColor: "#e0e0e0",
    padding: 20,
  },
  sidebarTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 20,
  },
  menuButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  menuText: {
    color: "#023047",
    fontWeight: "bold",
  },
  contentContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f5f5f5",
  },
  contentTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  // 🔹 Menú inferior en mobile (estilo base, sin posición absoluta)
  mobileBottomMenu: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#cfd8dc",
    paddingVertical: 10,
  },
  bottomMenuButton: {
    flex: 1,
    marginHorizontal: 5,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  // 🔹 Botón de logout más pequeño
  smallLogoutButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fb8500",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  logoutText: {
    color: "#fff",
    fontWeight: "bold",
  },
});
