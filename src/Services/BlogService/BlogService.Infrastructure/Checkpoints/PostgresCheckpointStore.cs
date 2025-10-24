using EventStore.Client;
using Npgsql;

namespace BlogService.Infrastructure;

public class PostgresCheckpointStore : ICheckpointStore
{
    private readonly string _connectionString;

    public PostgresCheckpointStore(string connectionString)
    {
        _connectionString = connectionString;
    }

    public async Task<Position?> GetAsync(string key, CancellationToken ct = default)
    {
        await using var conn = new NpgsqlConnection(_connectionString);
        await conn.OpenAsync(ct);

        await using var cmd = new NpgsqlCommand(
            "SELECT commit, prepare FROM checkpoints WHERE key = @key",
            conn);
        cmd.Parameters.AddWithValue("@key", key);

        await using var reader = await cmd.ExecuteReaderAsync(ct);

        if (await reader.ReadAsync(ct))
        {
            var commit = (ulong)(long)reader["commit"];
            var prepare = (ulong)(long)reader["prepare"];
            return new Position(commit, prepare);
        }

        return null;
    }

    public async Task StoreAsync(string key, Position position, CancellationToken ct = default)
    {
        await using var conn = new NpgsqlConnection(_connectionString);
        await conn.OpenAsync(ct);

        await using var cmd = new NpgsqlCommand(
            """
            INSERT INTO checkpoints (key, commit, prepare)
            VALUES (@key, @commit, @prepare)
            ON CONFLICT (key) DO UPDATE
            SET commit = @commit, prepare = @prepare;
            """,
            conn);

        cmd.Parameters.AddWithValue("@key", key);
        cmd.Parameters.AddWithValue("@commit", (long)position.CommitPosition);
        cmd.Parameters.AddWithValue("@prepare", (long)position.PreparePosition);

        await cmd.ExecuteNonQueryAsync(ct);
    }
}
