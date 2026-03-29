from dataclasses import dataclass

from django.contrib.auth.models import AnonymousUser
from rest_framework import exceptions
from rest_framework.authentication import BaseAuthentication


@dataclass
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


class RequestUserAuthentication(BaseAuthentication):
    def authenticate(self, request):
        if getattr(request._request, 'jwt_invalid', False):
            raise exceptions.AuthenticationFailed('Invalid authentication token.')

        user = getattr(request._request, 'user', None)
        if user is None or isinstance(user, AnonymousUser) or not getattr(user, 'is_authenticated', False):
            return None

        return (user, None)
