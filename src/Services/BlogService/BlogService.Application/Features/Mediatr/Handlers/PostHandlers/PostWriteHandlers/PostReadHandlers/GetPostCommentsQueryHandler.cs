using BlogService.Application.Common.ReadModels;
using BlogService.Application.DTOs.PostCommentDtos;
using BlogService.Application.Features.Mediatr.Queries.PostQueries;
using MediatR;
using MongoDB.Driver;

namespace BlogService.Application.Features.Mediatr.Handlers.PostHandlers.PostWriteHandlers.PostReadHandlers;

/// <summary>
/// Reads comments straight from the post read model (never from the shared post cache), so a new comment
/// shows as soon as the projection has it, and per-viewer flags (IsMine/CanDelete) never leak via cache.
/// </summary>
public class GetPostCommentsQueryHandler : IRequestHandler<GetPostCommentsQuery, PostCommentThreadPageDto?>
{
    public const string AnonymousAuthorLabel = "Paylaşan";
    private readonly IMongoCollection<PostDocument> _postsCollection;

    public GetPostCommentsQueryHandler(IMongoDatabase database)
    {
        _postsCollection = database.GetCollection<PostDocument>("posts");
    }

    public async Task<PostCommentThreadPageDto?> Handle(GetPostCommentsQuery request, CancellationToken ct)
    {
        var post = await (await _postsCollection.FindAsync(p => p.Id == request.PostId, cancellationToken: ct)).FirstOrDefaultAsync(ct);
        if (post is null) return null;
        if (!string.IsNullOrWhiteSpace(post.AudienceType) && post.AudienceType != "Public") return null;

        return BuildPage(post, request.RequestingUserId, request.Page, request.PageSize, request.Sort);
    }

    public static PostCommentThreadPageDto BuildPage(PostDocument post, Guid? viewerId, int page, int pageSize, string? sort)
    {
        var anonymousPost = post.IdentityDisclosure == "AnonymousMap";
        var all = post.Comments ?? new List<PostCommentReadModel>();
        var ids = all.Select(c => c.Id).ToHashSet();

        PostCommentViewDto View(PostCommentReadModel c)
        {
            var isPostAuthor = c.AuthorId == post.AuthorId;
            var hideIdentity = anonymousPost && isPostAuthor;
            var isMine = viewerId.HasValue && c.AuthorId == viewerId.Value;
            return new PostCommentViewDto
            {
                CommentId = c.Id,
                AuthorId = hideIdentity ? null : c.AuthorId,
                AuthorName = hideIdentity ? AnonymousAuthorLabel : (string.IsNullOrWhiteSpace(c.AuthorName) ? "Blinkr kullanıcısı" : c.AuthorName!),
                IsPostAuthor = isPostAuthor,
                IsMine = isMine,
                CanDelete = isMine || (viewerId.HasValue && viewerId.Value == post.AuthorId),
                ParentCommentId = c.ParentCommentId,
                Text = c.Text,
                CreatedAtUtc = c.CreatedAtUtc,
                LikeCount = c.LikedBy?.Count ?? 0,
                LikedByMe = viewerId.HasValue && (c.LikedBy?.Contains(viewerId.Value) ?? false),
                Mentions = BlogService.Application.Services.PostEngagement.Mentions(c.Mentions),
            };
        }

        // A reply whose parent is gone (should not happen - removal takes replies with it) is shown top-level.
        var topLevel = all.Where(c => c.ParentCommentId is null || !ids.Contains(c.ParentCommentId.Value));
        topLevel = string.Equals(sort, "oldest", StringComparison.OrdinalIgnoreCase)
            ? topLevel.OrderBy(c => c.CreatedAtUtc)
            : topLevel.OrderByDescending(c => c.CreatedAtUtc);
        var topList = topLevel.ToList();

        var items = topList
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => View(c) with
            {
                Replies = all.Where(r => r.ParentCommentId == c.Id).OrderBy(r => r.CreatedAtUtc).Select(View).ToList()
            })
            .ToList();

        return new PostCommentThreadPageDto
        {
            PostId = post.Id,
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = topList.Count,
            CommentCount = all.Count,
            HasMore = page * pageSize < topList.Count,
        };
    }
}
