# KaliGPT VM Deployment Guide

This guide provides detailed instructions for deploying KaliGPT in a Kali Linux Virtual Machine environment.

## 📋 Table of Contents

1. [VM Setup](#vm-setup)
2. [Installation Methods](#installation-methods)
3. [Configuration](#configuration)
4. [Security Hardening](#security-hardening)
5. [Performance Tuning](#performance-tuning)
6. [Troubleshooting](#troubleshooting)
7. [Best Practices](#best-practices)

## 🖥️ VM Setup

### Recommended VM Specifications

#### Minimum Configuration

- **Hypervisor**: VirtualBox 7.0+ / VMware Workstation 17+ / Hyper-V
- **OS**: Kali Linux 2023.4 or later
- **CPU**: 2 cores
- **RAM**: 4GB
- **Storage**: 20GB (dynamic allocation)
- **Network**: NAT + Host-Only Adapter

#### Recommended Configuration

- **CPU**: 4 cores
- **RAM**: 8GB
- **Storage**: 50GB SSD (dynamic allocation)
- **Network**: Bridged Adapter (for network testing)
- **Graphics**: 128MB VRAM

### Step 1: Download Kali Linux

```bash
# Download from official source
wget https://cdimage.kali.org/kali-2023.4/kali-linux-2023.4-installer-amd64.iso

# Verify checksum
sha256sum kali-linux-2023.4-installer-amd64.iso
```

### Step 2: Create VM

#### VirtualBox

```bash
# Create VM
VBoxManage createvm --name "KaliGPT" --ostype "Debian_64" --register

# Configure VM
VBoxManage modifyvm "KaliGPT" --memory 8192 --cpus 4 --vram 128
VBoxManage modifyvm "KaliGPT" --nic1 bridged --bridgeadapter1 "eth0"
VBoxManage modifyvm "KaliGPT" --nic2 hostonly --hostonlyadapter2 "vboxnet0"

# Create and attach disk
VBoxManage createhd --filename "KaliGPT.vdi" --size 51200
VBoxManage storagectl "KaliGPT" --name "SATA Controller" --add sata
VBoxManage storageattach "KaliGPT" --storagectl "SATA Controller" --port 0 --device 0 --type hdd --medium "KaliGPT.vdi"

# Attach ISO
VBoxManage storageattach "KaliGPT" --storagectl "SATA Controller" --port 1 --device 0 --type dvddrive --medium kali-linux-2023.4-installer-amd64.iso
```

#### VMware

1. Open VMware Workstation
2. File → New Virtual Machine
3. Select "Installer disc image file (iso)"
4. Choose Linux → Debian 11.x 64-bit
5. Allocate resources as per recommendations
6. Complete installation

### Step 3: Install Kali Linux

1. Boot from ISO
2. Select "Graphical Install"
3. Follow installation wizard
4. Create user account
5. Install GRUB bootloader
6. Reboot

### Step 4: Post-Installation Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essential tools
sudo apt install -y \
    git \
    curl \
    wget \
    vim \
    htop \
    net-tools \
    build-essential

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installations
docker --version
docker-compose --version
```

## 🚀 Installation Methods

### Method 1: Docker Deployment (Recommended)

```bash
# Clone repository
cd ~/Desktop
git clone <repository-url> kali-gpt
cd kali-gpt

# Build and start services
docker-compose up -d --build

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Access application
# Frontend: http://localhost:5173
# Backend: http://localhost:8000/docs
```

### Method 2: Manual Installation

#### Backend Setup

```bash
# Navigate to backend
cd ~/Desktop/kali-gpt/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Install security tools
sudo apt install -y \
    nmap \
    nikto \
    dirb \
    gobuster \
    john \
    hydra \
    aircrack-ng \
    wireshark \
    sqlmap \
    metasploit-framework

# Start backend
python3 main.py
```

#### Frontend Setup

```bash
# Install Node.js (if not installed)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Navigate to frontend
cd ~/Desktop/kali-gpt/frontend

# Install dependencies
npm install

# Start frontend
npm run dev
```

### Method 3: Systemd Service (Production)

#### Backend Service

```bash
# Create service file
sudo nano /etc/systemd/system/kaligpt-backend.service
```

```ini
[Unit]
Description=KaliGPT Backend API
After=network.target

[Service]
Type=simple
User=kali
WorkingDirectory=/home/kali/Desktop/kali-gpt/backend
Environment="PATH=/home/kali/Desktop/kali-gpt/backend/venv/bin"
ExecStart=/home/kali/Desktop/kali-gpt/backend/venv/bin/python3 -m uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

#### Frontend Service

```bash
# Create service file
sudo nano /etc/systemd/system/kaligpt-frontend.service
```

```ini
[Unit]
Description=KaliGPT Frontend
After=network.target kaligpt-backend.service

[Service]
Type=simple
User=kali
WorkingDirectory=/home/kali/Desktop/kali-gpt/frontend
ExecStart=/usr/bin/npm run dev
Restart=always

[Install]
WantedBy=multi-user.target
```

#### Enable Services

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable and start services
sudo systemctl enable kaligpt-backend
sudo systemctl enable kaligpt-frontend
sudo systemctl start kaligpt-backend
sudo systemctl start kaligpt-frontend

# Check status
sudo systemctl status kaligpt-backend
sudo systemctl status kaligpt-frontend
```

## ⚙️ Configuration

### Network Configuration

#### Bridged Adapter (For Network Testing)

```bash
# Configure network interface
sudo nano /etc/network/interfaces
```

```
auto eth0
iface eth0 inet dhcp

auto eth1
iface eth1 inet static
    address 192.168.56.10
    netmask 255.255.255.0
```

#### Firewall Configuration

```bash
# Install UFW
sudo apt install ufw

# Configure firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 5173/tcp  # Frontend (Vite dev server; see docker-compose.yml)
sudo ufw allow 8000/tcp  # Backend
sudo ufw allow 22/tcp    # SSH

# Enable firewall
sudo ufw enable
sudo ufw status
```

### Environment Variables

```bash
# Create .env file
cd ~/Desktop/kali-gpt/backend
nano .env
```

```env
# API Configuration
API_HOST=0.0.0.0
API_PORT=8000
DEBUG=false

# Security Settings
MAX_COMMAND_TIMEOUT=300
ENABLE_COMMAND_LOGGING=true
LOG_LEVEL=INFO

# CORS Settings
ALLOWED_ORIGINS=http://localhost:5173,http://192.168.56.10:5173

# LLM Integration (Optional)
OPENAI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here
```

## 🔒 Security Hardening

### 1. System Hardening

```bash
# Disable root login
sudo passwd -l root

# Configure SSH
sudo nano /etc/ssh/sshd_config
```

```
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
Port 2222
```

```bash
# Restart SSH
sudo systemctl restart ssh
```

### 2. Application Security

```bash
# Set proper file permissions
cd ~/Desktop/kali-gpt
chmod 700 backend/
chmod 700 frontend/
chmod 600 backend/.env

# Create audit log directory
sudo mkdir -p /var/log/kaligpt
sudo chown kali:kali /var/log/kaligpt
```

### 3. Docker Security

```bash
# Run containers with limited privileges
# Edit docker-compose.yml
```

```yaml
services:
  backend:
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
    read_only: true
    tmpfs:
      - /tmp
```

### 4. Network Isolation

```bash
# Create isolated network for testing
docker network create --driver bridge --subnet 172.20.0.0/16 pentest-network

# Update docker-compose.yml to use isolated network
```

## 🎯 Performance Tuning

### 1. VM Optimization

```bash
# Install VM tools
sudo apt install -y open-vm-tools  # VMware
sudo apt install -y virtualbox-guest-utils  # VirtualBox

# Enable shared folders (VirtualBox)
sudo adduser $USER vboxsf
```

### 2. Docker Optimization

```bash
# Configure Docker daemon
sudo nano /etc/docker/daemon.json
```

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2"
}
```

```bash
# Restart Docker
sudo systemctl restart docker
```

### 3. Application Optimization

```bash
# Backend: Use production ASGI server
pip install gunicorn

# Start with Gunicorn
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000

# Frontend: Build for production
cd frontend
npm run build
npm install -g serve
serve -s dist -l 5173
```

## 🐛 Troubleshooting

### Common Issues

#### Issue 1: Docker Permission Denied

```bash
# Solution
sudo usermod -aG docker $USER
newgrp docker
# Logout and login again
```

#### Issue 2: Port Already in Use

```bash
# Find process using port
sudo netstat -tulpn | grep :8000

# Kill process
sudo kill -9 <PID>

# Or change port in configuration
```

#### Issue 3: Tools Not Found

```bash
# Install missing tools
sudo apt update
sudo apt install -y <tool-name>

# Verify installation
which nmap
which nikto
```

#### Issue 4: Frontend Can't Connect to Backend

```bash
# Check backend status
curl http://localhost:8000/health

# Check firewall
sudo ufw status

# Check CORS settings in backend/main.py
```

### Logs and Debugging

```bash
# Backend logs
docker-compose logs backend

# Frontend logs
docker-compose logs frontend

# System logs
sudo journalctl -u kaligpt-backend -f
sudo journalctl -u kaligpt-frontend -f

# Application logs
tail -f /var/log/kaligpt/app.log
```

## 📚 Best Practices

### 1. Regular Updates

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Update Docker images
docker-compose pull
docker-compose up -d

# Update Node packages
cd frontend && npm update
```

### 2. Backup Strategy

```bash
# Create backup script
nano ~/backup-kaligpt.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/home/kali/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup application
tar -czf $BACKUP_DIR/kaligpt-$DATE.tar.gz ~/Desktop/kali-gpt

# Backup Docker
```
