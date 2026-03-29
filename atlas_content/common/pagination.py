import base64
from urllib.parse import parse_qs, urlencode, urlsplit, urlunsplit

from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class StandardPageNumberPagination(PageNumberPagination):
    page_size_query_param = 'pageSize'
    max_page_size = 100

    def get_paginated_response(self, data):
        return Response(
            {
                'data': data,
                'meta': {
                    'page': self.page.number,
                    'pageSize': self.get_page_size(self.request),
                    'total': self.page.paginator.count,
                    'totalPages': self.page.paginator.num_pages,
                },
            }
        )


class FeedCursorPagination:
    page_size = 20
    cursor_query_param = 'cursor'

    def paginate_queryset(self, items, request, view=None):
        self.request = request
        self.items = list(items)
        self.offset = self._decode_cursor(request.query_params.get(self.cursor_query_param))
        self.page = self.items[self.offset : self.offset + self.page_size]
        next_offset = self.offset + self.page_size
        self.next_offset = next_offset if next_offset < len(self.items) else None
        self.previous_offset = max(self.offset - self.page_size, 0) if self.offset > 0 else None
        return self.page

    def get_paginated_response(self, data):
        return Response(
            {
                'data': data,
                'meta': {
                    'nextCursor': self.get_next_link(),
                    'previousCursor': self.get_previous_link(),
                },
            }
        )

    def get_next_link(self):
        return self._build_link(self.next_offset)

    def get_previous_link(self):
        return self._build_link(self.previous_offset)

    def _build_link(self, offset):
        if offset is None:
            return None

        url = self.request.build_absolute_uri()
        parsed = urlsplit(url)
        query = parse_qs(parsed.query, keep_blank_values=True)
        query[self.cursor_query_param] = [self._encode_cursor(offset)]
        return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, urlencode(query, doseq=True), parsed.fragment))

    def _decode_cursor(self, cursor):
        if not cursor:
            return 0
        try:
            decoded = base64.urlsafe_b64decode(cursor.encode('utf-8')).decode('utf-8')
            return max(int(decoded), 0)
        except (ValueError, TypeError):
            return 0

    def _encode_cursor(self, offset):
        return base64.urlsafe_b64encode(str(offset).encode('utf-8')).decode('utf-8')
