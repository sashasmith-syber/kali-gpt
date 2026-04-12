"""
NET REAPER Integration Module for KaliGPT
Provides aggressive defensive countermeasures and threat response capabilities
Author: sashasmith-syber (Owner-Authorized)
"""

import os
import json
import logging
import subprocess
import ipaddress
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
from pydantic import BaseModel, Field
from enum import Enum

logger = logging.getLogger(__name__)

class ResponseProfile(str, Enum):
    """Net Reaper response profiles"""
    PASSIVE = "passive"
    DEFENSIVE = "defensive"
    AGGRESSIVE = "aggressive"
    SCORCHED_EARTH = "scorched_earth"

class ThreatEvent(BaseModel):
    """Threat event from Net Reaper"""
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
    """Net Reaper health status"""
    status: str = "healthy"
    version: str = "2.0.0"
    profile: ResponseProfile = ResponseProfile.DEFENSIVE
    uptime: int = 0
    threats_blocked: int = 0
    last_update: str = Field(default_factory=lambda: datetime.now().isoformat())

class BlockedIp(BaseModel):
    """Blocked IP entry"""
    ip: str
    reason: str
    timestamp: str
    blocked_by: str = "net-reaper"

class ScanResult(BaseModel):
    """IP scan result"""
    ip: str
    open_ports: List[int]
    services: Dict[str, Any]
    timestamp: str

