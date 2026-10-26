import { act, renderHook } from '@testing-library/react-native';

const mockScheduleNotification = jest.fn(() => Promise.resolve('notif-1'));
const mockDismissNotification = jest.fn(() => Promise.resolve());
const mockRequestPermissions = jest.fn(() => Promise.resolve({ granted: true }));
const mockGetPermissions = jest.fn(() => Promise.resolve({ granted: true, canAskAgain: true }));

jest.mock('expo-notifications', () => ({
  __esModule: true,
  // Called at import time, before any top-level mock const is initialised.
  setNotificationChannelAsync: jest.fn(() => Promise.resolve()),
  setNotificationHandler: jest.fn(),
  scheduleNotificationAsync: (...a: unknown[]) => (mockScheduleNotification as any)(...a),
  dismissNotificationAsync: (...a: unknown[]) => (mockDismissNotification as any)(...a),
  requestPermissionsAsync: (...a: unknown[]) => (mockRequestPermissions as any)(...a),
  getPermissionsAsync: (...a: unknown[]) => (mockGetPermissions as any)(...a),
  AndroidImportance: { LOW: 2 },
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
}));

let appStateListener: ((state: string) => void) | null = null;

jest.mock('react-native', () => ({
  // expo-modules-core looks optional native modules up here when expo-file-system loads.
  TurboModuleRegistry: { get: () => null },
  // Built inside the factory: react-native loads before any top-level const is initialised.
  AppState: { currentState: 'active', addEventListener: jest.fn() },
  Platform: { OS: 'android' },
}));

const mockAppState = require('react-native').AppState as {
  currentState: string;
  addEventListener: jest.Mock;
};

jest.mock('../../store/persistence/kvStorage', () => require('../../store/persistence/__mocks__/kvStorage'));

import { musicCacheStore } from '../../store/musicCacheStore';
import { useDownloadBackgroundNotification } from '../useDownloadBackgroundNotification';

const activeQueue = [{ queueId: 'q1', itemId: 'a1', status: 'downloading' }] as any;

/** Let the store subscriber's async permission check settle. */
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => {
  jest.clearAllMocks();
  appStateListener = null;
  mockAppState.currentState = 'active';
  mockAppState.addEventListener.mockImplementation((_event: string, cb: (state: string) => void) => {
    appStateListener = cb;
    return { remove: () => { appStateListener = null; } };
  });
  musicCacheStore.setState({ downloadQueue: [] });
});

describe('useDownloadBackgroundNotification', () => {
  it('posts a notification when backgrounded with downloads active', async () => {
    musicCacheStore.setState({ downloadQueue: activeQueue });
    renderHook(() => useDownloadBackgroundNotification());
    await appStateListener!('background');
    expect(mockScheduleNotification).toHaveBeenCalled();
  });

  it('does nothing when backgrounded with no downloads', async () => {
    renderHook(() => useDownloadBackgroundNotification());
    await appStateListener!('background');
    expect(mockScheduleNotification).not.toHaveBeenCalled();
  });

  it('dismisses the notification when returning to active', async () => {
    musicCacheStore.setState({ downloadQueue: activeQueue });
    renderHook(() => useDownloadBackgroundNotification());
    await appStateListener!('background');
    await appStateListener!('active');
    expect(mockDismissNotification).toHaveBeenCalledWith('notif-1');
  });

  it('skips scheduling when permission is not granted', async () => {
    mockGetPermissions.mockResolvedValue({ granted: false, canAskAgain: true });
    musicCacheStore.setState({ downloadQueue: activeQueue });
    renderHook(() => useDownloadBackgroundNotification());
    await appStateListener!('background');
    expect(mockScheduleNotification).not.toHaveBeenCalled();
    mockGetPermissions.mockResolvedValue({ granted: true, canAskAgain: true });
  });

  // The Android permission dialog drags a backgrounded app back to the front, and
  // dismissing it by switching away does not count as a denial — so asking here looped.
  it('never prompts for permission when going to the background', async () => {
    mockGetPermissions.mockResolvedValue({ granted: false, canAskAgain: true });
    musicCacheStore.setState({ downloadQueue: activeQueue });
    renderHook(() => useDownloadBackgroundNotification());
    mockAppState.currentState = 'background';
    await appStateListener!('background');
    await appStateListener!('background');
    expect(mockRequestPermissions).not.toHaveBeenCalled();
    mockGetPermissions.mockResolvedValue({ granted: true, canAskAgain: true });
  });

  describe('foreground permission prompt', () => {
    afterEach(() => {
      mockGetPermissions.mockResolvedValue({ granted: true, canAskAgain: true });
    });

    it('asks once when a download starts in the foreground', async () => {
      mockGetPermissions.mockResolvedValue({ granted: false, canAskAgain: true });
      renderHook(() => useDownloadBackgroundNotification());
      act(() => { musicCacheStore.setState({ downloadQueue: activeQueue }); });
      await flush();
      expect(mockRequestPermissions).toHaveBeenCalledTimes(1);
    });

    it('asks only once per session', async () => {
      mockGetPermissions.mockResolvedValue({ granted: false, canAskAgain: true });
      renderHook(() => useDownloadBackgroundNotification());
      act(() => { musicCacheStore.setState({ downloadQueue: activeQueue }); });
      await flush();
      act(() => { musicCacheStore.setState({ downloadQueue: [] }); });
      act(() => { musicCacheStore.setState({ downloadQueue: activeQueue }); });
      await flush();
      expect(mockRequestPermissions).toHaveBeenCalledTimes(1);
    });

    it('does not ask when permission is already granted', async () => {
      renderHook(() => useDownloadBackgroundNotification());
      act(() => { musicCacheStore.setState({ downloadQueue: activeQueue }); });
      await flush();
      expect(mockRequestPermissions).not.toHaveBeenCalled();
    });

    it('does not ask when the OS will no longer show the dialog', async () => {
      mockGetPermissions.mockResolvedValue({ granted: false, canAskAgain: false });
      renderHook(() => useDownloadBackgroundNotification());
      act(() => { musicCacheStore.setState({ downloadQueue: activeQueue }); });
      await flush();
      expect(mockRequestPermissions).not.toHaveBeenCalled();
    });

    it('does not ask when the queue fills while backgrounded', async () => {
      mockGetPermissions.mockResolvedValue({ granted: false, canAskAgain: true });
      mockAppState.currentState = 'background';
      renderHook(() => useDownloadBackgroundNotification());
      act(() => { musicCacheStore.setState({ downloadQueue: activeQueue }); });
      await flush();
      expect(mockRequestPermissions).not.toHaveBeenCalled();
    });
  });

  it('tears down its listeners on unmount', async () => {
    mockGetPermissions.mockResolvedValue({ granted: false, canAskAgain: true });
    const { unmount } = renderHook(() => useDownloadBackgroundNotification());
    expect(appStateListener).not.toBeNull();
    unmount();
    expect(appStateListener).toBeNull();
    act(() => { musicCacheStore.setState({ downloadQueue: activeQueue }); });
    await flush();
    expect(mockRequestPermissions).not.toHaveBeenCalled();
    mockGetPermissions.mockResolvedValue({ granted: true, canAskAgain: true });
  });
});
