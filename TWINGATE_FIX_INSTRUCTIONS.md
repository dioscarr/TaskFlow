# Twingate Clock Sync Issue - Resolution Steps

## Problem Identified
Your Twingate connector is failing with "token expired" errors because the Docker Desktop WSL2 VM clock has drifted ahead of the actual system time.

## Root Cause
- ✓ Network connectivity: Working
- ✓ DNS resolution: Working  
- ✓ TLS handshake: Working
- ✓ Host system clock: Correct (Feb 3, 2026 9:56 AM PST)
- ✗ **Docker container clock: Running ahead** (causing tokens to appear expired)

## Evidence from Logs
```
Token issued: 1770129545 (9:45 AM PST)
Token expires: 1770133145 (10:45 AM PST)
Current time should be: ~9:56 AM PST
Container thinks: Time is > 10:45 AM PST
Result: Token falsely marked as expired
```

## Fix Steps

### Option 1: Restart Docker Desktop (Recommended)
1. Right-click Docker Desktop icon in system tray
2. Select "Quit Docker Desktop"
3. Wait 10 seconds
4. Start Docker Desktop again
5. Wait for it to fully start
6. Your Twingate container will auto-restart with correct clock

### Option 2: Restart WSL2 (If Option 1 doesn't work)
```powershell
# Run in PowerShell as Administrator
wsl --shutdown
# Wait 10 seconds, then restart Docker Desktop
```

### Option 3: Manual Container Restart (Temporary)
```powershell
docker restart twingate-cheerful-jackdaw
```
**Note:** This only works if Docker Desktop's VM clock is correct. If the VM itself has drifted, you must use Option 1 or 2.

## Verification
After restarting, check the logs:
```powershell
docker logs twingate-cheerful-jackdaw --tail 20
```

You should see:
- ✓ No more "token verification failed: token expired" warnings
- ✓ Successful API calls without immediate expiration
- ✓ Normal connector operation

## Prevention
This issue typically occurs after:
- System sleep/hibernate
- Extended uptime without Docker Desktop restart
- WSL2 VM clock desync

**Recommendation:** Restart Docker Desktop weekly or after system sleep/resume.

## Still Having Issues?

If the problem persists after restarting Docker Desktop:

1. **Check Windows Time Service:**
   ```powershell
   w32tm /query /status
   # Resync if needed:
   w32tm /resync
   ```

2. **Verify Docker Desktop Settings:**
   - Settings → Resources → WSL Integration
   - Ensure WSL2 backend is enabled
   - Try toggling "Use the WSL 2 based engine" off/on

3. **Re-deploy the connector:**
   - Generate new connector tokens from Twingate Admin Console
   - Deploy fresh connector with new credentials
