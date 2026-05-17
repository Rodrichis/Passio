import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
  Modal,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

type NotificationItem = {
  id: string;
  title: string;
  description: string;
  tag?: string;
};

type Props = {
  pageTitle?: string;
  companyName?: string;
  isAdmin?: boolean;
  onOpenSupport?: () => void;
  onOpenFaq?: () => void;
  onOpenNotifications?: () => void;
  notificationItems?: NotificationItem[];
  hasUnreadNotifications?: boolean;
};

export default function DashboardTopBar({
  pageTitle,
  companyName,
  isAdmin = false,
  onOpenSupport,
  onOpenFaq,
  onOpenNotifications,
  notificationItems = [],
  hasUnreadNotifications = false,
}: Props) {
  const { width } = useWindowDimensions();
  const isCompact = Platform.OS !== "web" || width < 900;
  const isNativeCompact = Platform.OS === "android" || Platform.OS === "ios";
  const safeCompanyName = typeof companyName === "string" ? companyName.trim() : "";
  const [showNotificationsMenu, setShowNotificationsMenu] = useState(false);
  const horizontalPadding = isCompact ? 16 : 28;
  const menuWidth = Math.min(isCompact ? 420 : 460, width - horizontalPadding * 2);
  const notificationAnchorRef = useRef<View | null>(null);
  const [menuPosition, setMenuPosition] = useState({
    top: 84,
    left: Math.max(horizontalPadding, width - menuWidth - horizontalPadding),
  });

  const updateNotificationsMenuPosition = () => {
    const fallbackLeft = Math.max(horizontalPadding, width - menuWidth - horizontalPadding);

    if (
      !notificationAnchorRef.current ||
      typeof (notificationAnchorRef.current as any).measureInWindow !== "function"
    ) {
      setMenuPosition({
        top: isCompact ? 78 : 92,
        left: fallbackLeft,
      });
      return;
    }

    (notificationAnchorRef.current as any).measureInWindow((x: number, y: number, w: number, h: number) => {
      const nextLeft = Math.max(
        horizontalPadding,
        Math.min(x + w - menuWidth, width - menuWidth - horizontalPadding)
      );

      setMenuPosition({
        top: y + h + 12,
        left: nextLeft,
      });
    });
  };

  const handleToggleNotifications = () => {
    setShowNotificationsMenu((prev) => {
      const next = !prev;
      if (next) onOpenNotifications?.();
      return next;
    });
  };

  useEffect(() => {
    if (!showNotificationsMenu) return;

    const frame = requestAnimationFrame(() => {
      updateNotificationsMenuPosition();
    });

    return () => cancelAnimationFrame(frame);
  }, [showNotificationsMenu, width, menuWidth, horizontalPadding, isCompact]);

  return (
    <View
      style={{
        backgroundColor: "#FFFFFF",
        borderBottomWidth: 1,
        borderBottomColor: "#DCE7F1",
        paddingHorizontal: horizontalPadding,
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

        <View ref={notificationAnchorRef} collapsable={false}>
          <TouchableOpacity
            onPress={handleToggleNotifications}
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
            {hasUnreadNotifications ? (
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
            ) : null}
          </TouchableOpacity>
        </View>

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

      <Modal
        visible={showNotificationsMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNotificationsMenu(false)}
      >
        <View style={{ flex: 1 }}>
          <Pressable
            style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
            onPress={() => setShowNotificationsMenu(false)}
          />

          <View
            style={{
              position: "absolute",
              top: menuPosition.top,
              left: menuPosition.left,
              width: menuWidth,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: "#DCE7F1",
              backgroundColor: "#FFFFFF",
              shadowColor: "#0A2A43",
              shadowOpacity: 0.12,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 12 },
              elevation: 8,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                paddingHorizontal: 18,
                paddingTop: 18,
                paddingBottom: 14,
                borderBottomWidth: 1,
                borderBottomColor: "#E6EEF5",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: "#102A43",
                    fontSize: isCompact ? 16 : 17,
                    fontWeight: "800",
                  }}
                >
                  Noticias y versiones
                </Text>
                <Text
                  style={{
                    color: "#607381",
                    fontSize: 13,
                    marginTop: 2,
                  }}
                >
                  Resumen breve de las últimas mejoras
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setShowNotificationsMenu(false)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: "#DCE7F1",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#F8FBFE",
                }}
              >
                <Ionicons name="close" size={18} color="#51616F" />
              </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: 14, paddingVertical: 12, gap: 10 }}>
              {notificationItems.map((item) => (
                <View
                  key={item.id}
                  style={{
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: "#E4EDF4",
                    backgroundColor: "#F8FBFE",
                    paddingHorizontal: 14,
                    paddingVertical: 14,
                    gap: 8,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <Text
                      style={{
                        color: "#102A43",
                        fontSize: 15,
                        fontWeight: "800",
                        flex: 1,
                      }}
                    >
                      {item.title}
                    </Text>

                    {item.tag ? (
                      <View
                        style={{
                          borderRadius: 999,
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          backgroundColor: "#EAF5FF",
                          borderWidth: 1,
                          borderColor: "#CFE4F6",
                        }}
                      >
                        <Text
                          style={{
                            color: "#0A6F88",
                            fontSize: 11,
                            fontWeight: "800",
                          }}
                        >
                          {item.tag}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <Text
                    style={{
                      color: "#51616F",
                      fontSize: 13,
                      lineHeight: 20,
                    }}
                  >
                    {item.description}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
