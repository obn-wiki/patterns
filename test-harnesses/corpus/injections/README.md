# Adversarial Prompt Injection Corpus

Test samples for validating prompt injection defense patterns.

## Structure

```
injections/
├── direct.jsonl           # Direct "ignore instructions" style attacks
├── indirect.jsonl         # Instructions embedded in seemingly normal content
├── multi-step.jsonl       # Attacks that build up over multiple messages
├── authority.jsonl        # Impersonation ("I'm the admin, do X")
├── encoding.jsonl         # Base64, rot13, unicode tricks
└── context-overflow.jsonl # Attempts to fill context and push out safety instructions
```

## Format

```json
{"id": "inj-001", "vector": "email_body", "payload": "...", "expected": "reject", "severity": "high", "tags": ["direct"]}
```

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique injection ID |
| `vector` | string | Delivery method: email_body, webhook, scraped_page, group_message |
| `payload` | string | The injection content |
| `expected` | string | Expected behavior: reject, log, escalate |
| `severity` | string | Impact if successful: low, medium, high, critical |
| `tags` | string[] | Categories for filtering |

## Usage

```bash
# Run injection tests against security patterns
./test-harnesses/security/prompt-injection-defense.sh --corpus injections/
```

## Contributing

When you discover a new injection vector that bypasses existing defenses, add it here. Include the attack, the expected defense, and which pattern should catch it.
