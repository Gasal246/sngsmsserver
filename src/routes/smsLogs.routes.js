const express = require('express');
const authenticateApiKey = require('../middleware/auth');
const { getByDate, getByMonthYear } = require('../controllers/smsLogs.controller');

const router = express.Router();
// router.use(authenticateApiKey);
router.get('/date', getByDate);
router.get('/month-year', getByMonthYear);

module.exports = router;
