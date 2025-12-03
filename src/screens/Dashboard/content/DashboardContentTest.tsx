import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from "react-native";
import {
  createWalletObject,
  signWalletObject,
  type WalletApiResponse,
} from "../../../services/apiWallet";

export default function DashboardContentTest() {
  const [createRes, setCreateRes] = useState<WalletApiResponse | null>(null);
  const [signRes, setSignRes] = useState<WalletApiResponse | null>(null);
  const [display, setDisplay] = useState<string>("Cargando...");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const testCall = async () => {
      setLoading(true);
      try {
        const create = await createWalletObject({
          classId: "loyalty-class3-test",
          idUsuario: "tRQ11QOobd4m4BWSG1m0",
          nombreUsuario: "rodrigo test",
        });

        setCreateRes(create);

        let sign: WalletApiResponse | null = null;
        if (create.ok) {
          sign = await signWalletObject({ idUsuario: "tRQ11QOobd4m4BWSG1m0" });
          setSignRes(sign);
        } else {
          setSignRes(null);
        }

        setDisplay(
          JSON.stringify(
            {
              create,
              sign,
            },
            null,
            2
          )
        );
      } catch (err) {
        setDisplay(`Error: ${String(err)}`);
        setCreateRes(null);
        setSignRes(null);
      }

      setLoading(false);
    };

    testCall();
  }, []);

  const saveUrl =
    signRes &&
    signRes.data &&
    typeof signRes.data === "object" &&
    (signRes.data.saveUrl || signRes.data.addToWalletUrl || signRes.data.url);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Prueba API Wallet - Test</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#023047" />
      ) : (
        <Text style={styles.result} selectable>
          {display}
        </Text>
      )}

      {!!saveUrl && (
        <TouchableOpacity
          style={[styles.button, { opacity: loading ? 0.6 : 1 }]}
          onPress={() => Linking.openURL(saveUrl)}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Agregar a mi billetera</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f5f5f5",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    color: "#023047",
  },
  result: {
    fontSize: 14,
    color: "#333",
    backgroundColor: "#e0f2f1",
    padding: 12,
    borderRadius: 8,
  },
  button: {
    marginTop: 16,
    backgroundColor: "#023047",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
