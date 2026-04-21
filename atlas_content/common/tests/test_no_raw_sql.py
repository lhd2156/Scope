from __future__ import annotations

import re
from pathlib import Path

SOURCE_ROOT = Path(__file__).resolve().parents[2]
RAW_SQL_PATTERNS = {
    r'\.raw\(': 'QuerySet.raw()',
    r'\.cursor\(': 'database cursor usage',
    r'\.execute\(': 'direct execute() usage',
    r'\.executemany\(': 'direct executemany() usage',
    r'\bRawSQL\(': 'RawSQL expression',
}
EXCLUDED_PARTS = {'tests', 'migrations', '__pycache__'}


def _source_files() -> list[Path]:
    return sorted(
        path
        for path in SOURCE_ROOT.rglob('*.py')
        if not any(part in EXCLUDED_PARTS for part in path.parts)
    )


def test_source_code_avoids_raw_sql_primitives():
    violations: list[str] = []

    for path in _source_files():
        text = path.read_text(encoding='utf-8')
        relative_path = path.relative_to(SOURCE_ROOT)
        for pattern, label in RAW_SQL_PATTERNS.items():
            if re.search(pattern, text):
                violations.append(f'{relative_path}: {label}')

    assert not violations, 'Found raw SQL primitives in atlas_content source:\n' + '\n'.join(violations)
