const request = require('supertest');

const loadApp = () => {
  jest.resetModules();

  process.env.NODE_ENV = 'test';
  process.env.CLIENT_API_KEY = 'test-client-key';
  process.env.RATE_LIMIT_MAX = '100';
  process.env.RATE_LIMIT_WINDOW_MS = '60000';
  process.env.SMART_SMS_UAE_REST_URL = 'https://smart.example/send';
  process.env.SMART_SMS_UAE_USER_NAME = 'smart-user';
  process.env.SMART_SMS_UAE_API_PASSWORD = 'smart-password';
  process.env.SMART_SMS_UAE_SENDER_ID = 'SMARTID';
  process.env.CMI_REST_URL = 'https://cmi.example/send';
  process.env.CMI_CHANNEL = 'cmi-channel';
  process.env.CMI_AUTH_KEY = 'cmi-auth';
  process.env.CMI_SENDER_ID = 'CMIID';

  const axiosPost = jest.fn();
  const requestLogCreate = jest.fn().mockResolvedValue({});

  jest.doMock('axios', () => ({
    post: axiosPost
  }));

  jest.doMock('../src/models/requestLog.model', () => ({
    create: requestLogCreate
  }));

  const createApp = require('../src/app');

  return {
    app: createApp(),
    axiosPost,
    requestLogCreate
  };
};

const validBody = {
  type: 'smart-sms-uae',
  phone: '971500000000',
  text: 'Your OTP is 123456',
  date: '2026-06-23T10:30:00Z',
  campId: 'camp-1'
};

describe('SMS API', () => {
  test('sends Smart SMS request as form encoded payload', async () => {
    const { app, axiosPost } = loadApp();
    axiosPost.mockResolvedValue({ status: 200, data: 'OK' });

    const response = await request(app)
      .post('/api/send-otp')
      .set('x-api-key', 'test-client-key')
      .send(validBody);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.gateway).toBe('smart-sms-uae');
    expect(response.body.campId).toBe('camp-1');

    expect(axiosPost).toHaveBeenCalledTimes(1);
    const [url, payload, options] = axiosPost.mock.calls[0];
    expect(url).toBe('https://smart.example/send');
    expect(payload).toBeInstanceOf(URLSearchParams);
    expect(payload.get('username')).toBe('smart-user');
    expect(payload.get('password')).toBe('smart-password');
    expect(payload.get('senderid')).toBe('SMARTID');
    expect(payload.get('to')).toBe('971500000000');
    expect(payload.get('text')).toBe('Your OTP is 123456');
    expect(options.headers['content-type']).toBe('application/x-www-form-urlencoded');
  });

  test('sends CMI China Mobile request as JSON payload', async () => {
    const { app, axiosPost } = loadApp();
    axiosPost.mockResolvedValue({ status: 200, data: { ok: true } });

    const response = await request(app)
      .post('/api/send-otp')
      .set('x-api-key', 'test-client-key')
      .send({
        ...validBody,
        type: 'cmi.chinamobile'
      });

    expect(response.status).toBe(200);
    expect(axiosPost).toHaveBeenCalledTimes(1);
    const [url, payload] = axiosPost.mock.calls[0];
    expect(url).toBe('https://cmi.example/send');
    expect(payload).toEqual({
      uip_head: {
        METHOD: 'SMS_SEND_REQUEST',
        SERIAL: 1,
        TIME: '1782210600',
        CHANNEL: 'cmi-channel',
        AUTH_KEY: 'cmi-auth'
      },
      uip_body: {
        SMS_CONTENT: 'Your OTP is 123456',
        DESTINATION_ADDR: ['971500000000'],
        ORIGINAL_ADDR: 'CMIID'
      },
      uip_version: 2
    });
  });

  test('rejects missing API key', async () => {
    const { app, axiosPost } = loadApp();

    const response = await request(app)
      .post('/api/send-otp')
      .send(validBody);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_API_KEY');
    expect(axiosPost).not.toHaveBeenCalled();
  });

  test('rejects invalid body', async () => {
    const { app, axiosPost } = loadApp();

    const response = await request(app)
      .post('/api/send-otp')
      .set('x-api-key', 'test-client-key')
      .send({
        type: 'smart-sms-uae',
        phone: '123'
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(axiosPost).not.toHaveBeenCalled();
  });

  test('rejects unsupported gateway type', async () => {
    const { app, axiosPost } = loadApp();

    const response = await request(app)
      .post('/api/send-otp')
      .set('x-api-key', 'test-client-key')
      .send({
        ...validBody,
        type: 'unknown'
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(axiosPost).not.toHaveBeenCalled();
  });

  test('returns 502 for gateway non-success response', async () => {
    const { app, axiosPost } = loadApp();
    axiosPost.mockRejectedValue({
      response: {
        status: 500,
        data: 'gateway failed'
      }
    });

    const response = await request(app)
      .post('/api/send-otp')
      .set('x-api-key', 'test-client-key')
      .send(validBody);

    expect(response.status).toBe(502);
    expect(response.body.error.code).toBe('GATEWAY_NON_SUCCESS_STATUS');
  });

  test('logs campId and redacts full SMS text', async () => {
    const { app, axiosPost, requestLogCreate } = loadApp();
    axiosPost.mockResolvedValue({ status: 200, data: 'OK' });

    await request(app)
      .post('/api/send-otp')
      .set('x-api-key', 'test-client-key')
      .send(validBody);

    expect(requestLogCreate).toHaveBeenCalledTimes(1);
    const log = requestLogCreate.mock.calls[0][0];

    expect(log.request.campId).toBe('camp-1');
    expect(log.request.textLength).toBe('Your OTP is 123456'.length);
    expect(log.request.textHash).toHaveLength(64);
    expect(log.request.text).toBeUndefined();
    expect(JSON.stringify(log)).not.toContain('test-client-key');
    expect(JSON.stringify(log)).not.toContain('smart-password');
    expect(JSON.stringify(log)).not.toContain('Your OTP is 123456');
  });
});
