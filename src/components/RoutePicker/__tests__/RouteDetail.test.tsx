import { fireEvent, render, screen } from '@testing-library/react-native';

import { RouteDetail } from '../RouteDetail';
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

let nextId = 0;
function route(overrides: Partial<RouteInfo> = {}): RouteInfo {
  return {
    // Unique per test: the connect volume is remembered per id for the session.
    id: `airplay:dev${nextId++}`,
    protocol: 'airplay',
    protocolVersion: '2',
    name: 'LivingRoom',
    modelName: '4640X',
    iconHint: 'tv',
    capabilities: { supportsRemoteVolume: true, streamingModel: 'pushPcm', requiresPairing: false },
    isActive: false,
    isConnecting: false,
    ...overrides,
  };
}

const pairing = { supportsRemoteVolume: true, streamingModel: 'pushPcm', requiresPairing: true } as const;

function renderDetail(r: RouteInfo, extra: { missing?: boolean } = {}) {
  const onConnect = jest.fn();
  const onDisconnect = jest.fn();
  const onBack = jest.fn();
  const utils = render(
    <RouteDetail
      route={r}
      missing={extra.missing ?? false}
      onConnect={onConnect}
      onDisconnect={onDisconnect}
      onBack={onBack}
      theme={theme}
    />,
  );
  const rerender = (next: RouteInfo) =>
    utils.rerender(
      <RouteDetail route={next} missing={false} onConnect={onConnect} onDisconnect={onDisconnect} onBack={onBack} theme={theme} />,
    );
  return { onConnect, onDisconnect, onBack, rerender };
}

describe('RouteDetail', () => {
  it('shows the device and connects with the default 50% volume', () => {
    const r = route();
    const { onConnect } = renderDetail(r);
    expect(screen.getByText('LivingRoom')).toBeTruthy();
    expect(screen.getByText('AirPlay 2 • 4640X')).toBeTruthy();
    fireEvent.press(screen.getByTestId('route-detail-connect'));
    expect(onConnect).toHaveBeenCalledWith(r.id, undefined, 0.5);
  });

  it('connects at the volume chosen on the slider and remembers it for the session', () => {
    const r = route();
    const first = renderDetail(r);
    fireEvent(screen.getByTestId('route-detail-volume'), 'valueChange', 0.2);
    fireEvent.press(screen.getByTestId('route-detail-connect'));
    expect(first.onConnect).toHaveBeenCalledWith(r.id, undefined, 0.2);
    screen.unmount();

    const again = renderDetail(r);
    fireEvent.press(screen.getByTestId('route-detail-connect'));
    expect(again.onConnect).toHaveBeenCalledWith(r.id, undefined, 0.2);
  });

  it('omits the volume for receivers without remote volume', () => {
    const r = route({ capabilities: { supportsRemoteVolume: false, streamingModel: 'pushPcm', requiresPairing: false } });
    const { onConnect } = renderDetail(r);
    expect(screen.queryByTestId('route-detail-volume')).toBeNull();
    fireEvent.press(screen.getByTestId('route-detail-connect'));
    expect(onConnect).toHaveBeenCalledWith(r.id, undefined, undefined);
  });

  it('goes back to the list', () => {
    const { onBack } = renderDetail(route());
    fireEvent.press(screen.getByTestId('route-detail-back'));
    expect(onBack).toHaveBeenCalled();
  });

  it('offers to stop listening on the active receiver, with its live volume', () => {
    const { onDisconnect, onConnect } = renderDetail(route({ isActive: true }));
    expect(screen.getByTestId('output-volume-slider')).toBeTruthy();
    expect(screen.queryByTestId('route-detail-volume')).toBeNull();
    fireEvent.press(screen.getByTestId('route-detail-disconnect'));
    expect(onDisconnect).toHaveBeenCalled();
    expect(onConnect).not.toHaveBeenCalled();
  });

  it('disables connecting to a device discovery no longer sees', () => {
    const { onConnect } = renderDetail(route(), { missing: true });
    expect(screen.getByText('No longer found')).toBeTruthy();
    fireEvent.press(screen.getByTestId('route-detail-connect'));
    expect(onConnect).not.toHaveBeenCalled();
  });

  it('shows a spinner instead of the button label while connecting', () => {
    renderDetail(route({ isConnecting: true }));
    expect(screen.getByTestId('route-detail-connecting')).toBeTruthy();
  });
});

