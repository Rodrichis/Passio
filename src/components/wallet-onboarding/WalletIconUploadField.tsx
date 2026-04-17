import * as ImagePicker from "expo-image-picker";
import React, { useMemo, useRef, useState } from "react";
import { Image, Platform, Text, TouchableOpacity, View } from "react-native";
import { COLORS } from "../../styles/theme";
import type { WalletIconAsset } from "../../types/walletOnboarding";
import { isPngAsset } from "../../utils/walletOnboarding/validators";

type Props = {
  currentUrl: string;
  asset: WalletIconAsset | null;
  onSelectAsset: (asset: WalletIconAsset | null) => void;
  helperText?: string | null;
};

function extractFileNameFromUri(uri: string) {
  const cleanUri = String(uri || "").split("?")[0];
  const parts = cleanUri.split("/");
  return parts[parts.length - 1] || "";
}

function inferMimeType(name: string, fallbackType?: string | null) {
  if (fallbackType) return fallbackType;
  return name.toLowerCase().endsWith(".png") ? "image/png" : "";
}

function buildWebAsset(file: File): WalletIconAsset {
  return {
    file,
    name: "icon.png",
    type: "image/png",
    previewUrl: URL.createObjectURL(file),
  };
}

function buildNativeAsset(uri: string): WalletIconAsset {
  return {
    file: {
      uri,
      name: "icon.png",
      type: "image/png",
    },
    name: "icon.png",
    type: "image/png",
    previewUrl: uri,
  };
}

export default function WalletIconUploadField({ currentUrl, asset, onSelectAsset, helperText }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [pickerError, setPickerError] = useState("");
  const previewUri = useMemo(() => asset?.previewUrl || currentUrl || "", [asset, currentUrl]);
  const resolvedHelperText = pickerError || helperText || "";

  const handlePick = async () => {
    if (Platform.OS === "web") {
      inputRef.current?.click();
      return;
    }

    setPickerError("");
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPickerError("Debes permitir acceso a tus fotos para seleccionar un icono.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 1,
      selectionLimit: 1,
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    const pickedAsset = result.assets[0];
    const originalName = pickedAsset.fileName || extractFileNameFromUri(pickedAsset.uri);
    const originalType = inferMimeType(originalName, pickedAsset.mimeType);

    if (!isPngAsset({ name: originalName, type: originalType })) {
      onSelectAsset(null);
      setPickerError("Solo se permiten archivos PNG.");
      return;
    }

    onSelectAsset(buildNativeAsset(pickedAsset.uri));
    setPickerError("");
  };

  const handleFileChange = (event: any) => {
    const file = event?.target?.files?.[0];
    if (!file) return;

    if (!isPngAsset({ name: file.name || "", type: file.type || "" })) {
      onSelectAsset(null);
      setPickerError("Solo se permiten archivos PNG.");
      if (event?.target) {
        event.target.value = "";
      }
      return;
    }

    onSelectAsset(buildWebAsset(file));
    setPickerError("");
  };

  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ fontSize: 16, fontWeight: "700", color: COLORS.textDark, marginBottom: 8 }}>
        Icono del wallet
      </Text>
      <Text style={{ color: "#51616F", marginBottom: 12 }}>
        Sube un archivo PNG de tu empresa. Este icono se usara tanto en Android como en Apple.
      </Text>

      {Platform.OS === "web" ? (
        <>
          <input
            ref={(node) => {
              inputRef.current = node;
            }}
            type="file"
            accept=".png,image/png"
            onChange={handleFileChange}
            style={{ display: "none" } as any}
          />
          <TouchableOpacity
            onPress={handlePick}
            style={{
              borderWidth: 1,
              borderStyle: "dashed",
              borderColor: "#BFD1DB",
              backgroundColor: "#fff",
              borderRadius: 18,
              padding: 18,
              alignItems: "center",
              justifyContent: "center",
              minHeight: 140,
            }}
          >
            {previewUri ? (
              <View
                style={{
                  width: 112,
                  height: 112,
                  borderRadius: 24,
                  backgroundColor: "#2E527E",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 12,
                  padding: 12,
                }}
              >
                <Image source={{ uri: previewUri }} style={{ width: 88, height: 88 }} resizeMode="contain" />
              </View>
            ) : null}
            <Text style={{ fontSize: 15, fontWeight: "700", color: COLORS.textDark, marginBottom: 4 }}>
              {asset?.name || "Seleccionar icono PNG"}
            </Text>
            <Text style={{ color: "#51616F", textAlign: "center" }}>
              Formato obligatorio: PNG
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity
          onPress={handlePick}
          style={{
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: "#BFD1DB",
            backgroundColor: "#fff",
            borderRadius: 18,
            padding: 18,
            alignItems: "center",
            justifyContent: "center",
            minHeight: 140,
          }}
        >
          {previewUri ? (
            <View
              style={{
                width: 112,
                height: 112,
                borderRadius: 24,
                backgroundColor: "#2E527E",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 12,
                padding: 12,
              }}
            >
              <Image source={{ uri: previewUri }} style={{ width: 88, height: 88 }} resizeMode="contain" />
            </View>
          ) : null}
          <Text style={{ fontSize: 15, fontWeight: "700", color: COLORS.textDark, marginBottom: 4 }}>
            {asset?.name || "Seleccionar icono PNG"}
          </Text>
          <Text style={{ color: "#51616F", textAlign: "center" }}>
            Se abrira tu galeria. Solo se permiten archivos PNG.
          </Text>
        </TouchableOpacity>
      )}

      {resolvedHelperText ? (
        <Text style={{ marginTop: 8, color: resolvedHelperText.toLowerCase().includes("png") || resolvedHelperText.toLowerCase().includes("permit") ? "#C62828" : "#51616F" }}>
          {resolvedHelperText}
        </Text>
      ) : null}
    </View>
  );
}
