FROM kalilinux/kali-rolling:latest

# Set working directory
WORKDIR /app

# Update and install Python, venv, and security tools (Kali uses PEP 668 - use venv for pip)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    nmap \
    nikto \
    dirb \
    gobuster \
    john \
    hydra \
    aircrack-ng \
    wireshark \
    sqlmap \
    metasploit-framework \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create venv and install Python dependencies (Kali forbids system-wide pip install)
COPY requirements.txt .
RUN python3 -m venv /app/venv && \
    /app/venv/bin/pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Run the application with venv Python
CMD ["/app/venv/bin/python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