describe('RouteDetail pairing', () => {
  it('starts the connect first so the receiver displays its PIN, then prompts for it', () => {
    const r = route({ capabilities: pairing });
    const { onConnect, rerender } = renderDetail(r);
    fireEvent.press(screen.getByTestId('route-detail-connect'));
    expect(onConnect).toHaveBeenCalledWith(r.id, undefined, 0.5);
    expect(screen.getByTestId('route-detail-pin')).toBeTruthy();
    // The first connect rejects once the receiver is showing its PIN.
    rerender({ ...r, lastError: 'Error' });
    expect(screen.getByText('Enter the PIN shown on your TV')).toBeTruthy();
    expect(screen.queryByText(/Couldn't connect/)).toBeNull();
  });

  it('submits the PIN with the chosen volume and reports a rejected PIN', () => {
    const r = route({ capabilities: pairing });
    const { onConnect, rerender } = renderDetail(r);
    fireEvent.press(screen.getByTestId('route-detail-connect'));
    fireEvent.changeText(screen.getByTestId('route-detail-pin'), '1234');
    fireEvent.press(screen.getByTestId('route-detail-connect'));
    expect(onConnect).toHaveBeenLastCalledWith(r.id, '1234', 0.5);
    rerender({ ...r, lastError: 'Error' });
    expect(screen.getByText(/Couldn't connect/)).toBeTruthy();
  });

  it('does not restart pairing when an auth-required error already asked for the PIN', () => {
    const r = route({ lastError: 'cast_auth_required' });
    const { onConnect } = renderDetail(r);
    expect(screen.getByTestId('route-detail-pin')).toBeTruthy();
    expect(screen.getByText('Enter the password for this device')).toBeTruthy();
    // No PIN typed yet: the button cannot submit an empty one.
    fireEvent.press(screen.getByTestId('route-detail-connect'));
    expect(onConnect).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByTestId('route-detail-pin'), 'secret');
    fireEvent.press(screen.getByTestId('route-detail-connect'));
    expect(onConnect).toHaveBeenCalledTimes(1);
    expect(onConnect).toHaveBeenCalledWith(r.id, 'secret', 0.5);
  });

  describe('self-hosted Cast trust', () => {
    const FP = '874a96ab4628f649e37176b35473642daf151d9f04b57bcc539d90fa81ba3824';
    const cast = (changed: boolean) =>
      route({
        id: `castdirect:192.168.1.17:8009:Garage${nextId++}`,
        protocol: 'chromecast',
        name: 'Garage Cast',
        modelName: '',
        capabilities: { supportsRemoteVolume: true, streamingModel: 'pullUrl', requiresPairing: false },
        lastError: 'cast_trust_required',
        trust: { fingerprint: FP, changed },
      });

    it('shows the fingerprint grouped for comparing on the receiver, and trusts it on connect', () => {
      const r = cast(false);
      const { onConnect } = renderDetail(r);
      expect(screen.getByText('Trust this Cast receiver?')).toBeTruthy();
      expect(screen.getByTestId('route-detail-fingerprint')).toHaveTextContent(
        FP.toUpperCase().match(/../g)!.join(':'),
      );
      fireEvent.press(screen.getByTestId('route-detail-connect'));
      expect(onConnect).toHaveBeenCalledWith(r.id, FP, 0.5);
      expect(screen.getByTestId('route-detail-connect')).toHaveTextContent('Trust and connect');
    });

    it('warns when a pinned receiver presents a different certificate', () => {
      renderDetail(cast(true));
      expect(screen.getByText('Cast receiver changed')).toBeTruthy();
      expect(screen.getByText(/different certificate/)).toBeTruthy();
    });
  });
});
