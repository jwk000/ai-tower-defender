# Tower Defender — GitHub Pages 部署脚本
# 用法: .\deploy.ps1 [-DryRun] [-Message "提交信息"]
# 流程: release 构建 → 提交 → 推送 main 分支 → GitHub Actions 自动部署到 Pages
param(
    [switch]$DryRun,
    [string]$Message = ""
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Tower Defender — GitHub Pages 部署" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# === 1. 本地构建验证 ===
Write-Host "[1/4] 构建验证 — npm run release (typecheck + clean + build)" -ForegroundColor Yellow
npm run release
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 构建失败，部署中止" -ForegroundColor Red
    exit 1
}
Write-Host "✅ 构建成功" -ForegroundColor Green
Write-Host ""

# === Dry Run: 只构建不推送 ===
if ($DryRun) {
    Write-Host "🔍 --DryRun 模式: 构建已完成，跳过推送" -ForegroundColor Cyan
    Write-Host "   产物位置: dist/" -ForegroundColor Gray
    exit 0
}

# === 2. 检查 Git 状态 ===
Write-Host "[2/4] 检查 Git 状态" -ForegroundColor Yellow
$branch = git branch --show-current
Write-Host "   当前分支: $branch" -ForegroundColor Gray

$status = git status --porcelain
if (-not $status) {
    Write-Host "   工作区干净，没有需要提交的更改" -ForegroundColor Gray
    Write-Host ""
    Write-Host "[3/4] 跳过提交 (没有变更)" -ForegroundColor Yellow
} else {
    Write-Host "   未提交的变更:" -ForegroundColor Gray
    git status --short
    Write-Host ""

    # === 3. 提交 ===
    Write-Host "[3/4] 提交变更" -ForegroundColor Yellow
    
    if (-not $Message) {
        # 自动生成提交信息
        $changedFiles = git diff --name-only HEAD 2>$null
        if (-not $changedFiles) { $changedFiles = git ls-files --others --exclude-standard }
        $fileCount = ($changedFiles | Measure-Object).Count
        if ($fileCount -gt 0) {
            $firstFile = ($changedFiles | Select-Object -First 1)
            if ($fileCount -gt 1) {
                $Message = "deploy: $firstFile 等 $fileCount 个文件"
            } else {
                $Message = "deploy: $firstFile"
            }
        } else {
            $Message = "deploy: GitHub Pages 部署"
        }
    }
    
    Write-Host "   提交信息: $Message" -ForegroundColor Gray
    git add -A
    git commit -m $Message
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ 提交失败" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ 提交完成" -ForegroundColor Green
}
Write-Host ""

# === 4. 推送 ===
Write-Host "[4/4] 推送到 origin/$branch" -ForegroundColor Yellow
git push origin $branch
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 推送失败，请检查网络或权限" -ForegroundColor Red
    exit 1
}
Write-Host "✅ 推送成功" -ForegroundColor Green
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  🚀 部署流程已触发!" -ForegroundColor Cyan
Write-Host "  GitHub Actions 正在构建并部署到:" -ForegroundColor Cyan
Write-Host "  https://jwk000.github.io/ai-tower-defender/" -ForegroundColor Green
Write-Host ""
Write-Host "  查看部署状态:" -ForegroundColor Gray
Write-Host "  https://github.com/jwk000/ai-tower-defender/actions" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Cyan
