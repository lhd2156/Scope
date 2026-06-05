from django.http import JsonResponse


class ApiNotFoundJsonMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        if (
            response.status_code == 404
            and request.path.startswith('/api/')
            and not response.headers.get('Content-Type', '').lower().startswith('application/json')
        ):
            return JsonResponse(
                {
                    'error': {
                        'code': 'NOT_FOUND',
                        'message': 'API route does not exist',
                    },
                },
                status=404,
            )

        return response
