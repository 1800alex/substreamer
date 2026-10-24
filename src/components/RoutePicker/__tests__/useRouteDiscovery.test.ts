jest.mock('../../../store/persistence/kvStorage', () => require('../../../store/persistence/__mocks__/kvStorage'));

import { act, renderHook } from '@testing-library/react-native';

import { castReceiversStore } from '../../../store/castReceiversStore';
import { useRouteDiscovery } from '../useRouteDiscovery';

const rnqp = require('react-native-queue-player');

const GARAGE = '874a96ab4628f649e37176b35473642daf151d9f04b57bcc539d90fa81ba3824';
const ID = 'castdirect:192.168.1.17:8009:Garage%20Cast';

describe('useRouteDiscovery with self-hosted Cast receivers', () => {
  const mismatch = (seen: string) =>
    new Error(`Receiver certificate SHA-256 ${seen} does not match the saved fingerprint`);
  const pins = () => castReceiversStore.getState().pins;

  beforeEach(() => {
    rnqp.__resetPlayerMock();
    rnqp.Cast.connect.mockReset().mockResolvedValue(undefined);
    castReceiversStore.setState({ pins: {} });
  });

  it('connects with the pinned fingerprint', async () => {
    castReceiversStore.getState().pin('Garage Cast', GARAGE);
    const { result } = renderHook(() => useRouteDiscovery());
    await act(() => result.current.connect(ID));
    expect(rnqp.Cast.connect).toHaveBeenCalledTimes(1);
    expect(rnqp.Cast.connect).toHaveBeenCalledWith(ID, { password: GARAGE });
  });

  it('pins the certificate the receiver presents on the first connect', async () => {
    rnqp.Cast.connect.mockRejectedValueOnce(mismatch(GARAGE));
    const { result } = renderHook(() => useRouteDiscovery());
    await act(() => result.current.connect(ID));
    expect(rnqp.Cast.connect).toHaveBeenNthCalledWith(1, ID, undefined);
    expect(rnqp.Cast.connect).toHaveBeenNthCalledWith(2, ID, { password: GARAGE });
    expect(pins()).toEqual({ 'Garage Cast': GARAGE });
  });

  it('saves nothing when the pinned retry fails', async () => {
    rnqp.Cast.connect.mockRejectedValueOnce(mismatch(GARAGE)).mockRejectedValueOnce(new Error('Connection reset'));
    const { result } = renderHook(() => useRouteDiscovery());
    await expect(act(() => result.current.connect(ID))).rejects.toThrow('Connection reset');
    expect(pins()).toEqual({});
  });

  it('never re-pins a receiver that already has a fingerprint', async () => {
    castReceiversStore.getState().pin('Garage Cast', GARAGE);
    rnqp.Cast.connect.mockRejectedValueOnce(mismatch('ab'.repeat(32)));
    const { result } = renderHook(() => useRouteDiscovery());
    await expect(act(() => result.current.connect(ID))).rejects.toThrow('does not match');
    expect(rnqp.Cast.connect).toHaveBeenCalledTimes(1);
    expect(pins()).toEqual({ 'Garage Cast': GARAGE });
  });

  it('does not pin for receivers other than castdirect ones', async () => {
    rnqp.Cast.connect.mockRejectedValueOnce(mismatch(GARAGE));
    const { result } = renderHook(() => useRouteDiscovery());
    await expect(act(() => result.current.connect('chromecast:abc'))).rejects.toThrow('does not match');
    expect(rnqp.Cast.connect).toHaveBeenCalledTimes(1);
    expect(pins()).toEqual({});
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
