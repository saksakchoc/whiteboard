function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/g, "");
}

function firstForwardedValue(value) {
  return String(value || "").split(",")[0].trim();
}

function requestPublicBaseUrl(req, appBasePath, configuredBaseUrl = "") {
  const configured = trimTrailingSlash(configuredBaseUrl);
  if (/^https?:\/\//i.test(configured)) return configured;

  const forwardedProtocol = firstForwardedValue(req.get("x-forwarded-proto"));
  const protocol = /^(?:http|https)$/i.test(forwardedProtocol)
    ? forwardedProtocol.toLowerCase()
    : req.protocol;
  const forwardedHost = firstForwardedValue(req.get("x-forwarded-host"));
  const host = forwardedHost || req.get("host") || "localhost";
  return `${protocol}://${host}${appBasePath}`;
}

function absoluteResourceUrl(value, publicBaseUrl) {
  const text = String(value || "").trim();
  if (!text || /^(?:https?:|data:|blob:|mailto:|tel:|#)/i.test(text)) return text;
  try {
    const base = new URL(`${trimTrailingSlash(publicBaseUrl)}/`);
    if (text.startsWith("/")) return new URL(text, base.origin).href;
    return new URL(text, base).href;
  } catch (_error) {
    return text;
  }
}

function absoluteLinksInText(value, publicBaseUrl) {
  let text = String(value ?? "");
  text = text.replace(/(\]\(\s*)([^)\s]+)(\s*\))/g, (_match, before, link, after) => (
    `${before}${absoluteResourceUrl(link, publicBaseUrl)}${after}`
  ));
  text = text.replace(/((?:src|href)\s*=\s*["'])([^"']+)(["'])/gi, (_match, before, link, after) => (
    `${before}${absoluteResourceUrl(link, publicBaseUrl)}${after}`
  ));
  text = text.replace(/(^|[\s(])((?:\.\/)?uploads\/[^\s)"'<]+)/g, (_match, before, link) => (
    `${before}${absoluteResourceUrl(link, publicBaseUrl)}`
  ));
  text = text.replace(/(^|[\s(])(\/(?!\/)[^\s)"'<]+)/g, (_match, before, link) => (
    `${before}${absoluteResourceUrl(link, publicBaseUrl)}`
  ));
  return text;
}

function absolutizeSpecValue(value, publicBaseUrl, key = "") {
  if (Array.isArray(value)) {
    return value.map((entry) => absolutizeSpecValue(entry, publicBaseUrl, key));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) => (
      [entryKey, absolutizeSpecValue(entryValue, publicBaseUrl, entryKey)]
    )));
  }
  if (typeof value !== "string") return value;
  if (/(?:url|uri|src|href)$/i.test(key)) return absoluteResourceUrl(value, publicBaseUrl);
  return absoluteLinksInText(value, publicBaseUrl);
}

module.exports = {
  requestPublicBaseUrl,
  absoluteResourceUrl,
  absoluteLinksInText,
  absolutizeSpecValue,
};
