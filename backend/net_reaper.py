"""
NET REAPER Integration Module for KaliGPT
Provides defensive countermeasures and threat response capabilities
SECURITY HARDENED VERSION v2 - CodeQL fixes applied
"""

from __future__ import annotations

import logging
import subprocess
import ipaddress
import re
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
from pydantic import BaseModel, Field
from enum import Enum

logger = logging.getLogger(__name__)

_LOG_SANITIZE_RE = re.compile(r"[\r\n\t]")


def _sanitize_log(value: str) -> str:
    """Sanitize a value before embedding it in a log message."""
    return _LOG_SANITIZE_RE.sub(" ", str(value))


class ResponseProfile(str, Enum):
    PASSIVE = "passive"
    DEFENSIVE = "defensive"
    AGGRESSIVE = "aggressive"
    SCORCHED_EARTH = "scorched_earth"


class ThreatEvent(BaseModel):
    source: str = "net-reaper"
    event: str
    timestamp: str
    risk_level: int = Field(ge=0, le=10)
    threat_type: str
    source_ips: List[str]
    action_taken: str
    success: bool
    profile: str
    vcs_commit: Optional[str] = None


class NetReaperHealth(BaseModel):
    status: str
    profile: str
    blocked_count: int
    tarpit_active: bool
    threat_count: int


class BlockedIp(BaseModel):
    ip: str
    reason: str
    timestamp: str
    blocked_by: str = "net-reaper"


class ScanResult(BaseModel):
    ip: str
    open_ports: List[int]
    services: Dict[str, str]
    timestamp: str


