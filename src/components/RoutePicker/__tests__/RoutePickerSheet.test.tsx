jest.mock('../../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      primary: '#ff6600',
      textPrimary: '#ffffff',
      textSecondary: '#888888',
      border: '#333333',
      card: '#1e1e1e',
      inputBg: '#2a2a2a',
    },
  }),
}));

// Passthrough BottomSheet: renders children only while visible (mirrors the
// real primitive's unmount-when-hidden behaviour) without gesture-handler.
jest.mock('../../BottomSheet', () => {
  const { View } = require('react-native');
  return {
    BottomSheet: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
      visible ? <View testID="bottom-sheet">{children}</View> : null,
  };
});

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { listeningOnLabel } from '../copy';
import { RoutePickerSheet } from '../RoutePickerSheet';
import { useRoutePickerStore } from '../useRoutePickerStore';

const rnqp = require('react-native-queue-player');

/** Settle the discovery promise that the mounted content kicks off on mount. */
const flush = () => act(async () => {});

describe('RoutePickerSheet', () => {
  beforeEach(() => {
    rnqp.Cast.startDiscovery.mockClear();
    rnqp.Cast.stopDiscovery.mockClear();
    rnqp.Cast.requestLocalNetworkPermission.mockClear();
    rnqp.Cast.getLocalNetworkPermissionState.mockReturnValue('granted');
    rnqp.__setCastSnapshot({});
    act(() => useRoutePickerStore.getState().close());
  });

  it('renders nothing while closed', async () => {
    render(<RoutePickerSheet />);
    expect(screen.queryByTestId('bottom-sheet')).toBeNull();
    expect(rnqp.Cast.startDiscovery).not.toHaveBeenCalled();
    await flush();
  });

  it('mounts the picker content and starts discovery when opened', async () => {
    act(() => useRoutePickerStore.getState().open());
    render(<RoutePickerSheet />);
    expect(screen.getByTestId('bottom-sheet')).toBeTruthy();
    expect(screen.getByText(listeningOnLabel())).toBeTruthy();
    // Discovery is scoped to the open sheet (mounted inner content only).
    expect(rnqp.Cast.startDiscovery).toHaveBeenCalled();
    // Already granted: no probe (and no prompt) needed.
    expect(rnqp.Cast.requestLocalNetworkPermission).not.toHaveBeenCalled();
    await flush();
  });

  it('runs the local-network probe when the permission is not yet granted', async () => {
    rnqp.Cast.getLocalNetworkPermissionState.mockReturnValue('undetermined');
    act(() => useRoutePickerStore.getState().open());
    render(<RoutePickerSheet />);
    expect(rnqp.Cast.requestLocalNetworkPermission).toHaveBeenCalledTimes(1);
    await flush();
  });

  it('explains the denied state and offers Open Settings & Allow when local network is denied', async () => {
    rnqp.__setCastSnapshot({ permission: 'denied' });
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    act(() => useRoutePickerStore.getState().open());
    render(<RoutePickerSheet />);
    expect(screen.getByText('Local Network Permission has not been granted.')).toBeTruthy();
    expect(
      screen.getByText('Substreamer needs this to be able to find Chromecast receivers on your network.'),
    ).toBeTruthy();
    expect(screen.getByText('Open Settings & Allow')).toBeTruthy();
    fireEvent.press(screen.getByTestId('route-picker-open-settings'));
    expect(openSettings).toHaveBeenCalledTimes(1);
    openSettings.mockRestore();
    await flush();
  });

  it('stops discovery when the sheet closes (content unmounts)', async () => {
    act(() => useRoutePickerStore.getState().open());
    const { rerender } = render(<RoutePickerSheet />);
    expect(rnqp.Cast.startDiscovery).toHaveBeenCalled();
    act(() => useRoutePickerStore.getState().close());
    rerender(<RoutePickerSheet />);
    expect(rnqp.Cast.stopDiscovery).toHaveBeenCalled();
    await flush();
  });

  it('offers the in-app prompt, not Settings, when permission was never asked', async () => {
    // iOS only lists an app under Privacy > Local Network once it has ASKED. Sending an
    // un-asked user to Settings lands them on a screen with no entry to toggle.
    rnqp.Cast.getLocalNetworkPermissionState.mockReturnValue('undetermined');
    rnqp.__setCastSnapshot({ permission: 'undetermined' });
    act(() => useRoutePickerStore.getState().open());
    render(<RoutePickerSheet />);

    expect(screen.queryByTestId('route-picker-open-settings')).toBeNull();
    fireEvent.press(screen.getByTestId('route-picker-request-permission'));
    expect(rnqp.Cast.requestLocalNetworkPermission).toHaveBeenCalled();
    await flush();
  });
});

