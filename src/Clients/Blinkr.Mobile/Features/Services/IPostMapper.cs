using Blinkr.Mobile.Core.Api;

namespace Blinkr.Mobile.Features.Services;

public interface IPostMapper
{
    PostItem MapToPostItem(PostListDto dto);
}
