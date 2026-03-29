from __future__ import annotations

from dataclasses import dataclass

import jwt
from django.conf import settings


@dataclass(slots=True)
class TokenUser:
    id: str
    email: str | None = None
    name: str | None = None
    roles: list[str] | None = None
    is_authenticated: bool = True

    @property
    def is_admin(self) -> bool:
        return 'admin' in (self.roles or [])

    @property
    def is_anonymous(self) -> bool:
        return False


def extract_bearer_token(header_value: str | None) -> str | None:
    if not header_value:
        return None
    scheme, _, credentials = header_value.partition(' ')
    if scheme.lower() != 'bearer' or not credentials:
        return None
    return credentials.strip() or None


def decode_token(token: str) -> TokenUser:
    payload = jwt.decode(
        token,
        settings.JWT_SECRET,
        algorithms=['HS256'],
        issuer=settings.JWT_ISSUER,
        audience=settings.JWT_AUDIENCE,
    )
    return TokenUser(
        id=payload['sub'],
        email=payload.get('email'),
        name=payload.get('name'),
        roles=payload.get('roles', []),
    )


def authenticate_authorization_header(header_value: str | None) -> TokenUser | None:
    token = extract_bearer_token(header_value)
    if token is None:
        return None
    return decode_token(token)
