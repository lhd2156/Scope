# scope_geo

Native geospatial engine scaffold for Scope Intel, now with haversine distance utilities, a packed R-tree spatial index for nearest-neighbor lookups, native Dijkstra/A* pathfinding, convex hull construction, viewport-aware clustering, a pybind11 Python module, and mixed GoogleTest plus pytest coverage.

## Layout
- `CMakeLists.txt` configures the C++20 library target, fetches `pybind11` with `FetchContent`, and wires the `python/` and `tests/` subdirectories.
- `__init__.py` exposes the built `_scope_geo` native extension as an importable Python package from the repo root.
- `include/scope_geo/` holds public headers, including `haversine.hpp`, `rtree.hpp`, `pathfinding.hpp`, `hull.hpp`, and `cluster.hpp`.
- `src/` holds the native implementation, now covering `core.cpp`, `haversine.cpp`, `rtree.cpp`, `pathfinding.cpp`, `hull.cpp`, and `cluster.cpp`.
- `tests/` now mixes GoogleTest C++ coverage with pytest integration tests that exercise the pybind11 module from Python.
- `python/` builds the `_scope_geo` pybind11 extension into `build/python/` for in-repo Python imports.

Phase 21.1 created the build skeleton. Phase 21.2 adds haversine math plus GoogleTest coverage. Phase 21.3 adds a packed in-memory R-tree for nearest-neighbor spot queries. Phase 21.4 adds reusable Dijkstra and A* pathfinding over a weighted graph of geospatial nodes. Phase 21.5 adds monotonic-chain convex hull generation plus deterministic viewport-grid clustering for map-ready aggregation. Phase 21.6 adds the `_scope_geo` pybind11 module plus pytest integration tests. Later Phase 21 tasks will wire the native functions into Intel service code.
