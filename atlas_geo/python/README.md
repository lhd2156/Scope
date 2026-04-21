# atlas_geo python bindings

`atlas_geo_bindings.cpp` builds the `_atlas_geo` pybind11 extension into `build/python/`.
Import the repo-root `atlas_geo` package to load that native module during Python integration tests and later Intel service wiring.
