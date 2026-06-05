from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def test_intel_generated_protos_import_with_dependencies_loaded() -> None:
    proto_dir = Path(__file__).resolve().parents[1] / "app" / "proto"
    script = (
        "import sys; "
        f"sys.path.insert(0, {str(proto_dir)!r}); "
        "from scope.v1 import common_pb2, spot_pb2, user_pb2; "
        "print(common_pb2.DESCRIPTOR.name, spot_pb2.DESCRIPTOR.name, user_pb2.DESCRIPTOR.name)"
    )

    result = subprocess.run(
        [sys.executable, "-c", script],
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stderr
    assert "scope/v1/common.proto scope/v1/spot.proto scope/v1/user.proto" in result.stdout
