// System volume mock; tests drive it via `__setSystemVolume` / `__emitVolume`.
let systemVolume = 0.5;
let listeners = [];

const VolumeManager = {
  getVolume: jest.fn(() => Promise.resolve({ volume: systemVolume, type: 'music' })),
  setVolume: jest.fn((value) => {
    systemVolume = value;
    return Promise.resolve();
  }),
  addVolumeListener: jest.fn((cb) => {
    listeners.push(cb);
    return { remove: () => { listeners = listeners.filter((l) => l !== cb); } };
  }),
};

module.exports = {
  __esModule: true,
  VolumeManager,
  default: VolumeManager,
  __setSystemVolume: (value) => { systemVolume = value; },
  __emitVolume: (value) => { systemVolume = value; listeners.forEach((l) => l({ volume: value, type: 'music' })); },
  __resetVolumeMock: () => {
    systemVolume = 0.5;
    listeners = [];
    VolumeManager.getVolume.mockClear();
    VolumeManager.setVolume.mockClear();
    VolumeManager.addVolumeListener.mockClear();
  },
};
