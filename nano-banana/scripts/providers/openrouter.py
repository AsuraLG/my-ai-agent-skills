"""OpenRouter chat-completions provider adapter."""

import re
from typing import Any, Callable, Dict, List, Optional, Tuple

SUPPORTED_ASPECT_RATIOS = {
    "1:1",
    "2:3",
    "3:2",
    "3:4",
    "4:3",
    "4:5",
    "5:4",
    "9:16",
    "16:9",
    "21:9",
    "1:4",
    "4:1",
    "1:8",
    "8:1",
}
SUPPORTED_IMAGE_SIZES = {"0.5K", "1K", "2K", "4K"}
DEFAULT_ASPECT_RATIO = "1:1"
DEFAULT_IMAGE_SIZE = "1K"
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
EXPLICIT_SIZE_PATTERN = re.compile(r"^\s*(\d+)\s*[xX*]\s*(\d+)\s*$")


def prepare_openrouter_parameters(
    size: Optional[str],
    aspect_ratio: Optional[str],
    confirm: Callable[[str], bool],
) -> Tuple[Optional[str], Optional[str], bool]:
    """Validate chat endpoint parameters and ask before ignoring pixel sizes."""
    if size is not None and EXPLICIT_SIZE_PATTERN.match(str(size)):
        should_continue = confirm(
            "当前 openrouter provider 的 chat/completions 接口只支持 "
            "0.5K/1K/2K/4K，不能使用 WIDTH*HEIGHT 形式。"
            "继续将忽略 --size 并使用默认 1K，是否继续？"
        )
        if not should_continue:
            return size, aspect_ratio, False
        size = None
    return size, aspect_ratio, True


def build_openrouter_request(
    config: Dict[str, Any], prompt: str, image_inputs: List[Dict[str, str]]
) -> Dict[str, Any]:
    content = []

    for image_input in image_inputs:
        content.append(
            {
                "type": "image_url",
                "image_url": {"url": image_input["data_url"]},
            }
        )

    content.append({"type": "text", "text": prompt})

    payload = {
        "model": config["model_id"],
        "messages": [{"role": "user", "content": content}],
        "modalities": ["image", "text"],
    }

    image_config = {}

    raw_aspect_ratio = config.get("aspect_ratio")
    normalized_aspect_ratio = (
        DEFAULT_ASPECT_RATIO
        if raw_aspect_ratio is None
        else str(raw_aspect_ratio).strip()
    )
    if normalized_aspect_ratio not in SUPPORTED_ASPECT_RATIOS:
        supported = ", ".join(sorted(SUPPORTED_ASPECT_RATIOS))
        raise ValueError(
            f"OpenRouter aspect_ratio 不支持: {normalized_aspect_ratio}，当前仅支持: {supported}"
        )
    image_config["aspect_ratio"] = normalized_aspect_ratio

    raw_image_size = config.get("size")
    normalized_image_size = (
        DEFAULT_IMAGE_SIZE
        if raw_image_size is None
        else str(raw_image_size).strip().upper()
    )
    if normalized_image_size not in SUPPORTED_IMAGE_SIZES:
        supported = ", ".join(sorted(SUPPORTED_IMAGE_SIZES))
        raise ValueError(
            f"OpenRouter image_size 不支持: {normalized_image_size}，当前仅支持: {supported}"
        )
    image_config["image_size"] = normalized_image_size

    payload["image_config"] = image_config

    return payload


def parse_openrouter_image_response(result: Dict[str, Any]) -> Optional[str]:
    choices = result.get("choices") or []
    if not choices:
        return None

    message = choices[0].get("message") or {}
    images = message.get("images") or []
    if not images:
        return None

    first_image = images[0] or {}
    image_url = first_image.get("image_url") or {}
    if isinstance(image_url, dict):
        return image_url.get("url")

    if isinstance(image_url, str):
        return image_url

    return None
