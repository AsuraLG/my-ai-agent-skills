"""Provider adapters for nano-banana image generation."""

from typing import Any, Dict, Optional

from .openai_compatible import (
    build_openai_compatible_request,
    parse_openai_compatible_image_response,
)
from .openrouter import build_openrouter_request, parse_openrouter_image_response


SUPPORTED_PROVIDER_TYPES = {
    "openai_compatible",
    "openrouter",
}


def resolve_provider_type(provider_type: str) -> str:
    normalized = (provider_type or "openai_compatible").strip().lower()
    if normalized not in SUPPORTED_PROVIDER_TYPES:
        supported = ", ".join(sorted(SUPPORTED_PROVIDER_TYPES))
        raise ValueError(f"不支持的 provider_type: {provider_type}，当前仅支持: {supported}")
    return normalized


def resolve_provider_endpoint(config: Dict[str, Any]) -> str:
    provider_type = resolve_provider_type(config.get("provider_type", "openai_compatible"))
    base_url = config["base_url"].rstrip("/")

    if provider_type == "openrouter":
        return f"{base_url}/chat/completions"

    return f"{base_url}/chat/completions"


def build_provider_request(
    config: Dict[str, Any], prompt: str, image_input: Optional[Dict[str, str]]
) -> Dict[str, Any]:
    provider_type = resolve_provider_type(config.get("provider_type", "openai_compatible"))

    if provider_type == "openrouter":
        return build_openrouter_request(config, prompt, image_input)

    return build_openai_compatible_request(config, prompt, image_input)


def parse_provider_image_response(provider_type: str, result: Dict[str, Any]) -> Optional[str]:
    resolved_type = resolve_provider_type(provider_type)

    if resolved_type == "openrouter":
        return parse_openrouter_image_response(result)

    return parse_openai_compatible_image_response(result)
