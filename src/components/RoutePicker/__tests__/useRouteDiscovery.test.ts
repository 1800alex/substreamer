jest.mock('../../../store/persistence/kvStorage', () => require('../../../store/persistence/__mocks__/kvStorage'));

import { act, renderHook } from '@testing-library/react-native';

import { castReceiversStore } from '../../../store/castReceiversStore';
import { useRouteDiscovery } from '../useRouteDiscovery';

const rnqp = require('react-native-queue-player');

const GARAGE = '874a96ab4628f649e37176b35473642daf151d9f04b57bcc539d90fa81ba3824';
const ID = 'castdirect:192.168.1.17:8009:Garage%20Cast';

describe('useRouteDiscovery with saved Cast receivers', () => {
  beforeEach(() => {
    rnqp.__resetPlayerMock();
    rnqp.Cast.connect.mockClear();
    castReceiversStore.setState({ receivers: [] });
    castReceiversStore.getState().add({ name: 'Garage Cast', host: '192.168.1.17', port: 8009, fingerprint: GARAGE });
  });

  it('lists saved receivers as Cast rows', () => {
    const { result } = renderHook(() => useRouteDiscovery());
    const row = result.current.routes.find((r) => r.id === ID);
    expect(row).toMatchObject({ protocol: 'chromecast', name: 'Garage Cast', isActive: false });
    expect(row?.capabilities.requiresPairing).toBe(false);
  });

  it('marks the saved receiver active when it is the current route', () => {
    rnqp.__setCastSnapshot({ route: { castProtocol: 'chromecast', name: 'Garage Cast', receiverId: ID } });
    const { result } = renderHook(() => useRouteDiscovery());
    expect(result.current.routes.find((r) => r.id === ID)?.isActive).toBe(true);
  });

  it('connects with the saved fingerprint as the pin', async () => {
    const { result } = renderHook(() => useRouteDiscovery());
    await act(() => result.current.connect(ID));
    expect(rnqp.Cast.connect).toHaveBeenCalledWith(ID, { password: GARAGE });
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
    castReceiversStore.setState({ receivers: [] });
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
