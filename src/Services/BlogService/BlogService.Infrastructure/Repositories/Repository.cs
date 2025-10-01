using BlogService.Application.Common.Interfaces;
using BlogService.Application.DTOs.PostDtos;
using BlogService.Domain.Entities;
using BlogService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace BlogService.Infrastructure.Services;

public class Repository<T> : IRepository<T> where T : class
{
    private readonly BlogDbContext _db;
    private readonly DbSet<T> _set;

    public Repository(BlogDbContext db, DbSet<T> set)
    {
        _db = db;
        _set = set;
    }

    public async Task<T?> GetByIdAsync(Guid id) => await _set.FindAsync(id);
    public async Task<IEnumerable<T>> GetAllAsync() => await _set.ToListAsync();
    public async Task AddAsync(T entity) => await _set.AddAsync(entity);
    public void Update(T entity) => _set.Update(entity);
    public void Remove(T entity) => _set.Remove(entity);
    public async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        => await _db.SaveChangesAsync(cancellationToken);
}