import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { kvStorage } from './persistence';

/**
 * Certificate pins for self-hosted Cast receivers. RNQP finds them with its
 * own `_googlecast._tcp` mDNS scan (they have no Google device certificate, so
 * the Cast SDK never lists them) and reports them as `castdirect:` receivers.
 * The first connect trusts whatever certificate the receiver presents and
 * pins its SHA-256 here, keyed by receiver name so a new IP address keeps the
 * pin; later connects only succeed while the certificate matches.
 */
const DIRECT_PREFIX = 'castdirect:';

/** Lowercase 64-char hex without separators, or null unless a full SHA-256. */
export function normalizeCastFingerprint(raw: string): string | null {
  const hex = raw.toLowerCase().replace(/[\s:]/g, '');
  return /^[0-9a-f]{64}$/.test(hex) ? hex : null;
}

/** The receiver name in `castdirect:<host>:<port>:<url-encoded name>`, or null. */
export function castDirectName(receiverId: string): string | null {
  if (!receiverId.startsWith(DIRECT_PREFIX)) return null;
  const encoded = receiverId.slice(DIRECT_PREFIX.length).split(':')[2];
  if (!encoded) return null;
  try {
    return decodeURIComponent(encoded.replace(/\+/g, ' '));
  } catch {
    return null;
  }
}

/**
 * The certificate SHA-256 a receiver presented, read from RNQP's native pin
 * mismatch error ("Receiver certificate SHA-256 <hex> does not match the saved
 * fingerprint", CastChannel.open). Null for any other error.
 */
export function fingerprintFromPinError(err: unknown): string | null {
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  const match = /certificate SHA-256 ([0-9a-f]{64}) does not match/i.exec(message);
  return match ? match[1].toLowerCase() : null;
}

interface CastReceiversState {
  /** Receiver name → pinned certificate SHA-256 (lowercase hex). */
  pins: Record<string, string>;
  /** Pin `fingerprint` for receiver `name`. Throws on an invalid fingerprint. */
  pin: (name: string, fingerprint: string) => void;
  /** Drop the pin so the next connect trusts the receiver again. */
  forget: (name: string) => void;
}

/** v0 stored hand-added receivers; keep the fingerprints that were set. */
export function migrateCastReceivers(persisted: unknown, version: number): Pick<CastReceiversState, 'pins'> {
  const pins: Record<string, string> = {};
  if (version === 0) {
    const old = (persisted as { receivers?: { name?: string; fingerprint?: string }[] } | undefined)?.receivers ?? [];
    for (const r of old) {
      const fingerprint = normalizeCastFingerprint(r.fingerprint ?? '');
      if (r.name && fingerprint) pins[r.name] = fingerprint;
    }
    return { pins };
  }
  return { pins: (persisted as { pins?: Record<string, string> } | undefined)?.pins ?? pins };
}

export const castReceiversStore = create<CastReceiversState>()(
  persist(
    (set) => ({
      pins: {},
      pin: (name, raw) => {
        const fingerprint = normalizeCastFingerprint(raw);
        if (!fingerprint) throw new Error('Invalid certificate fingerprint');
        set((s) => ({ pins: { ...s.pins, [name]: fingerprint } }));
      },
      forget: (name) =>
        set((s) => {
          const { [name]: _drop, ...pins } = s.pins;
          return { pins };
        }),
    }),
    {
      name: 'substreamer-cast-receivers',
      version: 1,
      migrate: migrateCastReceivers as (persisted: unknown, version: number) => CastReceiversState,
      storage: createJSONStorage(() => kvStorage),
      partialize: (s) => ({ pins: s.pins }),
    },
  ),
);
