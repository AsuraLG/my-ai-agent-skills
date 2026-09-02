"""Provider adapters for nano-banana image generation."""

from typing import Any, Callable, Dict, List, Optional, Tuple

from .openai_compatible import (
    build_openai_compatible_request,
    parse_openai_compatible_image_response,
)
from .openrouter import build_openrouter_request, parse_openrouter_image_response
from .openrouter import OPENROUTER_BASE_URL, prepare_openrouter_parameters
from .openrouter_images import (
    build_openrouter_images_request,
    parse_openrouter_images_response,
    prepare_openrouter_images_parameters,
)


SUPPORTED_PROVIDER_TYPES = {
    "openai_compatible",
    "openrouter",
    "openrouter_images",
}


def resolve_provider_type(provider_type: str) -> str:
    normalized = (provider_type or "openai_compatible").strip().lower()
    if normalized not in SUPPORTED_PROVIDER_TYPES:
        supported = ", ".join(sorted(SUPPORTED_PROVIDER_TYPES))
        raise ValueError(f"不支持的 provider_type: {provider_type}，当前仅支持: {supported}")
    return normalized


def resolve_provider_endpoint(config: Dict[str, Any]) -> str:
    provider_type = resolve_provider_type(config.get("provider_type", "openai_compatible"))
    configured_base_url = config.get("base_url")
    if provider_type in {"openrouter", "openrouter_images"}:
        base_url = (configured_base_url or OPENROUTER_BASE_URL).rstrip("/")
    else:
        base_url = (configured_base_url or "").rstrip("/")
        if not base_url:
            raise ValueError("openai_compatible provider 缺少 base_url")

    if provider_type == "openrouter":
        return f"{base_url}/chat/completions"

    if provider_type == "openrouter_images":
        return f"{base_url}/images"

    return f"{base_url}/chat/completions"


def build_provider_request(
    config: Dict[str, Any], prompt: str, image_inputs: List[Dict[str, str]]
) -> Dict[str, Any]:
    provider_type = resolve_provider_type(config.get("provider_type", "openai_compatible"))

    if provider_type == "openrouter":
        return build_openrouter_request(config, prompt, image_inputs)

    if provider_type == "openrouter_images":
        return build_openrouter_images_request(config, prompt, image_inputs)

    return build_openai_compatible_request(config, prompt, image_inputs)


def parse_provider_image_response(provider_type: str, result: Any) -> Optional[str]:
    resolved_type = resolve_provider_type(provider_type)

    if resolved_type == "openrouter":
        return parse_openrouter_image_response(result)

    if resolved_type == "openrouter_images":
        return parse_openrouter_images_response(result)

    return parse_openai_compatible_image_response(result)


def resolve_provider_base_url(provider_type: str, configured_base_url: Optional[str]) -> Optional[str]:
    """Return the configured URL or the built-in OpenRouter API root."""
    resolved_type = resolve_provider_type(provider_type)
    if resolved_type in {"openrouter", "openrouter_images"}:
        return (configured_base_url or OPENROUTER_BASE_URL).rstrip("/")
    return configured_base_url.rstrip("/") if configured_base_url else None


def prepare_provider_parameters(
    provider_type: str,
    size: Optional[str],
    aspect_ratio: Optional[str],
    confirm: Callable[[str], bool],
) -> Tuple[Optional[str], Optional[str], bool]:
    resolved_type = resolve_provider_type(provider_type)
    if resolved_type == "openrouter":
        return prepare_openrouter_parameters(size, aspect_ratio, confirm)
    if resolved_type == "openrouter_images":
        return prepare_openrouter_images_parameters(size, aspect_ratio, confirm)
    if size is None and aspect_ratio is None:
        return size, aspect_ratio, True
    fields = []
    if aspect_ratio is not None:
        fields.append("--aspect-ratio")
    if size is not None:
        fields.append("--size")
    should_continue = confirm(
        "当前 openai_compatible provider 不支持 "
        + "、".join(fields)
        + "，继续将忽略这些参数，是否继续？"
    )
    return None, None, should_continue
