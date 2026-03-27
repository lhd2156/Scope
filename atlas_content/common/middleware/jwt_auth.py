import jwt
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from common.auth import TokenUser
class JWTAuthenticationMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
    def __call__(self, request):
        request.user = AnonymousUser()
        header = request.headers.get('Authorization', '')
        if header.startswith('Bearer '):
            token = header.removeprefix('Bearer ').strip()
            try:
                payload = jwt.decode(token, settings.JWT_SECRET, algorithms=['HS256'], issuer=settings.JWT_ISSUER, audience=settings.JWT_AUDIENCE)
                request.user = TokenUser(id=payload['sub'], email=payload.get('email'), name=payload.get('name'), roles=payload.get('roles', []))
            except jwt.PyJWTError:
                request.jwt_invalid = True
        return self.get_response(request)
