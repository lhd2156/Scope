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


_DOTNET_ROLE_CLAIM = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'


def _collect_roles(payload: dict) -> list[str]:
    collected: list[str] = []
    for key in ('roles', 'role', _DOTNET_ROLE_CLAIM):
        value = payload.get(key)
        if value is None:
            continue
        if isinstance(value, str):
            collected.append(value)
        elif isinstance(value, (list, tuple, set)):
            collected.extend(str(item) for item in value)
    return list(dict.fromkeys(role.lower() for role in collected if role))


def decode_token(token: str) -> TokenUser:
    payload = jwt.decode(
        token,
        settings.JWT_SECRET,
        algorithms=['HS256'],
        issuer=settings.JWT_ISSUER,
        audience=settings.JWT_AUDIENCE,
        options={'require': ['exp', 'iss', 'aud', 'sub']},
    )
    return TokenUser(
        id=payload['sub'],
        email=payload.get('email'),
        name=payload.get('name'),
        roles=_collect_roles(payload),
    )


def authenticate_authorization_header(header_value: str | None) -> TokenUser | None:
    token = extract_bearer_token(header_value)
    if token is None:
        return None
    return decode_token(token)
