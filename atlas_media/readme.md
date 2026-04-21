# atlas_media

Pure C image-processing library for the Atlas Content upload pipeline.

## Initial scaffold

This milestone establishes the native-media workspace so later tasks can add format detection, EXIF stripping, thumbnail generation, blurhash encoding, and Python `ctypes` integration without changing the project shape.

Included now:

- Compiler-aware `Makefile` with `cl.exe` or `gcc` support
- Public header at `include/atlas_media.h`
- Shared-library core implementation in `src/core.c`
- Native smoke test in `tests/native_smoke.c`
- Python smoke tests in `tests/test_scaffold.py`

## Commands

```bash
make compiler-check
make
make test
python -m pytest atlas_media/tests/
```

## Directory layout

```text
atlas_media/
├── Makefile
├── README.md
├── include/
│   └── atlas_media.h
├── src/
│   └── core.c
└── tests/
    ├── native_smoke.c
    └── test_scaffold.py
```
