from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BUILD_DIR = ROOT / 'build'
INCLUDE_DIR = ROOT / 'include'
SRC_DIR = ROOT / 'src'


def _source_files() -> list[Path]:
    sources = sorted(SRC_DIR.glob('*.c'))
    if not sources:
        raise SystemExit('No C source files found under atlas_media/src')
    return sources


def _compiler() -> str:
    compiler = shutil.which('cl') or shutil.which('gcc')
    if compiler is None:
        raise SystemExit('No C compiler found in PATH (expected cl or gcc).')
    return Path(compiler).name.lower()


def _build_with_cl(sources: list[Path]) -> Path:
    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    output = BUILD_DIR / 'atlas_media.dll'
    object_dir = f'{BUILD_DIR}\\'
    command = [
        'cl',
        '/nologo',
        '/LD',
        '/O2',
        '/W4',
        '/DATLAS_MEDIA_BUILD',
        f'/I{INCLUDE_DIR}',
        f'/Fo{object_dir}',
        *[str(path) for path in sources],
        '/link',
        f'/OUT:{output}',
    ]
    subprocess.run(command, cwd=ROOT, check=True)
    return output


def _build_with_gcc(sources: list[Path]) -> Path:
    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    if os.name == 'nt':
        output = BUILD_DIR / 'atlas_media.dll'
        command = [
            'gcc',
            '-shared',
            '-std=c99',
            '-O2',
            '-Wall',
            '-Wextra',
            '-DATLAS_MEDIA_BUILD',
            f'-I{INCLUDE_DIR}',
            '-o',
            str(output),
            *[str(path) for path in sources],
        ]
    else:
        output = BUILD_DIR / 'libatlas_media.so'
        command = [
            'gcc',
            '-shared',
            '-fPIC',
            '-std=c99',
            '-O2',
            '-Wall',
            '-Wextra',
            '-DATLAS_MEDIA_BUILD',
            f'-I{INCLUDE_DIR}',
            '-o',
            str(output),
            *[str(path) for path in sources],
        ]
    subprocess.run(command, cwd=ROOT, check=True)
    return output


def build() -> Path:
    sources = _source_files()
    compiler_name = _compiler()
    if compiler_name.startswith('cl'):
        return _build_with_cl(sources)
    return _build_with_gcc(sources)


if __name__ == '__main__':
    output = build()
    print(output)
