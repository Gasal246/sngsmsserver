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

## Health

```http
GET /health
```

Returns server uptime and MongoDB connection state.
