from __future__ import annotations

import os
from pathlib import Path

import pytest

from scope_media import build as build_module


def _patch_tree(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> tuple[Path, Path, Path, Path]:
    root = tmp_path / "scope_media"
    src = root / "src"
    include = root / "include"
    build = root / "build"
    src.mkdir(parents=True)
    include.mkdir()
    source = src / "scope_media.c"
    source.write_text("int scope_media_demo(void) { return 1; }\n", encoding="utf-8")
    (include / "scope_media.h").write_text("#define SCOPE_MEDIA_BUILD 1\n", encoding="utf-8")

    monkeypatch.setattr(build_module, "ROOT", root)
    monkeypatch.setattr(build_module, "SRC_DIR", src)
    monkeypatch.setattr(build_module, "INCLUDE_DIR", include)
    monkeypatch.setattr(build_module, "BUILD_DIR", build)
    return root, src, include, source


def test_source_discovery_and_compiler_errors(monkeypatch, tmp_path):
    empty_src = tmp_path / "empty-src"
    empty_src.mkdir()
    monkeypatch.setattr(build_module, "SRC_DIR", empty_src)

    with pytest.raises(SystemExit, match="No C source files"):
        build_module._source_files()

    monkeypatch.setattr(build_module.shutil, "which", lambda _name: None)
    with pytest.raises(SystemExit, match="No C compiler"):
        build_module._compiler()

    monkeypatch.setattr(build_module.shutil, "which", lambda name: f"/usr/bin/{name}" if name == "clang" else None)
    assert build_module._compiler() == "clang"


def test_build_reuses_fresh_native_library(monkeypatch, tmp_path):
    _root, _src, include, source = _patch_tree(monkeypatch, tmp_path)
    output = build_module.BUILD_DIR / ("scope_media.dll" if os.name == "nt" else "libscope_media.so")
    output.parent.mkdir()
    output.write_text("native", encoding="utf-8")
    fresh_time = max(source.stat().st_mtime, (include / "scope_media.h").stat().st_mtime) + 20
    os.utime(output, (fresh_time, fresh_time))
    monkeypatch.setattr(build_module, "_compiler", lambda: (_ for _ in ()).throw(AssertionError("compiler not needed")))

    assert build_module.build() == output


def test_build_dispatches_to_selected_compiler(monkeypatch, tmp_path):
    _patch_tree(monkeypatch, tmp_path)
    calls: list[str] = []

    monkeypatch.setattr(build_module, "_build_with_clang", lambda _sources: calls.append("clang") or Path("clang-out"))
    monkeypatch.setattr(build_module, "_build_with_cl", lambda _sources: calls.append("cl") or Path("cl-out"))
    monkeypatch.setattr(build_module, "_build_with_gcc", lambda _sources: calls.append("gcc") or Path("gcc-out"))

    for compiler, expected in (("clang", "clang"), ("clang.exe", "clang"), ("cl", "cl"), ("cl.exe", "cl"), ("gcc", "gcc")):
        monkeypatch.setattr(build_module, "_compiler", lambda compiler=compiler: compiler)
        assert build_module.build() == Path(f"{expected}-out")

    assert calls == ["clang", "clang", "cl", "cl", "gcc"]


def test_platform_specific_compile_commands(monkeypatch, tmp_path):
    _root, _src, _include, source = _patch_tree(monkeypatch, tmp_path)
    commands: list[list[str]] = []

    def capture(command, cwd, check):
        commands.append(command)
        assert cwd == build_module.ROOT
        assert check is True

    monkeypatch.setattr(build_module.subprocess, "run", capture)

    monkeypatch.setattr(build_module.os, "name", "nt", raising=False)
    assert build_module._build_with_cl([source]).name == "scope_media.dll"
    assert build_module._build_with_gcc([source]).name == "scope_media.dll"
    assert build_module._build_with_clang([source]).name == "scope_media.dll"

    monkeypatch.setattr(build_module.os, "name", "posix", raising=False)
    assert build_module._build_with_gcc([source]).name == "libscope_media.so"
    assert build_module._build_with_clang([source]).name == "libscope_media.so"

    flattened = [" ".join(command) for command in commands]
    assert any(command.startswith("cl /nologo /LD") for command in flattened)
    assert any(command.startswith("gcc -shared -std=c99") for command in flattened)
    assert any("-fPIC" in command for command in flattened)
    assert any(command.startswith("clang -shared -std=c99") for command in flattened)
