from pathlib import Path
from PIL import Image
def generate_thumbnail(source_path: Path, dest_path: Path, size=(512, 512)) -> None:
    with Image.open(source_path) as image:
        image.thumbnail(size)
        image.save(dest_path)
