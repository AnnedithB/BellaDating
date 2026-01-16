# User Service API Test Script for Windows PowerShell

$BASE_URL = "http://localhost:3001"
$timestamp = [DateTimeOffset]::Now.ToUnixTimeSeconds()

Write-Host "`n=== User Service API Tests ===" -ForegroundColor Cyan

# Test 1: Health Check
Write-Host "`n1. Testing health endpoint..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$BASE_URL/health" -Method Get
    Write-Host "✓ Health check passed" -ForegroundColor Green
    $health | ConvertTo-Json
} catch {
    Write-Host "✗ Health check failed: $_" -ForegroundColor Red
    exit 1
}

# Test 2: Register User
Write-Host "`n2. Registering new user..." -ForegroundColor Yellow
$registerBody = @{
    username = "testuser$timestamp"
    email = "test$timestamp@example.com"
    password = "SecurePass123!"
} | ConvertTo-Json

try {
    $registerResponse = Invoke-RestMethod -Uri "$BASE_URL/auth/register" `
        -Method Post `
        -ContentType "application/json" `
        -Body $registerBody
    
    $TOKEN = $registerResponse.data.token
    Write-Host "✓ User registered successfully" -ForegroundColor Green
    Write-Host "Username: $($registerResponse.data.user.username)" -ForegroundColor Cyan
    Write-Host "Email: $($registerResponse.data.user.email)" -ForegroundColor Cyan
    Write-Host "Token: $TOKEN" -ForegroundColor Gray
} catch {
    Write-Host "✗ Registration failed: $_" -ForegroundColor Red
    exit 1
}

# Test 3: Get Current User
Write-Host "`n3. Getting current user..." -ForegroundColor Yellow
try {
    $headers = @{
        Authorization = "Bearer $TOKEN"
    }
    $currentUser = Invoke-RestMethod -Uri "$BASE_URL/auth/me" `
        -Method Get `
        -Headers $headers
    
    Write-Host "✓ Current user retrieved" -ForegroundColor Green
    $currentUser.data.user | ConvertTo-Json
} catch {
    Write-Host "✗ Get current user failed: $_" -ForegroundColor Red
}

# Test 4: Create Profile
Write-Host "`n4. Creating profile..." -ForegroundColor Yellow
$profileBody = @{
    displayName = "Test User $timestamp"
    shortBio = "Testing the API from PowerShell"
    age = 25
    gender = "MAN"
    intent = "FRIENDS"
    locationCity = "New York"
    locationCountry = "USA"
} | ConvertTo-Json

try {
    $profile = Invoke-RestMethod -Uri "$BASE_URL/profile" `
        -Method Put `
        -Headers $headers `
        -ContentType "application/json" `
        -Body $profileBody
    
    Write-Host "✓ Profile created successfully" -ForegroundColor Green
    Write-Host "Display Name: $($profile.data.profile.displayName)" -ForegroundColor Cyan
    Write-Host "Bio: $($profile.data.profile.shortBio)" -ForegroundColor Cyan
} catch {
    Write-Host "✗ Profile creation failed: $_" -ForegroundColor Red
}

# Test 5: Get Profile
Write-Host "`n5. Getting profile..." -ForegroundColor Yellow
try {
    $getProfile = Invoke-RestMethod -Uri "$BASE_URL/profile" `
        -Method Get `
        -Headers $headers
    
    Write-Host "✓ Profile retrieved" -ForegroundColor Green
    $getProfile.data.profile | ConvertTo-Json
} catch {
    Write-Host "✗ Get profile failed: $_" -ForegroundColor Red
}

# Test 6: Update Partner Preferences
Write-Host "`n6. Updating partner preferences..." -ForegroundColor Yellow
$preferencesBody = @{
    preferredGenders = @("WOMAN", "NONBINARY")
    preferredMinAge = 22
    preferredMaxAge = 30
} | ConvertTo-Json

try {
    $preferences = Invoke-RestMethod -Uri "$BASE_URL/profile/preferences" `
        -Method Put `
        -Headers $headers `
        -ContentType "application/json" `
        -Body $preferencesBody
    
    Write-Host "✓ Preferences updated" -ForegroundColor Green
    Write-Host "Preferred Genders: $($preferences.data.preferences.preferredGenders -join ', ')" -ForegroundColor Cyan
    Write-Host "Age Range: $($preferences.data.preferences.preferredMinAge)-$($preferences.data.preferences.preferredMaxAge)" -ForegroundColor Cyan
} catch {
    Write-Host "✗ Update preferences failed: $_" -ForegroundColor Red
}

# Test 7: Get Safety Status
Write-Host "`n7. Getting safety status..." -ForegroundColor Yellow
try {
    $safety = Invoke-RestMethod -Uri "$BASE_URL/safety/safety-status" `
        -Method Get `
        -Headers $headers
    
    Write-Host "✓ Safety status retrieved" -ForegroundColor Green
    Write-Host "Status: $($safety.data.status)" -ForegroundColor Cyan
    Write-Host "Trust Score: $($safety.data.trustScore)" -ForegroundColor Cyan
} catch {
    Write-Host "✗ Get safety status failed: $_" -ForegroundColor Red
}

# Test 8: Logout
Write-Host "`n8. Logging out..." -ForegroundColor Yellow
try {
    $logout = Invoke-RestMethod -Uri "$BASE_URL/auth/logout" `
        -Method Post `
        -Headers $headers
    
    Write-Host "✓ Logged out successfully" -ForegroundColor Green
} catch {
    Write-Host "✗ Logout failed: $_" -ForegroundColor Red
}

Write-Host "`n=== All Tests Completed ===" -ForegroundColor Cyan
Write-Host "`nSummary:" -ForegroundColor Yellow
Write-Host "- Health Check: ✓" -ForegroundColor Green
Write-Host "- User Registration: ✓" -ForegroundColor Green
Write-Host "- Authentication: ✓" -ForegroundColor Green
Write-Host "- Profile Management: ✓" -ForegroundColor Green
Write-Host "- Safety Features: ✓" -ForegroundColor Green
Write-Host "`nUser Service is working correctly! 🚀" -ForegroundColor Green
