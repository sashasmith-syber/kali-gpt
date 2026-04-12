# KaliGPT - AI-Powered Penetration Testing Assistant

![KaliGPT](https://img.shields.io/badge/KaliGPT-v2.0.0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Python](https://img.shields.io/badge/python-3.11+-blue)
![React](https://img.shields.io/badge/react-18.2+-blue)

KaliGPT is an AI-powered penetration testing assistant designed specifically for Kali Linux environments. It provides natural language interaction with security tools, intelligent command suggestions, and comprehensive testing guidance, now with local LLM support.

## 🚀 Features

- **Natural Language Interface**: Interact with security tools using plain English
- **Local LLM Integration**: Supports local LLMs like Ollama and LM Studio for offline and private analysis.
- **Intelligent Command Suggestions**: Get context-aware command recommendations
- **Security Tool Integration**: Pre-configured with popular Kali Linux tools
- **Risk Assessment**: Automatic risk level evaluation for suggested commands
- **Ethical Guidelines**: Built-in authorization checks and ethical testing reminders
- **Command Execution**: Safe command execution with validation and sanitization
- **Real-time Feedback**: Live output from executed commands
- **Report Generation**: Assistance with penetration testing documentation

## 🛠️ Integrated Security Tools

- **Network Scanning**: nmap, masscan
- **Web Application Testing**: nikto, dirb, gobuster
- **Password Attacks**: John the Ripper, Hydra
- **Exploitation**: Metasploit Framework
- **Wireless Security**: Aircrack-ng
- **Network Analysis**: Wireshark
- **SQL Injection**: SQLMap

## 📋 Prerequisites

### For Docker Deployment (Recommended)
- Docker Engine 20.10+
- Docker Compose 2.0+
- 8GB RAM minimum (16GB recommended for local LLM)
- 30GB free disk space (for LLM models)

### For Manual Installation
- Kali Linux (2023.4 or later)
- Python 3.11+
- Node.js 20+
- npm or yarn
- Ollama or LM Studio installed locally

## 🚀 Quick Start

### Option 1: Docker Deployment (Recommended for VM)

1. **Clone the repository**

   **Note:** You must replace the placeholder URL below with the actual URL of the KaliGPT GitHub repository.

   ```bash
   # First, navigate to the directory where you want to save the project.
   # For example, on Windows:
   # cd C:\Users\YourUser\Desktop
   #
   # On macOS or Linux:
   # cd ~/Desktop

   # Now, clone the repository.
   git clone https://github.com/your-username/kali-gpt.git
   cd kali-gpt
   ```

2. **Build and start containers**

   Make sure Docker Desktop is running, then run the following command from the project's root directory (`kali-gpt`).
   ```bash
   docker-compose up -d --build
   ```

3. **Pull a model with Ollama**
   ```bash
   docker-compose exec ollama ollama pull llama3
   ```

4. **Access the application**
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

### Option 2: Manual Installation

#### Backend Setup

1. **Navigate to backend directory**
```bash
cd kali-gpt/backend
```

2. **Create virtual environment**
```bash
python3 -m venv venv
source venv/bin/activate
```

3. **Install dependencies**
```bash
pip install -r requirements.txt
```

4. **Start the backend server**
```bash
python3 main.py
```

#### Frontend Setup

1. **Navigate to frontend directory**
```bash
cd kali-gpt/frontend
```

2. **Install dependencies**
```bash
npm install
```

3. **Start the development server**
```bash
npm run dev
```

## 🔧 Configuration

### Security Context Setup

Before using KaliGPT, configure your security context:

1. **Target**: Specify the IP address or network range (e.g., 192.168.1.0/24)
2. **Scope**: Define the testing scope (e.g., web-app-pentest)
3. **Authorization**: Check the "Authorized Testing" box to confirm you have permission

### Environment Variables

Create a `.env` file in the backend directory:

```env
# API Configuration
API_HOST=0.0.0.0
API_PORT=8000

# Security Settings
MAX_COMMAND_TIMEOUT=300
ENABLE_COMMAND_LOGGING=true

# LLM Integration
LLM_PROVIDER=ollama # or "lm_studio"
OLLAMA_HOST=http://ollama:11434 # For Docker. Use http://localhost:11434 for local Ollama
LLM_MODEL=llama3:latest
```

## 📖 Usage Examples

### Example 1: Network Scanning

**User Input:**
```
Scan the network 192.168.1.0/24 for open ports
```

**KaliGPT Response:**
- Provides scanning strategy
- Suggests appropriate nmap command
- Displays risk level
- Offers one-click execution

### Example 2: Web Application Testing

**User Input:**
```
How do I test a web application for vulnerabilities?
```

**KaliGPT Response:**
- Explains web testing methodology
- Suggests tools (nikto, dirb, burpsuite)
- Provides step-by-step guidance
- Offers command examples

### Example 3: Vulnerability Assessment

**User Input:**
```
Explain SQL injection and show me how to test for it
```

**KaliGPT Response:**
- Educational explanation of SQL injection
- Ethical considerations
- Testing methodology
- SQLMap command examples

## 🔒 Security Considerations

### Built-in Safety Features

1. **Command Validation**: All commands are validated before execution
2. **Dangerous Pattern Detection**: Blocks potentially harmful commands
3. **Authorization Checks**: Requires explicit authorization confirmation
4. **Audit Logging**: All activities are logged for accountability
5. **Timeout Protection**: Commands have maximum execution time limits

### Ethical Use Guidelines

⚠️ **IMPORTANT**: KaliGPT is designed for authorized security testing only.

- ✅ Only test systems you have explicit permission to assess
- ✅ Define clear scope boundaries before testing
- ✅ Document all activities thoroughly
- ✅ Follow responsible disclosure practices
- ❌ Never use for unauthorized access or malicious purposes
- ❌ Do not test production systems without proper authorization

## 🏗️ Architecture

```
kali-gpt/
├── frontend/                 # React + TypeScript frontend
│   ├── src/
│   │   ├── kali-gpt-claude.tsx  # Main component
│   │   ├── main.tsx             # Entry point
│   │   └── index.css            # Styles
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── Dockerfile
├── backend/                  # FastAPI backend
│   ├── main.py              # API server
│   ├── llm.py               # NEW: Local LLM integration
│   ├── requirements.txt
│   └── Dockerfile
├── docker-compose.yml       # Container orchestration
└── README.md
```

## 🐛 Troubleshooting

### Backend Issues

**Problem**: Backend won't start
```bash
# Check if port 8000 is available
sudo netstat -tulpn | grep 8000

# Check Python version
python3 --version

# Reinstall dependencies
pip install -r requirements.txt --force-reinstall
```

**Problem**: LLM not responding
- Verify `LLM_PROVIDER` and `OLLAMA_HOST` in `.env` are correct.
- Check Ollama container logs: `docker-compose logs ollama`
- Ensure you have pulled a model: `docker-compose exec ollama ollama pull llama3`

### Frontend Issues

**Problem**: Frontend won't start
```bash
# Clear node modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check Node version
node --version  # Should be 20+
```

### Docker Issues

**Problem**: Container build fails
```bash
# Clean Docker cache
docker system prune -a

# Rebuild without cache
docker-compose build --no-cache
```

## 🦊 GitLab CI/CD Integration

KaliGPT supports seamless integration with GitLab CI/CD for automated security testing and auditing.

### Setting up the Pipeline

Create a `.gitlab-ci.yml` file in the root of your repository with the following configuration to run the comprehensive audit scan automatically on your codebase:

```yaml
stages:
  - security-audit

audit_scan:
  stage: security-audit
  image: python:3.11
  before_script:
    - pip install -r backend/requirements.txt
  script:
    - python comprehensive_test_suite.py
  artifacts:
    reports:
      junit: comprehensive_test_results.json
    paths:
      - comprehensive_test_results.json
```

This pipeline stage will ensure the Net Reaper defense system and all integrated security features are fully tested and audited on every commit.

## 🔄 Updates and Maintenance

### Updating the Application

```bash
# Pull latest changes
git pull origin main

# Rebuild containers
docker-compose down
docker-compose up -d --build
```

## 🗺️ Roadmap

- [x] Integration with local LLM (Ollama, LM Studio)
- [ ] Advanced report generation with templates
- [ ] Multi-user support with role-based access
- [ ] Integration with vulnerability databases (CVE, NVD)
- [ ] Automated testing workflows
- [ ] Plugin system for custom tools
- [ ] Mobile-responsive interface
- [ ] Dark/Light theme toggle
- [ ] Export results to multiple formats (PDF, JSON, XML)
- [ ] Real-time collaboration features

---

**Made with ❤️ for the security community**

**Version**: 2.0.0  
**Last Updated**: 2024
