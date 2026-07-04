#!/usr/bin/env bash
#
# NoblePort Backend - Linux Setup Script
#
# Sets up the Python backend service on a Linux server.
# Run as root or with sudo.
#
set -euo pipefail

INSTALL_DIR="/opt/nobleport/backend"
SERVICE_USER="nobleport"
PYTHON_VERSION="python3.12"

echo "=== NoblePort Backend Setup ==="
echo ""

# Check for root
if [[ $EUID -ne 0 ]]; then
    echo "Error: This script must be run as root (use sudo)"
    exit 1
fi

# Create service user
if ! id "$SERVICE_USER" &>/dev/null; then
    echo "Creating service user: $SERVICE_USER"
    useradd --system --shell /usr/sbin/nologin --home-dir "$INSTALL_DIR" "$SERVICE_USER"
fi

# Create directories
echo "Creating directories..."
mkdir -p "$INSTALL_DIR"
mkdir -p /var/log/nobleport
mkdir -p /opt/nobleport/data

# Install system dependencies
echo "Installing system dependencies..."
apt-get update -qq
apt-get install -y -qq "$PYTHON_VERSION" "${PYTHON_VERSION}-venv" "${PYTHON_VERSION}-dev" \
    build-essential libpq-dev redis-server

# Copy application files
echo "Copying application files..."
cp -r "$(dirname "$0")/../" "$INSTALL_DIR/"

# Create virtual environment
echo "Setting up Python virtual environment..."
cd "$INSTALL_DIR"
"$PYTHON_VERSION" -m venv .venv
.venv/bin/pip install --upgrade pip wheel
.venv/bin/pip install -r requirements.txt

# Create .env template if it doesn't exist
if [[ ! -f "$INSTALL_DIR/.env" ]]; then
    echo "Creating .env template..."
    cat > "$INSTALL_DIR/.env" << 'ENVEOF'
# NoblePort Backend Configuration
# Copy this file and fill in your values

NOBLEPORT_ENVIRONMENT=production
NOBLEPORT_DEBUG=false
NOBLEPORT_SECRET_KEY=CHANGE_THIS_TO_A_RANDOM_SECRET

# Database
NOBLEPORT_DATABASE_URL=sqlite+aiosqlite:///./nobleport.db

# Redis
NOBLEPORT_REDIS_URL=redis://localhost:6379/0

# Buildertrend Integration
NOBLEPORT_BUILDERTREND_API_KEY=
NOBLEPORT_BUILDERTREND_API_SECRET=
NOBLEPORT_BUILDERTREND_COMPANY_ID=
NOBLEPORT_BUILDERTREND_SYNC_MODE=scheduled
NOBLEPORT_BUILDERTREND_SYNC_INTERVAL_MINUTES=15

# NoblePort ETF Bridge
NOBLEPORT_NOBLEPORT_ENS_DOMAIN=nobleport.eth
NOBLEPORT_NOBLEPORT_RPC_URL=https://mainnet.infura.io/v3/YOUR_KEY
NOBLEPORT_NOBLEPORT_CHAIN_ID=1

# Stephanie.ai
NOBLEPORT_STEPHANIE_MCP_ENDPOINT=http://localhost:3100/mcp
ENVEOF
    chmod 600 "$INSTALL_DIR/.env"
fi

# Set permissions
echo "Setting permissions..."
chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"
chown -R "$SERVICE_USER:$SERVICE_USER" /var/log/nobleport
chown -R "$SERVICE_USER:$SERVICE_USER" /opt/nobleport/data

# Install systemd service
echo "Installing systemd service..."
cp "$INSTALL_DIR/deploy/nobleport-backend.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable nobleport-backend.service

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Edit /opt/nobleport/backend/.env with your configuration"
echo "  2. Start the service: systemctl start nobleport-backend"
echo "  3. Check status: systemctl status nobleport-backend"
echo "  4. View logs: journalctl -u nobleport-backend -f"
echo "  5. API docs: http://localhost:8400/api/docs"
echo ""
