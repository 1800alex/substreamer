import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Cast, useCast } from 'react-native-queue-player';
import { castDirectName, castReceiversStore, fingerprintFromPinError } from '../../store/castReceiversStore';
import type { DiscoveryState, RouteInfo } from './types';

export interface UseRouteDiscoveryResult {
  /** All discovered receivers plus the local route, with isActive flags. */
  routes: RouteInfo[];
  /** Discovery scanning state for the sheet header spinner / banner. */
  state: DiscoveryState;
  /** True while at least one `connect()` is in flight. */
  isConnecting: boolean;
  /** Imperative `connect(receiverId)` with PIN/password retry support. */
  connect: (receiverId: string, password?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  /** Stops discovery (typically on sheet close). */
  stopDiscovery: () => Promise<void>;
  /** Raise the iOS Local Network prompt from the sheet. */
  requestPermission: () => Promise<void>;
}

/**
 * Wires RNQP's Cast discovery surface into a flat `RouteInfo[]` with isActive
 * markers + per-row connecting/error state. Starts discovery on mount and stops
 * it on unmount — so mounting this hook only while the picker sheet is open
 * keeps mDNS/multicast scanning scoped to when the user is looking.
 */
export function useRouteDiscovery(): UseRouteDiscoveryResult {
  const snapshot = useCast();
  /** Raise the system prompt. Safe to call again — iOS shows it once, and a repeat
   *  call just re-reads the answer. */
  const requestPermission = useCallback(async () => {
    try {
      await Cast.requestLocalNetworkPermission();
      await Cast.startDiscovery();
    } catch { /* the sheet reflects whatever state the probe settles on */ }
  }, []);
  const [connectingIds, setConnectingIds] = useState<Set<string>>(new Set());
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  /** Receiver ids in first-seen order. RNQP lists Chromecasts before AirPlay
   *  devices, so a late Chromecast would otherwise land above rows the user is
   *  about to tap; new devices go to the bottom instead. */
  const seenOrderRef = useRef<string[]>([]);

  useEffect(() => {
    // The probe is what resolves `permission` (discovery alone never does) and,
    // on iOS, what raises the system prompt on first use — here, where the user
    // is looking for devices. Android below target 37 is always granted.
    if (Cast.getLocalNetworkPermissionState() !== 'granted') {
      void requestPermission();
    }
    Cast.startDiscovery().catch(() => {});
    return () => {
      void Cast.stopDiscovery();
    };
  }, []);

  const state: DiscoveryState = useMemo(() => {
    if (snapshot.permission === 'denied') return 'permission-denied';
    // Asked but unanswered, or never asked: the user can still grant it from here, so
    // offer the prompt rather than a Settings link that leads nowhere useful.
    if (snapshot.permission === 'undetermined') return 'permission-pending';
    if (!snapshot.isAvailable) return 'error';
    return snapshot.isDiscovering ? 'scanning' : 'idle';
  }, [snapshot.permission, snapshot.isAvailable, snapshot.isDiscovering]);

  const routes: RouteInfo[] = useMemo(() => {
    const localRoute: RouteInfo = {
      id: '',
      protocol: 'local',
      protocolVersion: '',
      name: snapshot.route.castProtocol === 'local' ? snapshot.route.name : 'This phone',
      modelName: '',
      iconHint: 'phone',
      capabilities: {
        supportsRemoteVolume: false,
        streamingModel: 'pushPcm',
        requiresPairing: false,
      },
      isActive: snapshot.route.castProtocol === 'local',
      isConnecting: false,
    };

    const present = new Set(snapshot.receivers.map((r) => r.id));
    const order = seenOrderRef.current.filter((id) => present.has(id));
    for (const r of snapshot.receivers) if (!order.includes(r.id)) order.push(r.id);
    seenOrderRef.current = order;

    const remote: RouteInfo[] = snapshot.receivers.map((r) => ({
      id: r.id,
      protocol: r.castProtocol,
      protocolVersion: r.protocolVersion,
      name: r.name,
      modelName: r.modelName,
      iconHint: r.iconHint,
      capabilities: r.capabilities,
      isActive: snapshot.route.receiverId === r.id,
      isConnecting: connectingIds.has(r.id),
      lastError: errorById[r.id],
    }));
    remote.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));

    return [localRoute, ...remote];
  }, [snapshot.receivers, snapshot.route, connectingIds, errorById]);

  const connect = useCallback(
    async (receiverId: string, password?: string) => {
      setConnectingIds((prev) => new Set(prev).add(receiverId));
      setErrorById((prev) => {
        const { [receiverId]: _drop, ...rest } = prev;
        return rest;
      });
      try {
        // Self-hosted Cast receivers (`castdirect:`, from RNQP's own mDNS scan)
        // authenticate by certificate pin, which rides as the connect password.
        const directName = castDirectName(receiverId);
        const pin = directName != null ? castReceiversStore.getState().pins[directName] : undefined;
        const secret = password ?? pin;
        try {
          await Cast.connect(receiverId, secret ? { password: secret } : undefined);
        } catch (err) {
          // Trust on first use: an unpinned receiver rejects the empty pin with
          // the SHA-256 it presented. Reconnect pinned to it and keep it only
          // once that connect succeeds.
          const seen = directName != null && !pin ? fingerprintFromPinError(err) : null;
          if (!seen) throw err;
          await Cast.connect(receiverId, { password: seen });
          castReceiversStore.getState().pin(directName!, seen);
        }
      } catch (err) {
        const code =
          (err as { code?: string; name?: string })?.code ??
          (err as { name?: string })?.name ??
          'cast_connect_failed';
        setErrorById((prev) => ({ ...prev, [receiverId]: code }));
        throw err;
      } finally {
        setConnectingIds((prev) => {
          const next = new Set(prev);
          next.delete(receiverId);
          return next;
        });
      }
    },
    [],
  );

  const disconnect = useCallback(async () => {
    await Cast.disconnect();
  }, []);

  const stopDiscovery = useCallback(async () => {
    await Cast.stopDiscovery();
  }, []);

  return {
    routes,
    state,
    isConnecting: connectingIds.size > 0,
    connect,
    disconnect,
    stopDiscovery,
    requestPermission,
  };
}
