/**
 * Desktop Defender App
 * Author: sashasmith-syber
 */
import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";

const DEFAULT_POLICIES = {
  mode: "alert",
  monitorProcesses: true,
  monitorFiles: true,
  monitorLogins: true,
  autoContainHighRisk: false
};

function severityClass(severity) {
  if (severity === "high") return "sev-high";
  if (severity === "medium") return "sev-med";
  return "sev-low";
}

async function api(config, { method = "GET", path, body }) {
  if (window.desktopDefender?.agentRequest) {
    const result = await window.desktopDefender.agentRequest({ method, path, body });
    if (!result.ok) {
      const err = new Error(result.error || "Request failed");
      err.response = { status: result.status, data: result.data };
      throw err;
    }
    return result.data;
  }

  const client = axios.create({
    baseURL: config.agentBaseUrl,
    timeout: 8000,
    headers: { "X-Agent-Token": config.agentToken || "" }
  });
  const res = await client.request({ method, url: path, data: body });
  return res.data;
}

function App() {
  const [config, setConfig] = useState({
    agentBaseUrl: "http://127.0.0.1:8787",
    agentToken: ""
  });
  const [showToken, setShowToken] = useState(false);
  const [health, setHealth] = useState({ status: "unknown" });
  const [incidents, setIncidents] = useState([]);
  const [audit, setAudit] = useState([]);
  const [policies, setPolicies] = useState(DEFAULT_POLICIES);
  const [message, setMessage] = useState("Configure the agent token, then connect.");
  const [busy, setBusy] = useState(false);
  const [containPid, setContainPid] = useState("");
  const [blockIp, setBlockIp] = useState("");
  const [tab, setTab] = useState("incidents");

  const online = health?.status === "healthy";
  const bridge = Boolean(window.desktopDefender?.agentRequest);

  useEffect(() => {
    (async () => {
      if (!window.desktopDefender?.getConfig) return;
      const saved = await window.desktopDefender.getConfig();
      setConfig((prev) => ({ ...prev, ...saved }));
      if (!saved?.agentToken) {
        setMessage("Agent token missing — paste from ~/.desktop-defender-agent-token");
      }
    })();
  }, []);

  const refreshAll = useCallback(async () => {
    if (!config.agentToken && !bridge) {
      setHealth({ status: "offline" });
      setMessage("Set an agent token before connecting.");
      return;
    }
    setBusy(true);
    try {
      const [h, p, i, a] = await Promise.all([
        api(config, { path: "/health" }),
        api(config, { path: "/policy" }),
        api(config, { path: "/incidents" }),
        api(config, { path: "/audit" })
      ]);
      setHealth(h);
      setPolicies(p);
      setIncidents(i.incidents || []);
      setAudit([...(a.audit || [])].reverse());
      setMessage("Connected to local agent.");
    } catch (err) {
      setHealth({ status: "offline" });
      setMessage(`Connect failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setBusy(false);
    }
  }, [bridge, config]);

  useEffect(() => {
    if (!config.agentToken && !bridge) return undefined;
    refreshAll();
    const id = setInterval(refreshAll, 15000);
    return () => clearInterval(id);
  }, [config.agentToken, config.agentBaseUrl, refreshAll, bridge]);

  async function saveConfig() {
    try {
      await window.desktopDefender?.setConfig(config);
      setMessage("Local configuration saved.");
      await refreshAll();
    } catch (err) {
      setMessage(`Save config failed: ${err.message}`);
    }
  }

  async function savePolicies() {
    setBusy(true);
    try {
      await api(config, { method: "POST", path: "/policy", body: policies });
      setMessage(`Policy set to ${policies.mode}.`);
      await refreshAll();
    } catch (err) {
      setMessage(`Policy update failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function runQuickScan() {
    setBusy(true);
    try {
      const data = await api(config, { method: "POST", path: "/scan/quick", body: {} });
      setMessage(`Quick scan complete — findings: ${data.findings}`);
      await refreshAll();
      setTab("incidents");
    } catch (err) {
      setMessage(`Quick scan failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function suspendProcess() {
    const pid = Number(containPid);
    if (!Number.isInteger(pid) || pid <= 0) {
      setMessage("Enter a valid process PID to suspend.");
      return;
    }
    setBusy(true);
    try {
      const data = await api(config, { method: "POST", path: `/contain/process/${pid}` });
      setMessage(`Suspended ${data.name} (PID ${data.pid}).`);
      setContainPid("");
      await refreshAll();
    } catch (err) {
      setMessage(`Contain failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function requestFirewallBlock() {
    if (!blockIp.trim()) {
      setMessage("Enter an IP for the dry-run firewall block.");
      return;
    }
    setBusy(true);
    try {
      const data = await api(config, {
        method: "POST",
        path: "/contain/firewall-block",
        body: { ip: blockIp.trim() }
      });
      setMessage(`Firewall block dry-run recorded for ${data.ip}.`);
      setBlockIp("");
      await refreshAll();
    } catch (err) {
      setMessage(`Firewall hook failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Local defensive control</p>
          <h1>Desktop Defender</h1>
        </div>
        <div className="topbar-meta">
          <span className={`pill ${online ? "ok" : "bad"}`}>
            {online ? "Agent online" : "Agent offline"}
          </span>
          <span className="pill muted">mode: {health.policy_mode || policies.mode}</span>
          <span className="pill muted">incidents: {health.incident_count ?? incidents.length}</span>
          <button type="button" className="ghost" disabled={busy} onClick={refreshAll}>
            Refresh
          </button>
        </div>
      </header>

      <p className="lede">
        Monitor, alert, and contain on this machine only. No remote control plane.
      </p>

      <div className="grid">
        <section className="panel">
          <h2>Agent connection</h2>
          <label htmlFor="baseUrl">Base URL</label>
          <input
            id="baseUrl"
            value={config.agentBaseUrl}
            onChange={(e) => setConfig({ ...config, agentBaseUrl: e.target.value })}
          />
          <label htmlFor="token">Agent token</label>
          <div className="token-row">
            <input
              id="token"
              type={showToken ? "text" : "password"}
              value={config.agentToken}
              onChange={(e) => setConfig({ ...config, agentToken: e.target.value })}
              placeholder="dd_…"
              autoComplete="off"
            />
            <button type="button" className="ghost" onClick={() => setShowToken((v) => !v)}>
              {showToken ? "Hide" : "Show"}
            </button>
          </div>
          <div className="row">
            <button type="button" onClick={saveConfig} disabled={busy}>
              Save & connect
            </button>
            <button type="button" className="secondary" onClick={runQuickScan} disabled={busy || !online}>
              Quick scan
            </button>
          </div>
          {!config.agentToken && (
            <p className="hint warn">
              Token file: <code>~/.desktop-defender-agent-token</code>
            </p>
          )}
          {bridge && <p className="hint">Electron bridge active — API calls go through main process.</p>}
        </section>

        <section className="panel">
          <h2>Defensive policy</h2>
          <label htmlFor="mode">Mode</label>
          <select
            id="mode"
            value={policies.mode}
            onChange={(e) => setPolicies({ ...policies, mode: e.target.value })}
          >
            <option value="monitor">monitor</option>
            <option value="alert">alert</option>
            <option value="contain">contain</option>
          </select>

          {[
            ["monitorProcesses", "Monitor processes"],
            ["monitorFiles", "Monitor file integrity paths"],
            ["monitorLogins", "Monitor login signals"],
            ["autoContainHighRisk", "Auto-contain high-risk (contain mode)"]
          ].map(([key, label]) => (
            <label className="checkbox" key={key}>
              <input
                type="checkbox"
                checked={Boolean(policies[key])}
                onChange={(e) => setPolicies({ ...policies, [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}

          <div className="row">
            <button type="button" onClick={savePolicies} disabled={busy || !online}>
              Save policy
            </button>
          </div>
        </section>

        {policies.mode === "contain" && (
          <section className="panel span-2 contain">
            <h2>Containment hooks</h2>
            <p className="hint">Active only in contain mode. Firewall block is dry-run.</p>
            <div className="contain-grid">
              <div>
                <label htmlFor="pid">Suspend process by PID</label>
                <div className="token-row">
                  <input
                    id="pid"
                    value={containPid}
                    onChange={(e) => setContainPid(e.target.value)}
                    placeholder="e.g. 4242"
                  />
                  <button type="button" className="danger" disabled={busy || !online} onClick={suspendProcess}>
                    Suspend
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="ip">Firewall block (dry-run)</label>
                <div className="token-row">
                  <input
                    id="ip"
                    value={blockIp}
                    onChange={(e) => setBlockIp(e.target.value)}
                    placeholder="203.0.113.10"
                  />
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy || !online}
                    onClick={requestFirewallBlock}
                  >
                    Request
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="panel span-2">
          <div className="tabs">
            <button
              type="button"
              className={tab === "incidents" ? "tab active" : "tab"}
              onClick={() => setTab("incidents")}
            >
              Incidents ({incidents.length})
            </button>
            <button
              type="button"
              className={tab === "audit" ? "tab active" : "tab"}
              onClick={() => setTab("audit")}
            >
              Audit ({audit.length})
            </button>
          </div>

          {tab === "incidents" && (
            <div className="list">
              {incidents.length === 0 ? (
                <p className="empty">No incidents yet. Run a quick scan after connecting.</p>
              ) : (
                incidents.map((item) => (
                  <article key={item.id} className="list-item">
                    <div className="list-head">
                      <span className={`sev ${severityClass(item.severity)}`}>{item.severity}</span>
                      <strong>{item.type}</strong>
                      <time>{item.timestamp}</time>
                    </div>
                    <p>{item.summary}</p>
                  </article>
                ))
              )}
            </div>
          )}

          {tab === "audit" && (
            <div className="list">
              {audit.length === 0 ? (
                <p className="empty">Audit trail is empty.</p>
              ) : (
                audit.map((entry) => (
                  <article key={entry.id} className="list-item">
                    <div className="list-head">
                      <strong>{entry.action}</strong>
                      <time>{entry.timestamp}</time>
                    </div>
                    <pre>{JSON.stringify(entry.payload, null, 2)}</pre>
                  </article>
                ))
              )}
            </div>
          )}
        </section>
      </div>

      <footer className="status-bar">{message}</footer>
    </div>
  );
}

export default App;
