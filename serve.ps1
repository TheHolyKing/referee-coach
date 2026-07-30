# Run this script to start a local web server for the app
# Then open the URL it prints on your PC to test
# Or serve it via a hosting service (see SETUP.txt) for iOS use

$path = $PSScriptRoot
$mimeTypes = @{
    '.html' = 'text/html; charset=utf-8'
    '.css'  = 'text/css'
    '.js'   = 'application/javascript'
    '.json' = 'application/json'
    '.png'  = 'image/png'
    '.ico'  = 'image/x-icon'
}

try {
    # 8080 is occasionally reserved by Hyper-V/WSL's dynamic port-exclusion
    # range on Windows, which makes HttpListener fail to bind even though
    # nothing is visibly "using" the port. Try a few nearby ports instead
    # of giving up on the first one.
    $http = $null
    $port = $null
    foreach ($candidate in 8080, 8081, 8082, 8090, 5173) {
        $listener = [System.Net.HttpListener]::new()
        $listener.Prefixes.Add("http://localhost:$candidate/")
        try {
            $listener.Start()
            $http = $listener
            $port = $candidate
            break
        } catch {
            $listener.Close()
        }
    }

    if (-not $http) {
        throw "Could not bind to any of the candidate ports (8080, 8081, 8082, 8090, 5173). They may all be in use or blocked."
    }

    $url = "http://localhost:$port/"
    Write-Host "Starting Referee Coach app server on $url" -ForegroundColor Cyan
    Write-Host "Press Ctrl+C to stop." -ForegroundColor Yellow
    Start-Process $url

    while ($http.IsListening) {
        $ctx = $http.GetContext()
        $req = $ctx.Request
        $res = $ctx.Response

        $urlPath = $req.Url.LocalPath
        if ($urlPath -eq '/') { $urlPath = '/index.html' }

        $filePath = Join-Path $path $urlPath.TrimStart('/')

        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath)
            $mime = if ($mimeTypes[$ext]) { $mimeTypes[$ext] } else { 'application/octet-stream' }
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $res.ContentType = $mime
            $res.ContentLength64 = $bytes.Length
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $res.StatusCode = 404
        }

        $res.OutputStream.Close()
    }
} catch {
    Write-Host ""
    Write-Host "Server failed to start:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to close this window"
}
