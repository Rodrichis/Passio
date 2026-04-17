import React from "react";
import { ScrollView, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import OnboardingNextButton from "../../components/wallet-onboarding/OnboardingNextButton";
import { COLORS } from "../../styles/theme";
import { RootStackParamList } from "../../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "WalletOnboardingDone">;

export default function WalletOnboardingDoneScreen({ navigation }: Props) {
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <View
        style={{
          flex: 1,
          backgroundColor: "#F5F8FA",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 24,
          paddingVertical: 40,
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 620,
            backgroundColor: "#FFFFFF",
            borderRadius: 28,
            paddingHorizontal: 28,
            paddingVertical: 34,
            borderWidth: 1,
            borderColor: "#E2ECF1",
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: "#E9F9F2",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 20,
            }}
          >
            <Ionicons name="checkmark-circle" size={52} color="#2E8B57" />
          </View>

          <Text style={{ fontSize: 30, fontWeight: "800", color: COLORS.textDark, textAlign: "center", marginBottom: 12 }}>
            Wallet configurada
          </Text>

          <Text
            style={{
              color: "#51616F",
              fontSize: 16,
              lineHeight: 24,
              textAlign: "center",
              marginBottom: 28,
              maxWidth: 460,
            }}
          >
            Tu configuracion base fue guardada. Ahora ya puedes entrar al panel y continuar con el uso normal de
            Passio.
          </Text>

          <OnboardingNextButton
            label="Ir al dashboard"
            onPress={() => navigation.reset({ index: 0, routes: [{ name: "Dashboard" }] })}
            style={{ minWidth: 200 }}
          />
        </View>
      </View>
    </ScrollView>
  );
}

