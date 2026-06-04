from __future__ import annotations

import ctypes
import subprocess

import pytest

from scope_media import python_bindings


def test_error_messages_and_status_fallbacks(monkeypatch, tmp_path) -> None:
    missing = tmp_path / "missing.dll"
    monkeypatch.setattr(python_bindings, "library_path", lambda: missing)

    error = python_bindings.ScopeMediaOperationError("demo", 12345)

    assert error.operation == "demo"
    assert error.status == 12345
    assert "unknown_status" in str(error)


def test_load_library_unavailable_paths(monkeypatch, tmp_path) -> None:
    missing = tmp_path / "missing.dll"
    monkeypatch.setattr(python_bindings, "library_path", lambda: missing)

    with pytest.raises(python_bindings.ScopeMediaUnavailable, match="not found"):
        python_bindings.load_library(allow_build=False)

    monkeypatch.setattr(python_bindings, "compiler_available", lambda: False)
    with pytest.raises(python_bindings.ScopeMediaUnavailable, match="No C compiler"):
        python_bindings.load_library()

    monkeypatch.setattr(python_bindings, "compiler_available", lambda: True)
    monkeypatch.setattr(subprocess, "run", lambda *args, **kwargs: None)
    with pytest.raises(python_bindings.ScopeMediaUnavailable, match="not found"):
        python_bindings.load_library()


def test_is_available_false_when_native_library_cannot_load(monkeypatch) -> None:
    def unavailable() -> ctypes.CDLL:
        raise python_bindings.ScopeMediaUnavailable("missing")

    monkeypatch.setattr(python_bindings, "load_library", unavailable)

    assert python_bindings.is_available() is False


def test_payload_guards_and_status_raising(monkeypatch) -> None:
    with pytest.raises(ValueError, match="payload"):
        python_bindings.detect_format(b"")

    with pytest.raises(python_bindings.ScopeMediaOperationError):
        python_bindings._raise_for_status("demo", python_bindings.STATUS_IO_ERROR)

    class FakeLibrary:
        @staticmethod
        def scope_media_detect_format(data, length, detected_format) -> int:
            return python_bindings.STATUS_UNSUPPORTED_FORMAT

    monkeypatch.setattr(python_bindings, "load_library", lambda: FakeLibrary())

    assert python_bindings.detect_format(b"unknown") is None
