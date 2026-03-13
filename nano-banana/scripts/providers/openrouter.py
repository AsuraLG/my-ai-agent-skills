"""OpenRouter provider adapter."""

from typing import Any, Dict, Optional

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


def build_openrouter_request(
    config: Dict[str, Any], prompt: str, image_input: Optional[Dict[str, str]]
) -> Dict[str, Any]:
    content = []

    if image_input:
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

    aspect_ratio = config.get("aspect_ratio")
    if aspect_ratio:
        normalized_aspect_ratio = str(aspect_ratio).strip()
        if normalized_aspect_ratio not in SUPPORTED_ASPECT_RATIOS:
            supported = ", ".join(sorted(SUPPORTED_ASPECT_RATIOS))
            raise ValueError(
                f"OpenRouter aspect_ratio 不支持: {normalized_aspect_ratio}，当前仅支持: {supported}"
            )
        if normalized_aspect_ratio != DEFAULT_ASPECT_RATIO:
            image_config["aspect_ratio"] = normalized_aspect_ratio

    image_size = config.get("size")
    if image_size:
        normalized_image_size = str(image_size).strip().upper()
        if normalized_image_size not in SUPPORTED_IMAGE_SIZES:
            supported = ", ".join(sorted(SUPPORTED_IMAGE_SIZES))
            raise ValueError(
                f"OpenRouter image_size 不支持: {normalized_image_size}，当前仅支持: {supported}"
            )
        if normalized_image_size != DEFAULT_IMAGE_SIZE:
            image_config["image_size"] = normalized_image_size

    if image_config:
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
