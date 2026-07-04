Pod::Spec.new do |s|
  s.name           = 'CappyProximityShare'
  s.version        = '0.1.0'
  s.summary        = 'iPhone-to-iPhone direct invite transfer via Nearby Interaction + Multipeer Connectivity'
  s.description    = 'Local Expo module: pairs two nearby iPhones over Multipeer Connectivity and uses the Nearby Interaction framework (Ultra Wideband) to confirm the phones are held together before transferring a Cappy family-invite link directly, device to device.'
  s.author         = 'Cappy'
  s.homepage       = 'https://cappy.closedose.com'
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
