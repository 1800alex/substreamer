import { renderHook } from '@testing-library/react-native';

const mockScheduleNotification = jest.fn(() => Promise.resolve('notif-1'));
const mockDismissNotification = jest.fn(() => Promise.resolve());
const mockRequestPermissions = jest.fn(() => Promise.resolve({ granted: true }));
const mockGetPermissions = jest.fn(() => Promise.resolve({ granted: true, canAskAgain: true }));
const mockSetNotificationChannelAsync = jest.fn(() => Promise.resolve());

jest.mock('expo-notifications', () => ({
  __esModule: true,
  setNotificationChannelAsync: (...a: unknown[]) => (mockSetNotificationChannelAsync as any)(...a),
  scheduleNotificationAsync: (...a: unknown[]) => (mockScheduleNotification as any)(...a),
  dismissNotificationAsync: (...a: unknown[]) => (mockDismissNotification as any)(...a),
  requestPermissionsAsync: (...a: unknown[]) => (mockRequestPermissions as any)(...a),
  getPermissionsAsync: (...a: unknown[]) => (mockGetPermissions as any)(...a),
  AndroidImportance: { LOW: 2 },
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
}));

let appStateListener: ((state: string) => void) | null = null;
const mockAppStateAdd = jest.fn((_event: string, cb: (state: string) => void) => {
  appStateListener = cb;
  return { remove: () => { appStateListener = null; } };
});

jest.mock('react-native', () => ({
  // expo-modules-core looks optional native modules up here when expo-file-system loads.
  TurboModuleRegistry: { get: () => null },
  AppState: { addEventListener: (...a: any[]) => (mockAppStateAdd as any)(...a) },
  Platform: { OS: 'android' },
}));

jest.mock('../../store/persistence/kvStorage', () => require('../../store/persistence/__mocks__/kvStorage'));

import { syncStatusStore } from '../../store/syncStatusStore';
import { useLibrarySyncBackgroundNotification } from '../useLibrarySyncBackgroundNotification';

beforeEach(() => {
  jest.clearAllMocks();
  appStateListener = null;
  syncStatusStore.setState({ detailSyncPhase: 'idle' });
});

describe('useLibrarySyncBackgroundNotification', () => {
  it('posts a notification when backgrounded during an active sync', async () => {
    syncStatusStore.setState({ detailSyncPhase: 'syncing', songSyncStrategy: 'basic' });
    renderHook(() => useLibrarySyncBackgroundNotification());
    await appStateListener!('background');
    expect(mockScheduleNotification).toHaveBeenCalled();
  });

  it('does nothing when backgrounded while idle', async () => {
    renderHook(() => useLibrarySyncBackgroundNotification());
    await appStateListener!('background');
    expect(mockScheduleNotification).not.toHaveBeenCalled();
  });

  it('dismisses the notification when returning to active', async () => {
    syncStatusStore.setState({ detailSyncPhase: 'syncing', songSyncStrategy: 'basic' });
    renderHook(() => useLibrarySyncBackgroundNotification());
    await appStateListener!('background');
    await appStateListener!('active');
    expect(mockDismissNotification).toHaveBeenCalledWith('notif-1');
  });

  it('skips scheduling when permission is not granted', async () => {
    mockGetPermissions.mockResolvedValueOnce({ granted: false, canAskAgain: true });
    syncStatusStore.setState({ detailSyncPhase: 'syncing', songSyncStrategy: 'basic' });
    renderHook(() => useLibrarySyncBackgroundNotification());
    await appStateListener!('background');
    expect(mockScheduleNotification).not.toHaveBeenCalled();
  });

  // The Android permission dialog drags a backgrounded app back to the front, and
  // dismissing it by switching away does not count as a denial — so asking here looped.
  it('never prompts for permission when going to the background', async () => {
    mockGetPermissions.mockResolvedValueOnce({ granted: false, canAskAgain: true });
    syncStatusStore.setState({ detailSyncPhase: 'syncing', songSyncStrategy: 'basic' });
    renderHook(() => useLibrarySyncBackgroundNotification());
    await appStateListener!('background');
    expect(mockRequestPermissions).not.toHaveBeenCalled();
  });

  it('tears down the AppState listener on unmount', () => {
    const { unmount } = renderHook(() => useLibrarySyncBackgroundNotification());
    expect(appStateListener).not.toBeNull();
    unmount();
    expect(appStateListener).toBeNull();
  });
});
