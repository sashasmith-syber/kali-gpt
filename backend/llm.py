"""
Local LLM integration (Ollama, LM Studio) with health, model listing, and reload.
"""

from __future__ import annotations

import os
import time
import requests
import json
import logging
from datetime import datetime
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

logger = logging.getLogger(__name__)

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama")
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://host.docker.internal:11434")
LM_STUDIO_HOST = os.getenv("LM_STUDIO_HOST", "http://host.docker.internal:1234")
LLM_MODEL = os.getenv("LLM_MODEL", "llama3:latest")
LLM_TIMEOUT = int(os.getenv("LLM_TIMEOUT", "120"))
LLM_CONNECT_TIMEOUT = int(os.getenv("LLM_CONNECT_TIMEOUT", "5"))
LLM_STREAM = os.getenv("LLM_STREAM", "false").lower() == "true"
LLM_TEMPERATURE = float(os.getenv("LLM_TEMPERATURE", "0.7"))
LLM_MAX_TOKENS = int(os.getenv("LLM_MAX_TOKENS", "2048"))


class LLMConfig(BaseModel):
    provider: str = LLM_PROVIDER
    host: str = ""
    model: str = LLM_MODEL
    timeout: int = LLM_TIMEOUT
    connect_timeout: int = LLM_CONNECT_TIMEOUT
    stream: bool = LLM_STREAM
    temperature: float = LLM_TEMPERATURE
    max_tokens: int = LLM_MAX_TOKENS


class LLMResponse(BaseModel):
    content: str
    model: str
    generated_at: str
    error: Optional[str] = None


class LLMHealth(BaseModel):
    provider: str
    host: str
    reachable: bool
    model: str
    latency_ms: Optional[float] = None
    status: str  # up | down | unconfigured
    detail: Optional[str] = None


class LLMProvider:
    def __init__(self, config: LLMConfig):
        self.config = config
        self.session = requests.Session()

    def generate(self, prompt: str, history: List[Dict[str, Any]]) -> LLMResponse:
        raise NotImplementedError

    def list_models(self) -> List[str]:
        raise NotImplementedError

    def health(self) -> LLMHealth:
        raise NotImplementedError

    def _prepare_headers(self) -> Dict[str, str]:
        return {"Content-Type": "application/json"}

    def _timeout(self):
        return (self.config.connect_timeout, self.config.timeout)

    def _health_timeout(self):
        # Keep /health under Compose's 10s probe; do not use generate timeouts.
        return (min(self.config.connect_timeout, 2), 3)


class OllamaProvider(LLMProvider):
    def __init__(self, config: LLMConfig):
        super().__init__(config)
        self.api_url = f"{self.config.host.rstrip('/')}/api/generate"
        self.tags_url = f"{self.config.host.rstrip('/')}/api/tags"

    def generate(self, prompt: str, history: List[Dict[str, Any]]) -> LLMResponse:
        payload = {
            "model": self.config.model,
            "prompt": prompt,
            "stream": self.config.stream,
            "context": history,
            "options": {
                "temperature": self.config.temperature,
                "num_predict": self.config.max_tokens,
            },
        }
        try:
            with self.session.post(
                self.api_url,
                json=payload,
                headers=self._prepare_headers(),
                timeout=self._timeout(),
                stream=self.config.stream,
            ) as response:
                response.raise_for_status()
                if self.config.stream:
                    final_content = ""
                    for line in response.iter_lines():
                        if line:
                            json_line = json.loads(line)
                            final_content += json_line.get("response", "")
                            if json_line.get("done"):
                                return LLMResponse(
                                    content=final_content,
                                    model=json_line.get("model", self.config.model),
                                    generated_at=json_line.get("created_at", ""),
                                )
                    return LLMResponse(
                        content=final_content,
                        model=self.config.model,
                        generated_at="",
                    )
                result = response.json()
                return LLMResponse(
                    content=result.get("response", ""),
                    model=result.get("model", self.config.model),
                    generated_at=result.get("created_at", ""),
                )
        except requests.exceptions.RequestException as e:
            logger.error("Ollama request failed (%s)", type(e).__name__)
            return LLMResponse(
                content="",
                model=self.config.model,
                generated_at="",
                error="LLM provider request failed",
            )
        except json.JSONDecodeError as e:
            logger.error("Failed to decode Ollama response: %s", e)
            return LLMResponse(
                content="",
                model=self.config.model,
                generated_at="",
                error="Invalid JSON response",
            )

    def list_models(self) -> List[str]:
        response = self.session.get(self.tags_url, timeout=self._timeout())
        response.raise_for_status()
        models = response.json().get("models", [])
        return [m.get("name", "") for m in models if m.get("name")]

    def health(self) -> LLMHealth:
        started = time.perf_counter()
        try:
            response = self.session.get(self.tags_url, timeout=self._health_timeout())
            response.raise_for_status()
            latency = (time.perf_counter() - started) * 1000
            return LLMHealth(
                provider="ollama",
                host=self.config.host,
                reachable=True,
                model=self.config.model,
                latency_ms=round(latency, 2),
                status="up",
            )
        except requests.exceptions.RequestException as e:
            return LLMHealth(
                provider="ollama",
                host=self.config.host,
                reachable=False,
                model=self.config.model,
                status="down",
                detail=type(e).__name__,
            )


