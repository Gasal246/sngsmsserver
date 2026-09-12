# SNG SMS Server

Express server for sending transactional SMS messages through configured SMS gateways.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Configure `.env` with your MongoDB URI, client API key, and SMS gateway credentials.

## API

```http
POST /api/send-otp
Content-Type: application/json
x-api-key: <CLIENT_API_KEY>
```

```json
{
  "type": "smart-sms-uae",
  "phone": "9715xxxxxxx",
  "text": "Your transaction was successful",
  "date": "2026-06-23T10:30:00Z",
  "campId": "campaign-or-client-reference"
}
```

Supported gateway types:

- `smart-sms-uae`
- `cmi.chinamobile`

## SMS reports

Both endpoints require `x-api-key: <CLIENT_API_KEY>`:

```http
GET /smslogs/date?from=2025-09-01&to=2025-09-30
GET /smslogs/month-year?month=9&year=2025
```

Add `&status=502` (or another HTTP status code) to either endpoint to override
the default status of `200`. Use `&` between query parameters.

Reports count request logs whose path is exactly `/api/send-otp`, grouped by
`request.campId`, within the requested `createdAt` period. Logs without a campaign
ID are excluded. Each request counts once, regardless of SMS length or gateway.
Campaign IDs retain their stored string value, including ObjectId strings.

Date ranges accept `YYYY-MM-DD` or ISO timestamps with a timezone. Date-only
ranges include the entire final day in UTC; timestamp endpoints are inclusive.
Monthly reports use UTC calendar months. Invalid or reversed ranges return 400.

The response is an object with shared report fields and a `camps` array containing
one object per campaign. When none match, `camps` is `[]` and the shared fields
are still returned:

```json
{
  "camps": [
    {
      "camp_id": "507f1f77bcf86cd799439011",
      "total_sms_count": 42
    }
  ],
  "sms_status": 200,
  "smart_sms_uae_balance": 1234.5,
  "date": "2025-09-01 to 2025-09-30"
}
```

The monthly endpoint uses a date label such as `September 2025`.
The current account balance is fetched once per report from Smart SMS UAE using
`SMART_SMS_UAE_USER_NAME` and `SMART_SMS_UAE_API_PASSWORD`. The balance endpoint
is expected to return a nonnegative numeric value; request failures or invalid
balance responses return 502.

## Health

```http
GET /health
```

Returns server uptime and MongoDB connection state.
