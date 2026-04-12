"""
KALI Incident Validation Module

Validates or falsifies high-severity alerts (ransomware, recon, brute-force, DNS)
without running offensive tools. Role: forensic and analytic only.

Decision: "Is this a real ransomware incident on our hosts, or just noisy signatures?"
Based on: host evidence + rule confidence, never on a single network alert.
"""

from enum import Enum
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field
from datetime import datetime, timedelta


# --- Internal assets to correlate (from mission brief) ---
FOCUS_INTERNAL_IPS = ["192.168.1.105", "10.0.0.45"]
DEFAULT_TIME_WINDOW_MINUTES = 60


class AlertCategory(str, Enum):
    RANSOMWARE_SIGNATURE = "ransomware_signature"
    RECON = "recon"
    BRUTE_FORCE = "brute_force"
    SUSPICIOUS_DNS = "suspicious_dns"
    DATA_EXFIL = "data_exfil"


class RuleConfidence(str, Enum):
    HIGH = "high"           # Low false-positive history, clear signature
    MEDIUM = "medium"       # Some FP history or generic signature
    LOW = "low"             # Known FP-prone rule; require host evidence


class IncidentState(str, Enum):
    CONFIRMED_RANSOMWARE = "CONFIRMED RANSOMWARE INCIDENT"
    LIKELY_FALSE_POSITIVE = "LIKELY FALSE POSITIVE / RULE NOISE"
    SUSPECTED_UNCONFIRMED = "SUSPECTED, UNCONFIRMED"


@dataclass
class NetworkAlert:
    """Single alert from IDS/IPS/SIEM (network traffic)."""
    alert_id: str
    rule_id: Optional[str] = None
    signature_name: Optional[str] = None
    category: AlertCategory = AlertCategory.RANSOMWARE_SIGNATURE
    source_ip: Optional[str] = None
    dest_ip: Optional[str] = None
    timestamp: Optional[datetime] = None
    payload_snippet: Optional[str] = None
    false_positive_rate: Optional[float] = None  # 0.0–1.0 if known
    raw_context: Optional[Dict[str, Any]] = None


@dataclass
class HostEvidence:
    """Telemetry from EDR/AV/logs for an internal host (no offensive tools)."""
    host_ip: str
    timestamp: Optional[datetime] = None
    # Process
    unknown_binaries_in_user_or_temp: List[str] = field(default_factory=list)
    long_running_suspicious_processes: List[str] = field(default_factory=list)
    # File system
    file_mod_spike: bool = False
    ransom_note_filenames_present: List[str] = field(default_factory=list)
    encryption_activity_detected: bool = False
    # AV/EDR
    av_edr_alerts_same_window: List[str] = field(default_factory=list)
    raw_telemetry: Optional[Dict[str, Any]] = None


@dataclass
class RuleInfo:
    """Detection rule metadata for confidence assessment."""
    rule_id: str
    signature_name: str
    false_positive_rate: Optional[float] = None
    requires_host_indicator: bool = False  # If True, treat as low confidence until host evidence


def _is_focus_host(ip: Optional[str]) -> bool:
    if not ip:
        return False
    return ip in FOCUS_INTERNAL_IPS


def _alert_in_time_window(alert: NetworkAlert, window_minutes: int) -> bool:
    if not alert.timestamp:
        return True  # Unknown time → include
    cutoff = datetime.utcnow() - timedelta(minutes=window_minutes)
    return alert.timestamp.replace(tzinfo=None) >= cutoff if alert.timestamp.tzinfo else alert.timestamp >= cutoff


def _rule_confidence(alert: NetworkAlert, rule_overrides: Optional[Dict[str, RuleInfo]] = None) -> RuleConfidence:
    """Classify rule confidence from FP rate and override table."""
    rule_id = (alert.rule_id or alert.signature_name or "").strip()
    fp = alert.false_positive_rate

    if rule_overrides and rule_id in rule_overrides:
        r = rule_overrides[rule_id]
        if r.requires_host_indicator or (r.false_positive_rate is not None and r.false_positive_rate > 0.2):
            return RuleConfidence.LOW
        if r.false_positive_rate is not None and r.false_positive_rate < 0.05:
            return RuleConfidence.HIGH
        return RuleConfidence.MEDIUM

    if fp is not None:
        if fp > 0.2:
            return RuleConfidence.LOW
        if fp < 0.05:
            return RuleConfidence.HIGH
    return RuleConfidence.MEDIUM


def correlate_alerts(
    alerts: List[NetworkAlert],
    window_minutes: int = DEFAULT_TIME_WINDOW_MINUTES,
) -> Dict[str, Any]:
    """
    Correlate by internal asset and time.
    Returns: counts per focus host, repeated-event flag, and 'suspected_unconfirmed' if only isolated network sigs.
    """
    focus_alerts = [
        a for a in alerts
        if _alert_in_time_window(a, window_minutes)
        and (_is_focus_host(a.source_ip) or _is_focus_host(a.dest_ip))
    ]
    by_host: Dict[str, int] = {ip: 0 for ip in FOCUS_INTERNAL_IPS}
    for a in focus_alerts:
        for ip in FOCUS_INTERNAL_IPS:
            if a.source_ip == ip or a.dest_ip == ip:
                by_host[ip] += 1
                break

    repeated = any(c >= 2 for c in by_host.values())
    # Isolated network signatures with no repeated host impact
    suspected_unconfirmed = len(focus_alerts) > 0 and not repeated and len(focus_alerts) == 1

    return {
        "window_minutes": window_minutes,
        "focus_hosts": FOCUS_INTERNAL_IPS,
        "alerts_in_window": len(focus_alerts),
        "by_host": by_host,
        "repeated_events_same_host": repeated,
        "suspected_unconfirmed": suspected_unconfirmed,
        "focus_alert_ids": [a.alert_id for a in focus_alerts],
    }


