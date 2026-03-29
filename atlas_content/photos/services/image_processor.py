from pathlib import Path
import shutil

try:
    from PIL import Image
except ModuleNotFoundError:  # pragma: no cover - environment-dependent fallback
    Image = None


def generate_thumbnail(source_path: Path, dest_path: Path, size=(512, 512)) -> None:
    if Image is None:
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source_path, dest_path)
        return

    with Image.open(source_path) as image:
        image.thumbnail(size)
        image.save(dest_path)
