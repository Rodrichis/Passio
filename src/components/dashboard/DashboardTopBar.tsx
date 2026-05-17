import React from "react";
import { View, Text, TouchableOpacity, useWindowDimensions, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  pageTitle?: string;
  companyName?: string;
  isAdmin?: boolean;
  onOpenSupport?: () => void;
  onOpenFaq?: () => void;
  onOpenNotifications?: () => void;
};

export default function DashboardTopBar({
  pageTitle,
  companyName,
  isAdmin = false,
  onOpenSupport,
  onOpenFaq,
  onOpenNotifications,
}: Props) {
  const { width } = useWindowDimensions();
  const isCompact = Platform.OS !== "web" || width < 900;
  const isNativeCompact = Platform.OS === "android" || Platform.OS === "ios";
  const safeCompanyName = typeof companyName === "string" ? companyName.trim() : "";

  return (
    <View
      style={{
        backgroundColor: "#FFFFFF",
        borderBottomWidth: 1,
        borderBottomColor: "#DCE7F1",
        paddingHorizontal: isCompact ? 16 : 28,
        paddingVertical: isCompact ? 12 : 18,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: isCompact ? 10 : 16,
          flexWrap: "wrap",
        }}
      >
        <Text
          style={{
            color: "#102A43",
            fontSize: isCompact ? 18 : 24,
            fontWeight: "800",
            flexShrink: 0,
          }}
        >
          {pageTitle || ""}
        </Text>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: isCompact ? 10 : 16,
            flexWrap: "wrap",
            flex: 1,
          }}
        >
        {!isCompact ? (
          <TouchableOpacity
            onPress={onOpenSupport}
            style={{ paddingVertical: 6, paddingHorizontal: 4 }}
          >
            <Text style={{ color: "#0A6F88", fontSize: 16, fontWeight: "600" }}>
              Ayuda y soporte
            </Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          onPress={onOpenFaq}
          style={{
            width: isCompact ? 38 : 42,
            height: isCompact ? 38 : 42,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#FFFFFF",
            borderWidth: 1,
            borderColor: "#DCE7F1",
          }}
        >
          <Ionicons name="help-circle-outline" size={isCompact ? 20 : 24} color="#243844" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onOpenNotifications}
          style={{
            width: isCompact ? 38 : 42,
            height: isCompact ? 38 : 42,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#FFFFFF",
            borderWidth: 1,
            borderColor: "#DCE7F1",
            position: "relative",
          }}
        >
          <Ionicons name="notifications-outline" size={isCompact ? 20 : 22} color="#243844" />
          <View
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: "#D72638",
            }}
          />
        </TouchableOpacity>

        {safeCompanyName ? (
          <View
            style={{
              minWidth: isCompact ? 0 : 168,
              maxWidth: isNativeCompact ? 126 : isCompact ? 190 : 240,
              flexDirection: "row",
              alignItems: "center",
              gap: isNativeCompact ? 8 : 10,
              paddingVertical: isNativeCompact ? 7 : isCompact ? 8 : 10,
              paddingHorizontal: isNativeCompact ? 8 : isCompact ? 12 : 14,
              borderRadius: 999,
              backgroundColor: "#EAF5FF",
              borderWidth: 1,
              borderColor: "#CFE4F6",
              alignSelf: "center",
              flexShrink: 1,
            }}
          >
            <View
              style={{
                width: isNativeCompact ? 24 : isCompact ? 28 : 32,
                height: isNativeCompact ? 24 : isCompact ? 28 : 32,
                borderRadius: 999,
                backgroundColor: "#BFE0FF",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="business-outline" size={isNativeCompact ? 12 : isCompact ? 14 : 16} color="#0A6F88" />
            </View>

            <View style={{ minWidth: 0, flexShrink: 1 }}>
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{
                  color: "#102A43",
                  fontSize: isNativeCompact ? 13 : isCompact ? 14 : 16,
                  fontWeight: "700",
                  maxWidth: isNativeCompact ? 74 : undefined,
                }}
              >
                {safeCompanyName}
              </Text>
            </View>
          </View>
        ) : null}
        </View>
      </View>
    </View>
  );
}
