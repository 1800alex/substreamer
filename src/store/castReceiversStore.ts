import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { kvStorage } from './persistence';

/**
 * A self-hosted Cast receiver the user added by hand. Such receivers have no
 * Google device certificate, so the connection is trusted only when the
 * receiver's TLS certificate matches `fingerprint` (SHA-256, lowercase hex).
 */
export interface CastReceiverConfig {
  /** Native receiver id: `castdirect:<host>:<port>:<url-encoded name>`. */
  id: string;
  name: string;
  host: string;
  port: number;
  fingerprint: string;
}

export type NewCastReceiver = Omit<CastReceiverConfig, 'id'>;

/** Lowercase 64-char hex without separators, or null unless a full SHA-256. */
export function normalizeCastFingerprint(raw: string): string | null {
  const hex = raw.toLowerCase().replace(/[\s:]/g, '');
  return /^[0-9a-f]{64}$/.test(hex) ? hex : null;
}

export function castReceiverId(r: Pick<CastReceiverConfig, 'host' | 'port' | 'name'>): string {
  return `castdirect:${r.host}:${r.port}:${encodeURIComponent(r.name)}`;
}

interface CastReceiversState {
  receivers: CastReceiverConfig[];
  /** Add or replace (same host, port and name). Throws on an invalid fingerprint. */
  add: (receiver: NewCastReceiver) => void;
  remove: (id: string) => void;
}

export const castReceiversStore = create<CastReceiversState>()(
  persist(
    (set) => ({
      receivers: [],
      add: (receiver) => {
        const fingerprint = normalizeCastFingerprint(receiver.fingerprint);
        if (!fingerprint) throw new Error('Invalid certificate fingerprint');
        const name = receiver.name.trim();
        const host = receiver.host.trim();
        const entry: CastReceiverConfig = { ...receiver, name, host, fingerprint, id: castReceiverId({ ...receiver, name, host }) };
        set((s) => ({ receivers: [...s.receivers.filter((r) => r.id !== entry.id), entry] }));
      },
      remove: (id) => set((s) => ({ receivers: s.receivers.filter((r) => r.id !== id) })),
    }),
    {
      name: 'substreamer-cast-receivers',
      storage: createJSONStorage(() => kvStorage),
      partialize: (s) => ({ receivers: s.receivers }),
    },
  ),
);
