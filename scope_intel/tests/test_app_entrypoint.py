from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

from app import factory as factory_module


def test_app_entrypoint_exposes_configured_flask_app(monkeypatch):
    monkeypatch.setattr(factory_module.settings, "secret_key", "scope-intel-test-secret")
    monkeypatch.setattr(factory_module.settings, "jwt_secret", "scope-intel-test-jwt-secret")
    monkeypatch.setattr(factory_module.settings, "frontend_origin", "https://scope-frontend.example")

    entrypoint_path = Path(__file__).resolve().parents[1] / "app.py"
    spec = spec_from_file_location("scope_intel_entrypoint_test", entrypoint_path)
    assert spec is not None and spec.loader is not None

    module = module_from_spec(spec)
    spec.loader.exec_module(module)

    assert module.app is not None
    assert module.app.config["SECRET_KEY"] == "scope-intel-test-secret"
    assert module.app.config["JWT_SECRET"] == "scope-intel-test-jwt-secret"
    assert module.app.config["FRONTEND_ORIGIN"] == "https://scope-frontend.example"
