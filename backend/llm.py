"""
Module for Local LLM Integration (Ollama, LM Studio)
"""

import os
import requests
import json
import logging
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

logger = logging.getLogger(__name__)

# --- Configuration ---
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama")  # Default to ollama
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://host.docker.internal:11434")
LM_STUDIO_HOST = os.getenv("LM_STUDIO_HOST", "http://host.docker.internal:1234")
LLM_MODEL = os.getenv("LLM_MODEL", "llama3:latest")
LLM_TIMEOUT = int(os.getenv("LLM_TIMEOUT", "120"))
LLM_STREAM = os.getenv("LLM_STREAM", "false").lower() == "true"
LLM_TEMPERATURE = float(os.getenv("LLM_TEMPERATURE", "0.7"))
LLM_MAX_TOKENS = int(os.getenv("LLM_MAX_TOKENS", "2048"))

# --- Pydantic Models ---
class LLMConfig(BaseModel):
    provider: str = LLM_PROVIDER
    host: str
    model: str = LLM_MODEL
    timeout: int = LLM_TIMEOUT
    stream: bool = LLM_STREAM
    temperature: float = LLM_TEMPERATURE
    max_tokens: int = LLM_MAX_TOKENS

class LLMResponse(BaseModel):
    content: str
    model: str
    generated_at: str
    error: Optional[str] = None

# --- LLM Provider Interface ---
class LLMProvider:
    def __init__(self, config: LLMConfig):
        self.config = config
        self.session = requests.Session()

    def generate(self, prompt: str, history: List[Dict[str, Any]]) -> LLMResponse:
        raise NotImplementedError

    def _prepare_headers(self) -> Dict[str, str]:
        return {"Content-Type": "application/json"}

# --- Ollama Integration ---
class OllamaProvider(LLMProvider):
    def __init__(self, config: LLMConfig):
        super().__init__(config)
        self.api_url = f"{self.config.host}/api/generate"

    def generate(self, prompt: str, history: List[Dict[str, Any]]) -> LLMResponse:
        payload = {
            "model": self.config.model,
            "prompt": prompt,
            "stream": self.config.stream,
            "context": history,  # Pass conversation history
            "options": {
                "temperature": self.config.temperature,
                "num_predict": self.config.max_tokens
            }
        }
        try:
            with self.session.post(
                self.api_url,
                json=payload,
                headers=self._prepare_headers(),
                timeout=self.config.timeout,
                stream=self.config.stream
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
                                    generated_at=json_line.get("created_at", "")
                                )
                    return LLMResponse(content=final_content, model=self.config.model, generated_at="")
                else:
                    result = response.json()
                    return LLMResponse(
                        content=result.get("response", ""),
                        model=result.get("model", self.config.model),
                        generated_at=result.get("created_at", "")
                    )

        except requests.exceptions.RequestException as e:
            logger.error(f"Ollama request failed: {e}")
            return LLMResponse(content="", model=self.config.model, generated_at="", error=str(e))
        except json.JSONDecodeError as e:
            logger.error(f"Failed to decode Ollama response: {e}")
            return LLMResponse(content="", model=self.config.model, generated_at="", error="Invalid JSON response")

# --- LM Studio Integration ---
class LMStudioProvider(LLMProvider):
    def __init__(self, config: LLMConfig):
        super().__init__(config)
        self.api_url = f"{self.config.host}/v1/chat/completions"

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
                timeout=self.config.timeout
            )
            response.raise_for_status()
            result = response.json()
            
            content = result["choices"][0]["message"]["content"]
            model_name = result.get("model", self.config.model)
            
            return LLMResponse(
                content=content,
                model=model_name,
                generated_at=datetime.now().isoformat()
            )

        except requests.exceptions.RequestException as e:
            logger.error(f"LM Studio request failed: {e}")
            return LLMResponse(content="", model=self.config.model, generated_at="", error=str(e))
        except (KeyError, IndexError) as e:
            logger.error(f"Invalid LM Studio response format: {e}")
            return LLMResponse(content="", model=self.config.model, generated_at="", error="Invalid response format")

# --- Factory Function ---
def get_llm_provider() -> Optional[LLMProvider]:
    """Factory to get the configured LLM provider"""
    
    if LLM_PROVIDER.lower() == "ollama":
        config = LLMConfig(provider="ollama", host=OLLAMA_HOST)
        logger.info(f"Using Ollama provider with model: {config.model} at {config.host}")
        return OllamaProvider(config)
        
    elif LLM_PROVIDER.lower() == "lm_studio":
        config = LLMConfig(provider="lm_studio", host=LM_STUDIO_HOST, model="local-model")
        logger.info(f"Using LM Studio provider with model: {config.model} at {config.host}")
        return LMStudioProvider(config)
        
    logger.warning("No valid LLM_PROVIDER configured. LLM features will be disabled.")
    return None

# --- Main LLM Service ---
class LLMService:
    def __init__(self):
        self.provider = get_llm_provider()

    def generate_response(self, prompt: str, history: List[Dict[str, Any]] = []) -> LLMResponse:
        if not self.provider:
            return LLMResponse(
                content="Local LLM is not configured. Please set LLM_PROVIDER in your .env file.",
                model="local-fallback",
                generated_at=datetime.now().isoformat(),
                error="LLM not configured"
            )
        
        try:
            return self.provider.generate(prompt, history)
        except Exception as e:
            logger.error(f"Error during LLM generation: {e}", exc_info=True)
            return LLMResponse(
                content="An unexpected error occurred while communicating with the LLM.",
                model=self.provider.config.model,
                generated_at=datetime.now().isoformat(),
                error=str(e)
            )

# Example usage (for testing)
if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv() # Make sure to load .env for testing
    
    # Configure logging for testing
    logging.basicConfig(level=logging.INFO)
    
    # --- Test Ollama ---
    os.environ["LLM_PROVIDER"] = "ollama"
    ollama_service = LLMService()
    if ollama_service.provider:
        logger.info("--- Testing Ollama ---")
        test_prompt = "Explain what a port scan is in one sentence."
        ollama_response = ollama_service.generate_response(test_prompt)
        logger.info(f"Ollama Prompt: {test_prompt}")
        logger.info(f"Ollama Response: {ollama_response.content}")
        logger.info(f"Model: {ollama_response.model}")
        if ollama_response.error:
            logger.error(f"Ollama Error: {ollama_response.error}")

    # --- Test LM Studio ---
    os.environ["LLM_PROVIDER"] = "lm_studio"
    lm_studio_service = LLMService()
    if lm_studio_service.provider:
        logger.info("--- Testing LM Studio ---")
        test_prompt = "What is the main purpose of nmap?"
        lm_studio_response = lm_studio_service.generate_response(test_prompt)
        logger.info(f"LM Studio Prompt: {test_prompt}")
        logger.info(f"LM Studio Response: {lm_studio_response.content}")
        logger.info(f"Model: {lm_studio_response.model}")
        if lm_studio_response.error:
            logger.error(f"LM Studio Error: {lm_studio_response.error}")
