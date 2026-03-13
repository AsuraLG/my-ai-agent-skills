"""OpenAI-compatible provider adapter."""

from typing import Any, Dict, Optional


def build_openai_compatible_request(
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

    return {
        "model": config["model_id"],
        "messages": [{"role": "user", "content": content}],
        "response_format": {"type": "image"},
    }


def parse_openai_compatible_image_response(result: Dict[str, Any]) -> Optional[str]:
    choices = result.get("choices") or []
    if not choices:
        return None

    message = choices[0].get("message") or {}
    images = message.get("images") or []
    if images:
        first_image = images[0]
        image_url = first_image.get("image_url") or {}
        if isinstance(image_url, dict):
            return image_url.get("url")
        if isinstance(image_url, str):
            return image_url

    content = message.get("content")
    if isinstance(content, dict):
        return content.get("image") or content.get("url") or content.get("b64_json")

    if isinstance(content, str):
        return content

    return None
