from rest_framework.permissions import BasePermission
class IsAuthenticatedJWT(BasePermission):
    def has_permission(self, request, view):
        return bool(getattr(request, 'user', None) and request.user.is_authenticated)
