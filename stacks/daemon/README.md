# Daemon Deployment Stack

Run OpenClaw gateway as a system service for production reliability.

## macOS (launchd)

### Install

```bash
# Copy the plist to LaunchAgents
cp openclaw-gateway.plist ~/Library/LaunchAgents/

# Load and start
launchctl load ~/Library/LaunchAgents/openclaw-gateway.plist
launchctl start com.openclaw.gateway
```

### Manage

```bash
# Check status
launchctl list | grep openclaw

# View logs
tail -f /usr/local/var/log/openclaw-gateway.log

# Stop
launchctl stop com.openclaw.gateway

# Unload
launchctl unload ~/Library/LaunchAgents/openclaw-gateway.plist
```

## Linux (systemd)

### Install

```bash
# Copy the service file
sudo cp openclaw-gateway.service /etc/systemd/system/

# Reload, enable, start
sudo systemctl daemon-reload
sudo systemctl enable openclaw-gateway
sudo systemctl start openclaw-gateway
```

### Manage

```bash
# Check status
sudo systemctl status openclaw-gateway

# View logs
journalctl -u openclaw-gateway -f

# Restart
sudo systemctl restart openclaw-gateway
```

## Files

| File | Platform | Description |
|------|----------|-------------|
| `openclaw-gateway.plist` | macOS | launchd property list |
| `openclaw-gateway.service` | Linux | systemd unit file |
| `env.example` | Both | Environment variable template |
