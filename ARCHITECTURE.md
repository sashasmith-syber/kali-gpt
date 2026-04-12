# KaliGPT Architecture Documentation

## 🏗️ System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Browser                             │
│                      (http://localhost:5173)                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTP/HTTPS
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                      Frontend Container                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              React + TypeScript (Vite)                    │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │  kali-gpt-claude.tsx (Main Component)              │  │  │
│  │  │  - Chat Interface                                   │  │  │
│  │  │  - Security Context Management                      │  │  │
│  │  │  - Command Execution UI                             │  │  │
│  │  │  - Real-time Updates                                │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                         Port: 5173                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ REST API
                             │ (axios)
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                      Backend Container                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              FastAPI + Python 3.11                        │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │  API Endpoints                                      │  │  │
│  │  │  - /health (Health Check)                           │  │  │
│  │  │  - /api/chat (Chat Interaction)                     │  │  │
│  │  │  - /api/execute (Command Execution)                 │  │  │
│  │  │  - /api/tools (Tool Listing)                        │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │  Core Components                                    │  │  │
│  │  │  - SecurityValidator (Command Validation)           │  │  │
│  │  │  - LLMIntegration (Response Generation)             │  │  │
│  │  │  - Command Executor (Tool Execution)                │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                         Port: 8000                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ subprocess
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                    Kali Linux Security Tools                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  nmap  │  nikto  │  sqlmap  │  metasploit  │  hydra     │  │
│  │  dirb  │  gobuster  │  john  │  aircrack-ng  │  wireshark│  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 🔄 Data Flow

### 1. User Query Flow

```
User Input
    │
    ▼
Frontend (React)
    │
    ├─ Validate Input
    ├─ Check Security Context
    └─ Send to Backend
        │
        ▼
    Backend API (FastAPI)
        │
        ├─ Parse Intent
        ├─ Generate Response
        └─ Create Command Suggestion
            │
            ▼
        Frontend Display
            │
            └─ Show Response + Command
```

### 2. Command Execution Flow

```
User Clicks "Execute"
    │
    ▼
Frontend Confirmation
    │
    ▼
Backend API
    │
    ├─ Validate Context
    ├─ Sanitize Command
    ├─ Check Authorization
    └─ Execute Command
        │
        ▼
    Security Tool (subprocess)
        │
        ├─ Run Command
        ├─ Capture Output
        └─ Return Result
            │
            ▼
        Backend Processing
            │
            ├─ Format Output
            ├─ Log Execution
            └─ Return to Frontend
                │
                ▼
            Frontend Display
                │
                └─ Show Results
```

## 🧩 Component Architecture

### Frontend Components

```
KaliGptClaude (Main Component)
│
├── Header
│   ├── Title
│   ├── Status Indicator
│   └── Security Context Bar
│       ├── Target Input
│       ├── Scope Input
│       └── Authorization Checkbox
│
├── Messages Container
│   ├── Welcome Message (initial state)
│   ├── Message List
│   │   ├── User Messages
│   │   ├── Assistant Messages
│   │   └── System Messages
│   └── Command Suggestions
│       ├── Command Display
│       ├── Risk Badge
│       ├── Description
│       └── Execute Button
│
├── Input Area
│   ├── Text Input
│   └── Send Button
│
└── Footer
    └── Warning Message
```

### Backend Components

```
FastAPI Application
│
├── Middleware
│   ├── CORS
│   └── Error Handling (future)
│
├── API Endpoints
│   ├── /health
│   ├── /api/chat
│   ├── /api/execute
│   ├── /api/tools
│   └── /api/tool/{name}
│
├── Core Classes
│   ├── SecurityValidator
│   │   ├── validate_context()
│   │   └── sanitize_command()
│   │
│   └── LLMIntegration
│       ├── generate_response()
│       ├── parse_intent()
│       └── handle_*_request()
│
└── Models (Pydantic)
    ├── Message
    ├── SecurityContext
    ├── ChatRequest
    ├── ChatResponse
    ├── CommandSuggestion
    ├── ExecuteRequest
    └── ExecuteResponse
```

## 🔐 Security Architecture

### Security Layers

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Frontend Validation                                 │
│ - Input sanitization                                         │
│ - Context validation                                         │
│ - Authorization check                                        │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ Layer 2: API Validation                                      │
│ - Request validation (Pydantic)                              │
│ - CORS policy                                                │
│ - Rate limiting (future)                                     │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ Layer 3: Command Validation                                  │
│ - Whitelist checking                                         │
│ - Pattern detection                                          │
│ - Dangerous command blocking                                 │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ Layer 4: Execution Control                                   │
│ - Timeout limits                                             │
│ - Resource constraints                                       │
│ - Audit logging                                              │
└─────────────────────────────────────────────────────────────┘
```

### Command Validation Process

```
Command Input
    │
    ▼
Check Authorization
    │
    ├─ No → Reject (403)
    │
    ▼
Check Target Specified
    │
    ├─ No → Reject (400)
    │
    ▼
Sanitize Command
    │
    ├─ Check Dangerous Patterns
    │   ├─ rm -rf → Block
    │   ├─ mkfs → Block
    │   ├─ Fork bomb → Block
    │   └─ ...
    │
    ▼
Check Tool Whitelist
    │
    ├─ Not in list → Reject (400)
    │
    ▼
Execute with Timeout
    │
    ├─ Timeout → Kill (408)
    │
    ▼
Log Execution
    │
    ▼
Return Result
```

## 🐳 Docker Architecture

### Container Structure

```
┌─────────────────────────────────────────────────────────────┐
│                     Docker Host (Kali VM)                    │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              kaligpt-network (bridge)                  │  │
│  │                                                         │  │
│  │  ┌─────────────────────┐  ┌─────────────────────┐    │  │
│  │  │  kaligpt-frontend   │  │  kaligpt-backend    │    │  │
│  │  │                     │  │                     │    │  │
│  │  │  Node.js 20         │  │  Kali Linux         │    │  │
│  │  │  Vite Dev Server    │  │  Python 3.11        │    │  │
│  │  │  React App          │  │  FastAPI            │    │  │
│  │  │                     │  │  Security Tools     │    │  │
│  │  │  Port: 5173         │  │  Port: 8000         │    │  │
│  │  └─────────────────────┘  └─────────────────────┘    │  │
│  │           │                         │                  │  │
│  │           └─────────────┬───────────┘                  │  │
│  └─────────────────────────┼──────────────────────────────┘  │
│                            │                                  │
│  ┌─────────────────────────▼──────────────────────────────┐  │
│  │                    Host Network                         │  │
│  │  localhost:5173 → Frontend                              │  │
│  │  localhost:8000 → Backend                               │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Volume Mounts

```
Host                          Container
────────────────────────────────────────────────
./frontend/src         →     /app/src
./frontend/package.json →    /app/package.json
./backend/main.py      →     /app/main.py
./logs                 →     /var/log/kaligpt
./data                 →     /app/data
```

## 📊 State Management

### Frontend State

```
Application State
│
├── UI State
│   ├── messages: Message[]
│   ├── input: string
│   ├── loading: boolean
│   └── apiStatus: string
│
├── Security Context
│   ├── target: string
│   ├── scope: string
│   └── authorization: boolean
│
└── Session State (future)
    ├── user: User
    ├── token: string
    └── preferences: object
```

### Backend State

```
Application State
│
├── Configuration
│   ├── ALLOWED_TOOLS
│   ├── DANGEROUS_PATTERNS
│   └── Environment Variables
│
├── Runtime State
│   ├── Active Connections
│   ├── Running Commands
│   └── Cache (future)
│
└── Persistent State (future)
    ├── User Data
    ├── Chat History
    └── Scan Results
```

## 🔌 API Architecture

### REST API Endpoints

```
GET  /health
     └─ Returns: { status, timestamp, version }

POST /api/chat
     ├─ Input: { message, context, history }
     └─ Returns: { response, command_suggestion }

POST /api/execute
     ├─ Input: { command, context }
     └─ Returns: { output, exit_code, executed_at }

GET  /api/tools
     └─ Returns: { tools, count }

GET  /api/tool/{name}
     └─ Returns: { name, installed, path, info }
```

### Request/Response Flow

```
Client Request
    │
    ▼
FastAPI Router
    │
    ├─ Validate Request (Pydantic)
    │
    ▼
Endpoint Handler
    │
    ├─ Business Logic
    ├─ Security Checks
    └─ Data Processing
        │
        ▼
    Response Model (Pydantic)
        │
        ▼
    JSON Response
        │
        ▼
    Client
```

## 🎯 Future Architecture Enhancements

### Planned Additions

```
Current Architecture
    │
    ├─ Add Authentication Layer
    │   └─ JWT tokens, user management
    │
    ├─ Add Database Layer
    │   └─ PostgreSQL/SQLite
    │
    ├─ Add Caching Layer
    │   └─ Redis
    │
    ├─ Add Message Queue
    │   └─ RabbitMQ/Celery for async tasks
    │
    ├─ Add WebSocket Layer
    │   └─ Real-time updates
    │
    └─ Add Monitoring Layer
        └─ Prometheus + Grafana
```

### Microservices Vision (Long-term)

```
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway                             │
│                   (Authentication, Routing)                  │
└────────┬────────────────────────────────────────────────────┘
         │
    ┌────┴────┬────────┬────────┬────────┬────────┐
    │         │        │        │        │        │
    ▼         ▼        ▼        ▼        ▼        ▼
┌────────┐ ┌────┐ ┌────────┐ ┌────┐ ┌────────┐ ┌────────┐
│ Chat   │ │LLM │ │Command │ │Tool│ │Report  │ │User    │
│Service │ │Svc │ │Executor│ │Mgr │ │Generator│ │Service │
└────────┘ └────┘ └────────┘ └────┘ └────────┘ └────────┘
```

## 📈 Scalability Considerations

### Horizontal Scaling

```
Load Balancer
    │
    ├─ Frontend Instance 1
    ├─ Frontend Instance 2
    └─ Frontend Instance N
        │
        ▼
    API Gateway
        │
        ├─ Backend Instance 1
        ├─ Backend Instance 2
        └─ Backend Instance N
            │
            ▼
        Shared Database
```

### Performance Optimization Points

1. **Frontend**
   - Code splitting
   - Lazy loading
   - Service worker caching
   - CDN for static assets

2. **Backend**
   - Connection pooling
   - Query optimization
   - Response caching
   - Async processing

3. **Infrastructure**
   - Container orchestration (Kubernetes)
   - Auto-scaling
   - Load balancing
   - CDN integration

## 🔍 Monitoring Architecture

### Observability Stack (Future)

```
Application
    │
    ├─ Metrics → Prometheus → Grafana
    ├─ Logs → ELK Stack (Elasticsearch, Logstash, Kibana)
    ├─ Traces → Jaeger
    └─ Alerts → AlertManager → Slack/Email
```

---

**Document Version:** 1.0  
**Last Updated:** 2024  
**Status:** Current Architecture + Future Vision