describe('RoutePickerSheet device detail', () => {
  // Chromecast: the suite runs as iOS, where idle AirPlay rows are left to the
  // system picker.
  const tv = {
    id: 'chromecast:tv',
    castProtocol: 'chromecast',
    protocolVersion: '',
    name: 'Den TV',
    modelName: '',
    iconHint: 'tv',
    capabilities: { supportsRemoteVolume: true, streamingModel: 'pushPcm', requiresPairing: false },
  };

  beforeEach(() => {
    jest.useFakeTimers();
    rnqp.Cast.connect.mockClear();
    rnqp.Cast.disconnect.mockClear();
    rnqp.Cast.setRouteVolume.mockClear();
    rnqp.Cast.getLocalNetworkPermissionState.mockReturnValue('granted');
    rnqp.__setCastSnapshot({ receivers: [tv] });
    act(() => useRoutePickerStore.getState().open());
  });

  afterEach(() => {
    act(() => useRoutePickerStore.getState().close());
    jest.useRealTimers();
  });

  it('opens the device detail on tap instead of connecting', async () => {
    render(<RoutePickerSheet />);
    fireEvent.press(screen.getByTestId('route-row-chromecast:tv'));
    expect(rnqp.Cast.connect).not.toHaveBeenCalled();
    expect(screen.getByTestId('route-detail-connect')).toBeTruthy();
    expect(screen.queryByTestId('route-row-local')).toBeNull();
    fireEvent.press(screen.getByTestId('route-detail-back'));
    expect(screen.getByTestId('route-row-local')).toBeTruthy();
    await flush();
  });

  it('connects from the detail, applies the chosen volume, then closes', async () => {
    render(<RoutePickerSheet />);
    fireEvent.press(screen.getByTestId('route-row-chromecast:tv'));
    fireEvent(screen.getByTestId('route-detail-volume'), 'valueChange', 0.3);
    fireEvent.press(screen.getByTestId('route-detail-connect'));
    await flush();
    expect(rnqp.Cast.connect).toHaveBeenCalledWith('chromecast:tv', undefined);
    expect(rnqp.Cast.setRouteVolume).toHaveBeenCalledWith(0.3);
    act(() => jest.advanceTimersByTime(600));
    expect(useRoutePickerStore.getState().isOpen).toBe(false);
  });

  it('stays on the detail with the error shown when the connect fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    rnqp.Cast.connect.mockRejectedValueOnce(Object.assign(new Error('boom'), { code: 'cast_connect_failed' }));
    render(<RoutePickerSheet />);
    fireEvent.press(screen.getByTestId('route-row-chromecast:tv'));
    fireEvent.press(screen.getByTestId('route-detail-connect'));
    await flush();
    expect(rnqp.Cast.setRouteVolume).not.toHaveBeenCalled();
    expect(screen.getByText(/Couldn't connect/)).toBeTruthy();
    act(() => jest.advanceTimersByTime(600));
    expect(useRoutePickerStore.getState().isOpen).toBe(true);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('keeps the detail open, marked missing, when the device drops out of discovery', async () => {
    const { rerender } = render(<RoutePickerSheet />);
    fireEvent.press(screen.getByTestId('route-row-chromecast:tv'));
    rnqp.__setCastSnapshot({ receivers: [] });
    rerender(<RoutePickerSheet />);
    expect(screen.getByText('No longer found')).toBeTruthy();
    await flush();
  });

  it('switches back to this device in one tap', async () => {
    rnqp.__setCastSnapshot({
      receivers: [tv],
      route: { castProtocol: 'chromecast', name: 'Den TV', receiverId: 'chromecast:tv' },
    });
    render(<RoutePickerSheet />);
    fireEvent.press(screen.getByTestId('route-row-local'));
    expect(rnqp.Cast.disconnect).toHaveBeenCalled();
    expect(screen.queryByTestId('route-detail-connect')).toBeNull();
    await flush();
  });
});
