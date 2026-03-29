from __future__ import annotations

from rest_framework import serializers


class AliasFieldsMixin:
    input_aliases: dict[str, str] = {}

    def to_internal_value(self, data):
        if not hasattr(data, 'copy') or not self.input_aliases:
            return super().to_internal_value(data)

        normalized = data.copy()
        for alias, field_name in self.input_aliases.items():
            if alias in normalized and field_name not in normalized:
                normalized[field_name] = normalized[alias]

        return super().to_internal_value(normalized)


class AliasModelSerializer(AliasFieldsMixin, serializers.ModelSerializer):
    pass


class AliasSerializer(AliasFieldsMixin, serializers.Serializer):
    pass
