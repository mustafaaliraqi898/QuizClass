import os from 'node:os';
import QRCode from 'qrcode';
import type { NetworkAddressOption } from '../../src/types/liveSession.ts';

const VIRTUAL_INTERFACE_PATTERNS = [
  /^lo$/i,
  /^docker/i,
  /^veth/i,
  /^br-/i,
  /^virbr/i,
  /^vmnet/i,
  /^vbox/i,
  /^utun/i,
  /^tun/i,
  /^tap/i,
  /^wg/i,
  /^tailscale/i,
  /^ham/i,
  /wsl/i,
  /hyper-v/i,
  /virtual/i,
];

const PREFERRED_LAN_INTERFACE_PATTERNS = [
  /^wi-?fi/i,
  /^wlan/i,
  /^wlp/i,
  /^en\d*$/i,
  /^eth\d*$/i,
  /^enp/i,
  /^ethernet/i,
];

interface RawInterfaceCandidate {
  interfaceName: string;
  ip: string;
  isVirtual: boolean;
  score: number;
  label: string;
}

function isPrivateLanIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 10) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  return false;
}

function isLinkLocalIpv4(ip: string): boolean {
  return ip.startsWith('169.254.');
}

function scoreInterface(name: string, ip: string): {
  isVirtual: boolean;
  score: number;
  label: string;
} {
  const isVirtualName = VIRTUAL_INTERFACE_PATTERNS.some((re) => re.test(name));
  const isLinkLocal = isLinkLocalIpv4(ip);
  const isVirtual = isVirtualName || isLinkLocal;

  let score = 0;
  if (!isVirtual) score += 100;
  if (isPrivateLanIpv4(ip)) score += 50;
  if (ip.startsWith('192.168.')) score += 20;
  if (PREFERRED_LAN_INTERFACE_PATTERNS.some((re) => re.test(name))) score += 25;
  if (isLinkLocal) score -= 80;

  let label = `واجهة الشبكة (${name})`;
  if (/wi-?fi|wlan|wlp/i.test(name)) {
    label = `شبكة Wi-Fi المحلية (${name})`;
  } else if (/eth|enp|en\d|ethernet/i.test(name)) {
    label = `الشبكة السلكية / المحلية (${name})`;
  } else if (isVirtual) {
    label = `واجهة افتراضية (${name})`;
  }

  return { isVirtual, score, label };
}

export function discoverLanIpv4Addresses(): RawInterfaceCandidate[] {
  const interfaces = os.networkInterfaces();
  const candidates: RawInterfaceCandidate[] = [];
  const seenIps = new Set<string>();

  for (const [interfaceName, records] of Object.entries(interfaces)) {
    if (!records) continue;
    for (const record of records) {
      const family = String(record.family);
      if ((family !== 'IPv4' && family !== '4') || record.internal) {
        continue;
      }
      if (!record.address || seenIps.has(record.address)) {
        continue;
      }
      seenIps.add(record.address);
      const { isVirtual, score, label } = scoreInterface(interfaceName, record.address);
      candidates.push({
        interfaceName,
        ip: record.address,
        isVirtual,
        score,
        label,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score || a.ip.localeCompare(b.ip));
  return candidates;
}

export function buildJoinUrl(origin: string, pinCode: string): string {
  const normalizedOrigin = origin.replace(/\/+$/, '');
  return `${normalizedOrigin}/join?pin=${encodeURIComponent(pinCode)}`;
}

function isLoopbackHost(hostname: string): boolean {
  const clean = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  return clean === 'localhost' || clean === '127.0.0.1' || clean === '::1';
}

export async function generateQrDataUrl(targetUrl: string): Promise<string> {
  return QRCode.toDataURL(targetUrl, {
    width: 320,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });
}

export async function resolveSessionNetworkOptions(options: {
  pinCode: string;
  port: number;
  requestOrigin?: string | null;
}): Promise<{
  networkAddresses: NetworkAddressOption[];
  primaryJoinUrl: string;
  primaryQrDataUrl: string;
}> {
  const { pinCode, port, requestOrigin } = options;
  const rawLanCandidates = discoverLanIpv4Addresses();
  const entries: Array<Omit<NetworkAddressOption, 'qrDataUrl'>> = [];

  for (const candidate of rawLanCandidates) {
    const joinUrl = buildJoinUrl(`http://${candidate.ip}:${port}`, pinCode);
    entries.push({
      interfaceName: candidate.interfaceName,
      ip: candidate.ip,
      port,
      joinUrl,
      isPrimary: false,
      isVirtual: candidate.isVirtual,
      label: candidate.label,
    });
  }

  // Only include a non-loopback request origin (e.g., HTTPS preview proxy or LAN hostname) as a selectable option;
  // NEVER default to localhost when a LAN IPv4 address is available.
  if (requestOrigin) {
    try {
      const parsed = new URL(requestOrigin);
      if (
        (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
        !isLoopbackHost(parsed.hostname) &&
        !entries.some((e) => e.ip === parsed.hostname && String(e.port) === (parsed.port || (parsed.protocol === 'https:' ? '443' : '80')))
      ) {
        const originPort = parsed.port
          ? Number(parsed.port)
          : parsed.protocol === 'https:'
            ? 443
            : 80;
        const joinUrl = buildJoinUrl(parsed.origin, pinCode);
        entries.push({
          interfaceName: parsed.protocol === 'https:' ? 'preview-proxy' : 'request-host',
          ip: parsed.hostname,
          port: originPort,
          joinUrl,
          isPrimary: false,
          isVirtual: false,
          label:
            parsed.protocol === 'https:'
              ? `عنوان المعاينة الحالي (${parsed.hostname})`
              : `العنوان الحالي (${parsed.hostname})`,
        });
      }
    } catch {
      // Ignore invalid request origin
    }
  }

  // Fallback only if zero non-loopback interfaces exist at all
  if (entries.length === 0) {
    const fallbackOrigin = requestOrigin || `http://127.0.0.1:${port}`;
    entries.push({
      interfaceName: 'fallback',
      ip: '127.0.0.1',
      port,
      joinUrl: buildJoinUrl(fallbackOrigin, pinCode),
      isPrimary: true,
      isVirtual: true,
      label: 'عنوان محلي مؤقت (لم يُكتشف اتصال Wi-Fi/LAN خارجي)',
    });
  } else {
    // Prefer non-virtual private LAN IP first; otherwise first entry
    const primaryIndex = entries.findIndex((e) => !e.isVirtual && e.interfaceName !== 'preview-proxy');
    const chosenIndex = primaryIndex >= 0 ? primaryIndex : 0;
    entries[chosenIndex].isPrimary = true;
    if (chosenIndex > 0) {
      const [primary] = entries.splice(chosenIndex, 1);
      entries.unshift(primary);
    }
  }

  const networkAddresses: NetworkAddressOption[] = await Promise.all(
    entries.map(async (entry) => ({
      ...entry,
      qrDataUrl: await generateQrDataUrl(entry.joinUrl),
    }))
  );

  const primary = networkAddresses[0];
  return {
    networkAddresses,
    primaryJoinUrl: primary.joinUrl,
    primaryQrDataUrl: primary.qrDataUrl,
  };
}
