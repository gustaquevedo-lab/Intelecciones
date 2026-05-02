$line = Get-Content 'C:\Users\Gustavo\.gemini\antigravity\brain\2d35e716-576c-42bd-9e21-76e088e2a189\.system_generated\logs\overview.txt' | Select-Object -Index 30
$json = $line | ConvertFrom-Json
$content = $json.tool_calls[0].args.CodeContent
[System.IO.File]::WriteAllText('C:\Users\Gustavo\OneDrive\Dev\Intelecciones\frontend\src\pages\SuperAdmin_recovered.tsx', $content)
