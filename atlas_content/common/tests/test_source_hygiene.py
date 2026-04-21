from __future__ import annotations

import ast
import re
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SERVICE_ROOTS = [
    PROJECT_ROOT / 'atlas_content',
    PROJECT_ROOT / 'common',
    PROJECT_ROOT / 'spots',
    PROJECT_ROOT / 'trips',
    PROJECT_ROOT / 'photos',
    PROJECT_ROOT / 'reviews',
    PROJECT_ROOT / 'feed',
]
COMMENT_MARKERS = (re.compile(r'\bTODO\b'), re.compile(r'\bFIXME\b'), re.compile(r'\bXXX\b'))
SECRET_LITERALS = (
    re.compile(r'django-insecure', re.IGNORECASE),
    re.compile(r'change-me-in-prod', re.IGNORECASE),
    re.compile(r'super-secret', re.IGNORECASE),
    re.compile(r'flask-insecure', re.IGNORECASE),
)

pytestmark = pytest.mark.django_db


class NameLoadCollector(ast.NodeVisitor):
    def __init__(self):
        self.loaded_names: set[str] = set()

    def visit_Name(self, node: ast.Name):
        if isinstance(node.ctx, ast.Load):
            self.loaded_names.add(node.id)
        self.generic_visit(node)


def _iter_service_files(*, include_tests: bool) -> list[Path]:
    paths: list[Path] = []
    for root in SERVICE_ROOTS:
        for path in root.rglob('*.py'):
            if 'migrations' in path.parts:
                continue
            if path.name in {'test_settings.py', 'test_source_hygiene.py'}:
                continue
            if not include_tests and 'tests' in path.parts:
                continue
            paths.append(path)
    return sorted(paths)


def _relative(path: Path) -> str:
    return path.relative_to(PROJECT_ROOT).as_posix()


def test_service_source_contains_no_todo_markers_or_debug_calls():
    issues: list[str] = []

    for path in _iter_service_files(include_tests=True):
        text = path.read_text(encoding='utf-8')
        for line_number, line in enumerate(text.splitlines(), start=1):
            if any(pattern.search(line) for pattern in COMMENT_MARKERS):
                issues.append(f'{_relative(path)}:{line_number} contains TODO/FIXME/XXX marker')
        tree = ast.parse(text, filename=str(path))
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            if isinstance(node.func, ast.Name) and node.func.id in {'print', 'breakpoint'}:
                issues.append(f'{_relative(path)}:{node.lineno} contains debug call {node.func.id}(...)')
            if (
                isinstance(node.func, ast.Attribute)
                and isinstance(node.func.value, ast.Name)
                and node.func.value.id == 'pdb'
                and node.func.attr == 'set_trace'
            ):
                issues.append(f'{_relative(path)}:{node.lineno} contains debug call pdb.set_trace(...)')

    assert issues == []


def test_service_source_contains_no_obvious_production_secret_literals():
    issues: list[str] = []

    for path in _iter_service_files(include_tests=False):
        text = path.read_text(encoding='utf-8')
        for line_number, line in enumerate(text.splitlines(), start=1):
            if any(pattern.search(line) for pattern in SECRET_LITERALS):
                issues.append(f'{_relative(path)}:{line_number} contains production secret placeholder literal')

    assert issues == []


def test_live_service_modules_do_not_keep_unused_imports():
    issues: list[str] = []

    for path in _iter_service_files(include_tests=False):
        text = path.read_text(encoding='utf-8')
        tree = ast.parse(text, filename=str(path))
        usage_collector = NameLoadCollector()
        usage_collector.visit(tree)

        imported_names: list[tuple[str, int, str]] = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    local_name = alias.asname or alias.name.split('.')[0]
                    if local_name != '*':
                        imported_names.append((local_name, node.lineno, alias.name))
            elif isinstance(node, ast.ImportFrom):
                if node.module == '__future__':
                    continue
                for alias in node.names:
                    local_name = alias.asname or alias.name
                    if local_name != '*':
                        imported_names.append((local_name, node.lineno, f'{node.module}.{alias.name}' if node.module else alias.name))

        for local_name, line_number, original_name in imported_names:
            if local_name.startswith('_'):
                continue
            if local_name not in usage_collector.loaded_names:
                issues.append(
                    f'{_relative(path)}:{line_number} imports {original_name} as {local_name} but never uses it'
                )

    assert issues == []


def test_orphan_bootstrap_append_scripts_are_removed():
    leftover_scripts = sorted(path.name for path in PROJECT_ROOT.glob('bootstrap_content_append*.py'))

    assert leftover_scripts == []
