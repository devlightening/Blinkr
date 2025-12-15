using Microsoft.Extensions.Configuration;
using MongoDB.Driver;
using Npgsql;
using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;

class Program
{
    static async Task Main(string[] args)
    {
        Console.WriteLine("🚀 Blinkr AuthorName Migration Tool");
        Console.WriteLine("====================================\n");

        // Load configuration
        var config = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
            .Build();

        var mongoConnStr = config["Mongo:ConnectionString"];
        var mongoDb = config["Mongo:Database"];
        var mongoCollection = config["Mongo:PostsCollection"];
        var pgConnStr = config["Postgres:ConnectionString"];

        Console.WriteLine($"📍 MongoDB: {mongoConnStr}/{mongoDb}/{mongoCollection}");
        Console.WriteLine($"📍 PostgreSQL: {pgConnStr.Split(';')[0]}...\n");

        try
        {
            // Connect to MongoDB
            var mongoClient = new MongoClient(mongoConnStr);
            var db = mongoClient.GetDatabase(mongoDb);
            var postsCollection = db.GetCollection<PostDocument>(mongoCollection);

            // Connect to PostgreSQL
            await using var pgConnection = new NpgsqlConnection(pgConnStr);
            await pgConnection.OpenAsync();
            Console.WriteLine("✅ Connected to PostgreSQL\n");

            // Find posts with AuthorName = "Blinkr User"
            var filter = Builders<PostDocument>.Filter.Eq(p => p.AuthorName, "Blinkr User");
            var postsToFix = await postsCollection.Find(filter).ToListAsync();

            Console.WriteLine($"📊 Found {postsToFix.Count} posts with AuthorName = 'Blinkr User'\n");

            if (postsToFix.Count == 0)
            {
                Console.WriteLine("✅ No posts to migrate!");
                return;
            }

            int successCount = 0;
            int failureCount = 0;

            foreach (var post in postsToFix)
            {
                try
                {
                    // Query PostgreSQL for UserName and Gender
                    using var cmd = new NpgsqlCommand(
                        "SELECT \"UserName\", \"Gender\" FROM public.\"Users\" WHERE \"Id\" = @id",
                        pgConnection);
                    cmd.Parameters.AddWithValue("@id", post.AuthorId);

                    using var reader = await cmd.ExecuteReaderAsync();
                    string? userName = null;
                    string? gender = null;

                    if (await reader.ReadAsync())
                    {
                        userName = reader.IsDBNull(0) ? null : reader.GetString(0);
                        gender = reader.IsDBNull(1) ? null : reader.GetString(1);
                    }

                    if (!string.IsNullOrWhiteSpace(userName))
                    {
                        // Update MongoDB post with real UserName and Gender
                        var update = Builders<PostDocument>.Update
                            .Set(p => p.AuthorName, userName)
                            .Set(p => p.AuthorGender, gender);
                        
                        var result = await postsCollection.UpdateOneAsync(
                            Builders<PostDocument>.Filter.Eq(p => p.Id, post.Id),
                            update);

                        if (result.ModifiedCount > 0)
                        {
                            Console.WriteLine($"✅ PostId={post.Id:N} | AuthorId={post.AuthorId:N} | AuthorName={userName} | Gender={gender ?? "N/A"}");
                            successCount++;
                        }
                    }
                    else
                    {
                        Console.WriteLine($"⚠️  PostId={post.Id:N} | AuthorId={post.AuthorId:N} | User not found in PostgreSQL");
                        failureCount++;
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"❌ PostId={post.Id:N} | Error: {ex.Message}");
                    failureCount++;
                }
            }

            Console.WriteLine($"\n📊 Migration Summary:");
            Console.WriteLine($"  ✅ Success: {successCount}");
            Console.WriteLine($"  ❌ Failed: {failureCount}");
            Console.WriteLine($"  📈 Total: {successCount + failureCount}");

            pgConnection.Close();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Error: {ex.Message}");
            Environment.Exit(1);
        }
    }
}

// MongoDB PostDocument model
public class PostDocument
{
    public Guid Id { get; set; }
    public Guid AuthorId { get; set; }
    public string? AuthorName { get; set; }
    public string? AuthorGender { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
    public int LikeCount { get; set; }
}
