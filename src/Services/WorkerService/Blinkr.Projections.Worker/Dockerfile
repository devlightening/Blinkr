FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy solution and project files
COPY ["src/Services/WorkerService/Blinkr.Projections.Worker/Blinkr.Projections.Worker.csproj", "src/Services/WorkerService/Blinkr.Projections.Worker/"]
COPY ["src/BuildingBlocks/Shared.Events/Shared.Events.csproj", "src/BuildingBlocks/Shared.Events/"]
COPY ["src/BuildingBlocks/Shared/Shared.csproj", "src/BuildingBlocks/Shared/"]

# Restore dependencies
RUN dotnet restore "src/Services/WorkerService/Blinkr.Projections.Worker/Blinkr.Projections.Worker.csproj"

# Copy everything else
COPY . .

# Build
WORKDIR "/src/src/Services/WorkerService/Blinkr.Projections.Worker"
RUN dotnet build "Blinkr.Projections.Worker.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "Blinkr.Projections.Worker.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "Blinkr.Projections.Worker.dll"]