class NetReaperService:
    """Defensive Net Reaper service: monitoring, blocking, counter-recon."""

    def __init__(self) -> None:
        self.current_profile: ResponseProfile = ResponseProfile.DEFENSIVE
        self.blocked_ips: Dict[str, BlockedIp] = {}
        self.threat_events: List[ThreatEvent] = []
        self.tarpit_active: bool = False
        self.threat_count: int = 0
        self.profile_configs: Dict[ResponseProfile, Dict[str, Any]] = {
            ResponseProfile.PASSIVE: {
                "threshold": 10,
                "block_duration": 0,
                "counter_scan": False,
                "tarpit": False,
                "description": "Monitor only, no blocking",
            },
            ResponseProfile.DEFENSIVE: {
                "threshold": 8,
                "block_duration": 3600,
                "counter_scan": False,
                "tarpit": True,
                "description": "Block confirmed threats (threshold 8+)",
            },
            ResponseProfile.AGGRESSIVE: {
                "threshold": 6,
                "block_duration": 7200,
                "counter_scan": True,
                "tarpit": True,
                "description": "Block + scan back (threshold 6+)",
            },
            ResponseProfile.SCORCHED_EARTH: {
                "threshold": 4,
                "block_duration": 86400,
                "counter_scan": True,
                "tarpit": True,
                "description": "Maximum response (threshold 4+)",
            },
        }
        logger.info("NET REAPER Service initialised")

    def get_health(self) -> NetReaperHealth:
        return NetReaperHealth(
            status="active",
            profile=self.current_profile.value,
            blocked_count=len(self.blocked_ips),
            tarpit_active=self.tarpit_active,
            threat_count=self.threat_count,
        )

    def get_profile_info(self) -> Dict[str, Any]:
        config = self.profile_configs[self.current_profile]
        return {
            "profile": self.current_profile.value,
            "config": config,
            "blocked_count": len(self.blocked_ips),
            "tarpit_active": self.tarpit_active,
        }

    def switch_profile(self, profile: ResponseProfile) -> Tuple[bool, str]:
        old = self.current_profile
        self.current_profile = profile
        self.tarpit_active = self.profile_configs[profile]["tarpit"]
        logger.info(
            "NET REAPER profile switched: %s -> %s",
            _sanitize_log(old.value),
            _sanitize_log(profile.value),
        )
        return True, f"Profile switched to {profile.value}"

    def block_ip(self, ip: str, reason: str = "Manual block") -> Tuple[bool, str]:
        try:
            ipaddress.ip_address(ip)
        except ValueError:
            return False, f"Invalid IP address: {_sanitize_log(ip)}"

        try:
            if ip in self.blocked_ips:
                return False, f"IP {ip} is already blocked"

            self.blocked_ips[ip] = BlockedIp(
                ip=ip,
                reason=reason,
                timestamp=datetime.now().isoformat(),
            )
            self.threat_count += 1
            logger.warning("IP BLOCKED: %s | Reason: %s", ip, _sanitize_log(reason))

            config = self.profile_configs[self.current_profile]
            if config["counter_scan"]:
                self._counter_scan(ip)

            return True, f"IP {ip} blocked successfully"
        except Exception as exc:
            logger.error("Failed to block IP %s: %s", ip, _sanitize_log(str(exc)))
            return False, str(exc)

    def unblock_ip(self, ip: str) -> Tuple[bool, str]:
        try:
            ipaddress.ip_address(ip)
        except ValueError:
            return False, f"Invalid IP address: {_sanitize_log(ip)}"

        if ip not in self.blocked_ips:
            return False, f"IP {ip} is not blocked"

        del self.blocked_ips[ip]
        logger.info("IP UNBLOCKED: %s", ip)
        return True, f"IP {ip} unblocked successfully"

    def process_threat(self, threat_data: Dict[str, Any]) -> ThreatEvent:
        try:
            risk_level = int(threat_data.get("risk_level", 0))
            threat_type = str(threat_data.get("threat_type", "unknown"))
            source_ips = list(threat_data.get("source_ips", []))

            config = self.profile_configs[self.current_profile]
            threshold = config["threshold"]
            action_taken = "monitored"
            success = True

            if risk_level >= threshold:
                for ip in source_ips:
                    if ip not in self.blocked_ips:
                        block_success, _ = self.block_ip(
                            ip,
                            f"Auto-block: {threat_type} (risk: {risk_level})",
                        )
                        if block_success:
                            action_taken = f"blocked:{ip}"

            event = ThreatEvent(
                event=f"threat_detected:{threat_type}",
                timestamp=datetime.now().isoformat(),
                risk_level=min(max(risk_level, 0), 10),
                threat_type=threat_type,
                source_ips=source_ips,
                action_taken=action_taken,
                success=success,
                profile=self.current_profile.value,
            )
            self.threat_events.append(event)
            logger.info(
                "Threat processed: type=%s risk=%d action=%s",
                _sanitize_log(threat_type),
                risk_level,
                _sanitize_log(action_taken),
            )
            return event
        except Exception as exc:
            logger.error("Threat processing error: %s", _sanitize_log(str(exc)))
            return ThreatEvent(
                event="processing_error",
                timestamp=datetime.now().isoformat(),
                risk_level=0,
                threat_type="unknown",
                source_ips=[],
                action_taken="error",
                success=False,
                profile=self.current_profile.value,
            )

    def _counter_scan(self, ip: str) -> None:
        """Stealth counter-recon using argv list (never shell=True)."""
        try:
            ipaddress.ip_address(ip)
        except ValueError:
            logger.error(
                "_counter_scan called with invalid IP: %s", _sanitize_log(ip)
            )
            return

        try:
            logger.info("Initiating counter-scan against %s", ip)
            cmd: List[str] = [
                "nmap",
                "-sS",
                "-Pn",
                "-T2",
                "--max-retries",
                "1",
                "--max-rtt-timeout",
                "500ms",
                "-p",
                "22,80,443,3389,5900",
                ip,
            ]
            subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                shell=False,
            )
            logger.info("Counter-scan initiated against %s", ip)
        except Exception as exc:
            logger.error(
                "Counter-scan failed for %s: %s", ip, _sanitize_log(str(exc))
            )

    def scan_ip(self, ip: str) -> Tuple[bool, Optional[ScanResult], str]:
        try:
            ipaddress.ip_address(ip)
        except ValueError:
            return False, None, f"Invalid IP address: {_sanitize_log(ip)}"

        try:
            logger.info("Authorised scan requested for %s", ip)
            result = subprocess.run(
                ["nmap", "-sV", "-Pn", "-p", "1-1000", "--open", ip],
                capture_output=True,
                text=True,
                timeout=300,
                shell=False,
            )

            open_ports: List[int] = []
            services: Dict[str, str] = {}
            for line in result.stdout.split("\n"):
                if "/tcp" in line and "open" in line:
                    parts = line.split()
                    try:
                        port = int(parts[0].split("/")[0])
                        open_ports.append(port)
                        if len(parts) > 2:
                            services[str(port)] = parts[2]
                    except (IndexError, ValueError):
                        continue

            scan_result = ScanResult(
                ip=ip,
                open_ports=open_ports,
                services=services,
                timestamp=datetime.now().isoformat(),
            )
            logger.info("Scan completed for %s: %d open ports", ip, len(open_ports))
            return True, scan_result, "Scan completed successfully"
        except subprocess.TimeoutExpired:
            logger.warning("Scan timed out for %s", ip)
            return False, None, "Scan timed out"
        except Exception as exc:
            logger.error("Scan failed for %s: %s", ip, _sanitize_log(str(exc)))
            return False, None, str(exc)

    def get_blocked_ips(self) -> List[BlockedIp]:
        return list(self.blocked_ips.values())


net_reaper_service: Optional[NetReaperService] = None


def get_net_reaper_service() -> NetReaperService:
    global net_reaper_service
    if net_reaper_service is None:
        net_reaper_service = NetReaperService()
    return net_reaper_service
