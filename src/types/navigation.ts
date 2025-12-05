export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Dashboard: undefined;
  RegisterClient: { empresaId: string }; 
  VerifyEmail: { email?: string };
};



export default RootStackParamList;  
