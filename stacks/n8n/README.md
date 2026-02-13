# n8n Integration Stack

Connect OpenClaw with n8n for workflow automation triggers and actions.

## Use Cases

| Scenario | Trigger | Action |
|----------|---------|--------|
| New email summary | n8n Gmail trigger | Send to OpenClaw via webhook |
| Daily report | n8n cron trigger | OpenClaw generates report via heartbeat |
| Form submission | n8n webhook trigger | OpenClaw processes and responds |
| Alert routing | OpenClaw heartbeat alert | n8n routes to PagerDuty/Slack |

## Architecture

```
[External Event] → [n8n Workflow] → [OpenClaw Webhook/CLI] → [Agent Processing]
                                                              ↓
[n8n Action Node] ← [OpenClaw Response/Event] ← ────────────┘
```

## Setup

### 1. n8n to OpenClaw (Inbound)

Use OpenClaw's webhook or CLI interface to receive n8n triggers:

```json
{
  "nodes": [
    {
      "name": "Trigger",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "path": "openclaw-trigger",
        "httpMethod": "POST"
      }
    },
    {
      "name": "Send to OpenClaw",
      "type": "n8n-nodes-base.executeCommand",
      "parameters": {
        "command": "openclaw system event --text '{{ $json.body.message }}' --mode now"
      }
    }
  ]
}
```

### 2. OpenClaw to n8n (Outbound)

Configure heartbeat or cron to call n8n webhook on events:

**HEARTBEAT.md entry:**
```markdown
- If any alerts need external routing, POST to n8n webhook:
  curl -X POST https://your-n8n.example.com/webhook/openclaw-alerts \
    -H "Content-Type: application/json" \
    -d '{"alert": "<alert details>", "severity": "<level>"}'
```

### 3. Bidirectional (Event Loop)

For complex workflows where n8n and OpenClaw collaborate:

1. External event arrives at n8n
2. n8n preprocesses and sends to OpenClaw
3. OpenClaw processes with full agent capabilities
4. OpenClaw sends result back to n8n webhook
5. n8n routes the response (email, Slack, database, etc.)

## Example Workflows

### Daily Digest

```
[n8n Cron: 8am] → [Trigger OpenClaw heartbeat] → [Agent compiles digest]
                                                    ↓
[n8n Email Node] ← [Agent returns summary] ← ─────┘
```

### Incident Response

```
[n8n Monitoring Alert] → [OpenClaw analyzes] → [Agent determines severity]
                                                  ↓
                                        ┌─────────┴──────────┐
                                   [Low: log]          [High: page on-call]
                                                              ↓
                                                    [n8n PagerDuty Node]
```

## Security Notes

- Authenticate n8n webhooks with shared secret headers
- Don't pass sensitive data through n8n workflow logs
- Use n8n's credential management for API keys, not inline
- Rate limit inbound webhooks to prevent agent overload
