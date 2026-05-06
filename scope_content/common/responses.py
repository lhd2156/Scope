from rest_framework.response import Response


def data_response(data, status_code=200, meta=None):
    payload = {'data': data}
    if meta is not None:
        payload['meta'] = meta
    return Response(payload, status=status_code)
