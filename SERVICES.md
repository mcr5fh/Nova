# Nova Service Management

This document describes how to run Nova services and manage them with systemd.

## Overview

Nova provides two services that run as background daemons:

1. **Orchestrator** - Executes CASCADE tasks in the background
2. **Dashboard** - Provides a web UI at http://localhost:8000 for monitoring task progress

Both services support daemon mode with proper logging and systemd integration.

## Installation (One-Time Setup)

Nova is designed to be installed once and used anywhere, like git.

### 1. Install Nova Package

```bash
# Clone the Nova repository
git clone https://github.com/yourusername/Nova.git
cd Nova

# Install with uv (recommended)
uv pip install -e .

# Or with pip
pip install -e .
```

This makes the `nova` command available globally.

### 2. Install Systemd Service Files (Optional)

If you want to manage Nova services with systemd instead of the `nova` CLI:

```bash
# Copy service files
mkdir -p ~/.config/systemd/user
cp systemd/nova-orchestrator.service ~/.config/systemd/user/
cp systemd/nova-dashboard.service ~/.config/systemd/user/

# Edit service files to set your project directory
nano ~/.config/systemd/user/nova-orchestrator.service
nano ~/.config/systemd/user/nova-dashboard.service

# Change this line in both files:
# WorkingDirectory=%h/nova
# to your actual project directory:
# WorkingDirectory=/path/to/your/project

# Reload systemd
systemctl --user daemon-reload
```

To start services automatically on login:

```bash
systemctl --user enable nova-orchestrator
systemctl --user enable nova-dashboard
```

**Note:** When using systemd service files, you need to manually edit the `WorkingDirectory` in the service files for each project. The `nova` CLI is simpler as it automatically uses your current directory.

## Quick Start

### Using the Nova CLI (Recommended)

The `nova` CLI provides the simplest way to manage services:

```bash
# Navigate to your project directory
cd /path/to/your/project

# Initialize a new CASCADE.md file
nova init

# Start all services (orchestrator + dashboard)
nova start

# View dashboard
open http://localhost:8000

# Check status
nova status

# View logs
nova logs orchestrator
nova logs dashboard --follow  # Follow logs in real-time

# Stop all services
nova stop

# Restart all services
nova restart
```

### Service Targets

You can start individual services:

```bash
nova start orchestrator  # Start only orchestrator
nova start dashboard     # Start only dashboard
nova start              # Start both (default)
```

## Using Nova from Any Directory

Once installed, you can use Nova from any project directory:

```bash
# Project 1
cd ~/projects/webapp
nova init
nova start

# Project 2 (Nova is already installed)
cd ~/projects/api-service
nova init
nova start
```

Each project gets its own CASCADE.md, cascade_state.json, and logs/ directory. The Nova services run from wherever you start them.

## Manual Service Control (Advanced)

If you installed systemd service files, you can also manage services directly with systemctl:

```bash
# Start services
systemctl --user start nova-orchestrator
systemctl --user start nova-dashboard

# Stop services
systemctl --user stop nova-orchestrator
systemctl --user stop nova-dashboard

# Restart services
systemctl --user restart nova-orchestrator
systemctl --user restart nova-dashboard

# Check status
systemctl --user status nova-orchestrator
systemctl --user status nova-dashboard

# View logs
journalctl --user -u nova-orchestrator
journalctl --user -u nova-dashboard -f  # Follow logs
```

## Running Without Systemd

You can also run the services manually in daemon mode:

### Orchestrator

```bash
python -m program_nova.engine.orchestrator --daemon
```

Options:
- `--daemon` - Run in daemon mode (log to file)
- `--max-workers N` - Maximum concurrent workers (default: 3)
- `--state-file PATH` - Path to state file (default: cascade_state.json)
- `CASCADE_FILE` - Path to cascade file (default: CASCADE.md)

### Dashboard

```bash
python -m program_nova.dashboard.server --daemon
```

Options:
- `--daemon` - Run in daemon mode (log to file)
- `--host HOST` - Host to bind to (default: 0.0.0.0)
- `--port PORT` - Port to bind to (default: 8000)
- `--state-file PATH` - Path to state file (default: cascade_state.json)
- `--cascade-file PATH` - Path to cascade file (default: CASCADE.md)
- `--milestones-file PATH` - Path to milestones file (default: program_nova/milestones.yaml)

## Logging

### Log Files

When running in daemon mode, logs are written to:

- Orchestrator: `logs/orchestrator.log`
- Dashboard: `logs/dashboard.log`

Log files use rotation (max 10MB, 5 backups).

### Systemd Logs

When running as systemd services, logs are also available via journalctl:

```bash
# View all orchestrator logs
journalctl --user -u nova-orchestrator

# View last 100 lines
journalctl --user -u nova-orchestrator -n 100

# Follow logs in real-time
journalctl --user -u nova-orchestrator -f

# View logs since a specific time
journalctl --user -u nova-orchestrator --since "1 hour ago"

# View logs for a specific date
journalctl --user -u nova-orchestrator --since "2024-01-01" --until "2024-01-02"
```

## Log Directory

The system also maintains task-specific logs in `logs/`:

```
logs/
├── orchestrator.log       # Orchestrator daemon log
├── dashboard.log          # Dashboard daemon log
├── F1.log                 # Task-specific logs
├── F2.log
└── ...
```

## Troubleshooting

### Service Won't Start

1. Check the service status:
   ```bash
   systemctl --user status nova-orchestrator
   ```

2. View recent logs:
   ```bash
   journalctl --user -u nova-orchestrator -n 50
   ```

3. Verify the service file paths are correct:
   ```bash
   systemctl --user cat nova-orchestrator
   ```

### Dashboard Not Accessible

1. Check if the dashboard service is running:
   ```bash
   systemctl --user status nova-dashboard
   ```

2. Verify the port is not in use:
   ```bash
   lsof -i :8000
   ```

3. Check dashboard logs:
   ```bash
   journalctl --user -u nova-dashboard -f
   ```

### Permission Issues

If you get permission errors, ensure:

1. The Nova directory is readable/writable by your user
2. The logs directory exists and is writable:
   ```bash
   mkdir -p logs
   chmod 755 logs
   ```

3. The systemd service files have correct permissions:
   ```bash
   chmod 644 ~/.config/systemd/user/nova-*.service
   ```

## Configuration

### Changing Work Directory

Edit the service files to change the working directory:

```ini
[Service]
WorkingDirectory=/path/to/your/nova/directory
```

Then reload:
```bash
systemctl --user daemon-reload
systemctl --user restart nova-orchestrator nova-dashboard
```

### Changing Log Location

For systemd logs, edit the service files:

```ini
[Service]
StandardOutput=append:/your/custom/log/path/orchestrator.log
StandardError=append:/your/custom/log/path/orchestrator.error.log
```

For daemon mode logs, the location is relative to the working directory.

## Security

The systemd service files include security hardening:

- `NoNewPrivileges=true` - Prevents privilege escalation
- `PrivateTmp=true` - Uses private /tmp directory
- `ProtectSystem=strict` - Read-only access to most system directories
- `ProtectHome=read-only` - Read-only access to home directory
- `ReadWritePaths=%h/nova` - Only the Nova directory is writable

These settings provide isolation and limit the impact of potential security issues.

## Development Mode

For development, you can run services interactively without daemon mode:

```bash
# Orchestrator
python -m program_nova.engine.orchestrator

# Dashboard
python -m program_nova.dashboard.server
```

This logs to the console and is easier for debugging.
