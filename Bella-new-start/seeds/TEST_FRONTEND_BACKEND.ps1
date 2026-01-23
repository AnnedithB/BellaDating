# Frontend-Backend Connection Test Script
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "KINDRED ADMIN FRONTEND-BACKEND TEST" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Backend Services Health
Write-Host "1. Testing Backend Services..." -ForegroundColor Yellow
Write-Host ""

$services = @(
    @{ Name = "Admin Service"; Port = 3009 },
    @{ Name = "Moderation Service"; Port = 3007 },
    @{ Name = "Analytics Service"; Port = 3008 }
)

foreach ($service in $services) {
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:$($service.Port)/health" -TimeoutSec 5
        Write-Host "  OK $($service.Name) (Port $($service.Port)): HEALTHY" -ForegroundColor Green
    }
    catch {
        Write-Host "  FAIL $($service.Name) (Port $($service.Port)): NOT RESPONDING" -ForegroundColor Red
    }
}

Write-Host ""

# Test 2: Login Endpoint
Write-Host "2. Testing Login Endpoint..." -ForegroundColor Yellow
Write-Host ""

try {
    $loginBody = @{
        email = "ogollachucho@gmail.com"
        password = "123456789"
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Method POST -Uri "http://localhost:3009/api/auth/login" -ContentType "application/json" -Body $loginBody
    
    Write-Host "  OK Login Successful" -ForegroundColor Green
    Write-Host "    Admin: $($loginResponse.admin.firstName) $($loginResponse.admin.lastName)" -ForegroundColor Gray
    Write-Host "    Role: $($loginResponse.admin.role)" -ForegroundColor Gray
    
    $token = $loginResponse.token
    $headers = @{ Authorization = "Bearer $token" }
}
catch {
    Write-Host "  FAIL Login Failed" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 3: Dashboard Analytics
Write-Host "3. Testing Dashboard Analytics..." -ForegroundColor Yellow
Write-Host ""

try {
    $dashboardData = Invoke-RestMethod -Uri "http://localhost:3009/api/analytics/dashboard" -Headers $headers
    Write-Host "  OK Dashboard Data Retrieved" -ForegroundColor Green
    Write-Host "    Total Users: $($dashboardData.users.total)" -ForegroundColor Gray
}
catch {
    Write-Host "  FAIL Dashboard Failed" -ForegroundColor Red
}

Write-Host ""

# Test 4: KPI Overview
Write-Host "4. Testing KPI Overview..." -ForegroundColor Yellow
Write-Host ""

try {
    $kpiData = Invoke-RestMethod -Uri "http://localhost:3008/kpis/kpis/overview" -Headers $headers
    Write-Host "  OK KPI Data Retrieved" -ForegroundColor Green
    Write-Host "    Daily Active Users: $($kpiData.currentMetrics.dailyActiveUsers)" -ForegroundColor Gray
}
catch {
    Write-Host "  FAIL KPI Failed" -ForegroundColor Red
}

Write-Host ""

# Test 5: Support Tickets
Write-Host "5. Testing Support Tickets..." -ForegroundColor Yellow
Write-Host ""

try {
    $ticketsData = Invoke-RestMethod -Uri "http://localhost:3009/api/support-tickets" -Headers $headers
    Write-Host "  OK Support Tickets Retrieved" -ForegroundColor Green
    Write-Host "    Total Tickets: $($ticketsData.data.Count)" -ForegroundColor Gray
}
catch {
    Write-Host "  FAIL Support Tickets Failed" -ForegroundColor Red
}

Write-Host ""

# Test 6: Frontend Availability
Write-Host "6. Testing Frontend..." -ForegroundColor Yellow
Write-Host ""

try {
    $frontendResponse = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 5 -UseBasicParsing
    Write-Host "  OK Frontend is Running" -ForegroundColor Green
    Write-Host "    URL: http://localhost:3000" -ForegroundColor Gray
}
catch {
    Write-Host "  FAIL Frontend Not Responding" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "NEXT STEPS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Open browser: http://localhost:3000" -ForegroundColor White
Write-Host "2. Login with:" -ForegroundColor White
Write-Host "   Email: ogollachucho@gmail.com" -ForegroundColor Gray
Write-Host "   Password: 123456789" -ForegroundColor Gray
Write-Host "3. Explore the admin dashboard" -ForegroundColor White
Write-Host ""
