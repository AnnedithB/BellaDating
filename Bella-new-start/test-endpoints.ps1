# Test all backend endpoints
$baseUrl = "http://51.20.160.210"

Write-Host "`n=== Testing Backend Services ===`n" -ForegroundColor Cyan

# Test GraphQL Gateway (4000)
Write-Host "1. GraphQL Gateway (4000):" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl:4000/health" -Method GET
    Write-Host "   ✓ Health check: OK" -ForegroundColor Green
    $response | ConvertTo-Json
} catch {
    Write-Host "   ✗ Health check failed: $($_.Exception.Message)" -ForegroundColor Red
}

try {
    $response = Invoke-RestMethod -Uri "$baseUrl:4000/.well-known/apollo/server-health" -Method GET
    Write-Host "   ✓ Apollo health: OK" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Apollo health failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test User Service (3001)
Write-Host "`n2. User Service (3001):" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl:3001/health" -Method GET
    Write-Host "   ✓ Health check: OK" -ForegroundColor Green
    $response | ConvertTo-Json
} catch {
    Write-Host "   ✗ Health check failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test Communication Service (3005)
Write-Host "`n3. Communication Service (3005):" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl:3005/health" -Method GET
    Write-Host "   ✓ Health check: OK" -ForegroundColor Green
    $response | ConvertTo-Json
} catch {
    Write-Host "   ✗ Health check failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test Interaction Service (3003)
Write-Host "`n4. Interaction Service (3003):" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl:3003/health" -Method GET
    Write-Host "   ✓ Health check: OK" -ForegroundColor Green
    $response | ConvertTo-Json
} catch {
    Write-Host "   ✗ Health check failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test Subscription Service (3010)
Write-Host "`n5. Subscription Service (3010):" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl:3010/health" -Method GET
    Write-Host "   ✓ Health check: OK" -ForegroundColor Green
    $response | ConvertTo-Json
} catch {
    Write-Host "   ✗ Health check failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test Notification Service (3006)
Write-Host "`n6. Notification Service (3006):" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl:3006/health" -Method GET
    Write-Host "   ✓ Health check: OK" -ForegroundColor Green
    $response | ConvertTo-Json
} catch {
    Write-Host "   ✗ Health check failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test GraphQL endpoint
Write-Host "`n7. GraphQL Endpoint (4000`/graphql):" -ForegroundColor Yellow
try {
    $body = @{
        query = "{ __typename }"
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$baseUrl:4000/graphql" -Method POST -Body $body -ContentType "application/json"
    Write-Host "   ✓ GraphQL query: OK" -ForegroundColor Green
    $response | ConvertTo-Json
} catch {
    Write-Host "   ✗ GraphQL query failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "   Response: $responseBody" -ForegroundColor Red
    }
}

# Test User Service auth endpoint (should return 400/401, not 404)
Write-Host "`n8. User Service Auth Endpoint (3001`/auth`/login):" -ForegroundColor Yellow
try {
    $body = @{
        email = "test@test.com"
        password = "test123"
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$baseUrl:3001/auth/login" -Method POST -Body $body -ContentType "application/json"
    Write-Host "   ✓ Login endpoint exists (unexpected success)" -ForegroundColor Yellow
    $response | ConvertTo-Json
} catch {
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq 401 -or $statusCode -eq 400) {
            Write-Host "   ✓ Login endpoint exists (returned $statusCode as expected)" -ForegroundColor Green
        } elseif ($statusCode -eq 404) {
            Write-Host "   ✗ Route not found (404)" -ForegroundColor Red
        } else {
            Write-Host "   ✗ Error: $statusCode - $($_.Exception.Message)" -ForegroundColor Red
        }
    } else {
        Write-Host "   ✗ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n=== Testing Complete ===`n" -ForegroundColor Cyan

