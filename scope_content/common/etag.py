from __future__ import annotations

from hashlib import sha256

from django.http import HttpResponseNotModified
from django.utils.cache import patch_cache_control, patch_vary_headers
from django.utils.http import parse_etags, quote_etag
from rest_framework.renderers import JSONRenderer

_ETAG_SAFE_METHODS = {'GET', 'HEAD'}


def _normalize_etag_value(value: str) -> str:
    return value.removeprefix('W/')



def _etag_matches(request, current_etag: str) -> bool:
    header_value = request.META.get('HTTP_IF_NONE_MATCH', '')
    if not header_value:
        return False
    parsed_etags = {_normalize_etag_value(value) for value in parse_etags(header_value)}
    return '*' in parsed_etags or _normalize_etag_value(current_etag) in parsed_etags



def build_response_etag(payload) -> str:
    rendered_payload = JSONRenderer().render(payload)
    return quote_etag(sha256(rendered_payload).hexdigest())



def apply_conditional_etag(request, response):
    if request.method not in _ETAG_SAFE_METHODS or response.status_code != 200 or not hasattr(response, 'data'):
        return response

    current_etag = build_response_etag(response.data)

    if _etag_matches(request, current_etag):
        not_modified_response = HttpResponseNotModified()
        not_modified_response['ETag'] = current_etag
        patch_cache_control(not_modified_response, private=True, no_cache=True)
        patch_vary_headers(not_modified_response, ['Authorization'])
        return not_modified_response

    response['ETag'] = current_etag
    patch_cache_control(response, private=True, no_cache=True)
    patch_vary_headers(response, ['Authorization'])
    return response
