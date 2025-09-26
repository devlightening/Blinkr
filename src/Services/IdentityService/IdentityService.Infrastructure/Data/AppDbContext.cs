using IdentityService.Domain.Entities;

using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;

namespace IdentityService.Infrastructure.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
}
