jest.mock('../../store/persistence/kvStorage', () => require('../../store/persistence/__mocks__/kvStorage'));
jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({ colors: { textPrimary: '#fff', textSecondary: '#888', primary: '#f60' } }),
}));
jest.mock('../PlaybackSpeedSheet', () => {
  const { Text } = require('react-native');
  return { PlaybackSpeedSheet: ({ visible }: { visible: boolean }) => (visible ? <Text testID="speed-sheet">sheet</Text> : null) };
});

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { create } from 'zustand';

import { playbackSettingsStore } from '../../store/playbackSettingsStore';
import { PlaybackRateButton } from '../PlaybackRateButton';

const rnqp = require('react-native-queue-player');

const castRoute = (castProtocol: 'chromecast' | 'airplay') => ({
  route: { castProtocol, name: 'Garage Cast', receiverId: 'castdirect:192.168.1.17:8009:Garage%20Cast' },
});

// The shared RNQP mock's useCast reads a plain object; back it with a store so
// a route change re-renders like the real hook does.
const castStore = create(() => ({ route: { castProtocol: 'local', name: '', receiverId: '' } }));
const setRoute = (next: ReturnType<typeof castRoute>) => act(() => castStore.setState(next));

describe('PlaybackRateButton', () => {
  beforeEach(() => {
    rnqp.__resetPlayerMock();
    castStore.setState({ route: { castProtocol: 'local', name: '', receiverId: '' } });
    jest.spyOn(rnqp, 'useCast').mockImplementation(() => castStore());
    playbackSettingsStore.setState({ playbackRate: 1.5 });
  });

  afterEach(() => jest.restoreAllMocks());

  it('shows the rate and opens the speed sheet on this device', () => {
    render(<PlaybackRateButton />);
    expect(screen.getByText('1.5x')).toBeTruthy();
    fireEvent.press(screen.getByRole('button'));
    expect(screen.getByTestId('speed-sheet')).toBeTruthy();
  });

  it.each(['chromecast', 'airplay'] as const)('is disabled at 1x while casting over %s', (protocol) => {
    castStore.setState(castRoute(protocol));
    render(<PlaybackRateButton />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(screen.getByText('1x')).toBeTruthy();
    expect(button.props.accessibilityLabel).toBe('Playback speed is unavailable while casting');
    fireEvent.press(button);
    expect(screen.queryByTestId('speed-sheet')).toBeNull();
  });

  it('closes an open speed sheet when casting starts', () => {
    render(<PlaybackRateButton />);
    fireEvent.press(screen.getByRole('button'));
    expect(screen.getByTestId('speed-sheet')).toBeTruthy();
    setRoute(castRoute('chromecast'));
    expect(screen.queryByTestId('speed-sheet')).toBeNull();
  });
});
