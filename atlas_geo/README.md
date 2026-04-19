# atlas_geo

Native geospatial engine scaffold for Atlas Intel, now with haversine distance utilities, a packed R-tree spatial index for nearest-neighbor lookups, native Dijkstra/A* pathfinding, convex hull construction, viewport-aware clustering, and GoogleTest coverage.

## Layout
- `CMakeLists.txt` configures the C++20 library target, fetches `pybind11` with `FetchContent`, and wires the `python/` and `tests/` subdirectories.
- `include/atlas_geo/` holds public headers, including `haversine.hpp`, `rtree.hpp`, `pathfinding.hpp`, `hull.hpp`, and `cluster.hpp`.
- `src/` holds the native implementation, now covering `core.cpp`, `haversine.cpp`, `rtree.cpp`, `pathfinding.cpp`, `hull.cpp`, and `cluster.cpp`.
- `tests/` fetches GoogleTest and builds unit coverage for haversine math, R-tree nearest-neighbor queries, shortest-path routing, convex hull generation, and viewport clustering behavior.
- `python/` is reserved for upcoming pybind11 bindings and currently exposes a placeholder interface target that links `pybind11::headers`.

Phase 21.1 created the build skeleton. Phase 21.2 adds haversine math plus GoogleTest coverage. Phase 21.3 adds a packed in-memory R-tree for nearest-neighbor spot queries. Phase 21.4 adds reusable Dijkstra and A* pathfinding over a weighted graph of geospatial nodes. Phase 21.5 adds monotonic-chain convex hull generation plus deterministic viewport-grid clustering for map-ready aggregation. Later Phase 21 tasks will add concrete Python bindings and Intel service integration.
