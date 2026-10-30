// Validate a URL before a source can send traffic through the privileged
// Electron network bridge. This deliberately does not restrict public domains:
// novels, CDNs and identity providers often use different hosts.
const { BlockList, isIP } = require('node:net');
const denied = new BlockList();
for (const [address, bits] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10],
  ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
]) denied.addSubnet(address, bits, 'ipv4');
for (const [address, bits] of [
  ['::', 128], ['::1', 128], ['fc00::', 7],
  ['fe80::', 10], ['ff00::', 8],
]) denied.addSubnet(address, bits, 'ipv6');

function validateNetworkUrl(value, { allowPrivate = false } = {}) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new Error('Endereço HTTP/HTTPS inválido.');
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) throw new Error('Host inválido.');
  if (!allowPrivate) {
    const ipVersion = isIP(host);
    const localName = !ipVersion && (
      !host.includes('.') ||
      host === 'localhost' ||
      ['.localhost', '.local', '.lan', '.internal', '.home.arpa'].some(suffix =>
        host.endsWith(suffix),
    ));
    if (localName || (ipVersion && denied.check(host, ipVersion === 4 ? 'ipv4' : 'ipv6')))
      throw new Error('Fontes não podem acessar endereços locais ou privados.');
  }
  return url.href;
}
// Validate every address returned by Chromium's resolver, not just the hostname.
// A mixed public/private answer is rejected in its entirety.
function validateResolvedAddresses(result) {
  // Electron 42 returns ResolvedHost.endpoints (ResolvedEndpoint[]).
  // Accept the older resolvedAddresses representation for compatibility.
  const addresses = result?.endpoints ?? result?.resolvedAddresses;
  if (!Array.isArray(addresses) || addresses.length === 0)
    throw new Error('Não foi possível validar o DNS da fonte.');
  for (const entry of addresses) {
    const ip = typeof entry === 'string' ? entry : entry?.address;
    const version = typeof ip === 'string' ? isIP(ip) : 0;
    if (!version || denied.check(ip, version === 4 ? 'ipv4' : 'ipv6'))
      throw new Error('O DNS da fonte retornou endereço local ou privado.');
  }
  return addresses;
}
async function validateNetworkDns(url, resolver, { allowPrivate = false } = {}) {
  const href = validateNetworkUrl(url, { allowPrivate });
  if (allowPrivate) return href;
  const hostname = new URL(href).hostname.replace(/^\[|\]$/g, '');
  if (isIP(hostname)) return href;
  if (typeof resolver !== 'function')
    throw new Error('Não foi possível validar o DNS da fonte.');
  const result = await resolver(hostname, { cacheUsage: 'disallowed' });
  validateResolvedAddresses(result);
  return href;
}
module.exports = { validateNetworkUrl, validateResolvedAddresses, validateNetworkDns };
