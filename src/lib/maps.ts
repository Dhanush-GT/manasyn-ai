/**
 * Google Maps Platform configuration and validation utilities.
 * Complies with google-maps-platform skill requirements.
 */

export const GMP_ATTRIBUTION_ID = 'gmp_mcp_codeassist_v1_aistudio';

/**
 * Validates whether a provided API key is a plausibly valid Google Maps Platform key.
 * Prevents mounting @vis.gl/react-google-maps APIProvider with placeholder, test, or empty keys
 * which otherwise triggers Google Maps JavaScript API error: InvalidKeyMapError.
 */
export function isValidGoogleMapsKey(key: string | null | undefined): boolean {
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();

  // Valid Google Maps API keys are 39 characters starting with AIzaSy
  if (trimmed.length < 30) return false;

  // Detect and reject common test/mock/placeholder strings
  if (
    trimmed.includes('TEST') ||
    trimmed.includes('YOUR_') ||
    trimmed.includes('MY_') ||
    trimmed.includes('PLACEHOLDER') ||
    trimmed.includes('12345') ||
    trimmed.includes('EXAMPLE') ||
    trimmed === 'AIzaSy_TEST_KEY_12345'
  ) {
    return false;
  }

  return true;
}
