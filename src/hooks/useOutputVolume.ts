import { useCallback, useEffect, useRef, useState } from 'react';
import { Cast, useCast } from 'react-native-queue-player';
import { VolumeManager } from 'react-native-volume-manager';

/** Minimum gap between volume writes while a slider is dragged. */
const WRITE_INTERVAL_MS = 150;

export interface OutputVolume {
  /** Current volume, `0..1`. */
  volume: number;
  /** Update the volume; writes are throttled and the last value always lands. */
  setVolume: (value: number) => void;
  /** True while casting: the receiver's volume, not the device's, is controlled. */
  isRemote: boolean;
  /** Receiver name while casting, empty otherwise. */
  routeName: string;
}

const clamp = (v: number) => Math.min(1, Math.max(0, v));

function readRouteVolume(): number {
  const v = Cast.getRouteVolume();
  return Number.isFinite(v) ? clamp(v) : 1;
}

/**
 * Volume of whatever is playing: the device's system media volume on this
 * device (kept in sync with the hardware keys), the cast receiver's volume
 * while casting. AirPlay receivers never report theirs, so that is the last
 * value sent.
 */
export function useOutputVolume(): OutputVolume {
  const { route } = useCast();
  const isRemote = route.castProtocol !== 'local';
  const [volume, setVolumeState] = useState(() => (isRemote ? readRouteVolume() : 1));

  const lastWriteRef = useRef(0);
  const pendingRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRemoteRef = useRef(isRemote);
  isRemoteRef.current = isRemote;

  useEffect(() => {
    if (isRemote) {
      setVolumeState(readRouteVolume());
      return undefined;
    }
    let active = true;
    void VolumeManager.getVolume().then((r) => {
      if (active) setVolumeState(clamp(r.volume));
    });
    const sub = VolumeManager.addVolumeListener((r) => setVolumeState(clamp(r.volume)));
    return () => {
      active = false;
      sub.remove();
    };
  }, [isRemote, route.receiverId]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const write = useCallback((value: number) => {
    lastWriteRef.current = Date.now();
    pendingRef.current = null;
    void (isRemoteRef.current
      ? Cast.setRouteVolume(value)
      : VolumeManager.setVolume(value, { type: 'music', showUI: false }));
  }, []);

  const setVolume = useCallback(
    (value: number) => {
      const v = clamp(value);
      setVolumeState(v);
      const wait = WRITE_INTERVAL_MS - (Date.now() - lastWriteRef.current);
      if (wait <= 0 && !timerRef.current) {
        write(v);
        return;
      }
      pendingRef.current = v;
      if (!timerRef.current) {
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          if (pendingRef.current != null) write(pendingRef.current);
        }, Math.max(wait, 0));
      }
    },
    [write],
  );

  return { volume, setVolume, isRemote, routeName: isRemote ? route.name : '' };
}