class LMStudioProvider(LLMProvider):
    def __init__(self, config: LLMConfig):
        super().__init__(config)
        self.api_url = f"{self.config.host.rstrip('/')}/v1/chat/completions"
        self.models_url = f"{self.config.host.rstrip('/')}/v1/models"

    def generate(self, prompt: str, history: List[Dict[str, Any]]) -> LLMResponse:
        messages = history + [{"role": "user", "content": prompt}]
        payload = {
            "model": self.config.model,
            "messages": messages,
            "temperature": self.config.temperature,
            "max_tokens": self.config.max_tokens,
            "stream": self.config.stream,
        }
        try:
            response = self.session.post(
                self.api_url,
                json=payload,
                headers=self._prepare_headers(),
                timeout=self._timeout(),
            )
            response.raise_for_status()
            result = response.json()
            content = result["choices"][0]["message"]["content"]
            model_name = result.get("model", self.config.model)
            return LLMResponse(
                content=content,
                model=model_name,
                generated_at=datetime.now().isoformat(),
            )
        except requests.exceptions.RequestException as e:
            logger.error("LM Studio request failed (%s)", type(e).__name__)
            return LLMResponse(
                content="",
                model=self.config.model,
                generated_at="",
                error="LLM provider request failed",
            )
        except (KeyError, IndexError) as e:
            logger.error("Invalid LM Studio response format: %s", e)
            return LLMResponse(
                content="",
                model=self.config.model,
                generated_at="",
                error="Invalid response format",
            )

    def list_models(self) -> List[str]:
        response = self.session.get(self.models_url, timeout=self._timeout())
        response.raise_for_status()
        data = response.json().get("data", [])
        return [m.get("id", "") for m in data if m.get("id")]

    def health(self) -> LLMHealth:
        started = time.perf_counter()
        try:
            response = self.session.get(self.models_url, timeout=self._health_timeout())
            response.raise_for_status()
            latency = (time.perf_counter() - started) * 1000
            return LLMHealth(
                provider="lm_studio",
                host=self.config.host,
                reachable=True,
                model=self.config.model,
                latency_ms=round(latency, 2),
                status="up",
            )
        except requests.exceptions.RequestException as e:
            return LLMHealth(
                provider="lm_studio",
                host=self.config.host,
                reachable=False,
                model=self.config.model,
                status="down",
                detail=type(e).__name__,
            )


def build_provider(
    provider: Optional[str] = None,
    host: Optional[str] = None,
    model: Optional[str] = None,
) -> Optional[LLMProvider]:
    name = (provider or LLM_PROVIDER).lower()
    if name == "ollama":
        config = LLMConfig(
            provider="ollama",
            host=host or OLLAMA_HOST,
            model=model or LLM_MODEL,
        )
        logger.info("Using Ollama provider model=%s host=%s", config.model, config.host)
        return OllamaProvider(config)
    if name == "lm_studio":
        config = LLMConfig(
            provider="lm_studio",
            host=host or LM_STUDIO_HOST,
            model=model or LLM_MODEL or "local-model",
        )
        logger.info("Using LM Studio provider model=%s host=%s", config.model, config.host)
        return LMStudioProvider(config)
    logger.warning("No valid LLM_PROVIDER configured. LLM features will be disabled.")
    return None


class LLMService:
    def __init__(self):
        self.provider = build_provider()
        self._models_cache: Optional[List[str]] = None
        self._models_cache_at: float = 0

    def reload(
        self,
        provider: Optional[str] = None,
        host: Optional[str] = None,
        model: Optional[str] = None,
    ) -> None:
        self.provider = build_provider(provider=provider, host=host, model=model)
        self._models_cache = None
        self._models_cache_at = 0

    @property
    def available(self) -> bool:
        return self.provider is not None

    def generate_response(
        self, prompt: str, history: Optional[List[Dict[str, Any]]] = None
    ) -> LLMResponse:
        history = history or []
        if not self.provider:
            return LLMResponse(
                content=(
                    "Local LLM is not configured. Set LLM_PROVIDER to ollama or lm_studio. "
                    "Command tools remain available without the LLM."
                ),
                model="local-fallback",
                generated_at=datetime.now().isoformat(),
                error="LLM not configured",
            )
        try:
            return self.provider.generate(prompt, history)
        except Exception as e:
            logger.error("Unexpected LLM generation failure (%s)", type(e).__name__)
            return LLMResponse(
                content="An unexpected error occurred while communicating with the LLM.",
                model=self.provider.config.model,
                generated_at=datetime.now().isoformat(),
                error="LLM generation failed",
            )

    def health(self) -> LLMHealth:
        if not self.provider:
            return LLMHealth(
                provider=LLM_PROVIDER or "none",
                host="",
                reachable=False,
                model=LLM_MODEL,
                status="unconfigured",
                detail="LLM_PROVIDER not set to ollama or lm_studio",
            )
        return self.provider.health()

    def list_models(self, cache_seconds: int = 45) -> List[str]:
        if not self.provider:
            return []
        now = time.time()
        if self._models_cache is not None and (now - self._models_cache_at) < cache_seconds:
            return self._models_cache
        try:
            models = self.provider.list_models()
            self._models_cache = models
            self._models_cache_at = now
            return models
        except requests.exceptions.RequestException as e:
            logger.warning("Failed to list models (%s)", type(e).__name__)
            return self._models_cache or []
