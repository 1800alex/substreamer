jest.mock('../../../store/persistence/kvStorage', () => require('../../../store/persistence/__mocks__/kvStorage'));

import { act, renderHook } from '@testing-library/react-native';

import { castReceiversStore } from '../../../store/castReceiversStore';
import { useRouteDiscovery } from '../useRouteDiscovery';

const rnqp = require('react-native-queue-player');

const GARAGE = '874a96ab4628f649e37176b35473642daf151d9f04b57bcc539d90fa81ba3824';
const ID = 'castdirect:192.168.1.17:8009:Garage%20Cast';

/** Runs a connect inside act and returns its rejection (if any), keeping the renderer mounted. */
async function attempt(
  result: { current: { connect: (id: string, password?: string) => Promise<void> } },
  id: string,
  password?: string,
): Promise<unknown> {
  let error: unknown;
  await act(async () => {
    await result.current.connect(id, password).catch((e: unknown) => {
      error = e;
    });
  });
  return error;
}

describe('useRouteDiscovery with self-hosted Cast receivers', () => {
  const OTHER = 'ab'.repeat(32);
  const mismatch = (seen: string) =>
    new Error(`Receiver certificate SHA-256 ${seen} does not match the saved fingerprint`);
  const pins = () => castReceiversStore.getState().pins;
  const row = (result: { current: ReturnType<typeof useRouteDiscovery> }) =>
    result.current.routes.find((r) => r.id === ID);

  beforeEach(() => {
    rnqp.__resetPlayerMock();
    rnqp.Cast.connect.mockReset().mockResolvedValue(undefined);
    castReceiversStore.setState({ pins: {} });
    rnqp.__setCastSnapshot({
      receivers: [{
        id: ID, castProtocol: 'chromecast', protocolVersion: '', name: 'Garage Cast', modelName: '', iconHint: 'speaker',
        capabilities: { supportsRemoteVolume: true, streamingModel: 'pullUrl', requiresPairing: false },
      }],
    });
  });

  it('connects with the pinned fingerprint', async () => {
    castReceiversStore.getState().pin('Garage Cast', GARAGE);
    const { result } = renderHook(() => useRouteDiscovery());
    await act(() => result.current.connect(ID));
    expect(rnqp.Cast.connect).toHaveBeenCalledTimes(1);
    expect(rnqp.Cast.connect).toHaveBeenCalledWith(ID, { password: GARAGE });
  });

  it('asks before trusting a receiver it has not seen, and saves nothing yet', async () => {
    rnqp.Cast.connect.mockRejectedValueOnce(mismatch(GARAGE));
    const { result } = renderHook(() => useRouteDiscovery());
    expect(await attempt(result, ID)).toMatchObject({ code: 'cast_trust_required' });
    expect(rnqp.Cast.connect).toHaveBeenCalledTimes(1);
    expect(rnqp.Cast.connect).toHaveBeenCalledWith(ID, undefined);
    expect(row(result)).toMatchObject({ trust: { fingerprint: GARAGE, changed: false }, lastError: 'cast_trust_required' });
    expect(pins()).toEqual({});
  });

  it('pins the fingerprint the user accepted once that connect succeeds', async () => {
    rnqp.Cast.connect.mockRejectedValueOnce(mismatch(GARAGE));
    const { result } = renderHook(() => useRouteDiscovery());
    expect(await attempt(result, ID)).toBeTruthy();
    await act(() => result.current.connect(ID, GARAGE));
    expect(rnqp.Cast.connect).toHaveBeenLastCalledWith(ID, { password: GARAGE });
    expect(pins()).toEqual({ 'Garage Cast': GARAGE });
    expect(row(result)?.trust).toBeUndefined();
  });

  it('saves nothing when the accepted connect fails', async () => {
    rnqp.Cast.connect.mockRejectedValueOnce(new Error('Connection reset'));
    const { result } = renderHook(() => useRouteDiscovery());
    expect(String(await attempt(result, ID, GARAGE))).toContain('Connection reset');
    expect(pins()).toEqual({});
  });

  it('asks again, as a change, when a pinned receiver presents another certificate', async () => {
    castReceiversStore.getState().pin('Garage Cast', GARAGE);
    rnqp.Cast.connect.mockRejectedValueOnce(mismatch(OTHER));
    const { result } = renderHook(() => useRouteDiscovery());
    expect(await attempt(result, ID)).toMatchObject({ code: 'cast_trust_required' });
    expect(row(result)?.trust).toEqual({ fingerprint: OTHER, changed: true });
    expect(pins()).toEqual({ 'Garage Cast': GARAGE });
    await act(() => result.current.connect(ID, OTHER));
    expect(pins()).toEqual({ 'Garage Cast': OTHER });
  });

  it('asks about the new certificate if it changed after the user accepted one', async () => {
    rnqp.Cast.connect.mockRejectedValueOnce(mismatch(OTHER));
    const { result } = renderHook(() => useRouteDiscovery());
    expect(await attempt(result, ID, GARAGE)).toMatchObject({ code: 'cast_trust_required' });
    expect(row(result)?.trust).toEqual({ fingerprint: OTHER, changed: false });
    expect(pins()).toEqual({});
  });

  it('never asks for receivers other than castdirect ones', async () => {
    rnqp.Cast.connect.mockRejectedValueOnce(mismatch(GARAGE));
    const { result } = renderHook(() => useRouteDiscovery());
    expect(String(await attempt(result, 'chromecast:abc'))).toContain('does not match');
    expect(pins()).toEqual({});
  });
});

