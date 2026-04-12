import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

// Types
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

// Main Component
const KaliGptClaude: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [securityContext, setSecurityContext] = useState<SecurityContext>({});
  const [apiStatus, setApiStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const API_BASE_URL = 'http://localhost:8000';

  // Check API connection on mount
  useEffect(() => {
    checkApiConnection();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const checkApiConnection = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/health`);
      setApiStatus(response.data.status === 'healthy' ? 'connected' : 'disconnected');
    } catch (error) {
      setApiStatus('disconnected');
      console.error('API connection failed:', error);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/chat`, {
        message: input,
        context: securityContext,
        history: messages.slice(-5), // Send last 5 messages for context
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.data.response,
        timestamp: new Date(),
        commandSuggestion: response.data.command_suggestion,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'system',
        content: 'Error: Unable to connect to backend. Please ensure the API server is running.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const executeCommand = async (command: string) => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/execute`, {
        command,
        context: securityContext,
      });

      const resultMessage: Message = {
        id: Date.now().toString(),
        role: 'system',
        content: `Command executed:\n\`\`\`bash\n${command}\n\`\`\`\n\nOutput:\n\`\`\`\n${response.data.output}\n\`\`\``,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, resultMessage]);
    } catch (error: any) {
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'system',
        content: `Error executing command: ${error.response?.data?.error || error.message}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
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

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerContent}>
          <h1 style={styles.title}>
            <span style={styles.kaliText}>Kali</span>
            <span style={styles.gptText}>GPT</span>
          </h1>
          <div style={styles.statusContainer}>
            <div style={{
              ...styles.statusDot,
              backgroundColor: apiStatus === 'connected' ? '#4ade80' : '#ef4444'
            }} />
            <span style={styles.statusText}>
              {apiStatus === 'connected' ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
        
        {/* Security Context */}
        <div style={styles.contextBar}>
          <input
            type="text"
            placeholder="Target (e.g., 192.168.1.0/24)"
            value={securityContext.target || ''}
            onChange={(e) => setSecurityContext({ ...securityContext, target: e.target.value })}
            style={styles.contextInput}
          />
          <input
            type="text"
            placeholder="Scope (e.g., web-app-pentest)"
            value={securityContext.scope || ''}
            onChange={(e) => setSecurityContext({ ...securityContext, scope: e.target.value })}
            style={styles.contextInput}
          />
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={securityContext.authorization || false}
              onChange={(e) => setSecurityContext({ ...securityContext, authorization: e.target.checked })}
            />
            <span style={styles.checkboxText}>Authorized Testing</span>
          </label>
        </div>
      </div>

      {/* Messages Area */}
      <div style={styles.messagesContainer}>
        {messages.length === 0 && (
          <div style={styles.welcomeMessage}>
            <h2 style={styles.welcomeTitle}>Welcome to KaliGPT</h2>
            <p style={styles.welcomeText}>
              Your AI-powered penetration testing assistant for Kali Linux.
            </p>
            <div style={styles.exampleQueries}>
              <p style={styles.exampleTitle}>Try asking:</p>
              <ul style={styles.exampleList}>
                <li>"Scan network 192.168.1.0/24 for open ports"</li>
                <li>"How do I perform a vulnerability assessment?"</li>
                <li>"Explain SQL injection and show me an example"</li>
                <li>"Generate a phishing awareness report"</li>
              </ul>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} style={styles.messageWrapper}>
            <div style={{
              ...styles.message,
              ...(message.role === 'user' ? styles.userMessage : 
                  message.role === 'system' ? styles.systemMessage : 
                  styles.assistantMessage)
            }}>
              <div style={styles.messageHeader}>
                <span style={styles.messageRole}>
                  {message.role === 'user' ? '👤 You' : 
                   message.role === 'system' ? '⚙️ System' : 
                   '🤖 KaliGPT'}
                </span>
                <span style={styles.messageTime}>
                  {message.timestamp.toLocaleTimeString()}
                </span>
              </div>
              <div style={styles.messageContent}>
                {message.content}
              </div>

              {/* Command Suggestion */}
              {message.commandSuggestion && (
                <div style={styles.commandSuggestion}>
                  <div style={styles.commandHeader}>
                    <span style={styles.commandLabel}>Suggested Command</span>
                    <span style={{
                      ...styles.riskBadge,
                      backgroundColor: getRiskColor(message.commandSuggestion.risk_level)
                    }}>
                      {message.commandSuggestion.risk_level.toUpperCase()}
                    </span>
                  </div>
                  <code style={styles.commandCode}>
                    {message.commandSuggestion.command}
                  </code>
                  <p style={styles.commandDescription}>
                    {message.commandSuggestion.description}
                  </p>
                  <button
                    onClick={() => executeCommand(message.commandSuggestion!.command)}
                    style={styles.executeButton}
                    disabled={loading}
                  >
                    {loading ? 'Executing...' : 'Execute Command'}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div style={styles.loadingContainer}>
            <div style={styles.loadingDot}></div>
            <div style={styles.loadingDot}></div>
            <div style={styles.loadingDot}></div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={styles.inputContainer}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask about security testing, tools, or techniques..."
          style={styles.input}
          rows={3}
          disabled={loading}
        />
        <button
          onClick={sendMessage}
          style={{
            ...styles.sendButton,
            ...(loading || !input.trim() ? styles.sendButtonDisabled : {})
          }}
          disabled={loading || !input.trim()}
        >
          {loading ? '⏳' : '🚀'} Send
        </button>
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        <span style={styles.footerText}>
          ⚠️ Use responsibly. Only test systems you have authorization to assess.
        </span>
      </div>
    </div>
  );
};

// Styles
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: '#0a0a0a',
    color: '#e5e5e5',
    fontFamily: "'Fira Code', 'Courier New', monospace",
  },
  header: {
    backgroundColor: '#1a1a1a',
    borderBottom: '2px solid #00ff41',
    padding: '1rem',
  },
  headerContent: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  title: {
    margin: 0,
    fontSize: '2rem',
    fontWeight: 'bold',
  },
  kaliText: {
    color: '#00ff41',
  },
  gptText: {
    color: '#e5e5e5',
  },
  statusContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  statusDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
  },
  statusText: {
    fontSize: '0.875rem',
    color: '#9ca3af',
  },
  contextBar: {
    display: 'flex',
    gap: '1rem',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  contextInput: {
    flex: 1,
    minWidth: '200px',
    padding: '0.5rem',
    backgroundColor: '#2a2a2a',
    border: '1px solid #3a3a3a',
    borderRadius: '4px',
    color: '#e5e5e5',
    fontSize: '0.875rem',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: 'pointer',
  },
  checkboxText: {
    fontSize: '0.875rem',
    color: '#9ca3af',
  },
  messagesContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '1rem',
    backgroundColor: '#0f0f0f',
  },
  welcomeMessage: {
    textAlign: 'center',
    padding: '3rem 1rem',
    maxWidth: '600px',
    margin: '0 auto',
  },
  welcomeTitle: {
    color: '#00ff41',
    fontSize: '2rem',
    marginBottom: '1rem',
  },
  welcomeText: {
    color: '#9ca3af',
    fontSize: '1.125rem',
    marginBottom: '2rem',
  },
  exampleQueries: {
    textAlign: 'left',
    backgroundColor: '#1a1a1a',
    padding: '1.5rem',
    borderRadius: '8px',
    border: '1px solid #2a2a2a',
  },
  exampleTitle: {
    color: '#00ff41',
    fontWeight: 'bold',
    marginBottom: '0.5rem',
  },
  exampleList: {
    color: '#9ca3af',
    lineHeight: '1.8',
  },
  messageWrapper: {
    marginBottom: '1rem',
  },
  message: {
    padding: '1rem',
    borderRadius: '8px',
    maxWidth: '80%',
  },
  userMessage: {
    backgroundColor: '#1e3a8a',
    marginLeft: 'auto',
  },
  assistantMessage: {
    backgroundColor: '#1a1a1a',
    border: '1px solid #2a2a2a',
  },
  systemMessage: {
    backgroundColor: '#2a2a2a',
    border: '1px solid #3a3a3a',
  },
  messageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '0.5rem',
    fontSize: '0.875rem',
  },
  messageRole: {
    fontWeight: 'bold',
    color: '#00ff41',
  },
  messageTime: {
    color: '#6b7280',
  },
  messageContent: {
    whiteSpace: 'pre-wrap',
    lineHeight: '1.6',
  },
  commandSuggestion: {
    marginTop: '1rem',
    padding: '1rem',
    backgroundColor: '#2a2a2a',
    borderRadius: '6px',
    border: '1px solid #3a3a3a',
  },
  commandHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
  },
  commandLabel: {
    fontSize: '0.875rem',
    fontWeight: 'bold',
    color: '#00ff41',
  },
  riskBadge: {
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: 'bold',
  },
  commandCode: {
    display: 'block',
    padding: '0.75rem',
    backgroundColor: '#1a1a1a',
    borderRadius: '4px',
    color: '#00ff41',
    fontSize: '0.875rem',
    overflowX: 'auto',
    marginBottom: '0.5rem',
  },
  commandDescription: {
    fontSize: '0.875rem',
    color: '#9ca3af',
    marginBottom: '0.75rem',
  },
  executeButton: {
    padding: '0.5rem 1rem',
    backgroundColor: '#00ff41',
    color: '#0a0a0a',
    border: 'none',
    borderRadius: '4px',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
  loadingContainer: {
    display: 'flex',
    gap: '0.5rem',
    justifyContent: 'center',
    padding: '1rem',
  },
  loadingDot: {
    width: '8px',
    height: '8px',
    backgroundColor: '#00ff41',
    borderRadius: '50%',
    animation: 'pulse 1.5s infinite',
  },
  inputContainer: {
    padding: '1rem',
    backgroundColor: '#1a1a1a',
    borderTop: '1px solid #2a2a2a',
    display: 'flex',
    gap: '1rem',
  },
  input: {
    flex: 1,
    padding: '0.75rem',
    backgroundColor: '#2a2a2a',
    border: '1px solid #3a3a3a',
    borderRadius: '6px',
    color: '#e5e5e5',
    fontSize: '1rem',
    resize: 'none',
    fontFamily: 'inherit',
  },
  sendButton: {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#00ff41',
    color: '#0a0a0a',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontSize: '1rem',
    transition: 'all 0.2s',
  },
  sendButtonDisabled: {
    backgroundColor: '#3a3a3a',
    color: '#6b7280',
    cursor: 'not-allowed',
  },
  footer: {
    padding: '0.75rem',
    backgroundColor: '#1a1a1a',
    borderTop: '1px solid #2a2a2a',
    textAlign: 'center',
  },
  footerText: {
    fontSize: '0.875rem',
    color: '#ef4444',
  },
};

export default KaliGptClaude;
