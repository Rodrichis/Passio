import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type GeoPoint = {
  latitude: number;
  longitude: number;
};

type Props = {
  value: GeoPoint | null;
  onChange: (point: GeoPoint) => void;
  disabled?: boolean;
  height?: number | string;
};

export default function GeoMapPicker({ height = 240 }: Props) {
  return (
    <View style={[styles.container, typeof height === "number" ? { minHeight: height } : null]}>
      <View style={styles.iconBox}>
        <Ionicons name="map-outline" size={28} color="#2196F3" />
      </View>
      <Text style={styles.title}>Mapa disponible desde la versión web</Text>
      <Text style={styles.description}>
        Para crear una notificación georeferenciada, ingresa desde el navegador web y selecciona el punto en el mapa.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#D6E4ED",
    backgroundColor: "#F7FBFF",
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#EAF5FB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: {
    color: "#023047",
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  description: {
    color: "#607D8B",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 360,
  },
});
