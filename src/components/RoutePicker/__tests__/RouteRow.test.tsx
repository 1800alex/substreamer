import { fireEvent, render, screen } from '@testing-library/react-native';

import { RouteRow } from '../RouteRow';
import { type RouteInfo, type RoutePickerTheme } from '../types';

const theme: RoutePickerTheme = {
  background: '#000',
  surface: '#111',
  text: '#fff',
  textSubtle: '#888',
  border: '#333',
  accent: '#f60',
  activeIndicator: '#0f0',
  connectingIndicator: '#ff0',
  errorIndicator: '#f00',
};

function route(overrides: Partial<RouteInfo> = {}): RouteInfo {
  return {
    id: 'airplay:roku',
    protocol: 'airplay',
    protocolVersion: '2',
    name: 'LivingRoom',
    modelName: '4640X',
    iconHint: 'tv',
    capabilities: { supportsRemoteVolume: true, requiresPairing: true } as RouteInfo['capabilities'],
    isActive: false,
    isConnecting: false,
    ...overrides,
  };
}

function renderRow(r: RouteInfo) {
  const onConnect = jest.fn();
  render(<RouteRow route={r} onConnect={onConnect} onDisconnect={jest.fn()} theme={theme} />);
  return onConnect;
}

describe('RouteRow pairing', () => {
  it('starts the connect on the first tap so the receiver displays its PIN', () => {
    const onConnect = renderRow(route());
    fireEvent.press(screen.getByTestId('route-row-airplay:roku'));
    expect(onConnect).toHaveBeenCalledWith('airplay:roku', undefined);
    expect(screen.getByTestId('route-row-airplay:roku-pin')).toBeTruthy();
  });

  it('does not restart pairing when a PIN is already being requested', () => {
    const onConnect = renderRow(route({ lastError: 'cast_auth_required' }));
    // The auth-required error already expanded the PIN box.
    expect(screen.getByTestId('route-row-airplay:roku-pin')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('route-row-airplay:roku-pin'), '1234');
    fireEvent.press(screen.getByTestId('route-row-airplay:roku-submit'));
    expect(onConnect).toHaveBeenCalledTimes(1);
    expect(onConnect).toHaveBeenCalledWith('airplay:roku', '1234');
  });

  it('connects straight away for receivers that need no pairing', () => {
    const onConnect = renderRow(
      route({ capabilities: { supportsRemoteVolume: true, requiresPairing: false } as RouteInfo['capabilities'] }),
    );
    fireEvent.press(screen.getByTestId('route-row-airplay:roku'));
    expect(onConnect).toHaveBeenCalledWith('airplay:roku', undefined);
    expect(screen.queryByTestId('route-row-airplay:roku-pin')).toBeNull();
  });
});

describe('RouteRow volume', () => {
  it('shows a volume slider under the active cast receiver', () => {
    renderRow(route({ isActive: true }));
    expect(screen.getByTestId('output-volume-slider')).toBeTruthy();
  });

  it('shows no slider on inactive receivers or this device', () => {
    renderRow(route());
    expect(screen.queryByTestId('output-volume-slider')).toBeNull();
    renderRow(route({ id: '', protocol: 'local', isActive: true }));
    expect(screen.queryByTestId('output-volume-slider')).toBeNull();
  });
});
