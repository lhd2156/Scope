"""Smoke-check Scope AI's Gemini provider without starting the full stack."""

from __future__ import annotations

import os
from pathlib import Path

import httpx


def _load_env_file(path: Path) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def main() -> int:
    repo_root = Path(__file__).resolve().parents[2]
    _load_env_file(repo_root / ".env")
    _load_env_file(Path(__file__).resolve().parents[1] / ".env")

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite").strip()
    fallback_models = [
        item.strip()
        for item in os.getenv("GEMINI_FALLBACK_MODELS", "gemini-2.0-flash-lite,gemini-2.0-flash").split(",")
        if item.strip()
    ]
    base_url = os.getenv("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta").rstrip("/")

    if not api_key:
        print("GEMINI_API_KEY is not set.")
        return 2

    models = []
    for model_name in [model, *fallback_models]:
        if model_name not in models:
            models.append(model_name)

    last_error = ""
    for model_name in models:
        endpoint = f"{base_url}/models/{model_name.removeprefix('models/')}:generateContent"
        try:
            response = httpx.post(
                endpoint,
                params={"key": api_key},
                json={
                    "systemInstruction": {
                        "parts": [
                            {
                                "text": (
                                    "You are Scope AI. Reply with one short sentence confirming "
                                    "the Gemini provider is ready for Scope."
                                )
                            }
                        ]
                    },
                    "contents": [{"role": "user", "parts": [{"text": "Scope Gemini smoke check"}]}],
                    "generationConfig": {"temperature": 0.1, "maxOutputTokens": 80},
                },
                timeout=float(os.getenv("GEMINI_TIMEOUT_SECONDS", "30")),
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            last_error = f"{model_name} failed with HTTP {exc.response.status_code}"
            print(last_error)
            continue

        parts = response.json().get("candidates", [{}])[0].get("content", {}).get("parts", [])
        text = " ".join(str(part.get("text") or "").strip() for part in parts).strip()
        print(f"Gemini provider OK: {model_name}")
        print(text or "No text returned.")
        return 0

    print(last_error or "Gemini provider failed.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
