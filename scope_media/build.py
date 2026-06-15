from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BUILD_DIR = ROOT / 'build'
INCLUDE_DIR = ROOT / 'include'
SRC_DIR = ROOT / 'src'
COMPILER_CANDIDATES = ('cl', 'clang', 'gcc')


def _source_files() -> list[Path]:
    sources = sorted(SRC_DIR.glob('*.c'))
    if not sources:
        raise SystemExit('No C source files found under scope_media/src')
    return sources


def _compiler() -> str:
    for compiler_name in COMPILER_CANDIDATES:
        compiler = shutil.which(compiler_name)
        if compiler is not None:
            return Path(compiler).name.lower()
    raise SystemExit('No C compiler found in PATH (expected cl, clang, or gcc).')


def _build_with_cl(sources: list[Path]) -> Path:
    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    output = BUILD_DIR / 'scope_media.dll'
    object_dir = f'{BUILD_DIR}\\'
    command = [
        'cl',
        '/nologo',
        '/LD',
        '/O2',
        '/W4',
        '/DSCOPE_MEDIA_BUILD',
        f'/I{INCLUDE_DIR}',
        f'/Fo{object_dir}',
        *[str(path) for path in sources],
        '/link',
        f'/OUT:{output}',
    ]
    subprocess.run(command, cwd=ROOT, check=True)
    return output


def _native_library_output() -> Path:
    return BUILD_DIR / ('scope_media.dll' if os.name == 'nt' else 'libscope_media.so')


def _build_with_c_compiler(compiler: str, sources: list[Path]) -> Path:
    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    output = _native_library_output()
    command = [compiler, '-shared']
    if os.name != 'nt':
        command.append('-fPIC')
    command.extend(
        [
            '-std=c99',
            '-O2',
            '-Wall',
            '-Wextra',
            '-DSCOPE_MEDIA_BUILD',
            f'-I{INCLUDE_DIR}',
            '-o',
            str(output),
            *[str(path) for path in sources],
        ]
    )
    if os.name != 'nt' or compiler == 'gcc':
        command.append('-lm')
    subprocess.run(command, cwd=ROOT, check=True)
    return output


def _build_with_gcc(sources: list[Path]) -> Path:
    return _build_with_c_compiler('gcc', sources)


def _build_with_clang(sources: list[Path]) -> Path:
    return _build_with_c_compiler('clang', sources)


def build() -> Path:
    sources = _source_files()
    output = _native_library_output()
    if output.exists():
        headers = sorted(SRC_DIR.glob('*.h')) + sorted(INCLUDE_DIR.glob('*.h'))
        newest_source = max(path.stat().st_mtime for path in [*sources, *headers])
        if output.stat().st_mtime >= newest_source:
            return output

    compiler_name = _compiler()
    if compiler_name.startswith('clang'):
        return _build_with_clang(sources)
    if compiler_name in {'cl', 'cl.exe'}:
        return _build_with_cl(sources)
    return _build_with_gcc(sources)


if __name__ == '__main__':
    output = build()
    print(output)
