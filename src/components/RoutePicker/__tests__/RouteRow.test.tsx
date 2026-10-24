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
  const onPress = jest.fn();
  render(<RouteRow route={r} onPress={onPress} theme={theme} />);
  return onPress;
}

describe('RouteRow press', () => {
  it('hands the tapped route to onPress and never connects by itself', () => {
    const onPress = renderRow(route());
    fireEvent.press(screen.getByTestId('route-row-airplay:roku'));
    expect(onPress).toHaveBeenCalledWith(expect.objectContaining({ id: 'airplay:roku' }));
    expect(screen.queryByTestId('route-row-airplay:roku-pin')).toBeNull();
  });

  it('shows the derived subtitle unless overridden', () => {
    renderRow(route());
    expect(screen.getByText('AirPlay 2 • 4640X')).toBeTruthy();
    render(<RouteRow route={route({ id: '', protocol: 'local' })} onPress={jest.fn()} subtitleOverride="Tap me" theme={theme} />);
    expect(screen.getByText('Tap me')).toBeTruthy();
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
