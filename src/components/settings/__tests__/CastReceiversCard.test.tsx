jest.mock('../../../store/persistence/kvStorage', () => require('../../../store/persistence/__mocks__/kvStorage'));
jest.mock('../../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      primary: '#ff6600', textPrimary: '#fff', textSecondary: '#888', border: '#333',
      card: '#1e1e1e', inputBg: '#2a2a2a', red: '#f00', label: '#aaa',
    },
  }),
}));

import { fireEvent, render, screen } from '@testing-library/react-native';

import { castReceiversStore } from '../../../store/castReceiversStore';
import { CastReceiversCard } from '../CastReceiversCard';

const GARAGE = '874a96ab4628f649e37176b35473642daf151d9f04b57bcc539d90fa81ba3824';

function fill(name: string, host: string, port: string, fingerprint: string) {
  fireEvent.changeText(screen.getByTestId('cast-receiver-name'), name);
  fireEvent.changeText(screen.getByTestId('cast-receiver-host'), host);
  fireEvent.changeText(screen.getByTestId('cast-receiver-port'), port);
  fireEvent.changeText(screen.getByTestId('cast-receiver-fingerprint'), fingerprint);
  fireEvent.press(screen.getByTestId('cast-receiver-add'));
}

describe('CastReceiversCard', () => {
  beforeEach(() => castReceiversStore.setState({ receivers: [] }));

  it('adds a receiver with a valid fingerprint and lists it', () => {
    render(<CastReceiversCard />);
    fill('Garage Cast', '192.168.1.17', '8009', GARAGE.toUpperCase());
    expect(castReceiversStore.getState().receivers).toEqual([
      expect.objectContaining({ name: 'Garage Cast', host: '192.168.1.17', port: 8009, fingerprint: GARAGE }),
    ]);
    expect(screen.getByText('Garage Cast')).toBeTruthy();
    expect(screen.getByText('192.168.1.17:8009')).toBeTruthy();
  });

  it('explains a truncated fingerprint instead of saving it', () => {
    render(<CastReceiversCard />);
    fill('Garage Cast', '192.168.1.17', '8009', GARAGE.slice(0, 59));
    expect(castReceiversStore.getState().receivers).toEqual([]);
    expect(screen.getByTestId('cast-receiver-error')).toBeTruthy();
  });

  it('requires a host and a valid port', () => {
    render(<CastReceiversCard />);
    fill('Garage Cast', ' ', '8009', GARAGE);
    fill('Garage Cast', '192.168.1.17', '99999', GARAGE);
    expect(castReceiversStore.getState().receivers).toEqual([]);
  });

  it('removes a receiver', () => {
    castReceiversStore.getState().add({ name: 'Garage Cast', host: '192.168.1.17', port: 8009, fingerprint: GARAGE });
    render(<CastReceiversCard />);
    fireEvent.press(screen.getByTestId('cast-receiver-remove-0'));
    expect(castReceiversStore.getState().receivers).toEqual([]);
  });
});
