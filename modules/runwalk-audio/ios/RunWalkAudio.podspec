Pod::Spec.new do |s|
  s.name           = 'RunWalkAudio'
  s.version        = '1.0.0'
  s.summary        = 'Ducking voice cues and background keep-alive for RunWalk'
  s.description    = 'Speaks interval cues over other apps (ducking them) and keeps the app alive in the background during a workout.'
  s.license        = 'MIT'
  s.author         = 'RunWalk'
  s.homepage       = 'https://apiyo.com/runwalk'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
