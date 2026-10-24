jest.mock('../persistence/kvStorage', () => require('../persistence/__mocks__/kvStorage'));

import {
  castDirectName,
  castReceiversStore,
  fingerprintFromPinError,
  migrateCastReceivers,
  normalizeCastFingerprint,
} from '../castReceiversStore';

const GARAGE = '874a96ab4628f649e37176b35473642daf151d9f04b57bcc539d90fa81ba3824';

describe('normalizeCastFingerprint', () => {
  it('accepts upper case and colon or space separated input', () => {
    expect(normalizeCastFingerprint(GARAGE.toUpperCase())).toBe(GARAGE);
    expect(normalizeCastFingerprint(GARAGE.match(/../g)!.join(':'))).toBe(GARAGE);
    expect(normalizeCastFingerprint(` ${GARAGE.slice(0, 32)} ${GARAGE.slice(32)} `)).toBe(GARAGE);
  });

  it('rejects truncated or non-hex input', () => {
    expect(normalizeCastFingerprint(GARAGE.slice(0, 59))).toBeNull();
    expect(normalizeCastFingerprint(`${GARAGE.slice(0, 63)}z`)).toBeNull();
    expect(normalizeCastFingerprint('')).toBeNull();
  });
});

describe('castDirectName', () => {
  it('reads the receiver name from a native castdirect id', () => {
    expect(castDirectName('castdirect:192.168.1.17:8009:Garage%20Cast')).toBe('Garage Cast');
    expect(castDirectName('castdirect:192.168.1.17:8009:Garage+Cast')).toBe('Garage Cast');
  });

  it('is null for other receivers', () => {
    expect(castDirectName('chromecast:abc')).toBeNull();
    expect(castDirectName('castdirect:192.168.1.17:8009')).toBeNull();
  });
});

describe('castReceiversStore', () => {
  beforeEach(() => castReceiversStore.setState({ pins: {} }));

  it('pins, replaces and forgets a fingerprint by receiver name', () => {
    const { pin, forget } = castReceiversStore.getState();
    pin('Garage Cast', GARAGE.toUpperCase());
    expect(castReceiversStore.getState().pins).toEqual({ 'Garage Cast': GARAGE });
    expect(() => pin('Garage Cast', 'nope')).toThrow();
    expect(castReceiversStore.getState().pins).toEqual({ 'Garage Cast': GARAGE });
    forget('Garage Cast');
    expect(castReceiversStore.getState().pins).toEqual({});
  });

  it('persists under the substreamer-cast-receivers key', () => {
    expect(castReceiversStore.persist.getOptions().name).toBe('substreamer-cast-receivers');
  });
});

describe('migrateCastReceivers', () => {
  it('turns hand-added receivers into pins, dropping unpinned ones', () => {
    const old = {
      receivers: [
        { id: 'castdirect:192.168.1.17:8009:Garage%20Cast', name: 'Garage Cast', host: '192.168.1.17', port: 8009, fingerprint: GARAGE },
        { id: 'castdirect:192.168.1.40:8009:Pi', name: 'Pi', host: '192.168.1.40', port: 8009, fingerprint: '' },
      ],
    };
    expect(migrateCastReceivers(old, 0)).toEqual({ pins: { 'Garage Cast': GARAGE } });
    expect(migrateCastReceivers(undefined, 0)).toEqual({ pins: {} });
  });
});

describe('fingerprintFromPinError', () => {
  it('reads the SHA-256 the receiver presented from the native pin mismatch error', () => {
    // Wording of CastPinMismatchException in RNQP's CastChannel.open.
    const err = new Error(`Receiver certificate SHA-256 ${GARAGE} does not match the saved fingerprint`);
    expect(fingerprintFromPinError(err)).toBe(GARAGE);
  });

  it('returns null for any other error', () => {
    expect(fingerprintFromPinError(new Error('Connection refused'))).toBeNull();
    expect(fingerprintFromPinError(new Error('Receiver sent no certificate'))).toBeNull();
    expect(fingerprintFromPinError(undefined)).toBeNull();
  });
});
