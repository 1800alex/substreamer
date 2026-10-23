import { act, renderHook } from '@testing-library/react-native';

import { useOutputVolume } from '../useOutputVolume';

const rnqp = require('react-native-queue-player');
const vm = require('react-native-volume-manager');

const airplay = { castProtocol: 'airplay', name: 'Garage', receiverId: 'airplay:garage' };

/** Settle the async system-volume read kicked off on mount. */
const flush = () => act(async () => {});

describe('useOutputVolume', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    rnqp.__resetPlayerMock();
    vm.__resetVolumeMock();
    rnqp.Cast.getRouteVolume.mockReset().mockReturnValue(NaN);
    rnqp.Cast.setRouteVolume.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('controls the system media volume while playing on this device', async () => {
    vm.__setSystemVolume(0.4);
    const { result } = renderHook(() => useOutputVolume());
    await flush();
    expect(result.current.isRemote).toBe(false);
    expect(result.current.volume).toBe(0.4);

    act(() => result.current.setVolume(0.7));
    act(() => jest.runAllTimers());
    expect(vm.VolumeManager.setVolume).toHaveBeenLastCalledWith(0.7, { type: 'music', showUI: false });
    expect(rnqp.Cast.setRouteVolume).not.toHaveBeenCalled();
    expect(rnqp.__trackPlayer.setVolume).not.toHaveBeenCalled();
  });

  it('follows hardware volume key changes on this device', async () => {
    const { result } = renderHook(() => useOutputVolume());
    await flush();
    act(() => vm.__emitVolume(0.2));
    expect(result.current.volume).toBe(0.2);
  });

  it('controls the receiver volume while casting', async () => {
    rnqp.__setCastSnapshot({ route: airplay });
    rnqp.Cast.getRouteVolume.mockReturnValue(2 / 3);
    const { result } = renderHook(() => useOutputVolume());
    await flush();
    expect(result.current.isRemote).toBe(true);
    expect(result.current.routeName).toBe('Garage');
    expect(result.current.volume).toBeCloseTo(2 / 3);

    act(() => result.current.setVolume(0.9));
    act(() => jest.runAllTimers());
    expect(rnqp.Cast.setRouteVolume).toHaveBeenLastCalledWith(0.9);
    expect(vm.VolumeManager.setVolume).not.toHaveBeenCalled();
  });

  it('ignores system volume key changes while casting', async () => {
    rnqp.__setCastSnapshot({ route: airplay });
    rnqp.Cast.getRouteVolume.mockReturnValue(2 / 3);
    const { result } = renderHook(() => useOutputVolume());
    await flush();
    act(() => vm.__emitVolume(0.1));
    expect(result.current.volume).toBeCloseTo(2 / 3);
  });

  it('coalesces a drag into few receiver writes and always sends the final value', async () => {
    rnqp.__setCastSnapshot({ route: airplay });
    const { result } = renderHook(() => useOutputVolume());
    await flush();
    act(() => {
      for (let i = 1; i <= 20; i++) result.current.setVolume(i / 20);
    });
    act(() => jest.runAllTimers());
    expect(rnqp.Cast.setRouteVolume.mock.calls.length).toBeLessThan(5);
    expect(rnqp.Cast.setRouteVolume).toHaveBeenLastCalledWith(1);
    expect(result.current.volume).toBe(1);
  });

  it('shows full volume when the receiver has not reported one', async () => {
    rnqp.__setCastSnapshot({ route: airplay });
    const { result } = renderHook(() => useOutputVolume());
    await flush();
    expect(result.current.volume).toBe(1);
  });
});
