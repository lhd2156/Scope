from __future__ import annotations

import jwt
from django.contrib.auth.models import AnonymousUser

from common.auth import authenticate_authorization_header


class JWTAuthenticationMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.user = AnonymousUser()
        request.jwt_invalid = False
        request.user_id = None

        try:
            user = authenticate_authorization_header(request.headers.get('Authorization', ''))
            if user is not None:
                request.user = user
                request.user_id = user.id
        except jwt.PyJWTError:
            request.jwt_invalid = True

        return self.get_response(request)
