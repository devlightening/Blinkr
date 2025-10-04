using AutoMapper;
using AutoMapper.QueryableExtensions;
using BlogService.Application.Common.Interfaces;
using BlogService.Application.Common.Models;
using BlogService.Application.DTOs.PostDtos;
using BlogService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BlogService.Infrastructure.Repositories
{
    public class PostReadRepository : IPostReadRepository
    {
        private readonly BlogDbContext _db;
        private readonly IConfigurationProvider _mapperCfg;

        public PostReadRepository(BlogDbContext db, IMapper mapper)
        {
            _db = db;
            _mapperCfg = mapper.ConfigurationProvider;
        }

        public async Task<PagedResult<PostListItemDto>> GetPagedAsync(
            int page, int pageSize,
            string? search,
            string? orderBy,
            string? sort,
            CancellationToken ct = default)
        {
            var query = _db.Posts.AsNoTracking();

            // Filtre
            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim().ToLower();
                query = query.Where(p =>
                    p.Title.ToLower().Contains(term) ||
                    (p.Content != null && p.Content.ToLower().Contains(term)));
            }

            // Güvenli sıralama (whitelist)
            var ob = (orderBy ?? "CreatedAt").ToLower();
            var so = (sort ?? "desc").ToLower();

            query = (ob, so) switch
            {
                ("title", "asc") => query.OrderBy(p => p.Title),
                ("title", _) => query.OrderByDescending(p => p.Title),
                ("createdat", "asc") => query.OrderBy(p => p.CreatedAt),
                _ => query.OrderByDescending(p => p.CreatedAt),
            };

            var total = await query.LongCountAsync(ct);

            var items = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ProjectTo<PostListItemDto>(_mapperCfg)
                .ToListAsync(ct);

            return new PagedResult<PostListItemDto>
            {
                Items = items,
                Page = page,
                PageSize = pageSize,
                TotalCount = total
            };
        }
    }
}
