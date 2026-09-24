const express = require('express');
const { z } = require('zod');
const authenticateApiKey = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { sendSms } = require('../services/smsGateway.service');

const router = express.Router();

const smsRequestSchema = z.object({
  type: z.enum(['smart-sms-uae', 'cmi.chinamobile']),
  phone: z.string().trim().min(5).max(32),
  text: z.string().trim().min(1).max(1000),
  date: z.string().trim().min(1).optional(),
  campId: z.string().trim().max(128).optional(),
  sms_type: z.enum(['new_user_eid', 'new_user', 'existing_user_eid', 'existing_user', 'purchase'])
});

router.post('/send-otp', authenticateApiKey, validateBody(smsRequestSchema), async (req, res, next) => {
  try {
    const result = await sendSms(req.body);
    res.locals.gateway = result.log;

    res.status(200).json({
      success: true,
      requestId: req.id,
      gateway: req.body.type,
      campId: req.body.campId,
      sms_type: req.body.sms_type
    });
  } catch (error) {
    if (error.gatewayLog) {
      res.locals.gateway = error.gatewayLog;
    }
    next(error);
  }
});

module.exports = router;
