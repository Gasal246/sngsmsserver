const { z } = require('zod');
const RequestLog = require('../models/requestLog.model');
const { getSmartSmsBalance } = require('../services/smsGateway.service');
const AppError = require('../utils/AppError');

const dateString = z.union([z.string().date(), z.string().datetime({ offset: true })]);
const integer = (min, max) => z.string().regex(/^\d+$/).transform(Number)
  .pipe(z.number().int().min(min).max(max));
const status = integer(100, 599).default('200');
const dateQuery = z.object({ from: dateString, to: dateString, status });
const monthQuery = z.object({ month: integer(1, 12), year: integer(1, 9999), status });

const parseQuery = (schema, query) => {
  const result = schema.safeParse(query);
  if (!result.success) {
    throw new AppError('Invalid query parameters', 400, 'VALIDATION_ERROR', result.error.issues);
  }
  return result.data;
};

const getReport = async (createdAt, smsStatus, date) => {
  const campaigns = await RequestLog.aggregate([
    { $match: {
      path: '/api/send-otp',
      statusCode: smsStatus,
      createdAt,
      'request.campId': { $exists: true, $nin: [null, ''] }
    } },
    { $group: { _id: '$request.campId', total_sms_count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);
  const balance = await getSmartSmsBalance();
  return {
    camps: campaigns.map((campaign) => ({
      camp_id: campaign._id,
      total_sms_count: campaign.total_sms_count
    })),
    sms_status: smsStatus,
    smart_sms_uae_balance: balance,
    date
  };
};

const getByDate = async (req, res, next) => {
  try {
    const query = parseQuery(dateQuery, req.query);
    const from = new Date(query.from);
    const to = new Date(query.to);
    const dateOnly = query.to.length === 10;
    if (dateOnly) to.setUTCDate(to.getUTCDate() + 1);
    if (dateOnly ? from >= to : from > to) {
      throw new AppError('from must be on or before to', 400, 'VALIDATION_ERROR');
    }
    res.json(await getReport(
      { $gte: from, [dateOnly ? '$lt' : '$lte']: to },
      query.status,
      `${query.from} to ${query.to}`
    ));
  } catch (error) {
    next(error);
  }
};

const getByMonthYear = async (req, res, next) => {
  try {
    const query = parseQuery(monthQuery, req.query);
    const from = new Date(`${String(query.year).padStart(4, '0')}-${String(query.month).padStart(2, '0')}-01T00:00:00.000Z`);
    const to = new Date(from);
    to.setUTCMonth(to.getUTCMonth() + 1);
    const month = from.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
    res.json(await getReport({ $gte: from, $lt: to }, query.status, `${month} ${query.year}`));
  } catch (error) {
    next(error);
  }
};

module.exports = { getByDate, getByMonthYear };
