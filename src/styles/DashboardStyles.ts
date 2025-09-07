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
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  menuText: {
    color: "#023047",
    fontWeight: "bold",
  },
  logoutButton: {
    marginTop: 20,
    backgroundColor: "#fb8500",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  logoutText: {
    color: "#fff",
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
  mobileBottomMenuContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  mobileBottomMenu: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#cfd8dc",
    paddingVertical: 5,
  },
  bottomMenuButton: {
    flex: 1,
    marginHorizontal: 5,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
});
