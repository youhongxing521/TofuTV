[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateSet("Start", "Stop")]
    [string]$Action,
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$webDir = Join-Path $repoRoot "web"
$viteScript = Join-Path $webDir "node_modules\vite\bin\vite.js"
$workspaceCompose = Join-Path $repoRoot ".local\docker-compose.windows.yml"
$assistantViteConfig = Join-Path $repoRoot ".local\assistant-dev\vite.config.mts"
$runtimeDir = Join-Path $repoRoot ".local\launcher"
$webPort = 3000
$backendPort = 8080
$homepage = "http://localhost:$webPort"
$composeProject = "tofutv-dev"
$backendName = "$composeProject-backend-1"
$docker = Get-Command docker.exe -ErrorAction SilentlyContinue

function Test-DockerEngine {
    if (-not $docker) { return $false }
    # Windows PowerShell can surface redirected native stderr as an error record.
    $ErrorActionPreference = "Continue"
    $null = & $docker.Source info --format "{{.ServerVersion}}" 2>&1
    return $LASTEXITCODE -eq 0
}

function Invoke-TofuDocker([string[]]$CommandArgs) {
    & $docker.Source @CommandArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Docker $($CommandArgs[0]) 执行失败（退出码 $LASTEXITCODE）。"
    }
}

function Get-TofuBackend {
    $names = @(& $docker.Source container ls -a --filter "name=^/$backendName$" --format "{{.Names}}")
    if ($LASTEXITCODE -ne 0) { throw "无法读取 Docker 容器列表。" }
    if ($names -notcontains $backendName) { return $null }

    $details = & $docker.Source container inspect --format "{{json .}}" $backendName | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0 -or -not $details) { throw "无法读取 TofuTV 后端容器。" }
    $labels = $details.Config.Labels
    if ($labels.'com.docker.compose.service' -ne "backend" -or
        $labels.'com.docker.compose.project.working_dir' -ne $repoRoot) {
        throw "现有后端容器不属于当前 TofuTV 目录。请从对应项目目录操作。"
    }
    return $details
}

function Test-LocalPort([int]$Port) {
    return [bool]([Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() |
        Where-Object Port -eq $Port | Select-Object -First 1)
}

function Get-TofuWebProcess {
    $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $webPort -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique)
    foreach ($id in $listeners) {
        $info = Get-CimInstance -ClassName Win32_Process -Filter "ProcessId=$id"
        if ($info.Name -eq "node.exe" -and $info.CommandLine -and
            $info.CommandLine.IndexOf($viteScript, [StringComparison]::OrdinalIgnoreCase) -ge 0) {
            Get-Process -Id $id -ErrorAction SilentlyContinue
        }
    }
}

function Wait-TofuHealth([int]$Port, [int]$TimeoutSeconds, [Diagnostics.Process]$Process) {
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        if ($Process -and $Process.HasExited) { return $false }
        try {
            $result = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/health" -TimeoutSec 2
            if ($result.code -eq 0 -and $result.data.ready -eq $true) { return $true }
        } catch {
            # The service may still be compiling or opening its database.
        }
        Start-Sleep -Seconds 1
    } while ((Get-Date) -lt $deadline)
    return $false
}

