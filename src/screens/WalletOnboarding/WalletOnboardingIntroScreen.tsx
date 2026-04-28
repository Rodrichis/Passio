import React, { useMemo, useState } from "react";
import { ScrollView, Text, View, useWindowDimensions } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import OnboardingDots from "../../components/wallet-onboarding/OnboardingDots";
import OnboardingNextButton from "../../components/wallet-onboarding/OnboardingNextButton";
import OnboardingSlide from "../../components/wallet-onboarding/OnboardingSlide";
import { COLORS } from "../../styles/theme";
import { RootStackParamList } from "../../types/navigation";
import { WALLET_ONBOARDING_SLIDES } from "../../utils/walletOnboarding/slides";

type Props = NativeStackScreenProps<RootStackParamList, "WalletOnboardingIntro">;

export default function WalletOnboardingIntroScreen({ navigation }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const { width } = useWindowDimensions();
  const currentSlide = useMemo(() => WALLET_ONBOARDING_SLIDES[activeIndex], [activeIndex]);
  const isLastSlide = activeIndex === WALLET_ONBOARDING_SLIDES.length - 1;
  const canGoBack = activeIndex > 0;
  const isNarrow = width < 560;

  const handleNext = () => {
    if (isLastSlide) {
      navigation.navigate("WalletOnboardingSetup");
      return;
    }

    setActiveIndex((current) => Math.min(current + 1, WALLET_ONBOARDING_SLIDES.length - 1));
  };

  const handleBack = () => {
    if (!canGoBack) return;
    setActiveIndex((current) => Math.max(current - 1, 0));
  };

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <View
        style={{
          flex: 1,
          paddingHorizontal: isNarrow ? 14 : 24,
          paddingVertical: 40,
          backgroundColor: "#F5F8FA",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 760,
            backgroundColor: "#FFFFFF",
            borderRadius: 28,
            paddingHorizontal: isNarrow ? 16 : 24,
            paddingVertical: 32,
            borderWidth: 1,
            borderColor: "#E2ECF1",
          }}
        >
          <Text
            style={{
              color: COLORS.primary,
              fontSize: 13,
              fontWeight: "800",
              letterSpacing: 1,
              textTransform: "uppercase",
              textAlign: "center",
              marginBottom: 10,
            }}
          >
            Configuración de wallet
          </Text>

          <Text
            style={{
              color: COLORS.textDark,
              fontSize: isNarrow ? 28 : 32,
              fontWeight: "800",
              textAlign: "center",
              marginBottom: 16,
            }}
          >
            Activa tu programa de fidelizacion
          </Text>

          <Text
            style={{
              color: "#51616F",
              fontSize: 16,
              lineHeight: 24,
              textAlign: "center",
              maxWidth: 560,
              alignSelf: "center",
              marginBottom: 32,
            }}
          >
            Antes de usar Passio, configura el aspecto base de tu wallet. Esto define el color, los sellos y la
            cantidad de visitas necesarias para entregar un premio.
          </Text>

          <View
            style={{
              minHeight: 280,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 8,
            }}
          >
            <OnboardingSlide slide={currentSlide} />
          </View>

          <View style={{ marginTop: 20, marginBottom: 28 }}>
            <OnboardingDots total={WALLET_ONBOARDING_SLIDES.length} activeIndex={activeIndex} />
          </View>

          <View
            style={{
              flexDirection: isNarrow ? "column-reverse" : "row",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            {canGoBack ? (
              <OnboardingNextButton
                label="Atras"
                onPress={handleBack}
                iconName="arrow-back"
                iconPosition="left"
                variant="secondary"
                style={{ width: isNarrow ? "100%" : undefined, minWidth: isNarrow ? 0 : 132 }}
              />
            ) : isNarrow ? null : (
              <View style={{ minWidth: 132 }} />
            )}

            <OnboardingNextButton
              label={isLastSlide ? "Comenzar" : "Siguiente"}
              onPress={handleNext}
              style={{ width: isNarrow ? "100%" : undefined, minWidth: isNarrow ? 0 : 160 }}
            />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
