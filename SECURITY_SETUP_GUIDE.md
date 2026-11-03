# Security Setup Guide - KaliGPT & Desktop Defender

## Overview

This guide provides instructions for securely configuring the KaliGPT backend and Desktop Defender applications after the security audit fixes have been applied.

## Critical Security Changes

### 1. Backend Admin Password (KaliGPT)

**What Changed:**
- An admin is seeded only when `KALIGPT_ADMIN_PASSWORD` is configured.
- The backend no longer generates or logs an admin password.
- Seed username, email, and password are validated before the account is saved.

**Setup Instructions:**

1. **Create and configure the backend environment file:**
   ```bash
   cp backend/.env.example backend/.env
   python -c "import secrets; print(secrets.token_urlsafe(32))"
   ```
   Set the generated value as `SECRET_KEY`, and set `KALIGPT_ADMIN_PASSWORD`
   to a unique password of at least 16 characters, with uppercase, lowercase,
   and a digit, and no more than 72 UTF-8 bytes.

2. **Start KaliGPT using the configured environment:**
   ```bash
   docker compose --env-file backend/.env up -d --build
   ```

3. If no admin seed password is configured, the backend starts without seeding
   an admin. Set it in `backend/.env` and restart to seed one; invalid seed
   configuration stops startup without creating a partial account.

### 2. Desktop Defender Agent Token

**What Changed:**
- The hardcoded default token `"change-me-local-token"` has been removed
- A cryptographically secure random token is now generated on first startup
- The token is saved to `~/.desktop-defender-agent-token` with restricted permissions (600)

**Setup Instructions:**

1. **Start the Desktop Defender agent:**
   ```bash
   cd desktop-defender/agent
   python main.py
   ```

2. **Look for the token in the console output:**
   ```
   ======================================================================
   DESKTOP DEFENDER AGENT TOKEN GENERATED - SECURE THIS IMMEDIATELY
   ======================================================================
   Token: dd_a1B2c3D4e5F6g7H8i9J0...
   Token file: ~/.desktop-defender-agent-token
   ======================================================================
   ⚠️  ACTION REQUIRED: Save this token in your environment or client configuration!
   ⚠️  This token will NOT be shown again!
   ======================================================================
   ```

3. **Configure the token in the Desktop Defender Electron app:**
   - Open the Desktop Defender application
   - You will see a security warning if the token is not configured
   - Enter the token in the "Agent Token" field
   - Click "Save Config"
   - The warning should disappear

4. **Alternative: Set via environment variable:**
   ```bash
   export DESKTOP_DEFENDER_AGENT_TOKEN="dd_a1B2c3D4e5F6g7H8i9J0..."
   ```

5. **If you lose the token:**
   - Check the token file: `cat ~/.desktop-defender-agent-token`
   - If the file is lost, delete it and restart the agent to generate a new one
   - **Warning:** You will need to reconfigure all clients with the new token

## Security Best Practices

### Password Requirements

The backend enforces strong password policies:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one digit

**Recommended:** Use passwords with:
- 16+ characters
- Mix of uppercase, lowercase, numbers, and special characters
- No dictionary words or personal information
- Unique to this application

### Token Security

- Tokens are 32+ character cryptographically secure random strings
- Store tokens in environment variables or secure credential stores
- Never commit tokens to version control
- Rotate tokens periodically (every 90 days recommended)
- Use different tokens for different environments (dev, staging, prod)

### Network Security

- The backend runs on `0.0.0.0:8000` by default
- **Production:** Use a reverse proxy (nginx, Apache) with TLS/SSL
- **Production:** Restrict access using firewall rules
- **Production:** Use VPN or private network for agent communication
- Never expose the backend directly to the internet without TLS

### CORS Configuration

The backend has CORS configured with restricted origins:
- Default: `http://localhost:3000,http://localhost:5173`
- **Production:** Update `ALLOWED_ORIGINS` environment variable to only allow your frontend domain

### Rate Limiting

Rate limiting is enabled to prevent abuse:
- Authentication endpoints: 5 requests/minute
- Command execution: 10 requests/minute
- Chat endpoints: 30 requests/minute

## Environment Variables

### Backend (`.env` file)

```bash
# Required
# Generate with: python -c "import secrets; print(secrets.token_urlsafe(32))"
SECRET_KEY=
ALLOWED_ORIGINS=https://yourdomain.com,https://admin.yourdomain.com

# Optional
LOG_LEVEL=INFO
LOG_FILE=kaligpt.log
MAX_COMMAND_TIMEOUT=300
# Set to "ollama" or "lm_studio" only when using a local LLM.
LLM_PROVIDER=none
OLLAMA_HOST=http://localhost:11434
```

### Desktop Defender Agent

```bash
# Optional - if not set, token is read from ~/.desktop-defender-agent-token
DESKTOP_DEFENDER_AGENT_TOKEN=dd_your_token_here
```

## Security Checklist

- [ ] Admin seed password is unique and deployment-specific, if an admin was seeded
- [ ] Desktop Defender agent token configured in Electron app
- [ ] Environment variables set for production
- [ ] TLS/SSL configured for production
- [ ] Firewall rules configured
- [ ] CORS origins restricted to known domains
- [ ] Rate limiting verified working
- [ ] Audit logging enabled
- [ ] Regular security audits scheduled

## Troubleshooting

### "Invalid agent token" error
- Verify the token is correctly entered in the Desktop Defender app
- Check that the agent is running and accessible
- Verify the token file exists: `cat ~/.desktop-defender-agent-token`

### "Could not validate credentials" error
- Verify you're using the correct admin password
- Check that the backend is running
- If the admin password is lost, use the application's documented account recovery procedure; no default password reset flag is provided.

### Security warnings persist
- Ensure all configuration is saved
- Restart the Electron app after configuration
- Check browser console for detailed error messages

## Contact & Support

For security-related issues or questions:
- Review the code in `backend/auth.py` and `desktop-defender/agent/main.py`
- Check the logs for detailed error messages
- Ensure all environment variables are properly set

---

**Last Updated:** After Security Audit Fixes  
**Security Level:** Hardened  
**Review Date:** 2026-01-10
