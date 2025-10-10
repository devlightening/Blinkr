using BlogService.Application.DTOs.PostDtos;
using BlogService.Application.Features.Mediatr.Queries.PostQueries;
using MediatR;
using MongoDB.Driver;
using Blinkr.Projections.Worker.Documents;
using AutoMapper;

namespace BlogService.Application.Features.Mediatr.Handlers.PostHandlers.PostWriteHandlers.PostReadHandlers;

public class GetAllPostsHandler : IRequestHandler<GetAllPostsQuery, IEnumerable<PostResponseDto>>
{
    private readonly IMongoCollection<PostDocument> _postsCollection;
    private readonly IMapper _mapper;

    public GetAllPostsHandler(IMongoDatabase database, IMapper mapper)
    {
        _postsCollection = database.GetCollection<PostDocument>("posts");
        _mapper = mapper;
    }

    public async Task<IEnumerable<PostResponseDto>> Handle(GetAllPostsQuery request, CancellationToken ct)
    {
        var posts = await _postsCollection.Find(_ => true).ToListAsync(ct);

        return _mapper.Map<IEnumerable<PostResponseDto>>(posts);
    }
}