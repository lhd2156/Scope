# atlas_geo

Native geospatial engine scaffold for Atlas Intel, now with haversine distance utilities, a packed R-tree spatial index for nearest-neighbor lookups, native Dijkstra/A* pathfinding, and GoogleTest coverage.

## Layout
- `CMakeLists.txt` configures the C++20 library target, fetches `pybind11` with `FetchContent`, and wires the `python/` and `tests/` subdirectories.
- `include/atlas_geo/` holds public headers, including `haversine.hpp`, `rtree.hpp`, and `pathfinding.hpp`.
- `src/` holds the native implementation, now covering `core.cpp`, `haversine.cpp`, `rtree.cpp`, and `pathfinding.cpp`.
- `tests/` fetches GoogleTest and builds unit coverage for haversine math, R-tree nearest-neighbor queries, and exact shortest-path routing.
- `python/` is reserved for upcoming pybind11 bindings and currently exposes a placeholder interface target that links `pybind11::headers`.

Phase 21.1 created the build skeleton. Phase 21.2 adds haversine math plus GoogleTest coverage. Phase 21.3 adds a packed in-memory R-tree for nearest-neighbor spot queries. Phase 21.4 adds reusable Dijkstra and A* pathfinding over a weighted graph of geospatial nodes. Later Phase 21 tasks will add hull/clustering and concrete Python bindings.
