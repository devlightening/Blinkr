import { NearbyRequestOwnership, type NearbyOrigin } from '../src/nearbyRequestOwnership';

const assertEqual = (actual: unknown, expected: unknown) => {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
  }
};

const deviceOrigin: NearbyOrigin = {
  accuracyMeters: 22,
  latitude: 41.0082,
  longitude: 28.9784,
  source: 'DEVICE',
  timestamp: 1,
};

const jitteredDeviceOrigin: NearbyOrigin = {
  ...deviceOrigin,
  latitude: 41.00824,
  longitude: 28.97842,
  timestamp: 2,
};

{
  const owner = new NearbyRequestOwnership();
  const first = owner.begin(deviceOrigin, 'COMPOSER_OPEN');
  const second = owner.begin(jitteredDeviceOrigin, 'MOVED');
  const third = owner.begin(jitteredDeviceOrigin, 'MOVED');

  assertEqual(first.status, 'start');
  assertEqual(second.status, 'reuse-inflight');
  assertEqual(third.status, 'reuse-inflight');
  assertEqual(first.requestId, second.requestId);
  assertEqual(first.requestId, third.requestId);
  assertEqual(owner.apply(first.requestId), true);
}

{
  const owner = new NearbyRequestOwnership();
  const device = owner.begin(deviceOrigin, 'COMPOSER_OPEN');
  const mapCenter = owner.begin(
    { accuracyMeters: null, latitude: 41.011, longitude: 28.985, source: 'MAP_CENTER', timestamp: null },
    'SOURCE_CHANGE',
  );

  assertEqual(device.status, 'start');
  assertEqual(mapCenter.status, 'start');
  assertEqual(mapCenter.shouldAbortActive, true);
  assertEqual(owner.apply(device.requestId), false);
  assertEqual(owner.apply(mapCenter.requestId), true);
}

{
  const owner = new NearbyRequestOwnership();
  const first = owner.begin(deviceOrigin, 'COMPOSER_OPEN');
  owner.fail(first.requestId);
  const retry = owner.begin(deviceOrigin, 'MANUAL_REFRESH');

  assertEqual(retry.status, 'start');
  assertEqual(retry.requestId, first.requestId + 1);
  assertEqual(owner.apply(retry.requestId), true);
}

console.log('nearby request ownership tests passed');
