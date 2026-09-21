const request = require('supertest');

const loadApp = () => {
  jest.resetModules();
  process.env.NODE_ENV = 'test';
  process.env.CLIENT_API_KEY = 'test-client-key';
  process.env.SMART_SMS_UAE_USER_NAME = 'smart-user';
  process.env.SMART_SMS_UAE_API_PASSWORD = 'smart-password';
  const aggregate = jest.fn().mockResolvedValue([
    {
      _id: '507f1f77bcf86cd799439011', total_sms_count: 3,
      verification: 1, existing: 1, purchase: 1, no_id: 0
    },
    { _id: 'camp-2', total_sms_count: 1, verification: 0, existing: 0, purchase: 0, no_id: 1 }
  ]);
  const get = jest.fn().mockResolvedValue({ status: 200, data: ' 1234.5\n' });
  jest.doMock('../src/models/requestLog.model', () => ({
    aggregate, create: jest.fn().mockResolvedValue({})
  }));
  jest.doMock('../src/models/rawRequestLog.model', () => ({
    create: jest.fn().mockResolvedValue({})
  }));
  jest.doMock('axios', () => ({ get }));
  return { app: require('../src/app')(), aggregate, get };
};

const fetchReport = (app, url) => request(app).get(url).set('x-api-key', 'test-client-key');

test('date report groups campaigns, defaults status, includes full final day, and fetches balance once', async () => {
  const { app, aggregate, get } = loadApp();
  const response = await fetchReport(app, '/smslogs/date?from=2025-09-01&to=2025-09-30');
  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    camps: [
      {
        camp_id: '507f1f77bcf86cd799439011', total_sms_count: 3,
        verification: 1, existing: 1, purchase: 1, no_id: 0
      },
      {
        camp_id: 'camp-2', total_sms_count: 1,
        verification: 0, existing: 0, purchase: 0, no_id: 1
      }
    ],
    sms_status: 200,
    smart_sms_uae_balance: 1234.5,
    date: '2025-09-01 to 2025-09-30'
  });
  expect(aggregate).toHaveBeenCalledWith([
    { $match: { path: '/api/send-otp', statusCode: 200, createdAt: {
      $gte: new Date('2025-09-01T00:00:00Z'), $lt: new Date('2025-10-01T00:00:00Z')
    }, 'request.campId': { $exists: true, $nin: [null, ''] } } },
    { $group: {
      _id: '$request.campId',
      total_sms_count: { $sum: 1 },
      verification: { $sum: { $cond: [{ $eq: ['$request.sms_type', 'verification'] }, 1, 0] } },
      existing: { $sum: { $cond: [{ $eq: ['$request.sms_type', 'existing'] }, 1, 0] } },
      purchase: { $sum: { $cond: [{ $eq: ['$request.sms_type', 'purchase'] }, 1, 0] } },
      no_id: { $sum: { $cond: [{ $eq: ['$request.sms_type', 'no_nid'] }, 1, 0] } }
    } },
    { $sort: { _id: 1 } }
  ]);
  expect(get).toHaveBeenCalledTimes(1);
  expect(get).toHaveBeenCalledWith('https://smartsmsgateway.com/api/api_http_balance.php', expect.objectContaining({
    params: { username: 'smart-user', password: 'smart-password' }, timeout: expect.any(Number)
  }));
});

test('accepts timestamps with offsets and explicit status', async () => {
  const { app, aggregate } = loadApp();
  const response = await fetchReport(app, '/smslogs/date').query({
    from: '2025-09-01T04:00:00+04:00', to: '2025-09-01T05:00:00+04:00', status: '502'
  });
  expect(response.status).toBe(200);
  expect(aggregate.mock.calls[0][0][0].$match).toMatchObject({ statusCode: 502, createdAt: {
    $gte: new Date('2025-09-01T00:00:00Z'), $lte: new Date('2025-09-01T01:00:00Z')
  } });
  expect(response.body.sms_status).toBe(502);
});

