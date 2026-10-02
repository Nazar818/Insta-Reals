const assert = require('node:assert/strict');
const test = require('node:test');
const { requestPlayback } = require('./playback-request.ts');

test('unsupported media rejection is handled instead of becoming an uncaught app error', async () => {
  const failures = [];
  await requestPlayback({ play: () => Promise.reject(new DOMException('The operation is not supported.', 'NotSupportedError')), pause() {} }, () => true, failure => failures.push(failure));
  assert.deepEqual(failures, ['error']);
});

test('blocked autoplay asks for a user gesture instead of reporting broken media', async () => {
  const failures = [];
  await requestPlayback({ play: () => Promise.reject(new DOMException('User gesture required', 'NotAllowedError')), pause() {} }, () => true, failure => failures.push(failure));
  assert.deepEqual(failures, ['blocked']);
});

test('pausing a pending play request ignores its normal AbortError', async () => {
  const failures = [];
  await requestPlayback({ play: () => Promise.reject(new DOMException('Paused', 'AbortError')), pause() {} }, () => true, failure => failures.push(failure));
  assert.deepEqual(failures, []);
});

test('a late playback success cannot restart an offscreen video', async () => {
  let resolve;
  let eligible = true;
  let pauses = 0;
  const pending = new Promise(done => { resolve = done; });
  const request = requestPlayback({ play: () => pending, pause: () => { pauses += 1; } }, () => eligible, () => assert.fail('Unexpected failure'));
  eligible = false;
  resolve();
  await request;
  assert.equal(pauses, 1);
});

test('a stale source rejection cannot overwrite the replacement video state', async () => {
  const failures = [];
  await requestPlayback({ play: () => Promise.reject(new Error('Old source')), pause() {} }, () => true, failure => failures.push(failure), () => false);
  assert.deepEqual(failures, []);
});

test('synchronous playback errors are handled too', async () => {
  const failures = [];
  await requestPlayback({ play: () => { throw new Error('Released player'); }, pause() {} }, () => true, failure => failures.push(failure));
  assert.deepEqual(failures, ['error']);
});
