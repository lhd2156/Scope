from __future__ import annotations

import jwt
from rest_framework import exceptions
from rest_framework.authentication import BaseAuthentication

from common.auth import authenticate_authorization_header


class JWTAuthentication(BaseAuthentication):
    def authenticate(self, request):
        header_value = request.headers.get('Authorization', '')
        if not header_value:
            return None

        try:
            user = authenticate_authorization_header(header_value)
        except jwt.PyJWTError as exc:
            raise exceptions.AuthenticationFailed('Invalid token') from exc

        if user is None:
            return None

        return user, None
