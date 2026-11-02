import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  commandSuggestion?: CommandSuggestion;
}

interface CommandSuggestion {
  command: string;
  description: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  requires_confirmation: boolean;
}

interface SecurityContext {
  target?: string;
  scope?: string;
  authorization?: boolean;
}

type ThemeMode = 'dark' | 'light';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const TOKEN_KEY = 'kaligpt_access_token';
const THEME_KEY = 'kaligpt_theme';

const KaliGptClaude: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [securityContext, setSecurityContext] = useState<SecurityContext>({});
  const [apiStatus, setApiStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const [llmStatus, setLlmStatus] = useState<string>('unknown');
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [authUser, setAuthUser] = useState<{ username: string; role: string } | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(THEME_KEY) as ThemeMode | null;
    return saved === 'light' ? 'light' : 'dark';
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const api = useMemo(() => {
    const client = axios.create({ baseURL: API_BASE_URL });
    client.interceptors.request.use((config) => {
      const t = localStorage.getItem(TOKEN_KEY);
      if (t) {
        config.headers.Authorization = `Bearer ${t}`;
      }
      return config;
    });
    return client;
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    checkApiConnection();
  }, []);

  useEffect(() => {
    if (token) {
      loadMe();
    } else {
      setAuthUser(null);
    }
  }, [token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const checkApiConnection = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/health`);
      setApiStatus(response.data.status === 'healthy' ? 'connected' : 'disconnected');
      setLlmStatus(response.data.llm?.status || 'unknown');
    } catch {
      setApiStatus('disconnected');
      setLlmStatus('down');
    }
  };

  const loadMe = async () => {
    try {
      const res = await api.get('/api/auth/me');
      setAuthUser({ username: res.data.username, role: res.data.role });
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setAuthUser(null);
    }
  };

  const formatLoginDetail = (detail: unknown): string => {
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      const parts = detail.map((item) => {
        if (item && typeof item === 'object' && 'msg' in item) {
          return String((item as { msg: unknown }).msg);
        }
        return typeof item === 'string' ? item : '';
      }).filter(Boolean);
      return parts.join('; ') || 'Login failed';
    }
    return 'Login failed';
  };

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        username,
        password,
      });
      localStorage.setItem(TOKEN_KEY, res.data.access_token);
      setToken(res.data.access_token);
      setPassword('');
    } catch (err: any) {
      setLoginError(formatLoginDetail(err.response?.data?.detail) || 'Login failed');
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setAuthUser(null);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading || !token) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await api.post('/api/chat', {
        message: userMessage.content,
        context: securityContext,
        history: messages.slice(-5),
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.data.response,
        timestamp: new Date(),
        commandSuggestion: response.data.command_suggestion,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      if (response.data.llm_available === false) {
        setLlmStatus('down');
      }
    } catch (error: any) {
      const detail = error.response?.data?.detail || error.message;
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'system',
          content: `Error: ${detail}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const executeCommand = async (command: string) => {
    setLoading(true);
    try {
      const response = await api.post('/api/execute', {
        command,
        context: securityContext,
      });
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'system',
          content: `Command executed:\n\`\`\`bash\n${command}\n\`\`\`\n\nOutput:\n\`\`\`\n${response.data.output}\n\`\`\``,
          timestamp: new Date(),
        },
      ]);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'system',
          content: `Error executing command: ${error.response?.data?.detail || error.message}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return '#4ade80';
      case 'medium': return '#fbbf24';
      case 'high': return '#fb923c';
      case 'critical': return '#ef4444';
      default: return '#6b7280';
    }
  };

  if (!token) {
    return (
      <div className="kgpt-container">
        <form className="kgpt-login" onSubmit={login}>
          <h2>KaliGPT Login</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Sign in with a local account. Seed admin via KALIGPT_ADMIN_PASSWORD.
          </p>
          <input
            className="kgpt-input"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            minLength={3}
          />
          <input
            className="kgpt-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            minLength={8}
          />
          {loginError && <div className="kgpt-error">{loginError}</div>}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="kgpt-btn kgpt-btn-primary" style={{ flex: 1 }}>
              Sign in
            </button>
            <button
              type="button"
              className="kgpt-btn"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="kgpt-container">
      <div className="kgpt-header">
        <div className="kgpt-header-row">
          <h1 className="kgpt-title">
            <span className="kali">Kali</span>
            <span className="gpt">GPT</span>
          </h1>
          <div className="kgpt-actions">
            <div className="kgpt-status">
              <div
                className="kgpt-dot"
                style={{ backgroundColor: apiStatus === 'connected' ? '#4ade80' : '#ef4444' }}
              />
              <span>{apiStatus === 'connected' ? 'API' : 'Offline'}</span>
              <span style={{ color: 'var(--text-dim)' }}>· LLM {llmStatus}</span>
              {authUser && (
                <span style={{ color: 'var(--text-dim)' }}>
                  · {authUser.username} ({authUser.role})
                </span>
              )}
            </div>
            <button
              type="button"
              className="kgpt-btn"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
            <button type="button" className="kgpt-btn" onClick={logout}>
              Logout
            </button>
          </div>
        </div>

        <div className="kgpt-context">
          <input
            className="kgpt-input"
            type="text"
            placeholder="Target (e.g., 192.168.1.0/24)"
            value={securityContext.target || ''}
            onChange={(e) => setSecurityContext({ ...securityContext, target: e.target.value })}
          />
          <input
            className="kgpt-input"
            type="text"
            placeholder="Scope (e.g., web-app-pentest)"
            value={securityContext.scope || ''}
            onChange={(e) => setSecurityContext({ ...securityContext, scope: e.target.value })}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={securityContext.authorization || false}
              onChange={(e) =>
                setSecurityContext({ ...securityContext, authorization: e.target.checked })
              }
            />
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Authorized Testing</span>
          </label>
        </div>
      </div>

      <div className="kgpt-messages">
        {messages.length === 0 && (
          <div className="kgpt-welcome">
            <h2 style={{ color: 'var(--accent)', marginBottom: '1rem' }}>Welcome to KaliGPT</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Local-first AI assistant for authorized Kali testing. LLM and tools use your session role.
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className={`kgpt-message ${message.role}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
              <span style={{ fontWeight: 'bold', color: 'var(--accent)' }}>
                {message.role === 'user' ? 'You' : message.role === 'system' ? 'System' : 'KaliGPT'}
              </span>
              <span style={{ color: 'var(--text-dim)' }}>{message.timestamp.toLocaleTimeString()}</span>
            </div>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{message.content}</div>
            {message.commandSuggestion && (
              <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-input)', borderRadius: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--accent)', fontWeight: 'bold', fontSize: '0.875rem' }}>
                    Suggested Command
                  </span>
                  <span
                    style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: 4,
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      backgroundColor: getRiskColor(message.commandSuggestion.risk_level),
                      color: '#0a0a0a',
                    }}
                  >
                    {message.commandSuggestion.risk_level.toUpperCase()}
                  </span>
                </div>
                <code style={{ display: 'block', padding: '0.75rem', background: 'var(--bg)', borderRadius: 4, color: 'var(--accent)', marginBottom: '0.5rem' }}>
                  {message.commandSuggestion.command}
                </code>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  {message.commandSuggestion.description}
                </p>
                <button
                  className="kgpt-btn kgpt-btn-primary"
                  onClick={() => executeCommand(message.commandSuggestion!.command)}
                  disabled={loading || authUser?.role === 'viewer'}
                >
                  {loading ? 'Executing...' : 'Execute Command'}
                </button>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', padding: '1rem' }}>
            <div className="kgpt-dot" style={{ background: 'var(--accent)', animation: 'pulse 1.5s infinite' }} />
            <div className="kgpt-dot" style={{ background: 'var(--accent)', animation: 'pulse 1.5s infinite' }} />
            <div className="kgpt-dot" style={{ background: 'var(--accent)', animation: 'pulse 1.5s infinite' }} />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="kgpt-composer">
        <textarea
          className="kgpt-textarea"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Ask about security testing, tools, or techniques..."
          rows={3}
          disabled={loading}
        />
        <button
          className="kgpt-btn kgpt-btn-primary"
          onClick={sendMessage}
          disabled={loading || !input.trim()}
        >
          Send
        </button>
      </div>

      <div className="kgpt-footer">
        Use responsibly. Only test systems you have authorization to assess.
      </div>
    </div>
  );
};

export default KaliGptClaude;