function Start-TofuTV {
    if (-not $docker) { throw "未找到 Docker Desktop。请确认 Docker 已安装并可在命令行调用。" }
    $node = Get-Command node.exe -ErrorAction SilentlyContinue
    if (-not $node -or -not (Test-Path -LiteralPath $viteScript)) {
        throw "找不到 Node.js 或已有的前端依赖，请先恢复当前工作区的开发环境。"
    }

    $webAlreadyRunning = $false
    if (Test-LocalPort $webPort) {
        $webAlreadyRunning = [bool](Get-TofuWebProcess)
        if (-not $webAlreadyRunning) { throw "端口 $webPort 被其他进程占用。" }
    }
    if (-not (Test-DockerEngine)) {
        Write-Host "正在启动 Docker Desktop..."
        Invoke-TofuDocker @("desktop", "start", "--timeout", "90")
        if (-not (Test-DockerEngine)) { throw "Docker Desktop 仍未就绪。" }
    }

    $backend = Get-TofuBackend
    if (-not $backend.State.Running -and (Test-LocalPort $backendPort)) {
        throw "端口 $backendPort 被其他进程占用。"
    }

    $startedBackend = $false
    $webProcess = $null
    try {
        if (-not $backend) {
            if (-not (Test-Path -LiteralPath $workspaceCompose)) {
                throw "找不到现有 TofuTV 容器和本机 Docker 配置 .local/docker-compose.windows.yml。"
            }
            Write-Host "正在用本机配置创建 TofuTV 后端容器..."
            Invoke-TofuDocker @("compose", "--project-name", $composeProject, "--project-directory", $repoRoot, "-f",
                (Join-Path $repoRoot "docker-compose.dev.yml"), "-f", $workspaceCompose, "up", "-d", "--no-deps", "backend")
            $startedBackend = $true
        } elseif (-not $backend.State.Running) {
            Write-Host "正在启动现有 TofuTV 后端..."
            Invoke-TofuDocker @("container", "start", $backendName)
            $startedBackend = $true
        }
        if (-not (Wait-TofuHealth -Port $backendPort -TimeoutSeconds 120)) {
            throw "后端未就绪。可运行 docker logs --tail 60 $backendName 查看原因。"
        }

        if (-not $webAlreadyRunning) {
            New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
            $webArgs = @(('"' + $viteScript + '"'), "--host", "127.0.0.1", "--port", "$webPort", "--strictPort")
            if (Test-Path -LiteralPath $assistantViteConfig) {
                $webArgs += "--config", ('"' + $assistantViteConfig + '"')
            }
            $env:VITE_API_PROXY_TARGET = "http://127.0.0.1:$backendPort"
            $env:TOFUTV_BACKEND_CONTAINER = $backendName
            Write-Host "正在启动 TofuTV 前端..."
            $webProcess = Start-Process -FilePath $node.Source -WorkingDirectory $webDir -ArgumentList $webArgs -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimeDir "web.log") -RedirectStandardError (Join-Path $runtimeDir "web-error.log")
        }
        if (-not (Wait-TofuHealth -Port $webPort -TimeoutSeconds 45 -Process $webProcess)) {
            throw "前端未就绪。请查看 .local/launcher/web-error.log。"
        }
    } catch {
        if ($webProcess -and -not $webProcess.HasExited) {
            Stop-Process -InputObject $webProcess -ErrorAction SilentlyContinue
        }
        if ($startedBackend) {
            & $docker.Source container stop --timeout 15 $backendName 2>$null | Out-Null
        }
        throw
    }

    Write-Host "TofuTV 已启动 $homepage" -ForegroundColor Green
    if (-not $NoBrowser) { Start-Process $homepage }
}

function Stop-TofuTV {
    $backend = if (Test-DockerEngine) { Get-TofuBackend }
    foreach ($webProcess in @(Get-TofuWebProcess)) {
        Stop-Process -InputObject $webProcess
        if (-not $webProcess.WaitForExit(5000)) { throw "等待 TofuTV 前端退出超时。" }
    }
    if ($backend.State.Running) {
        Invoke-TofuDocker @("container", "stop", "--timeout", "15", $backendName)
    }
    if (Test-LocalPort $webPort) {
        Write-Warning "端口 $webPort 仍由其他进程监听。"
    }
    Write-Host "TofuTV 已关闭。项目和配置保存在原数据卷。" -ForegroundColor Green
}

$mutex = [Threading.Mutex]::new($false, "Local\TofuTV-Launcher")
$locked = $false
try {
    try { $locked = $mutex.WaitOne(0) }
    catch [Threading.AbandonedMutexException] { $locked = $true }
    if (-not $locked) { throw "TofuTV 的另一项启动或关闭操作正在进行，请等待它结束。" }
    if ($Action -eq "Start") { Start-TofuTV }
    else { Stop-TofuTV }
} catch {
    Write-Host ("TofuTV " + $_.Exception.Message) -ForegroundColor Red
    exit 1
} finally {
    if ($locked) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
