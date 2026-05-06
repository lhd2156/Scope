from pathlib import Path


SCOPE_MEDIA_ROOT = Path(__file__).resolve().parents[1]


def test_expected_scaffold_files_exist() -> None:
    expected = [
        SCOPE_MEDIA_ROOT / 'Makefile',
        SCOPE_MEDIA_ROOT / 'build.py',
        SCOPE_MEDIA_ROOT / 'include' / 'scope_media.h',
        SCOPE_MEDIA_ROOT / 'src' / 'scope_media.c',
        SCOPE_MEDIA_ROOT / 'src' / 'detect.c',
        SCOPE_MEDIA_ROOT / 'src' / 'exif.c',
        SCOPE_MEDIA_ROOT / 'src' / 'thumbnail.c',
        SCOPE_MEDIA_ROOT / 'src' / 'blurhash.c',
        SCOPE_MEDIA_ROOT / 'tests' / 'test_scaffold.py',
        SCOPE_MEDIA_ROOT / 'tests' / 'test_detect.py',
        SCOPE_MEDIA_ROOT / 'tests' / 'test_exif.py',
        SCOPE_MEDIA_ROOT / 'tests' / 'test_thumbnail.py',
        SCOPE_MEDIA_ROOT / 'tests' / 'test_blurhash.py',
    ]
    for path in expected:
        assert path.exists(), f'Missing scaffold file: {path}'


def test_makefile_exposes_scaffold_targets() -> None:
    makefile = (SCOPE_MEDIA_ROOT / 'Makefile').read_text(encoding='utf-8')
    for target in ('compiler-check:', 'build:', 'test:', 'clean:'):
        assert target in makefile


def test_header_declares_phase_22_api_surface() -> None:
    header = (SCOPE_MEDIA_ROOT / 'include' / 'scope_media.h').read_text(encoding='utf-8')
    for token in (
        'SCOPE_MEDIA_API',
        'SCOPE_MEDIA_FORMAT_JPEG',
        'scope_media_detect_format',
        'scope_media_strip_exif',
        'scope_media_generate_thumbnail',
        'scope_media_encode_blurhash',
        'scope_media_free_buffer',
        'scope_media_free_image',
    ):
        assert token in header
