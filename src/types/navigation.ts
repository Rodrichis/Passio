export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Dashboard: undefined;
  RegisterClient: { empresaId: string }; 
  VerifyEmail: { email?: string };
  ForgotPassword: undefined;
};



export default RootStackParamList;  
