# atlas_geo

Native geospatial engine scaffold for Atlas Intel, now with haversine distance utilities, a packed R-tree spatial index for nearest-neighbor lookups, and GoogleTest coverage.

## Layout
- `CMakeLists.txt` configures the C++20 library target, fetches `pybind11` with `FetchContent`, and wires the `python/` and `tests/` subdirectories.
- `include/atlas_geo/` holds public headers, including `haversine.hpp` and `rtree.hpp`.
- `src/` holds the native implementation, now covering `core.cpp`, `haversine.cpp`, and `rtree.cpp`.
- `tests/` fetches GoogleTest and builds unit coverage for haversine math plus R-tree nearest-neighbor queries.
- `python/` is reserved for upcoming pybind11 bindings and currently exposes a placeholder interface target that links `pybind11::headers`.

Phase 21.1 created the build skeleton. Phase 21.2 adds haversine math plus GoogleTest coverage. Phase 21.3 adds a packed in-memory R-tree for nearest-neighbor spot queries. Later Phase 21 tasks will add pathfinding, hull/clustering, and concrete Python bindings.
