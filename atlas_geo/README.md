# atlas_geo

Native geospatial engine scaffold for Atlas Intel.

## Layout
- `CMakeLists.txt` configures the C++20 library target and fetches `pybind11` with `FetchContent`.
- `include/atlas_geo/` holds public headers.
- `src/` holds the native implementation.
- `tests/` is reserved for upcoming GoogleTest coverage.
- `python/` is reserved for upcoming pybind11 bindings.

Phase 21.1 creates the build skeleton only. Later Phase 21 tasks will add haversine math, spatial indexing, pathfinding, hull/clustering, and Python bindings.
