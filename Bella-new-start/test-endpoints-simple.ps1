# Test all backend endpoints
$baseUrl = "http://51.20.160.210"

Write-Host "`n=== Testing Backend Services ===`n" -ForegroundColor Cyan

# Test GraphQL Gateway (4000)
Write-Host "1. GraphQL Gateway (4000):" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "${baseUrl}:4000/health" -Method GET
    Write-Host "   OK - Health check" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 3
} catch {
    Write-Host "   FAILED - $($_.Exception.Message)" -ForegroundColor Red
}

# Test User Service (3001)
Write-Host "`n2. User Service (3001):" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "${baseUrl}:3001/health" -Method GET
    Write-Host "   OK - Health check" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 3
} catch {
    Write-Host "   FAILED - $($_.Exception.Message)" -ForegroundColor Red
}

# Test Communication Service (3005)
Write-Host "`n3. Communication Service (3005):" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "${baseUrl}:3005/health" -Method GET
    Write-Host "   OK - Health check" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 3
} catch {
    Write-Host "   FAILED - $($_.Exception.Message)" -ForegroundColor Red
}

# Test Interaction Service (3003)
Write-Host "`n4. Interaction Service (3003):" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "${baseUrl}:3003/health" -Method GET
    Write-Host "   OK - Health check" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 3
} catch {
    Write-Host "   FAILED - $($_.Exception.Message)" -ForegroundColor Red
}

# Test Subscription Service (3010)
Write-Host "`n5. Subscription Service (3010):" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "${baseUrl}:3010/health" -Method GET
    Write-Host "   OK - Health check" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 3
} catch {
    Write-Host "   FAILED - $($_.Exception.Message)" -ForegroundColor Red
}

# Test Notification Service (3006)
Write-Host "`n6. Notification Service (3006):" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "${baseUrl}:3006/health" -Method GET
    Write-Host "   OK - Health check" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 3
} catch {
    Write-Host "   FAILED - $($_.Exception.Message)" -ForegroundColor Red
}

# Test GraphQL endpoint
Write-Host "`n7. GraphQL Endpoint:" -ForegroundColor Yellow
try {
    $body = @{
        query = "{ __typename }"
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "${baseUrl}:4000/graphql" -Method POST -Body $body -ContentType "application/json"
    Write-Host "   OK - GraphQL query" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 3
} catch {
    Write-Host "   FAILED - $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "   Status Code: $statusCode" -ForegroundColor Yellow
    }
}

# Test User Service auth endpoint
Write-Host "`n8. User Service Auth Endpoint:" -ForegroundColor Yellow
try {
    $body = @{
        email = "test@test.com"
        password = "test123"
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "${baseUrl}:3001/auth/login" -Method POST -Body $body -ContentType "application/json"
    Write-Host "   OK - Login endpoint exists" -ForegroundColor Green
} catch {
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq 404) {
            Write-Host "   FAILED - Route not found (404)" -ForegroundColor Red
        } else {
            Write-Host "   OK - Endpoint exists (returned $statusCode)" -ForegroundColor Green
        }
    } else {
        Write-Host "   FAILED - $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n=== Testing Complete ===`n" -ForegroundColor Cyan

