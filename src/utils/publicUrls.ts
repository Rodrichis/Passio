const PUBLIC_APP_BASE_URL = "https://passio.cl/app";

export function getPublicAppBaseUrl() {
  return PUBLIC_APP_BASE_URL;
}

export function buildRegistrationUrl(empresaId?: string | null) {
  if (!empresaId) return "";
  return `${PUBLIC_APP_BASE_URL}/register/${empresaId}`;
}
