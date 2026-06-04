namespace Scope.Core.API.Infrastructure;

internal readonly record struct PageRequest(int Page, int PageSize)
{
    public int Offset => (Page - 1) * PageSize;

    public object ToMetadata(int total) => new
    {
        page = Page,
        pageSize = PageSize,
        total,
        totalPages = (int)Math.Ceiling(total / (double)PageSize),
    };
}

internal static class Pagination
{
    public static PageRequest Normalize(int page, int pageSize, int defaultPageSize, int maxPageSize)
    {
        if (page < 1)
        {
            page = 1;
        }

        if (pageSize < 1)
        {
            pageSize = defaultPageSize;
        }

        if (pageSize > maxPageSize)
        {
            pageSize = maxPageSize;
        }

        return new PageRequest(page, pageSize);
    }
}
