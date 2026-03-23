const PUBLIC_SITE_BASE_URL = "https://passio.cl";

export function getPublicAppBaseUrl() {
  return PUBLIC_SITE_BASE_URL;
}

export function buildRegistrationUrl(empresaId?: string | null) {
  if (!empresaId) return "";
  return `${PUBLIC_SITE_BASE_URL}/register/${empresaId}`;
}
