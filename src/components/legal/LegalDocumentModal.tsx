import React from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  LEGAL_DOCUMENT_SECTIONS,
  LEGAL_DOCUMENT_TITLE,
  LEGAL_DOCUMENT_UPDATED_AT,
} from "../../content/legalDocument";

type Props = {
  visible: boolean;
  onClose: () => void;
  onAccept?: () => void;
  showAcceptButton?: boolean;
};

export default function LegalDocumentModal({
  visible,
  onClose,
  onAccept,
  showAcceptButton = false,
}: Props) {
  const handleAccept = () => {
    onAccept?.();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerBadge}>
              <Ionicons name="document-text-outline" size={22} color="#0A6F88" />
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={18} color="#123042" />
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>{LEGAL_DOCUMENT_TITLE}</Text>
          <Text style={styles.updatedAt}>Actualizado: {LEGAL_DOCUMENT_UPDATED_AT}</Text>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {LEGAL_DOCUMENT_SECTIONS.map((section) => (
              <View key={section.title} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                {section.paragraphs.map((paragraph) => (
                  <Text key={`${section.title}-${paragraph}`} style={styles.paragraph}>
                    {paragraph}
                  </Text>
                ))}
              </View>
            ))}
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity onPress={onClose} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Cerrar</Text>
            </TouchableOpacity>

            {showAcceptButton ? (
              <TouchableOpacity onPress={handleAccept} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Aceptar</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(13, 25, 34, 0.52)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 760,
    maxHeight: "86%",
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#E2ECF1",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  headerBadge: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "#EAF6FB",
    alignItems: "center",
    justifyContent: "center",
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D6E1EA",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#102A43",
    fontSize: 22,
    fontWeight: "800",
  },
  updatedAt: {
    color: "#60707D",
    fontSize: 13,
    marginTop: 4,
    marginBottom: 14,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    gap: 18,
    paddingBottom: 12,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    color: "#123042",
    fontSize: 16,
    fontWeight: "800",
  },
  paragraph: {
    color: "#425466",
    fontSize: 14,
    lineHeight: 22,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },
  secondaryButton: {
    minHeight: 46,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D6E1EA",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "#123042",
    fontWeight: "700",
    fontSize: 15,
  },
  primaryButton: {
    minHeight: 46,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: "#219EBC",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
  },
});