class NetReaperService:
    """
    NET REAPER Service - Aggressive Defensive Countermeasures
    Owner: sashasmith-syber | Authorized AI Defense: KALI
    """
    
    def __init__(self):
        self.current_profile: ResponseProfile = ResponseProfile.DEFENSIVE
        self.blocked_ips: Dict[str, BlockedIp] = {}
        self.threat_count: int = 0
        self.start_time: datetime = datetime.now()
        self.tarpit_active: bool = False
        self.honeypot_active: bool = False
        
        # Profile configurations
        self.profile_configs = {
            ResponseProfile.PASSIVE: {
                "threshold": 10,
                "block_duration": 0,
                "counter_scan": False,
                "tarpit": False,
                "description": "Monitor only, no blocking"
            },
            ResponseProfile.DEFENSIVE: {
                "threshold": 8,
                "block_duration": 3600,
                "counter_scan": False,
                "tarpit": True,
                "description": "Block confirmed threats (threshold 8+)"
            },
            ResponseProfile.AGGRESSIVE: {
                "threshold": 6,
                "block_duration": 7200,
                "counter_scan": True,
                "tarpit": True,
                "description": "Block + scan back (threshold 6+)"
            },
            ResponseProfile.SCORCHED_EARTH: {
                "threshold": 4,
                "block_duration": 86400,
                "counter_scan": True,
                "tarpit": True,
                "description": "Maximum response (threshold 4+)"
            }
        }
        
        logger.info("NET REAPER Service initialized - Owner: sashasmith-syber")
        logger.info(f"Default profile: {self.current_profile.value}")
    
    def get_health(self) -> NetReaperHealth:
        """Get current health status"""
        uptime = int((datetime.now() - self.start_time).total_seconds())
        return NetReaperHealth(
            status="healthy",
            version="2.0.0",
            profile=self.current_profile,
            uptime=uptime,
            threats_blocked=self.threat_count,
            last_update=datetime.now().isoformat()
        )
    
    def switch_profile(self, profile: ResponseProfile) -> Tuple[bool, str]:
        """Switch response profile"""
        try:
            old_profile = self.current_profile
            self.current_profile = profile
            config = self.profile_configs[profile]
            
            # Activate/deactivate tarpit based on profile
            if config["tarpit"] and not self.tarpit_active:
                self._activate_tarpit()
            elif not config["tarpit"] and self.tarpit_active:
                self._deactivate_tarpit()
            
            logger.warning(f"NET REAPER profile switched: {old_profile.value} -> {profile.value}")
            logger.info(f"Profile config: {config['description']}")
            
            return True, f"Switched to {profile.value}"
        except Exception as e:
            logger.error(f"Failed to switch profile: {str(e)}")
            return False, str(e)
    
    def _activate_tarpit(self):
        """Activate SSH/HTTP tarpit"""
        try:
            # Check if endlessh is installed
            result = subprocess.run(
                ["which", "endlessh"],
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0:
                # Start endlessh on port 22 (if not already running)
                subprocess.run(
                    ["sudo", "systemctl", "start", "endlessh"],
                    capture_output=True
                )
                self.tarpit_active = True
                logger.info("Tarpit activated (endlessh)")
            else:
                logger.warning("endlessh not installed, tarpit not activated")
        except Exception as e:
            logger.error(f"Failed to activate tarpit: {str(e)}")
    
    def _deactivate_tarpit(self):
        """Deactivate tarpit"""
        try:
            subprocess.run(
                ["sudo", "systemctl", "stop", "endlessh"],
                capture_output=True
            )
            self.tarpit_active = False
            logger.info("Tarpit deactivated")
        except Exception as e:
            logger.error(f"Failed to deactivate tarpit: {str(e)}")
    
    def block_ip(self, ip: str, reason: str = "NET REAPER auto-block") -> Tuple[bool, str]:
        """Block an IP address using iptables"""
        try:
            # Validate IP
            ipaddress.ip_address(ip)
            
            # Check if already blocked
            if ip in self.blocked_ips:
                return True, f"IP {ip} already blocked"
            
            # Add iptables rule
            result = subprocess.run(
                ["sudo", "iptables", "-A", "INPUT", "-s", ip, "-j", "DROP"],
                capture_output=True,
                text=True
            )
            
            if result.returncode != 0:
                logger.error(f"iptables failed: {result.stderr}")
                return False, f"iptables error: {result.stderr}"
            
            # Record block
            self.blocked_ips[ip] = BlockedIp(
                ip=ip,
                reason=reason,
                timestamp=datetime.now().isoformat()
            )
            self.threat_count += 1
            
            logger.warning(f"IP BLOCKED: {ip} | Reason: {reason}")
            
            # If aggressive/scorched_earth, perform counter-scan
            config = self.profile_configs[self.current_profile]
            if config["counter_scan"]:
                self._counter_scan(ip)
            
            return True, f"IP {ip} blocked successfully"
            
        except ValueError:
            return False, f"Invalid IP address: {ip}"
        except Exception as e:
            logger.error(f"Failed to block IP {ip}: {str(e)}")
            return False, str(e)
    
    def unblock_ip(self, ip: str) -> Tuple[bool, str]:
        """Unblock an IP address"""
        try:
            # Validate IP
            ipaddress.ip_address(ip)
            
            # Remove iptables rule
            result = subprocess.run(
                ["sudo", "iptables", "-D", "INPUT", "-s", ip, "-j", "DROP"],
                capture_output=True,
                text=True
            )
            
            # Remove from blocked list
            if ip in self.blocked_ips:
                del self.blocked_ips[ip]
            
            logger.info(f"IP UNBLOCKED: {ip}")
            return True, f"IP {ip} unblocked"
            
        except ValueError:
            return False, f"Invalid IP address: {ip}"
        except Exception as e:
            logger.error(f"Failed to unblock IP {ip}: {str(e)}")
            return False, str(e)
    
    def _counter_scan(self, ip: str):
        """Perform counter-reconnaissance scan (passive/stealth)"""
        try:
            logger.info(f"Initiating counter-scan against {ip}")
            
            # Stealth nmap scan (SYN, no ping, slow)
            # This is defensive reconnaissance - gathering intel on attacker
            cmd = [
                "nmap", "-sS", "-Pn", "-T2", "--max-retries", "1",
                "--max-rtt-timeout", "500ms", "-p", "22,80,443,3389,5900",
                ip
            ]
            
            # Run in background to not block
            subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            logger.info(f"Counter-scan initiated against {ip}")
            
        except Exception as e:
            logger.error(f"Counter-scan failed for {ip}: {str(e)}")
    
    def scan_ip(self, ip: str) -> Tuple[bool, Optional[ScanResult], str]:
        """Perform authorized reconnaissance scan"""
        try:
            # Validate IP
            ipaddress.ip_address(ip)
            
            logger.info(f"Authorized scan requested for {ip}")
            
            # Run nmap scan
            result = subprocess.run(
                ["nmap", "-sV", "-Pn", "-p", "1-1000", "--open", ip],
                capture_output=True,
                text=True,
                timeout=300
            )
            
            # Parse results (simplified)
            open_ports = []
            services = {}
            
            for line in result.stdout.split('\n'):
                if '/tcp' in line and 'open' in line:
                    parts = line.split()
                    port = int(parts[0].split('/')[0])
                    open_ports.append(port)
                    if len(parts) > 2:
                        services[str(port)] = parts[2]
            
            scan_result = ScanResult(
                ip=ip,
                open_ports=open_ports,
                services=services,
                timestamp=datetime.now().isoformat()
            )
            
            logger.info(f"Scan completed for {ip}: {len(open_ports)} ports open")
            return True, scan_result, "Scan completed"
            
        except ValueError:
            return False, None, f"Invalid IP address: {ip}"
        except subprocess.TimeoutExpired:
            return False, None, "Scan timeout"
        except Exception as e:
            logger.error(f"Scan failed for {ip}: {str(e)}")
            return False, None, str(e)
    
    def process_threat(self, threat_data: Dict[str, Any]) -> ThreatEvent:
        """Process incoming threat and take appropriate action"""
        try:
            risk_level = threat_data.get("risk_level", 0)
            threat_type = threat_data.get("threat_type", "unknown")
            source_ips = threat_data.get("source_ips", [])
            
            config = self.profile_configs[self.current_profile]
            threshold = config["threshold"]
            
            action_taken = "monitored"
            success = True
            
            # Take action if risk exceeds threshold
            if risk_level >= threshold:
                for ip in source_ips:
                    if ip not in self.blocked_ips:
                        block_success, _ = self.block_ip(
                            ip, 
                            f"Auto-block: {threat_type} (risk: {risk_level})"
                        )
                        if block_success:
                            action_taken = f"blocked:{ip}"
            
            event = ThreatEvent(
                event="threat_detected",
                timestamp=datetime.now().isoformat(),
                risk_level=risk_level,
                threat_type=threat_type,
                source_ips=source_ips,
                action_taken=action_taken,
                success=success,
                profile=self.current_profile.value
            )
            
            logger.warning(
                f"THREAT PROCESSED: {threat_type} | "
                f"Risk: {risk_level} | Action: {action_taken}"
            )
            
            return event
            
        except Exception as e:
            logger.error(f"Failed to process threat: {str(e)}")
            return ThreatEvent(
                event="threat_detected",
                timestamp=datetime.now().isoformat(),
                risk_level=0,
                threat_type="error",
                source_ips=[],
                action_taken="error",
                success=False,
                profile=self.current_profile.value
            )
    
    def get_blocked_ips(self) -> List[BlockedIp]:
        """Get list of blocked IPs"""
        return list(self.blocked_ips.values())
    
    def get_profile_info(self) -> Dict[str, Any]:
        """Get current profile configuration"""
        config = self.profile_configs[self.current_profile]
        return {
            "profile": self.current_profile.value,
            "config": config,
            "blocked_count": len(self.blocked_ips),
            "tarpit_active": self.tarpit_active
        }


# Singleton instance
net_reaper_service: Optional[NetReaperService] = None

def get_net_reaper_service() -> NetReaperService:
    """Get or create Net Reaper service singleton"""
    global net_reaper_service
    if net_reaper_service is None:
        net_reaper_service = NetReaperService()
    return net_reaper_service
