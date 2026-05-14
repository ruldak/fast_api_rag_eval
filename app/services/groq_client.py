import json
import re
import logging
from typing import Dict, Any
from groq import AsyncGroq

logger = logging.getLogger("groq_client")

class GroqClient:
    def __init__(self, api_key: str):
        self.client = AsyncGroq(api_key=api_key)
    
    async def evaluate(self, prompt: str, model: str = "llama-3.1-8b-instant", temperature: float = 0.0) -> Dict[str, Any]:
        logger.info(f"[GROQ] Sending request | model={model} | prompt_length={len(prompt)}")
        
        chat_completion = await self.client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are a precise evaluation engine. You must respond with valid JSON only."
                },
                {"role": "user", "content": prompt}
            ],
            model=model,
            temperature=temperature,
            max_tokens=1024,
        )
        
        raw_content = chat_completion.choices[0].message.content
        usage = chat_completion.usage
        
        result = self._parse_json(raw_content)
        result["token_usage"] = {
            "prompt_tokens": usage.prompt_tokens,
            "completion_tokens": usage.completion_tokens,
            "total_tokens": usage.total_tokens
        }
        
        return result
    
    def _parse_json(self, text: str) -> Dict[str, Any]:
        # Coba parse langsung
        try:
            return json.loads(text.strip())
        except json.JSONDecodeError:
            pass
        
        # Cari JSON di dalam markdown code block
        patterns = [
            r"```json\s*([\s\S]*?)\s*```",
            r"```\s*([\s\S]*?)\s*```",
            r"\{[\s\S]*?\}"
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, text)
            for match in matches:
                try:
                    return json.loads(match.strip())
                except json.JSONDecodeError:
                    continue
        return {
            "score": None,
            "reason": f"Failed to parse JSON from LLM response. Raw: {text[:500]}",
            "parse_error": True
        }