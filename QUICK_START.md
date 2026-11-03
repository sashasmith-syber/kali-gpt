# KaliGPT Quick Start Guide

Get KaliGPT running in your Kali Linux VM in under 10 minutes!

## 🚀 Prerequisites Check

```bash
# Check if you have the required tools
docker --version          # Should be 20.10+
docker compose version   # Should be 2.24+
git --version            # Any recent version
```

If any are missing, install them:

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose plugin
sudo apt-get update
sudo apt-get install docker-compose-plugin
```

## 📥 Installation (3 Steps)

### Step 1: Clone the Repository

```bash
cd ~/Desktop
git clone <your-repo-url> kali-gpt
cd kali-gpt
```

### Step 2: Start the Application

```bash
# Copy backend/.env.example to backend/.env and set SECRET_KEY and KALIGPT_ADMIN_PASSWORD first.
# Build and start all services
docker compose --env-file backend/.env up -d --build

# This will take 5-10 minutes on first run
```

### Step 3: Access the Application

Open your browser and navigate to:

- **Frontend**: http://localhost:5173
- **API Docs**: http://localhost:8000/docs

## ✅ Verify Installation

```bash
# Check if containers are running
docker compose --env-file backend/.env ps

# You should see:
# kaligpt-backend   running   0.0.0.0:8000->8000/tcp
# kaligpt-frontend  running   0.0.0.0:5173->5173/tcp

# Check backend health
curl http://localhost:8000/health

# Should return: {"status":"healthy",...}
```

## 🎯 First Use

1. **Open the application** at http://localhost:5173

2. **Set Security Context** (top bar):

   - Target: `192.168.1.100` (example)
   - Scope: `web-app-test`
   - ✅ Check "Authorized Testing"

3. **Try your first query**:

   ```
   Scan 192.168.1.100 for open ports
   ```

4. **Review the suggestion** and click "Execute Command" if appropriate

## 🛑 Stop the Application

```bash
# Stop all services
docker compose --env-file backend/.env down

# Stop and remove all data
docker compose --env-file backend/.env down -v
```

## 🔄 Restart the Application

```bash
# Start existing containers
docker compose --env-file backend/.env start

# Or rebuild and start
docker compose --env-file backend/.env up -d --build
```

## 📊 View Logs

```bash
# View all logs
docker compose --env-file backend/.env logs -f

# View backend logs only
docker compose --env-file backend/.env logs -f backend

# View frontend logs only
docker compose --env-file backend/.env logs -f frontend
```

## 🐛 Common Issues

### Issue: Port already in use

```bash
# Find what's using the port
sudo netstat -tulpn | grep :5173
sudo netstat -tulpn | grep :8000

# Kill the process or change ports in docker-compose.yml
```

### Issue: Permission denied

```bash
# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Logout and login again
```

### Issue: Containers won't start

```bash
# Check logs for errors
docker compose --env-file backend/.env logs

# Rebuild from scratch
docker compose --env-file backend/.env down -v
docker compose --env-file backend/.env up -d --build
```

## 🎓 Next Steps

1. Read the full [README.md](README.md) for detailed features
2. Check [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for production setup
3. Review [IMPROVEMENTS_AND_CORRECTIONS.md](IMPROVEMENTS_AND_CORRECTIONS.md) for known issues

## ⚠️ Important Security Notes

- ✅ Only use on authorized systems
- ✅ Always set proper security context
- ✅ Review commands before execution
- ❌ Never use on production systems without permission
- ❌ Don't expose to public internet without authentication

## 📞 Need Help?

- Check the logs: `docker compose --env-file backend/.env logs -f`
- Review the troubleshooting section in README.md
- Open an issue on GitHub

---

**Ready to start? Run these commands:**

```bash
cd ~/Desktop
git clone <your-repo-url> kali-gpt
cd kali-gpt
cp backend/.env.example backend/.env
# Set SECRET_KEY and KALIGPT_ADMIN_PASSWORD in backend/.env before running:
docker compose --env-file backend/.env up -d --build
```

Then open http://localhost:5173 in your browser! 🚀
