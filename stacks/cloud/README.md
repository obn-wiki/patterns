# Cloud Deployment Stack

Deploy OpenClaw gateway on a cloud VM for always-on availability.

## Recommended Setup

| Component | Recommendation |
|-----------|---------------|
| Provider | Any (AWS, GCP, DigitalOcean, Hetzner) |
| Instance | 2 vCPU, 4GB RAM minimum |
| OS | Ubuntu 22.04+ or Debian 12+ |
| Access | Tailscale (preferred) or SSH tunnel |
| Process | systemd (see `../daemon/openclaw-gateway.service`) |

## Quick Start (Ubuntu/Debian)

```bash
# 1. Install Node.js 22+
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Install OpenClaw
sudo npm install -g openclaw

# 3. Create service user
sudo useradd -r -m -s /bin/bash openclaw
sudo -u openclaw mkdir -p /home/openclaw/.openclaw/workspace/memory

# 4. Configure environment
sudo cp env.example /home/openclaw/.openclaw/env
sudo chown openclaw:openclaw /home/openclaw/.openclaw/env
sudo chmod 600 /home/openclaw/.openclaw/env
# Edit with your API keys

# 5. Install systemd service
sudo cp ../daemon/openclaw-gateway.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now openclaw-gateway

# 6. Install Tailscale for remote access
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

## Security Checklist

- [ ] Gateway token set (`OPENCLAW_GATEWAY_TOKEN`)
- [ ] Firewall: block port 18789 from public internet
- [ ] Tailscale ACLs configured for authorized devices only
- [ ] API keys in env file with 600 permissions
- [ ] Automatic security updates enabled (`unattended-upgrades`)
- [ ] Log rotation configured (see `../daemon/`)

## Monitoring

```bash
# Check gateway status
sudo systemctl status openclaw-gateway

# View recent logs
journalctl -u openclaw-gateway --since "1 hour ago"

# Check resource usage
systemctl show openclaw-gateway --property=MemoryCurrent,CPUUsageNSec
```

## Backup

```bash
# Backup workspace (memory, config, index)
tar -czf openclaw-backup-$(date +%Y%m%d).tar.gz -C /home/openclaw .openclaw/

# Restore
tar -xzf openclaw-backup-YYYYMMDD.tar.gz -C /home/openclaw/
```
