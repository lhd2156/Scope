from __future__ import annotations

import io
import sys
import trace
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOTS = [
    ROOT / 'scope_content',
    ROOT / 'common',
    ROOT / 'spots',
    ROOT / 'trips',
    ROOT / 'photos',
    ROOT / 'reviews',
    ROOT / 'feed',
]
EXCLUDED_PARTS = {'tests', 'migrations', '__pycache__'}
EXCLUDED_FILES = {'test_settings.py'}


def source_files() -> list[Path]:
    files: list[Path] = []
    for source_root in SOURCE_ROOTS:
        for path in source_root.rglob('*.py'):
            if any(part in EXCLUDED_PARTS for part in path.parts):
                continue
            if path.name in EXCLUDED_FILES:
                continue
            files.append(path.resolve())
    return sorted(set(files))


def executable_lines(path: Path) -> set[int]:
    return set(trace._find_executable_linenos(str(path)))


def measure() -> tuple[int, int, float, list[tuple[str, int, int, float]]]:
    tracer = trace.Trace(count=1, trace=0)
    stdout_buffer = io.StringIO()
    stderr_buffer = io.StringIO()

    with redirect_stdout(stdout_buffer), redirect_stderr(stderr_buffer):
        exit_code = tracer.runfunc(pytest.main, ['.'])

    output = stdout_buffer.getvalue()
    errors = stderr_buffer.getvalue()
    if output:
        print(output, end='')
    if errors:
        print(errors, end='', file=sys.stderr)
    if exit_code != 0:
        raise SystemExit(exit_code)

    counts = tracer.results().counts
    total_executable = 0
    total_covered = 0
    per_file: list[tuple[str, int, int, float]] = []

    for path in source_files():
        executable = executable_lines(path)
        covered = {line for line in executable if counts.get((str(path), line), 0) > 0}
        total_executable += len(executable)
        total_covered += len(covered)
        coverage_pct = (len(covered) / len(executable) * 100) if executable else 100.0
        per_file.append((str(path.relative_to(ROOT)), len(covered), len(executable), coverage_pct))

    per_file.sort(key=lambda item: (item[3], item[0]))
    total_pct = (total_covered / total_executable * 100) if total_executable else 100.0
    return total_covered, total_executable, total_pct, per_file


if __name__ == '__main__':
    covered, executable, total_pct, per_file = measure()
    print('\nApp coverage summary (trace-based)')
    print('================================')
    for relative_path, covered_lines, executable_lines_count, coverage_pct in per_file:
        print(f'{coverage_pct:6.2f}%  {covered_lines:4d}/{executable_lines_count:<4d}  {relative_path}')
    print('--------------------------------')
    print(f'TOTAL {total_pct:.2f}% ({covered}/{executable} lines)')
