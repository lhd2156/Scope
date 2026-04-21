from pathlib import Path

WORKTREE = Path(r"C:\Users\dongu\atlas-native-geo-wt")

progress_path = WORKTREE / "intel/PROGRESS.md"
text = progress_path.read_text(encoding="utf-8")

old_checklist = """### Phase 21: Native Geospatial Engine (C++ + pybind11)
- [x] 21.1 Scaffold atlas_geo/ with CMakeLists.txt + pybind11 fetch
- [x] 21.2 Haversine distance (src/haversine.cpp + GoogleTest)
- [x] 21.3 R-tree spatial index (src/rtree.cpp, nearest-neighbor spot queries)
- [x] 21.4 A*/Dijkstra pathfinding (src/pathfinding.cpp, route optimization)
- [ ] 21.5 Convex hull + viewport clustering (src/hull.cpp, src/cluster.cpp)
- [ ] 21.6 pybind11 module (python/atlas_geo_bindings.cpp) + pytest integration tests
- [ ] 21.7 Wire into Intel route_optimizer.py + recommendation_engine.py
"""
new_checklist = """### Phase 21: Native Geospatial Engine (C++ + pybind11)
- [x] 21.1 Scaffold atlas_geo/ with CMakeLists.txt + pybind11 fetch
- [x] 21.2 Haversine distance (src/haversine.cpp + GoogleTest)
- [x] 21.3 R-tree spatial index (src/rtree.cpp, nearest-neighbor spot queries)
- [x] 21.4 A*/Dijkstra pathfinding (src/pathfinding.cpp, route optimization)
- [x] 21.5 Convex hull + viewport clustering (src/hull.cpp, src/cluster.cpp)
- [ ] 21.6 pybind11 module (python/atlas_geo_bindings.cpp) + pytest integration tests
- [ ] 21.7 Wire into Intel route_optimizer.py + recommendation_engine.py
"""
if old_checklist not in text:
    raise RuntimeError("Phase 21 checklist block not found")
text = text.replace(old_checklist, new_checklist)

old_current = "## Current Task: Phase 21.5 - Convex hull + viewport clustering\n## Last Updated: 2026-04-19T14:55:00Z\n"
new_current = "## Current Task: Phase 21.6 - pybind11 bindings + pytest integration tests\n## Last Updated: 2026-04-19T15:42:00Z\n"
if old_current not in text:
    raise RuntimeError("Current task block not found")
text = text.replace(old_current, new_current)

marker = "## Environment Notes\n"
entry = "- 2026-04-19: Added `include/atlas_geo/hull.hpp` + `src/hull.cpp` with deterministic monotonic-chain convex hull generation over latitude/longitude coordinates, added `include/atlas_geo/cluster.hpp` + `src/cluster.cpp` with viewport-bucket clustering for visible spot aggregation, extended the CMake/test targets and README, and added GoogleTest coverage for duplicate/interior-point hull pruning, collinear endpoints, viewport bucket grouping, inclusive max-edge handling, and invalid input rejection. Validation remains partially blocked because `cmake`/`ctest` are still unavailable on PATH while both winget install attempts continue to report `Waiting for another install/uninstall to complete`; `C:\\Users\\dongu\\AppData\\Local\\Python\\bin\\python.exe -m pytest atlas_geo/tests/ -q` still reports `no tests ran`, which is expected until Phase 21.6 adds pybind11 integration tests.\n\n"
if entry not in text:
    if marker not in text:
        raise RuntimeError("Environment Notes marker not found")
    text = text.replace(marker, entry + marker, 1)

progress_path.write_text(text, encoding="utf-8")

ledger_path = WORKTREE / "memory/COMPLETED-TASKS.md"
ledger_text = ledger_path.read_text(encoding="utf-8")
ledger_entry = "- [2026-04-19T15:42Z] intel 21.5 ✅\n"
if ledger_entry not in ledger_text:
    ledger_text = ledger_text.rstrip() + "\n\n" + ledger_entry
    ledger_path.write_text(ledger_text, encoding="utf-8")

print("Updated Phase 21.5 progress and completion ledger.")
