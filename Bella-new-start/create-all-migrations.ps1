# Create Prisma Migrations for All Services
# Run this script to generate migration files for all microservices

Write-Host "`n╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Creating Prisma Migrations for All Services          ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

$services = @(
    "queuing-service",
    "interaction-service",
    "history-service",
    "communication-service",
    "notification-service",
    "moderation-service",
    "analytics-service",
    "subscription-service"
)

$successCount = 0
$failCount = 0
$results = @()

foreach ($service in $services) {
    Write-Host "[$($services.IndexOf($service) + 1)/$($services.Count)] Processing $service..." -ForegroundColor Yellow
    
    try {
        # Check if service is running
        $isRunning = docker compose ps $service --format json | ConvertFrom-Json
        
        if (-not $isRunning -or $isRunning.State -ne "running") {
            Write-Host "  ⚠ Service not running. Starting $service..." -ForegroundColor Yellow
            docker compose up -d $service | Out-Null
            Start-Sleep -Seconds 5
        }
        
        # Create migration
        $output = docker compose exec $service sh -c "cd /app/services/$service && npx prisma migrate dev --name init" 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ Migrations created successfully" -ForegroundColor Green
            $successCount++
            $results += [PSCustomObject]@{
                Service = $service
                Status = "✓ Success"
                Color = "Green"
            }
        } else {
            Write-Host "  ✗ Migration failed" -ForegroundColor Red
            Write-Host "  Error: $output" -ForegroundColor Red
            $failCount++
            $results += [PSCustomObject]@{
                Service = $service
                Status = "✗ Failed"
                Color = "Red"
            }
        }
    } catch {
        Write-Host "  ✗ Error: $_" -ForegroundColor Red
        $failCount++
        $results += [PSCustomObject]@{
            Service = $service
            Status = "✗ Error"
            Color = "Red"
        }
    }
    
    Write-Host ""
}

# Summary
Write-Host "`n╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Migration Creation Summary                            ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

foreach ($result in $results) {
    $status = $result.Status.PadRight(15)
    Write-Host "  $status $($result.Service)" -ForegroundColor $result.Color
}

Write-Host "`n  Total: $($services.Count) services" -ForegroundColor White
Write-Host "  Success: $successCount" -ForegroundColor Green
Write-Host "  Failed: $failCount" -ForegroundColor $(if ($failCount -gt 0) { "Red" } else { "Green" })

if ($successCount -eq $services.Count) {
    Write-Host "`n  🎉 All migrations created successfully!" -ForegroundColor Green
} elseif ($successCount -gt 0) {
    Write-Host "`n  ⚠ Some migrations failed. Check errors above." -ForegroundColor Yellow
} else {
    Write-Host "`n  ✗ All migrations failed. Check your setup." -ForegroundColor Red
}

Write-Host "`n  Next steps:" -ForegroundColor Cyan
Write-Host "  1. Verify migrations: ls services/*/prisma/migrations/" -ForegroundColor White
Write-Host "  2. Restart services: docker compose restart" -ForegroundColor White
Write-Host "  3. Test endpoints for each service" -ForegroundColor White
Write-Host ""
