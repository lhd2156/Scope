from pathlib import Path


ATLAS_MEDIA_ROOT = Path(__file__).resolve().parents[1]


def test_expected_scaffold_files_exist() -> None:
    expected = [
        ATLAS_MEDIA_ROOT / 'Makefile',
        ATLAS_MEDIA_ROOT / 'build.py',
        ATLAS_MEDIA_ROOT / 'include' / 'atlas_media.h',
        ATLAS_MEDIA_ROOT / 'src' / 'atlas_media.c',
        ATLAS_MEDIA_ROOT / 'src' / 'detect.c',
        ATLAS_MEDIA_ROOT / 'src' / 'exif.c',
        ATLAS_MEDIA_ROOT / 'src' / 'thumbnail.c',
        ATLAS_MEDIA_ROOT / 'src' / 'blurhash.c',
        ATLAS_MEDIA_ROOT / 'tests' / 'test_scaffold.py',
        ATLAS_MEDIA_ROOT / 'tests' / 'test_detect.py',
        ATLAS_MEDIA_ROOT / 'tests' / 'test_exif.py',
        ATLAS_MEDIA_ROOT / 'tests' / 'test_thumbnail.py',
        ATLAS_MEDIA_ROOT / 'tests' / 'test_blurhash.py',
    ]
    for path in expected:
        assert path.exists(), f'Missing scaffold file: {path}'


def test_makefile_exposes_scaffold_targets() -> None:
    makefile = (ATLAS_MEDIA_ROOT / 'Makefile').read_text(encoding='utf-8')
    for target in ('compiler-check:', 'build:', 'test:', 'clean:'):
        assert target in makefile


def test_header_declares_phase_22_api_surface() -> None:
    header = (ATLAS_MEDIA_ROOT / 'include' / 'atlas_media.h').read_text(encoding='utf-8')
    for token in (
        'ATLAS_MEDIA_API',
        'ATLAS_MEDIA_FORMAT_JPEG',
        'atlas_media_detect_format',
        'atlas_media_strip_exif',
        'atlas_media_generate_thumbnail',
        'atlas_media_encode_blurhash',
        'atlas_media_free_buffer',
        'atlas_media_free_image',
    ):
        assert token in header
