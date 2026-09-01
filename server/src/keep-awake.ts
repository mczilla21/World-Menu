import { spawn, ChildProcess } from 'child_process';

// This is the whole point of the machine running World Menu: every tablet/phone in the
// building is a thin client with zero local data, so the moment this laptop sleeps or its
// lid closes, the entire restaurant loses the system at once -- no local fallback exists by
// design. Rather than rely on someone remembering to change a Windows power setting (and
// that setting quietly reverting after a Windows update, or a different laptop being used
// next time), the server claims "stay awake" for itself the moment it starts, and releases
// the claim on a clean shutdown so it doesn't outlive its usefulness on some unrelated day.
//
// Windows only: SetThreadExecutionState is a Win32 API with no POSIX equivalent, and every
// machine touched by this project tonight has been Windows. ES_CONTINUOUS keeps the claim
// active until explicitly cleared or the calling process exits -- which is why this spawns
// a small PowerShell process that stays alive (not a one-shot call, that would revert the
// instant the calling process exited) for as long as the Node server itself is running.
let keepAwakeProcess: ChildProcess | null = null;

export function startKeepAwake() {
  if (process.platform !== 'win32' || keepAwakeProcess) return;
  const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WorldMenuAwake {
  [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
  public static extern uint SetThreadExecutionState(uint esFlags);
}
"@
$ES_CONTINUOUS = [uint32]"0x80000000"
$ES_SYSTEM_REQUIRED = [uint32]"0x00000001"
[WorldMenuAwake]::SetThreadExecutionState($ES_CONTINUOUS -bor $ES_SYSTEM_REQUIRED) | Out-Null
while ($true) { Start-Sleep -Seconds 30 }
`.trim();
  try {
    keepAwakeProcess = spawn('powershell', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', script], { stdio: 'ignore' });
    keepAwakeProcess.on('error', () => { keepAwakeProcess = null; });
    console.log('  Sleep prevention: ON — this computer will stay awake while the server is running.');
  } catch {
    console.log('  Sleep prevention: could not start — turn off sleep manually in Windows power settings.');
  }
}

export function stopKeepAwake() {
  if (keepAwakeProcess) {
    keepAwakeProcess.kill();
    keepAwakeProcess = null;
  }
}
