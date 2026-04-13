/**
 * Desktop Defender App
 * Author: sashasmith-syber
 */
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

const DEFAULT_POLICIES = {
  mode: "alert",
  monitorProcesses: true,
  monitorFiles: true,
  monitorLogins: true,
  autoContainHighRisk: false
};

function App() {
  const [config, setConfig] = useState({
    agentBaseUrl: "http://127.0.0.1:8787",
    agentToken: "" // No default token - must be configured securely
  });
  const [securityWarning, setSecurityWarning] = useState("");
  const [health, setHealth] = useState({ status: "unknown" });
  const [incidents, setIncidents] = useState([]);
  const [policies, setPolicies] = useState(DEFAULT_POLICIES);
  const [message, setMessage] = useState("");

  const client = useMemo(() => {
    return axios.create({
      baseURL: config.agentBaseUrl,
      timeout: 8000,
      headers: {
        "X-Agent-Token": config.agentToken
      }
    });
  }, [config]);

  useEffect(() => {
    (async () => {
      if (window.desktopDefender?.getConfig) {
        const saved = await window.desktopDefender.getConfig();
        setConfig(saved);
        // Check if token is configured
        if (!saved.agentToken) {
          setSecurityWarning("⚠️ Security Warning: Agent token not configured. Please set a secure token to connect to the agent.");
        } else {
          setSecurityWarning("");
        }
      }
    })();
  }, []);

  async function refreshHealth() {
    try {
      const { data } = await client.get("/health");
      setHealth(data);
      setMessage("Agent reachable.");
    } catch (err) {
      setHealth({ status: "offline" });
      setMessage(`Health check failed: ${err.message}`);
    }
  }

  async function refreshIncidents() {
    try {
      const { data } = await client.get("/incidents");
      setIncidents(data.incidents || []);
      setMessage("Incidents refreshed.");
    } catch (err) {
      setMessage(`Failed to load incidents: ${err.message}`);
    }
  }

  async function saveConfig() {
    try {
      await window.desktopDefender?.setConfig(config);
      setMessage("Local configuration saved.");
    } catch (err) {
      setMessage(`Save config failed: ${err.message}`);
    }
  }

  async function savePolicies() {
    try {
      await client.post("/policy", policies);
      setMessage("Policy updated.");
    } catch (err) {
      setMessage(`Policy update failed: ${err.message}`);
    }
  }

  async function runQuickScan() {
    try {
      const { data } = await client.post("/scan/quick", {});
      setMessage(`Quick scan complete. Findings: ${data.findings}`);
      await refreshIncidents();
    } catch (err) {
      setMessage(`Quick scan failed: ${err.message}`);
    }
  }

  return (
    <div className="layout">
      <h1>Desktop Defender</h1>
      <p className="author">Author: sashasmith-syber</p>
      
      {securityWarning && (
        <section className="card" style={{backgroundColor: '#fff3cd', border: '1px solid #ffc107', color: '#856404'}}>
          <p style={{margin: 0, fontWeight: 'bold'}}>{securityWarning}</p>
          <p style={{margin: '8px 0 0 0', fontSize: '0.9em'}}>
            The agent token can be found in the agent startup logs or ~/.desktop-defender-agent-token
          </p>
        </section>
      )}

      <section className="card">
        <h2>Agent Connection</h2>
        <label>Agent Base URL</label>
        <input
          value={config.agentBaseUrl}
          onChange={(e) => setConfig({ ...config, agentBaseUrl: e.target.value })}
        />
        <label>Agent Token</label>
        <input
          value={config.agentToken}
          onChange={(e) => setConfig({ ...config, agentToken: e.target.value })}
        />
        <div className="row">
          <button onClick={saveConfig}>Save Config</button>
          <button onClick={refreshHealth}>Check Health</button>
        </div>
        <pre>{JSON.stringify(health, null, 2)}</pre>
      </section>

      <section className="card">
        <h2>Defensive Policy</h2>
        <label>Mode</label>
        <select
          value={policies.mode}
          onChange={(e) => setPolicies({ ...policies, mode: e.target.value })}
        >
          <option value="monitor">monitor</option>
          <option value="alert">alert</option>
          <option value="contain">contain</option>
        </select>

        {[
          ["monitorProcesses", "Monitor Processes"],
          ["monitorFiles", "Monitor File Integrity"],
          ["monitorLogins", "Monitor Login Signals"],
          ["autoContainHighRisk", "Auto-contain High Risk Alerts"]
        ].map(([key, label]) => (
          <label className="checkbox" key={key}>
            <input
              type="checkbox"
              checked={policies[key]}
              onChange={(e) => setPolicies({ ...policies, [key]: e.target.checked })}
            />
            {label}
          </label>
        ))}

        <div className="row">
          <button onClick={savePolicies}>Save Policy</button>
          <button onClick={runQuickScan}>Run Quick Scan</button>
        </div>
      </section>

      <section className="card">
        <h2>Incidents</h2>
        <button onClick={refreshIncidents}>Refresh Incidents</button>
        <ul>
          {incidents.map((i) => (
            <li key={i.id}>
              <strong>{i.severity}</strong> - {i.type} - {i.summary}
            </li>
          ))}
        </ul>
      </section>

      <section className="card status">{message}</section>
    </div>
  );
}

export default App;
