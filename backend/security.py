"""
Security utilities for KaliGPT
Handles command validation, sanitization, and security checks
"""

import shlex
import re
import ipaddress
from typing import Tuple, List, Optional
import logging

logger = logging.getLogger(__name__)

# Allowed security tools with their configurations
ALLOWED_TOOLS = {
    'nmap': {
        'binary': 'nmap',
        'allowed_flags': ['-sV', '-sC', '-p', '-A', '-O', '-sS', '-sT', '-sU', '-Pn', '--script', '-oN', '-oX'],
        'risk_level': 'medium',
        'description': 'Network exploration and security auditing'
    },
    'nikto': {
        'binary': 'nikto',
        'allowed_flags': ['-h', '-p', '-ssl', '-o', '-Format'],
        'risk_level': 'medium',
        'description': 'Web server scanner'
    },
    'sqlmap': {
        'binary': 'sqlmap',
        'allowed_flags': ['-u', '--dbs', '--tables', '--dump', '--batch', '--level', '--risk'],
        'risk_level': 'high',
        'description': 'SQL injection detection and exploitation'
    },
    'dirb': {
        'binary': 'dirb',
        'allowed_flags': ['-o', '-r', '-z'],
        'risk_level': 'low',
        'description': 'Web content scanner'
    },
    'gobuster': {
        'binary': 'gobuster',
        'allowed_flags': ['dir', 'dns', 'vhost', '-u', '-w', '-o', '-t', '-x'],
        'risk_level': 'low',
        'description': 'Directory/file brute-forcing tool'
    },
    'hydra': {
        'binary': 'hydra',
        'allowed_flags': ['-l', '-L', '-p', '-P', '-t', '-o'],
        'risk_level': 'high',
        'description': 'Password cracking tool'
    },
    'john': {
        'binary': 'john',
        'allowed_flags': ['--wordlist', '--format', '--show'],
        'risk_level': 'medium',
        'description': 'Password cracker'
    },
    'aircrack-ng': {
        'binary': 'aircrack-ng',
        'allowed_flags': ['-w', '-b', '-e'],
        'risk_level': 'high',
        'description': 'WiFi security auditing'
    },
    'wireshark': {
        'binary': 'tshark',  # CLI version
        'allowed_flags': ['-i', '-r', '-w', '-f', '-Y'],
        'risk_level': 'low',
        'description': 'Network protocol analyzer'
    },
    'metasploit': {
        'binary': 'msfconsole',
        'allowed_flags': ['-q', '-x', '-r'],
        'risk_level': 'critical',
        'description': 'Penetration testing framework'
    }
}

# Safe basic commands
SAFE_COMMANDS = ['ls', 'cat', 'grep', 'echo', 'pwd', 'whoami', 'id', 'uname', 'hostname']

# Dangerous patterns that should never be allowed
DANGEROUS_PATTERNS = [
    r'rm\s+-rf',
    r'mkfs',
    r'dd\s+if=',
    r':\(\)\{.*\};:',  # Fork bomb
    r'>\s*/dev/sd',
    r'wget.*\|.*sh',
    r'curl.*\|.*bash',
    r'chmod\s+777',
    r'/etc/passwd',
    r'/etc/shadow',
    r'sudo\s+',
    r'su\s+',
    r'nc\s+-e',  # Netcat reverse shell
    r'bash\s+-i',  # Interactive bash
    r'/bin/sh',
    r'eval\s*\(',
    r'exec\s*\(',
    r'system\s*\(',
]

# Shell metacharacters that indicate command injection attempts
SHELL_METACHARACTERS = [';', '&&', '||', '|', '`', '$', '(', ')', '<', '>', '&', '\n', '\r']