test.each([
  [9, 2025, '2025-09-01', '2025-10-01', 'September 2025'],
  [2, 2024, '2024-02-01', '2024-03-01', 'February 2024'],
  [12, 2025, '2025-12-01', '2026-01-01', 'December 2025']
])('month %s of %s uses correct UTC boundaries', async (month, year, from, to, label) => {
  const { app, aggregate } = loadApp();
  const response = await fetchReport(app, `/smslogs/month-year?month=${month}&year=${year}&status=400`);
  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    camps: [
      {
        camp_id: '507f1f77bcf86cd799439011', total_sms_count: 3,
        verification: 1, existing: 1, purchase: 1, no_id: 0
      },
      {
        camp_id: 'camp-2', total_sms_count: 1,
        verification: 0, existing: 0, purchase: 0, no_id: 1
      }
    ],
    date: label,
    sms_status: 400,
    smart_sms_uae_balance: 1234.5
  });
  expect(aggregate.mock.calls[0][0][0].$match.createdAt).toEqual({ $gte: new Date(from), $lt: new Date(to) });
});

test.each([
  '/date', '/date?from=2025-02-30&to=2025-03-01', '/date?from=2025-10-01&to=2025-09-01',
  '/date?from=2025-09-01&to=2025-09-01&status=abc',
  '/date?from=2025-09-01&to=2025-09-01&status=200&status=400',
  '/month-year?month=13&year=2025', '/month-year?month=2',
  '/month-year?month=1.5&year=2025', '/month-year?month=1&year=0',
  '/month-year?month=1&year=2025&status=600'
])('rejects invalid query %s before calling dependencies', async (url) => {
  const { app, aggregate, get } = loadApp();
  const response = await fetchReport(app, `/smslogs${url}`);
  expect(response.status).toBe(400);
  expect(aggregate).not.toHaveBeenCalled();
  expect(get).not.toHaveBeenCalled();
});

test.each(['/date?from=2025-09-01&to=2025-09-30', '/month-year?month=9&year=2025'])('requires authentication for %s', async (url) => {
  const { app, aggregate, get } = loadApp();
  expect((await request(app).get(`/smslogs${url}`)).status).toBe(401);
  expect(aggregate).not.toHaveBeenCalled();
  expect(get).not.toHaveBeenCalled();
});

test('returns empty camps with shared fields when no campaigns match', async () => {
  const { app, aggregate } = loadApp();
  aggregate.mockResolvedValue([]);
  expect((await fetchReport(app, '/smslogs/month-year?month=9&year=2025')).body).toEqual({
    camps: [], sms_status: 200, smart_sms_uae_balance: 1234.5, date: 'September 2025'
  });
});

test('always returns zero-valued sms type fields when counts are absent', async () => {
  const { app, aggregate } = loadApp();
  aggregate.mockResolvedValue([{ _id: 'camp-legacy', total_sms_count: 2 }]);
  expect((await fetchReport(app, '/smslogs/month-year?month=9&year=2025')).body.camps).toEqual([
    {
      camp_id: 'camp-legacy', total_sms_count: 2,
      verification: 0, existing: 0, purchase: 0, no_id: 0
    }
  ]);
});

test.each(['ERROR: invalid credentials', '', null, {}, '-1', 'Infinity'])('rejects malformed provider balance %p', async (data) => {
  const { app, get } = loadApp();
  get.mockResolvedValue({ status: 200, data });
  const response = await fetchReport(app, '/smslogs/month-year?month=9&year=2025');
  expect(response.status).toBe(502);
  expect(response.body.error.code).toBe('INVALID_BALANCE_RESPONSE');
});

test('accepts zero balance', async () => {
  const { app, get } = loadApp();
  get.mockResolvedValue({ status: 200, data: 0 });
  const response = await fetchReport(app, '/smslogs/month-year?month=9&year=2025');
  expect(response.status).toBe(200);
  expect(response.body.smart_sms_uae_balance).toBe(0);
});

test('handles provider failure without exposing credentials', async () => {
  const { app, get } = loadApp();
  get.mockRejectedValue(new Error('failed password=smart-password'));
  const response = await fetchReport(app, '/smslogs/month-year?month=9&year=2025');
  expect(response.status).toBe(502);
  expect(response.body.error.code).toBe('BALANCE_REQUEST_FAILED');
  expect(JSON.stringify(response.body)).not.toContain('smart-password');
});

test('handles database failure before querying balance', async () => {
  const { app, aggregate, get } = loadApp();
  aggregate.mockRejectedValue(new Error('database unavailable'));
  const response = await fetchReport(app, '/smslogs/month-year?month=9&year=2025');
  expect(response.status).toBe(500);
  expect(get).not.toHaveBeenCalled();
});
