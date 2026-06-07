from __future__ import annotations

from django.conf import settings
from rest_framework import serializers

from photos.delivery import photo_delivery_url
from photos.models import Photo
from spots.models import Spot


# Magic-byte signatures we accept. The client-declared ``content_type`` header
# is not trusted — a malicious upload can claim ``image/png`` while shipping an
# HTML or SVG payload that triggers XSS when served back from S3. We read the
# first bytes of the file and verify they match one of the real formats we
# want to support, then put the sniffed type back on the file so downstream
# handlers (thumbnailing, S3 metadata) use the authoritative value.
_MAGIC_SIGNATURES: tuple[tuple[bytes, str], ...] = (
    (b'\x89PNG\r\n\x1a\n', 'image/png'),
    (b'\xff\xd8\xff', 'image/jpeg'),
    (b'GIF87a', 'image/gif'),
    (b'GIF89a', 'image/gif'),
)


def _sniff_image_mime(file_obj) -> str | None:
    """Return the canonical MIME type for the upload, or None if unknown."""
    if not hasattr(file_obj, 'read') or not hasattr(file_obj, 'seek'):
        return None
    try:
        file_obj.seek(0)
        header = file_obj.read(16) or b''
    finally:
        try:
            file_obj.seek(0)
        except Exception:  # pragma: no cover - stream not seekable
            return None
    for signature, mime in _MAGIC_SIGNATURES:
        if header.startswith(signature):
            return mime
    # WEBP has a variable-offset marker: ``RIFF....WEBP``.
    if len(header) >= 12 and header[0:4] == b'RIFF' and header[8:12] == b'WEBP':
        return 'image/webp'
    return None


class PhotoUploadSerializer(serializers.Serializer):
    spot_id = serializers.UUIDField()
    file = serializers.ImageField()
    caption = serializers.CharField(required=False, allow_blank=True, max_length=500)
    sort_order = serializers.IntegerField(required=False, default=0, min_value=0)

    def validate_file(self, value):
        if value.size > settings.MAX_UPLOAD_BYTES:
            raise serializers.ValidationError('File too large')
        sniffed = _sniff_image_mime(value)
        if sniffed is None or sniffed not in settings.ALLOWED_IMAGE_TYPES:
            raise serializers.ValidationError('Unsupported file type')
        # Overwrite the client-provided content type so downstream code never
        # sees an attacker-controlled value.
        try:
            value.content_type = sniffed
        except Exception:  # pragma: no cover - some storage backends are read-only
            pass
        return value

    def validate_spot_id(self, value):
        if not Spot.objects.filter(id=value).exists():
            raise serializers.ValidationError('Spot does not exist')
        return value

    def validate_caption(self, value: str) -> str:
        return value.strip()


class PhotoSerializer(serializers.ModelSerializer):
    caption = serializers.CharField(required=False, allow_blank=True, max_length=500)
    sort_order = serializers.IntegerField(required=False, min_value=0)
    storage_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = Photo
        fields = ['id', 'spot', 'user_id', 'storage_key', 'storage_url', 'thumbnail_url', 'caption', 'sort_order', 'created_at']
        read_only_fields = ['id', 'user_id', 'storage_key', 'storage_url', 'thumbnail_url', 'created_at']

    def validate_caption(self, value: str) -> str:
        return value.strip()

    def get_storage_url(self, obj: Photo) -> str:
        return photo_delivery_url(
            photo_id=obj.id,
            source_url=obj.storage_url,
            is_public=obj.spot.is_public,
            request=self.context.get('request'),
        ) or ''

    def get_thumbnail_url(self, obj: Photo) -> str:
        return photo_delivery_url(
            photo_id=obj.id,
            source_url=obj.thumbnail_url,
            is_public=obj.spot.is_public,
            request=self.context.get('request'),
            variant='thumbnail',
        ) or ''
