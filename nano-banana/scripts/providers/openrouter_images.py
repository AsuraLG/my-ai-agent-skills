"""OpenRouter dedicated Images API provider adapter."""

from fractions import Fraction
from typing import Any, Callable, Dict, List, Optional, Tuple

from .openrouter import (
    DEFAULT_ASPECT_RATIO,
    DEFAULT_IMAGE_SIZE,
    EXPLICIT_SIZE_PATTERN,
    SUPPORTED_ASPECT_RATIOS,
)

SUPPORTED_SIZE_TIERS = {"0.5K", "1K", "2K", "4K"}


def prepare_openrouter_images_parameters(
    size: Optional[str],
    aspect_ratio: Optional[str],
    confirm: Callable[[str], bool],
) -> Tuple[Optional[str], Optional[str], bool]:
    """Normalize user size input and resolve explicit-size/aspect conflicts."""
    normalized_size = _normalize_size(size)
    dimensions = _parse_dimensions(normalized_size)
    if normalized_size is None:
        normalized_size = DEFAULT_IMAGE_SIZE
    if aspect_ratio is None and dimensions is None:
        aspect_ratio = DEFAULT_ASPECT_RATIO
    if dimensions and aspect_ratio and _dimensions_conflict(dimensions, aspect_ratio):
        should_continue = confirm(
            f"当前 --size {size} 与 --aspect-ratio {aspect_ratio} 冲突。"
            "继续将以显式像素尺寸为准并忽略 --aspect-ratio，是否继续？"
        )
        if not should_continue:
            return normalized_size, aspect_ratio, False
        aspect_ratio = None
    return normalized_size, aspect_ratio, True


def _normalize_size(size: Optional[str]) -> Optional[str]:
    if size is None:
        return None
    normalized = str(size).strip()
    normalized_upper = normalized.upper()
    if normalized_upper == "0.5K":
        return "512"
    dimensions = _parse_dimensions(normalized)
    if dimensions:
        return "{}x{}".format(*dimensions)
    if normalized_upper not in SUPPORTED_SIZE_TIERS:
        supported = ", ".join(sorted(SUPPORTED_SIZE_TIERS))
        raise ValueError(
            f"OpenRouter Images size 不支持: {size}，当前仅支持: "
            f"{supported} 或 WIDTH*HEIGHT"
        )
    return normalized_upper


def _parse_dimensions(value: Optional[str]) -> Optional[Tuple[int, int]]:
    if value is None:
        return None
    match = EXPLICIT_SIZE_PATTERN.match(str(value))
    if not match:
        return None
    width, height = int(match.group(1)), int(match.group(2))
    if width < 1 or height < 1:
        return None
    return width, height


def _dimensions_conflict(dimensions: Tuple[int, int], aspect_ratio: str) -> bool:
    try:
        width_ratio, height_ratio = str(aspect_ratio).split(":", 1)
        expected = Fraction(width_ratio.strip()) / Fraction(height_ratio.strip())
    except (ValueError, ZeroDivisionError):
        return False
    return Fraction(dimensions[0], dimensions[1]) != expected


def build_openrouter_images_request(
    config: Dict[str, Any], prompt: str, image_inputs: List[Dict[str, str]]
) -> Dict[str, Any]:
    """Build a request for OpenRouter's dedicated POST /images endpoint."""
    payload: Dict[str, Any] = {
        "model": config["model_id"],
        "prompt": prompt,
    }

    if image_inputs:
        payload["input_references"] = [
            {
                "type": "image_url",
                "image_url": {"url": image_input["data_url"]},
            }
            for image_input in image_inputs
        ]

    normalized_size = _normalize_size(config.get("size"))
    dimensions = _parse_dimensions(normalized_size)
    if normalized_size is None:
        normalized_size = DEFAULT_IMAGE_SIZE
    normalized_aspect_ratio = config.get("aspect_ratio")
    if normalized_aspect_ratio is None and dimensions is None:
        normalized_aspect_ratio = DEFAULT_ASPECT_RATIO
    if normalized_aspect_ratio is not None:
        payload["aspect_ratio"] = normalized_aspect_ratio
    payload["size"] = normalized_size

    _validate_image_options(payload)
    return payload


def _validate_image_options(payload: Dict[str, Any]) -> None:
    """Reject malformed local values before making a billable request."""
    aspect_ratio = payload.get("aspect_ratio")
    if aspect_ratio is not None and not isinstance(aspect_ratio, str):
        raise ValueError("OpenRouter Images aspect_ratio 必须是字符串")
    if aspect_ratio is not None and aspect_ratio not in SUPPORTED_ASPECT_RATIOS:
        supported = ", ".join(sorted(SUPPORTED_ASPECT_RATIOS))
        raise ValueError(
            f"OpenRouter Images aspect_ratio 不支持: {aspect_ratio}，当前仅支持: {supported}"
        )


def parse_openrouter_images_response(result: Any) -> Optional[str]:
    """Extract the first image as a data URL from a JSON response."""
    if not isinstance(result, dict):
        return None

    data = result.get("data") or []
    if not isinstance(data, list):
        return None
    for item in data:
        if not isinstance(item, dict):
            continue
        encoded = item.get("b64_json")
        if isinstance(encoded, str) and encoded:
            if encoded.startswith("data:image/"):
                return encoded
            media_type = item.get("media_type") or "image/png"
            return f"data:{media_type};base64,{encoded}"
        image_url = item.get("url")
        if isinstance(image_url, str) and image_url:
            return image_url
    return None