describe('useRouteDiscovery with MPD servers', () => {
  const MPD = 'mpd:192.168.1.17:6600:Music%20Player%20%40%20alex-garage';

  beforeEach(() => {
    rnqp.__resetPlayerMock();
    rnqp.Cast.connect.mockReset().mockResolvedValue(undefined);
    castReceiversStore.setState({ pins: {} });
    rnqp.__setCastSnapshot({
      receivers: [{
        id: MPD, castProtocol: 'chromecast', protocolVersion: '', name: 'Music Player @ alex-garage', modelName: 'MPD',
        iconHint: 'speaker', capabilities: { supportsRemoteVolume: true, streamingModel: 'pullUrl', requiresPairing: false },
      }],
    });
  });

  it('lists them as MPD rows and connects without a pin', async () => {
    const { result } = renderHook(() => useRouteDiscovery());
    expect(result.current.routes.find((r) => r.id === MPD)?.protocol).toBe('mpd');
    await act(() => result.current.connect(MPD));
    expect(rnqp.Cast.connect).toHaveBeenCalledWith(MPD, undefined);
  });
});

describe('useRouteDiscovery row order', () => {
  const receiver = (id: string, castProtocol: 'airplay' | 'chromecast') => ({
    id,
    castProtocol,
    protocolVersion: '',
    name: id,
    modelName: '',
    iconHint: 'speaker',
    capabilities: { supportsRemoteVolume: true, streamingModel: 'pushPcm', requiresPairing: false },
  });
  const remoteIds = (routes: { id: string }[]) => routes.filter((r) => r.id.length > 0).map((r) => r.id);

  beforeEach(() => {
    rnqp.__resetPlayerMock();
    castReceiversStore.setState({ pins: {} });
  });

  it('adds a late receiver at the bottom even when RNQP lists it first', () => {
    // RNQP publishes chromecastReceivers + airplayReceivers, so a late Chromecast
    // arrives ahead of every AirPlay device.
    rnqp.__setCastSnapshot({ receivers: [receiver('airplay:a', 'airplay')] });
    const { result, rerender } = renderHook(() => useRouteDiscovery());
    rnqp.__setCastSnapshot({
      receivers: [receiver('chromecast:c', 'chromecast'), receiver('airplay:a', 'airplay')],
    });
    rerender({});
    expect(remoteIds(result.current.routes)).toEqual(['airplay:a', 'chromecast:c']);
  });

  it('keeps the remaining rows in place when a receiver disappears', () => {
    rnqp.__setCastSnapshot({
      receivers: [receiver('airplay:a', 'airplay'), receiver('airplay:b', 'airplay')],
    });
    const { result, rerender } = renderHook(() => useRouteDiscovery());
    rnqp.__setCastSnapshot({
      receivers: [receiver('chromecast:c', 'chromecast'), receiver('airplay:a', 'airplay'), receiver('airplay:b', 'airplay')],
    });
    rerender({});
    rnqp.__setCastSnapshot({
      receivers: [receiver('chromecast:c', 'chromecast'), receiver('airplay:b', 'airplay')],
    });
    rerender({});
    expect(remoteIds(result.current.routes)).toEqual(['airplay:b', 'chromecast:c']);
  });
});
