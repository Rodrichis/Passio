export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Dashboard: undefined;
  CompanyGate: undefined;
  WalletOnboardingIntro: undefined;
  WalletOnboardingSetup: undefined;
  WalletOnboardingDone: undefined;
  RegisterClient: { empresaId: string };
  VerifyEmail: { email?: string };
  ForgotPassword: undefined;
};

export default RootStackParamList;

