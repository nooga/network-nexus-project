import os
import logging
import httpx
import json
import re
from dotenv import load_dotenv
import asyncio

# Configure logging
logger = logging.getLogger("network-nexus-simulator")
# Set the logging level to DEBUG to ensure debug messages are displayed
logger.setLevel(logging.DEBUG)

# Load environment variables
load_dotenv()

# LLM configuration
LLM_API_URL = os.getenv("LLM_API_URL", "http://localhost:11434")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
MODEL_NAME = os.getenv("MODEL_NAME", "llama2")  # Default to llama2 if not specified
# Increase timeout to 30 seconds to prevent timeouts on longer generations
REQUEST_TIMEOUT = 30.0

def clean_json_response(text):
    """Clean markdown code blocks from JSON responses"""
    # Remove markdown code block markers (```json, ```)
    cleaned = re.sub(r'^```json\s*', '', text)
    cleaned = re.sub(r'\s*```$', '', cleaned)
    return cleaned.strip()

class LLMClient:
    def __init__(self, base_url=LLM_API_URL, api_key=LLM_API_KEY):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.headers = {
            "Content-Type": "application/json"
        }
        # Only add Authorization header if API key is provided
        if api_key:
            self.headers["Authorization"] = f"Bearer {api_key}"
        logger.info(f"Initialized LLM client with base URL: {self.base_url}, model: {MODEL_NAME}")
    
    async def ensure_model_available(self):
        """Ensure the model is pulled and available"""
        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                # First check if Ollama server is running
                max_retries = 5
                retry_delay = 2  # seconds
                
                for attempt in range(max_retries):
                    try:
                        logger.debug(f"Checking Ollama server health (attempt {attempt + 1}/{max_retries})")
                        health_check = await client.get(f"{self.base_url}/api/tags")
                        if health_check.status_code == 200:
                            logger.info("Ollama server is running")
                            break
                        else:
                            logger.warning(f"Ollama server returned status {health_check.status_code}")
                    except Exception as e:
                        logger.warning(f"Failed to connect to Ollama server (attempt {attempt + 1}/{max_retries}): {e}")
                        if attempt < max_retries - 1:
                            logger.info(f"Waiting {retry_delay} seconds before retrying...")
                            await asyncio.sleep(retry_delay)
                        else:
                            logger.error("Failed to connect to Ollama server after all retries")
                            return False
                
                # Now check if the model exists
                logger.debug(f"Checking if model {MODEL_NAME} exists")
                response = await client.get(f"{self.base_url}/api/tags")
                response.raise_for_status()
                models = response.json().get("models", [])
                
                # Check if the model exists and is ready
                model_exists = False
                for model in models:
                    if model.get("name") == MODEL_NAME:
                        model_exists = True
                        logger.info(f"Model {MODEL_NAME} exists and is ready")
                        break
                
                if not model_exists:
                    logger.info(f"Model {MODEL_NAME} not found, pulling it...")
                    # Pull the model
                    pull_response = await client.post(
                        f"{self.base_url}/api/pull",
                        headers=self.headers,
                        json={"name": MODEL_NAME}
                    )
                    pull_response.raise_for_status()
                else:
                    return True
        except Exception as e:
            logger.error(f"Failed to ensure model availability: {e}")
            return False

    async def generate(self, prompt: str, max_tokens: int = 100) -> str:
        """Generate text using the LLM"""
        try:
            # First check if Ollama is running
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                try:
                    logger.debug(f"Checking Ollama health at {self.base_url}/api/tags")
                    health_check = await client.get(f"{self.base_url}/api/tags")
                    logger.debug(f"Ollama health check response: {health_check.status_code}")
                    if health_check.status_code != 200:
                        logger.error(f"Ollama health check failed: {health_check.text}")
                except Exception as e:
                    logger.error(f"Failed to connect to Ollama: {e}")
                    return "{}"

                # Prepare the request payload
                payload = {
                    "model": MODEL_NAME,  # Use the configured model name
                    "prompt": f"""You are a participant in a social media network that is LinkedIn. You always respond in valid JSON format when asked.
System: You must respond with valid JSON that can be parsed by json.loads().
User: {prompt}""",
                    "stream": False
                }
                
                logger.debug(f"Sending request to {self.base_url}/api/generate with model {MODEL_NAME}")
                logger.debug(f"Request payload: {json.dumps(payload, indent=2)}")
                
                # Try the generate endpoint instead of chat/completions
                response = await client.post(
                    f"{self.base_url}/api/generate",
                    headers=self.headers,
                    json=payload
                )
                
                logger.debug(f"Response status code: {response.status_code}")
                response.raise_for_status()
                
                result = response.json()
                logger.debug(f"Raw LLM response: {json.dumps(result, indent=2)}")
                
                response_text = result.get("response", "{}").strip()
                logger.debug(f"Extracted response text: {response_text}")
                
                # Clean the response text to remove markdown code blocks
                cleaned_text = clean_json_response(response_text)
                logger.debug(f"Cleaned response text: {cleaned_text}")
                
                # Check if the response is valid JSON
                try:
                    json.loads(cleaned_text)
                    logger.debug("Response is valid JSON")
                    return cleaned_text
                except json.JSONDecodeError:
                    logger.warning(f"Response is not valid JSON after cleaning: {cleaned_text}")
                    return "{}"
        except Exception as e:
            logger.error(f"Failed to generate text: {e}")
            if isinstance(e, httpx.HTTPError):
                logger.error(f"Response content: {e.response.text if hasattr(e, 'response') else 'No response content'}")
            return "{}"  # Return empty JSON object as fallback

# Initialize LLM client
llm_client = LLMClient() 