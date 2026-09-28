# vo-gen.ps1 — voice scenes with the local Windows voice (System.Speech, no download, no cloud), at the film's format:
# 48 kHz, 16-bit, mono PCM. Voice and rate come from script.json; only the scene ids passed are voiced.
#   powershell -NoProfile -File vo-gen.ps1 -Ids prove,sizer [-OutDir vo] [-Text "override for a single id"]
param([string[]]$Ids, [string]$OutDir = 'vo', [string]$Text = '')
Add-Type -AssemblyName System.Speech
$script = Get-Content -Raw -Encoding UTF8 (Join-Path $PSScriptRoot 'script.json') | ConvertFrom-Json
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(48000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
foreach ($id in $Ids) {
  $scene = $script.scenes | Where-Object { $_.id -eq $id }
  if (-not $scene) { throw "no scene $id in script.json" }
  $say = if ($Text) { $Text } else { $scene.say }
  $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $synth.SelectVoice($script.voice)
  $synth.Rate = [int]$script.rate
  $out = Join-Path (Join-Path $PSScriptRoot $OutDir) ($id + '.wav')
  $synth.SetOutputToWaveFile($out, $fmt)
  $synth.Speak($say)
  $synth.SetOutputToNull(); $synth.Dispose()
  Write-Output ("voiced {0} -> {1}" -f $id, $out)
}
