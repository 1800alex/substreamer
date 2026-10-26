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
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
}));

let appStateListener: ((state: string) => void) | null = null;
const mockAppStateAdd = jest.fn((_event: string, cb: (state: string) => void) => {
  appStateListener = cb;
  return { remove: () => { appStateListener = null; } };
});

jest.mock('react-native', () => ({
  AppState: { currentState: 'active', addEventListener: (...a: any[]) => (mockAppStateAdd as any)(...a) },
  Platform: { OS: 'android' },
}));

import { migrationGateStore } from '../../store/migrationGateStore';
import { useMigrationGateBackgroundNotification } from '../useMigrationGateBackgroundNotification';

const running = { visible: true, mode: 'working' as const, failed: false };

beforeEach(() => {
  jest.clearAllMocks();
  appStateListener = null;
  migrationGateStore.setState({ visible: false, mode: 'working', failed: false });
});

describe('useMigrationGateBackgroundNotification', () => {
  it('posts a notification when backgrounded mid-migration', async () => {
    migrationGateStore.setState(running);
    renderHook(() => useMigrationGateBackgroundNotification());
    await appStateListener!('background');
    expect(mockScheduleNotification).toHaveBeenCalled();
  });

  it('does nothing when no migration is running', async () => {
    renderHook(() => useMigrationGateBackgroundNotification());
    await appStateListener!('background');
    expect(mockScheduleNotification).not.toHaveBeenCalled();
  });

  it('skips scheduling when permission is not granted', async () => {
    mockGetPermissions.mockResolvedValueOnce({ granted: false, canAskAgain: true });
    migrationGateStore.setState(running);
    renderHook(() => useMigrationGateBackgroundNotification());
    await appStateListener!('background');
    expect(mockScheduleNotification).not.toHaveBeenCalled();
  });

  // The Android permission dialog drags a backgrounded app back to the front, and
  // dismissing it by switching away does not count as a denial — so asking here looped.
  it('never prompts for permission when going to the background', async () => {
    mockGetPermissions.mockResolvedValueOnce({ granted: false, canAskAgain: true });
    migrationGateStore.setState(running);
    renderHook(() => useMigrationGateBackgroundNotification());
    await appStateListener!('background');
    expect(mockRequestPermissions).not.toHaveBeenCalled();
  });

  it('dismisses the notification when returning to active', async () => {
    migrationGateStore.setState(running);
    renderHook(() => useMigrationGateBackgroundNotification());
    await appStateListener!('background');
    await appStateListener!('active');
    expect(mockDismissNotification).toHaveBeenCalledWith('notif-1');
  });
});
