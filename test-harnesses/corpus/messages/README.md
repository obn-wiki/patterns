# Test Message Corpus

Standard input corpus for validating OpenClaw operational patterns.

## Structure

```
messages/
├── routine.jsonl        # 200 routine messages (greetings, questions, tasks)
├── ambiguous.jsonl      # 100 ambiguous messages (unclear intent, partial context)
├── multi-turn.jsonl     # 100 multi-turn conversations (context dependency)
├── channel-mixed.jsonl  # 100 messages across different channel types
└── edge-cases.jsonl     # 50 edge cases (empty, very long, unicode, etc.)
```

## Format

Each line is a JSON object:

```json
{"id": "msg-001", "channel": "dm", "sender": "user", "text": "...", "expected_behavior": "respond", "tags": ["routine"]}
```

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique message ID |
| `channel` | string | Channel type: dm, slack, telegram, email, group |
| `sender` | string | Sender identifier |
| `text` | string | Message content |
| `expected_behavior` | string | Expected agent behavior: respond, react, ignore, escalate |
| `tags` | string[] | Tags for filtering: routine, ambiguous, urgent, sensitive |

## Usage

```bash
# Feed corpus to test harness
cat messages/routine.jsonl | ./test-harnesses/framework/runner.sh --stdin
```

## Contributing Messages

Add messages that exposed real failures. Tag them with the pattern they're relevant to.
