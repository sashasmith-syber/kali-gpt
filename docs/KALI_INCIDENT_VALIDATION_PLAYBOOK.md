# KALI Incident Validation Playbook

**Mission:** Answer one question for the OPERATOR:  
**"Is this a real ransomware incident on our hosts, or just noisy signatures?"**

Base the answer on **host evidence + rule confidence**, never on a single network alert.

---

## 1. Correlate Before Acting

### Internal assets (focus hosts)
- **192.168.1.105**
- **10.0.0.45**

### Time window
- **Last 30–60 minutes** (configurable up to 24h in API).

### What to do
- For each alert, correlate by **internal IP** and **time**.
- Count repeated events involving the same host, user, or process.
- **If** you see only **isolated** network signatures with **no repeated host impact** → flag as **"SUSPECTED, UNCONFIRMED"**.

### Output
- Alerts in window per focus host.
- Whether repeated events occurred on the same host.
- Boolean: `suspected_unconfirmed` when a single isolated alert with no repetition.

---

## 2. Check Host Reality (Quietly)

**Do not run offensive tools.** Pull telemetry only (EDR/AV/logs) for the internal hosts.

### Data to gather

| Check | What to look for |
|-------|-------------------|
| **Process list** | Unknown binaries in user profiles or temp dirs. |
| **File activity** | Sudden spikes in file modifications/renames; ransom-note style filenames (e.g. `README.txt`, `DECRYPT_INSTRUCTIONS.html`). |
| **AV/EDR** | Alerts on those hosts in the same time window. |

### Interpretation
- **No** encryption activity + **no** ransom artefacts + **no** suspicious long-running processes  
  → Treat **"ransomware in traffic"** as **unvalidated**.

---

## 3. Validate the Detection Rules

For each **"ransomware signature detected in network traffic"** event, retrieve:

| Field | Use |
|-------|-----|
| **Rule ID / signature name** | Identify the rule. |
| **Payload snippet or context** | If available. |
| **Known false-positive rate** | From rule metadata or past incidents. |

### Rule confidence
- **High:** Low FP history, clear signature → can support confirmation if host evidence exists.
- **Medium:** Some FP history or generic signature → treat with care.
- **Low:** Known FP-prone rule → mark **low confidence** and **require at least one host-based indicator** before calling it a real incident.

---

## 4. Reclassify Incident State

| Outcome | State | Next step |
|---------|--------|------------|
| **Host-level evidence** (encryption, ransom notes, malicious processes, C2) on any internal host | **CONFIRMED RANSOMWARE INCIDENT** | Escalate; prepare **containment steps for that asset only**. Do **not** launch active scans or exploits on production. |
| **No supporting evidence** after correlation and host checks | **LIKELY FALSE POSITIVE / RULE NOISE** | Downgrade; keep a **short observation window** in case patterns repeat. |
| **Isolated network sigs**, no repeated host impact, no host evidence | **SUSPECTED, UNCONFIRMED** | Keep gathering host evidence and rule metadata; re-run validation. |

---

## 5. What KALI Must Not Do (Until Confirmed)

- **No** nmap, Hydra, Metasploit, or exploit PoCs on production addresses.
- **Restrict** to log review, rule verification, and passive data correlation.

---

## 6. Using the API

**Endpoint:** `POST /api/incident/validate`  
**Rate limit:** 30 requests/minute.

**Request body (example):**

```json
{
  "alerts": [
    {
      "alert_id": "alert-001",
      "rule_id": "SURICATA_RANSOMWARE_1",
      "signature_name": "Possible ransomware C2 pattern",
      "category": "ransomware_signature",
      "source_ip": "192.168.1.105",
      "dest_ip": "10.0.0.45",
      "timestamp": "2025-03-05T14:30:00Z",
      "false_positive_rate": 0.15
    }
  ],
  "host_evidence": [
    {
      "host_ip": "192.168.1.105",
      "encryption_activity_detected": false,
      "ransom_note_filenames_present": [],
      "unknown_binaries_in_user_or_temp": [],
      "long_running_suspicious_processes": [],
      "av_edr_alerts_same_window": []
    }
  ],
  "time_window_minutes": 60
}
```

**Response:** Contains `correlation`, `host_evidence`, `rule_validation`, and **`reclassification`** with:
- `incident_state`: CONFIRMED RANSOMWARE INCIDENT | LIKELY FALSE POSITIVE / RULE NOISE | SUSPECTED, UNCONFIRMED
- `answer`: One-sentence answer for the operator.
- `recommendation`: Next steps.

---

## 7. Decision Matrix (Summary)

| Host evidence | Rule confidence | Result |
|---------------|-----------------|--------|
| Yes (encryption / notes / malicious procs / C2) | Any | **CONFIRMED RANSOMWARE** |
| No | High/Medium, repeated events | **SUSPECTED, UNCONFIRMED** (observe; re-validate with more data) |
| No | Low or isolated single alert | **LIKELY FALSE POSITIVE** |

**Bottom line:** A **real ransomware incident** is declared only when there is **host-level evidence** on a focus asset. Network-only alerts are **not** sufficient for confirmation.
