$file = "Bella-new-start/docs/BUILD_ONE_BY_ONE.md"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace 'AKIAU4WMPN6WGQUM7QUW', 'your_aws_access_key_id'
    $content = $content -replace '3rP\+bmUwBVXnuJvr5uKgfIZs6w6Ju0NAIlAvGRbZ', 'your_aws_secret_access_key'
    Set-Content $file -Value $content -NoNewline
}
