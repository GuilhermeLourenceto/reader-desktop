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
  ['fe80::', 10], ['ff00::', 8], ['::ffff:0:0', 96],
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
        host.endsWith(suffix)
    );
    if (localName || (ipVersion && denied.check(host, ipVersion === 4 ? 'ipv4' : 'ipv6')))
      throw new Error('Fontes não podem acessar endereços locais ou privados.');
  }
  return url.href;
}
module.exports = { validateNetworkUrl };
