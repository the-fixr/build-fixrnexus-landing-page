# FEEDS API Studio

## Overview

API Studio provides a Swagger-like interface for testing and monitoring oracle APIs. Users can explore endpoints, test requests, and monitor validator health in real-time.

## Access

**URL**: http://localhost:3000/api-studio

## Available APIs

### 1. Oracle Data API

**Endpoint**: `GET /api/v1/oracle/{address}`

**Description**: Fetch real-time data from any oracle by its contract address

**Parameters**:
- `address` (required): Oracle contract address

**Response**:
```json
{
  "success": true,
  "oracle": {
    "address": "0x793Bd341405A5298707C175Bf62B7D171aef02c7",
    "name": "FC-DATA",
    "symbol": "FC-DATA",
    "latestPrice": "0",
    "formattedPrice": "0",
    "consensusThreshold": 66,
    "updateFrequency": 3600,
    "updateFrequencyMinutes": 60,
    "lastUpdate": 0,
    "lastUpdateDate": null,
    "timeSinceUpdate": 1769042491,
    "needsUpdate": true,
    "submissions": {
      "count": 0,
      "required": 4,
      "data": []
    }
  }
}
```

**Example**:
```bash
curl -X GET "http://localhost:3000/api/v1/oracle/0x793Bd341405A5298707C175Bf62B7D171aef02c7"
```

### 2. Validators Health API

**Endpoint**: `GET /api/v1/validators`

**Description**: Check health and status of all 5 validators

**Response**:
```json
{
  "success": true,
  "summary": {
    "total": 5,
    "online": 5,
    "offline": 0,
    "healthy": 5,
    "avgResponseTime": 350
  },
  "validators": [
    {
      "index": 0,
      "address": "0xcBdA8000a200E7e013c52bC6AD1bB11C30DB37E4",
      "endpoint": "https://feeds-validator-1.see21289.workers.dev",
      "status": "online",
      "healthy": true,
      "responseTime": 280,
      "data": {
        "status": "healthy",
        "validator": "0xcBdA8000a200E7e013c52bC6AD1bB11C30DB37E4",
        "configured": {
          "privateKey": true,
          "rpc": true,
          "registry": true
        }
      }
    }
    // ... 4 more validators
  ]
}
```

**Example**:
```bash
curl -X GET "http://localhost:3000/api/v1/validators"
```

## Features

### API Studio Interface

1. **Endpoint Explorer**
   - Browse all available endpoints
   - See method (GET, POST, etc.)
   - View descriptions and parameters

2. **Request Builder**
   - Fill in parameters
   - Execute requests in real-time
   - See formatted responses

3. **Response Viewer**
   - Syntax-highlighted JSON
   - Status codes
   - Copy response functionality

4. **cURL Generator**
   - Auto-generates cURL commands
   - One-click copy to clipboard
   - Test from terminal

### Monitoring Capabilities

**Oracle Status**:
- Current price data
- Submission count
- Consensus requirements
- Last update timestamp
- Whether oracle needs update

**Validator Health**:
- Online/offline status
- Response times
- Health check data
- Configuration status

## Use Cases

### For Users

1. **Test Oracle Data**
   - Check if oracle is receiving data
   - Monitor update frequency
   - Verify consensus is working

2. **Monitor Validators**
   - See which validators are online
   - Check response times
   - Verify all validators are healthy

3. **Debug Issues**
   - See why oracle isn't updating
   - Check if validators are submitting
   - Verify consensus threshold being met

### For Developers

1. **Integration Testing**
   - Test API endpoints before integrating
   - See exact response formats
   - Generate cURL commands for docs

2. **Real-time Monitoring**
   - Monitor oracle performance
   - Track validator uptime
   - Debug deployment issues

3. **API Documentation**
   - Self-documenting API interface
   - Example requests and responses
   - Easy to share with team

## Current Deployment Status

### Deployed Contracts (Base Mainnet)
- **OracleRegistry**: `0xdd2B69f72832aBAD5DA333F6bC4Dd584c13ADD64`
- **OracleFactory**: `0xcCfCDA863366c627cD586ce5CBDD7F8114645189`
- **FC-DATA Oracle**: `0x793Bd341405A5298707C175Bf62B7D171aef02c7`

### Validator Status
All 5 validators are:
- ✅ Deployed to Cloudflare Workers
- ✅ Registered in OracleRegistry
- ✅ Set in OracleFactory
- ✅ Funded with 0.01 ETH on Base
- ✅ Online and healthy (verified via `/api/v1/validators`)

## Expected Behavior

### Fresh Oracle (No Data Yet)
```json
{
  "latestPrice": "0",
  "submissions": {
    "count": 0,
    "required": 4
  },
  "needsUpdate": true
}
```

This is normal for a freshly deployed oracle. Validators will submit data on their next cron run (every 60 minutes for FC-DATA oracle).

### After First Update (3-4 validators submit)
```json
{
  "latestPrice": "12345600",
  "formattedPrice": "1.234567",
  "submissions": {
    "count": 4,
    "required": 4,
    "data": [
      {
        "validator": "0xcBdA8000...",
        "price": "12345600",
        "formattedPrice": "1.234567",
        "timestamp": 1769045000
      }
      // ... more submissions
    ]
  },
  "needsUpdate": false
}
```

### Consensus Achieved
When 4+ validators (66% of 5) submit similar prices, the oracle calculates the median and updates `latestPrice`.

## Future Enhancements

### API Keys & Rate Limiting
- Generate API keys for users
- Track API usage per key
- Implement rate limits
- Usage analytics dashboard

### More Endpoints
- `/api/v1/oracle/{address}/history` - Historical price data
- `/api/v1/oracle/{address}/submissions` - All validator submissions
- `/api/v1/oracle/{address}/events` - Contract events
- `/api/v1/analytics` - System-wide analytics

### WebSocket Support
- Real-time oracle updates
- Live validator status
- Event streaming

### API Playground Features
- Save favorite requests
- Request history
- Share requests with team
- Export to Postman/Insomnia

## Testing

### Test Validators API
```bash
curl http://localhost:3000/api/v1/validators
```

Expected: All 5 validators show `"status": "online"` and `"healthy": true`

### Test Oracle API
```bash
curl http://localhost:3000/api/v1/oracle/0x793Bd341405A5298707C175Bf62B7D171aef02c7
```

Expected: Oracle data with `"needsUpdate": true` (until first validator submission)

### Test Invalid Address
```bash
curl http://localhost:3000/api/v1/oracle/0xinvalid
```

Expected: `{"error": "Invalid oracle address"}`

## Monitoring Validator Submissions

To see when validators start submitting data:

1. **Check oracle every few minutes**:
```bash
watch -n 30 'curl -s http://localhost:3000/api/v1/oracle/0x793Bd341405A5298707C175Bf62B7D171aef02c7 | jq .oracle.submissions.count'
```

2. **Monitor on BaseScan**:
- Go to: https://basescan.org/address/0x793Bd341405A5298707C175Bf62B7D171aef02c7
- Click "Events" tab
- Look for `PriceSubmitted` events

3. **Check Supabase**:
- Query `oracle_updates` table for new entries

## Support

If validators aren't submitting data after 60 minutes:

1. Check validator health: `/api/v1/validators`
2. Verify validators have ETH for gas
3. Check Cloudflare Workers logs
4. Verify cron triggers are configured

---

**The API Studio is now live at**: http://localhost:3000/api-studio 🚀
