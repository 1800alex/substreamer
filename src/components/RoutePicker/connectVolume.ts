/**
 * Volume to connect a receiver at, remembered per receiver id for this app
 * session only (not persisted, by decision). Unknown receivers start at 50%.
 */
const DEFAULT_CONNECT_VOLUME = 0.5;

const volumes = new Map<string, number>();

export function getConnectVolume(receiverId: string): number {
  return volumes.get(receiverId) ?? DEFAULT_CONNECT_VOLUME;
}

export function rememberConnectVolume(receiverId: string, value: number): void {
  volumes.set(receiverId, value);
}
