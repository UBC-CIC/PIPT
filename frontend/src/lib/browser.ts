/**
 * Browser detection utilities.
 * Used for feature compatibility hints (e.g., WebRTC voice mode).
 */

/**
 * Returns true if the browser is Chromium-based (Chrome, Edge, Brave, Opera, Arc, etc.)
 * Voice mode (WebRTC) works best on Chromium browsers.
 */
export function isChromiumBrowser(): boolean {
  const ua = navigator.userAgent;
  // Chrome/Chromium-based browsers include "Chrome/" in UA but not "Edg/" false positive
  // Edge also works fine (Chromium-based) — it includes both "Chrome/" and "Edg/"
  return /Chrome\//.test(ua) || /CriOS\//.test(ua);
}

/**
 * Returns true if the browser is Firefox.
 */
export function isFirefox(): boolean {
  return /Firefox\//.test(navigator.userAgent) && !/Seamonkey\//.test(navigator.userAgent);
}

/**
 * Returns true if the browser supports WebRTC voice mode well.
 * Currently only Chromium-based browsers are fully supported.
 */
export function supportsVoiceMode(): boolean {
  return isChromiumBrowser();
}
