import { createHmac } from 'node:crypto';
import { config } from '../common/config.js';
import { MuxService } from './mux.service.js';
import { validVideoSignature } from '../uploads/uploads.service.js';

describe('Provider boundaries', () => {
  const oldSecret = config.muxWebhookSecret;
  beforeEach(() => {
    config.muxWebhookSecret = 'unit-test-secret';
  });
  afterEach(() => {
    config.muxWebhookSecret = oldSecret;
  });
  it('accepts signed Mux bytes and rejects altered bytes', () => {
    const service = new MuxService();
    const raw = Buffer.from('{"id":"event_123","type":"video.asset.ready"}');
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac('sha256', config.muxWebhookSecret!)
      .update(`${timestamp}.`)
      .update(raw)
      .digest('hex');
    expect(
      service.verifyWebhook(raw, `t=${timestamp},v1=${signature}`),
    ).toEqual({ id: 'event_123', type: 'video.asset.ready' });
    expect(() =>
      service.verifyWebhook(
        Buffer.from('{}'),
        `t=${timestamp},v1=${signature}`,
      ),
    ).toThrow('Invalid webhook signature');
  });
  it('rejects replayed webhooks outside the five minute window', () => {
    expect(() =>
      new MuxService().verifyWebhook(Buffer.from('{}'), 't=1,v1=abcd'),
    ).toThrow('Expired webhook signature');
  });
  it('requires matching MP4 or WebM signatures', () => {
    const mp4 = Buffer.from([
      0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
    ]);
    const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(validVideoSignature(mp4, 'video/mp4')).toBe(true);
    expect(validVideoSignature(webm, 'video/webm')).toBe(true);
    expect(validVideoSignature(mp4, 'video/webm')).toBe(false);
    expect(
      validVideoSignature(Buffer.from('this is not a video'), 'video/mp4'),
    ).toBe(false);
  });
});