def evaluate_host_evidence(evidence_list: List[HostEvidence]) -> Dict[str, Any]:
    """
    Check host reality: encryption, ransom notes, suspicious processes, AV/EDR.
    No encryption + no ransom artefacts + no suspicious long-running processes → treat ransomware-in-traffic as unvalidated.
    """
    if not evidence_list:
        return {
            "hosts_checked": 0,
            "encryption_activity": False,
            "ransom_artefacts": False,
            "suspicious_processes": False,
            "av_edr_alerts": False,
            "supporting_evidence": False,
            "summary": "No host evidence provided; ransomware in traffic remains unvalidated.",
        }

    encryption = any(e.encryption_activity_detected for e in evidence_list)
    ransom_notes = any(len(e.ransom_note_filenames_present) > 0 for e in evidence_list)
    suspicious_procs = any(
        len(e.unknown_binaries_in_user_or_temp) > 0 or len(e.long_running_suspicious_processes) > 0
        for e in evidence_list
    )
    av_alerts = any(len(e.av_edr_alerts_same_window) > 0 for e in evidence_list)

    supporting = encryption or ransom_notes or suspicious_procs or av_alerts
    summary = (
        "Host-level evidence supports incident."
        if supporting
        else "No encryption activity, no ransom artefacts, no suspicious long-running processes; treat 'ransomware in traffic' as unvalidated."
    )

    return {
        "hosts_checked": len(evidence_list),
        "encryption_activity": encryption,
        "ransom_artefacts": ransom_notes,
        "suspicious_processes": suspicious_procs,
        "av_edr_alerts": av_alerts,
        "supporting_evidence": supporting,
        "summary": summary,
        "per_host": [
            {
                "host_ip": e.host_ip,
                "encryption": e.encryption_activity_detected,
                "ransom_notes": e.ransom_note_filenames_present,
                "unknown_binaries": e.unknown_binaries_in_user_or_temp,
                "suspicious_processes": e.long_running_suspicious_processes,
                "av_edr_alerts": e.av_edr_alerts_same_window,
            }
            for e in evidence_list
        ],
    }


def validate_rules(
    alerts: List[NetworkAlert],
    rule_overrides: Optional[Dict[str, RuleInfo]] = None,
) -> List[Dict[str, Any]]:
    """
    For each ransomware-signature alert: rule ID, payload context, FP rate.
    Mark rules with history of false positives as low confidence; require at least one host indicator before confirming.
    """
    out = []
    for a in alerts:
        if a.category != AlertCategory.RANSOMWARE_SIGNATURE:
            continue
        conf = _rule_confidence(a, rule_overrides)
        out.append({
            "alert_id": a.alert_id,
            "rule_id": a.rule_id,
            "signature_name": a.signature_name,
            "payload_snippet": a.payload_snippet,
            "false_positive_rate": a.false_positive_rate,
            "confidence": conf.value,
            "low_confidence": conf == RuleConfidence.LOW,
            "requires_host_indicator": conf == RuleConfidence.LOW,
        })
    return out


def reclassify_incident(
    correlation: Dict[str, Any],
    host_result: Dict[str, Any],
    rule_validation: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Reclassify incident state:
    - CONFIRMED RANSOMWARE: host-level evidence (encryption, ransom notes, malicious procs, C2) on any focus host.
    - LIKELY FALSE POSITIVE: no supporting host evidence after correlation and host checks; optional short observation.
    - SUSPECTED UNCONFIRMED: isolated network sigs, no repeated host impact.
    """
    supporting = host_result.get("supporting_evidence", False)
    suspected_unconfirmed = correlation.get("suspected_unconfirmed", False)
    all_low_confidence = (
        len(rule_validation) > 0
        and all(r.get("low_confidence") for r in rule_validation)
        and not supporting
    )

    if supporting:
        state = IncidentState.CONFIRMED_RANSOMWARE
        recommendation = "Escalate to CONFIRMED RANSOMWARE INCIDENT; prepare containment steps for affected asset(s) only. Do not launch offensive tools on production."
    elif suspected_unconfirmed or all_low_confidence:
        state = IncidentState.LIKELY_FALSE_POSITIVE
        recommendation = "Downgrade to LIKELY FALSE POSITIVE / RULE NOISE. Keep a short observation window; if patterns repeat, re-run validation with fresh host telemetry."
    else:
        state = IncidentState.SUSPECTED_UNCONFIRMED
        recommendation = "Remain SUSPECTED, UNCONFIRMED. Gather more host evidence and rule metadata; re-run validation."

    return {
        "incident_state": state.value,
        "recommendation": recommendation,
        "answer": (
            "Real ransomware incident on our hosts (host evidence present)."
            if supporting
            else "Not validated as a real ransomware incident on our hosts; treat as noisy signatures unless host evidence appears."
        ),
        "correlation_summary": {
            "repeated_events": correlation.get("repeated_events_same_host"),
            "suspected_unconfirmed": suspected_unconfirmed,
            "alerts_in_window": correlation.get("alerts_in_window"),
        },
        "host_evidence_summary": host_result.get("summary"),
        "rule_confidence_notes": "At least one high/medium confidence rule with host evidence → confirm. All low confidence and no host evidence → false positive.",
    }
