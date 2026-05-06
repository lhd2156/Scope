import ast
from pathlib import Path

APP_DIR = Path(__file__).resolve().parents[1] / "app"
FORBIDDEN_CALL_NAMES = {"execute", "from_statement", "raw_connection", "cursor"}
FORBIDDEN_FUNCTION_NAMES = {"text"}
FORBIDDEN_SQL_PREFIXES = ("SELECT ", "INSERT ", "UPDATE ", "DELETE ", "ALTER ", "DROP ")


def _full_name(node: ast.AST) -> str:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        parent = _full_name(node.value)
        return f"{parent}.{node.attr}" if parent else node.attr
    return ""


class UnsafeSqlVisitor(ast.NodeVisitor):
    def __init__(self) -> None:
        self.violations: list[str] = []

    def visit_Call(self, node: ast.Call) -> None:
        full_name = _full_name(node.func)
        call_name = full_name.rsplit(".", 1)[-1]

        if call_name in FORBIDDEN_CALL_NAMES:
            self.violations.append(f"forbidden SQL call '{full_name}'")
        if full_name in FORBIDDEN_FUNCTION_NAMES:
            self.violations.append(f"forbidden SQL helper '{full_name}'")

        self.generic_visit(node)

    def visit_Constant(self, node: ast.Constant) -> None:
        if isinstance(node.value, str):
            normalized = " ".join(node.value.strip().upper().split())
            if normalized.startswith(FORBIDDEN_SQL_PREFIXES):
                self.violations.append(f"raw SQL literal '{normalized[:40]}'")
        self.generic_visit(node)


def test_intel_app_uses_sqlalchemy_orm_only_for_database_access():
    violations: list[str] = []

    for path in APP_DIR.rglob("*.py"):
        visitor = UnsafeSqlVisitor()
        visitor.visit(ast.parse(path.read_text(encoding="utf-8"), filename=str(path)))
        violations.extend(f"{path.relative_to(APP_DIR.parent)}: {violation}" for violation in visitor.violations)

    assert not violations, "\n".join(violations)


def test_repository_module_uses_model_query_apis_for_persistence():
    repository_path = APP_DIR / "repositories.py"
    source = repository_path.read_text(encoding="utf-8")

    assert "ItineraryCache.query.filter_by" in source
    assert "UserPreference.query.filter_by" in source
    assert "SpotFeature.query.filter_by" in source
    assert "db.session.add" in source
    assert "db.session.commit" in source
