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

describe('CastReceiversCard', () => {
  beforeEach(() => castReceiversStore.setState({ pins: {} }));

  it('renders nothing until a receiver has been trusted', () => {
    render(<CastReceiversCard />);
    expect(screen.queryByTestId('cast-receiver-pin-0')).toBeNull();
    expect(screen.queryByTestId('cast-receiver-add')).toBeNull();
  });

  it('lists trusted receivers with the start of their fingerprint', () => {
    castReceiversStore.getState().pin('Garage Cast', GARAGE);
    render(<CastReceiversCard />);
    expect(screen.getByText('Garage Cast')).toBeTruthy();
    expect(screen.getByTestId('cast-receiver-pin-0')).toHaveTextContent('SHA-256 874a96ab…');
  });

  it('forgets a receiver so the next connect trusts it again', () => {
    castReceiversStore.getState().pin('Garage Cast', GARAGE);
    render(<CastReceiversCard />);
    fireEvent.press(screen.getByTestId('cast-receiver-forget-0'));
    expect(castReceiversStore.getState().pins).toEqual({});
  });
});
