import { StyleSheet } from "react-native";

export const COLORS = {
  background: "#f5f5f5",
  card: "#e0e0e0",
  primary: "#219ebc",
  secondary: "#ffb703",
  textDark: "#023047",
  accentLight: "#8ecae6",
  accentOrange: "#fb8500",
};

export const globalStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: COLORS.background,
  },
  scrollContainer: { flexGrow: 1, justifyContent: "center", paddingVertical: 40 },
  header: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 20,
    color: COLORS.textDark,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 20, textAlign: "center", color: COLORS.textDark },
  input: {
    borderWidth: 1,
    borderColor: COLORS.accentLight,
    padding: 12,
    marginBottom: 15,
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    padding: 12,
    borderRadius: 10,
    marginBottom: 15,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "bold" },
  secondaryButton: {
    backgroundColor: COLORS.secondary,
    padding: 12,
    borderRadius: 10,
    marginBottom: 5,
    alignItems: "center",
  },
  buttonTextSecondary: { color: COLORS.textDark, fontWeight: "bold" },
  error: { color: COLORS.accentOrange, marginBottom: 10, textAlign: "center" },
});
