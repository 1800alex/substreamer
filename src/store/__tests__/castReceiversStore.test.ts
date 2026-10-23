jest.mock('../persistence/kvStorage', () => require('../persistence/__mocks__/kvStorage'));

import { castReceiverId, castReceiversStore, normalizeCastFingerprint } from '../castReceiversStore';

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

describe('castReceiversStore', () => {
  beforeEach(() => castReceiversStore.setState({ receivers: [] }));

  it('builds the native receiver id from host, port and name', () => {
    expect(castReceiverId({ host: '192.168.1.17', port: 8009, name: 'Garage Cast' })).toBe(
      'castdirect:192.168.1.17:8009:Garage%20Cast',
    );
  });

  it('adds, replaces by id and removes receivers', () => {
    const { add, remove } = castReceiversStore.getState();
    add({ name: 'Garage Cast', host: '192.168.1.17', port: 8009, fingerprint: GARAGE });
    add({ name: 'Garage Cast', host: '192.168.1.17', port: 8009, fingerprint: GARAGE.toUpperCase() });
    const { receivers } = castReceiversStore.getState();
    expect(receivers).toHaveLength(1);
    expect(receivers[0]).toEqual({
      id: 'castdirect:192.168.1.17:8009:Garage%20Cast',
      name: 'Garage Cast',
      host: '192.168.1.17',
      port: 8009,
      fingerprint: GARAGE,
    });
    remove(receivers[0].id);
    expect(castReceiversStore.getState().receivers).toEqual([]);
  });

  it('refuses an invalid fingerprint', () => {
    expect(() =>
      castReceiversStore.getState().add({ name: 'x', host: 'h', port: 8009, fingerprint: GARAGE.slice(0, 59) }),
    ).toThrow();
    expect(castReceiversStore.getState().receivers).toEqual([]);
  });

  it('persists under the substreamer-cast-receivers key', () => {
    expect(castReceiversStore.persist.getOptions().name).toBe('substreamer-cast-receivers');
  });
});