class CommandValidator:
    """Validates and sanitizes commands for safe execution"""
    
    @staticmethod
    def validate_ip_address(ip: str) -> Tuple[bool, str]:
        """Validate IP address or CIDR notation"""
        try:
            # Try parsing as IP address
            ipaddress.ip_address(ip)
            return True, "Valid IP address"
        except ValueError:
            try:
                # Try parsing as network (CIDR)
                ipaddress.ip_network(ip, strict=False)
                return True, "Valid network address"
            except ValueError:
                # Check if it's a hostname (basic validation)
                hostname_pattern = r'^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$'
                if re.match(hostname_pattern, ip) and len(ip) <= 253:
                    return True, "Valid hostname"
                return False, "Invalid IP address, network, or hostname"
    
    @staticmethod
    def check_dangerous_patterns(command: str) -> Tuple[bool, Optional[str]]:
        """Check for dangerous command patterns"""
        for pattern in DANGEROUS_PATTERNS:
            if re.search(pattern, command, re.IGNORECASE):
                logger.warning(f"Dangerous pattern detected: {pattern} in command: {command}")
                return False, f"Dangerous pattern detected: {pattern}"
        return True, None
    
    @staticmethod
    def check_shell_metacharacters(command: str) -> Tuple[bool, Optional[str]]:
        """Check for shell metacharacters that could enable command injection"""
        for char in SHELL_METACHARACTERS:
            if char in command:
                logger.warning(f"Shell metacharacter detected: {char} in command: {command}")
                return False, f"Shell metacharacter not allowed: {char}"
        return True, None
    
    @staticmethod
    def parse_command_safely(command: str) -> Tuple[bool, Optional[List[str]], Optional[str]]:
        """
        Parse command into safe argument list using shlex
        Returns: (success, parsed_args, error_message)
        """
        try:
            # Use shlex to safely parse the command
            args = shlex.split(command)
            
            if not args:
                return False, None, "Empty command"
            
            return True, args, None
            
        except ValueError as e:
            logger.error(f"Failed to parse command: {command}, error: {str(e)}")
            return False, None, f"Invalid command syntax: {str(e)}"
    
    @staticmethod
    def validate_tool_command(args: List[str]) -> Tuple[bool, Optional[str]]:
        """Validate that the command uses an allowed tool with valid arguments"""
        if not args:
            return False, "Empty command"
        
        base_command = args[0]
        
        # Check if it's a safe basic command
        if base_command in SAFE_COMMANDS:
            return True, None
        
        # Check if it's an allowed security tool
        tool_info = None
        for tool_name, info in ALLOWED_TOOLS.items():
            if base_command == info['binary'] or base_command == tool_name:
                tool_info = info
                break
        
        if not tool_info:
            return False, f"Command '{base_command}' is not in the allowed tools list"
        
        # Validate flags if tool has allowed_flags defined
        if 'allowed_flags' in tool_info:
            allowed_flags = tool_info['allowed_flags']
            for arg in args[1:]:
                # Skip arguments that are not flags (don't start with -)
                if not arg.startswith('-'):
                    continue
                
                # Check if the flag is allowed
                flag_allowed = False
                for allowed_flag in allowed_flags:
                    if arg == allowed_flag or arg.startswith(allowed_flag + '='):
                        flag_allowed = True
                        break
                
                if not flag_allowed:
                    return False, f"Flag '{arg}' is not allowed for {base_command}"
        
        return True, None
    
    @staticmethod
    def validate_command(command: str) -> Tuple[bool, Optional[List[str]], Optional[str]]:
        """
        Complete command validation pipeline
        Returns: (is_valid, parsed_args, error_message)
        """
        # Step 1: Check for dangerous patterns
        is_safe, error = CommandValidator.check_dangerous_patterns(command)
        if not is_safe:
            return False, None, error
        
        # Step 2: Check for shell metacharacters
        is_safe, error = CommandValidator.check_shell_metacharacters(command)
        if not is_safe:
            return False, None, error
        
        # Step 3: Parse command safely
        success, args, error = CommandValidator.parse_command_safely(command)
        if not success:
            return False, None, error
        
        # Step 4: Validate tool and arguments
        is_valid, error = CommandValidator.validate_tool_command(args)
        if not is_valid:
            return False, None, error
        
        logger.info(f"Command validated successfully: {command}")
        return True, args, None
    
    @staticmethod
    def sanitize_output(output: str, max_length: int = 10000) -> str:
        """Sanitize command output before returning to client"""
        if not output:
            return ""
        
        # Truncate if too long
        if len(output) > max_length:
            output = output[:max_length] + f"\n\n... (output truncated, {len(output) - max_length} characters omitted)"
        
        # Remove any potential ANSI escape codes
        ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
        output = ansi_escape.sub('', output)
        
        return output


class SecurityContext:
    """Security context validation"""
    
    @staticmethod
    def validate_target(target: str) -> Tuple[bool, str]:
        """Validate target IP/hostname"""
        if not target:
            return False, "Target is required"
        
        # Check length
        if len(target) > 253:
            return False, "Target too long"
        
        # Validate IP/hostname
        is_valid, message = CommandValidator.validate_ip_address(target)
        if not is_valid:
            return False, message
        
        # Check for private/localhost addresses (optional warning)
        try:
            ip = ipaddress.ip_address(target)
            if ip.is_loopback:
                logger.info(f"Target is localhost: {target}")
            elif ip.is_private:
                logger.info(f"Target is private IP: {target}")
        except ValueError:
            pass  # Not an IP, probably hostname
        
        return True, "Valid target"
    
    @staticmethod
    def validate_scope(scope: str) -> Tuple[bool, str]:
        """Validate testing scope"""
        if not scope:
            return False, "Scope is required"
        
        if len(scope) > 200:
            return False, "Scope description too long"
        
        # Basic sanitization
        if any(char in scope for char in ['<', '>', '&', '"', "'"]):
            return False, "Scope contains invalid characters"
        
        return True, "Valid scope"


def get_tool_info(tool_name: str) -> Optional[dict]:
    """Get information about a specific tool"""
    return ALLOWED_TOOLS.get(tool_name)


def list_all_tools() -> dict:
    """List all available tools"""
    return ALLOWED_TOOLS
