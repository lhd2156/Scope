# atlas_geo

Native geospatial engine scaffold for Atlas Intel, now with the first haversine distance primitive and GoogleTest coverage.

## Layout
- `CMakeLists.txt` configures the C++20 library target, fetches `pybind11` with `FetchContent`, and wires the `python/` and `tests/` subdirectories.
- `include/atlas_geo/` holds public headers, including `haversine.hpp`.
- `src/` holds the native implementation, starting with `core.cpp` and `haversine.cpp`.
- `tests/` now fetches GoogleTest and builds the first haversine unit suite.
- `python/` is reserved for upcoming pybind11 bindings and currently exposes a placeholder interface target that links `pybind11::headers`.

Phase 21.1 created the build skeleton. Phase 21.2 adds haversine math plus GoogleTest coverage. Later Phase 21 tasks will add spatial indexing, pathfinding, hull/clustering, and concrete Python bindings.
