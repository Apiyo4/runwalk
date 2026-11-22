import AVFoundation

/// Owns the app's AVAudioSession for a workout.
///
/// Two session configurations are used:
///
///   Idle-in-workout:  .playback + .mixWithOthers   (YouTube at full volume)
///   Speaking a cue:   .playback/.voicePrompt + .duckOthers   (YouTube lowered)
///
/// iOS only applies or removes ducking when the session is (re)activated, and
/// it only restores the other app's volume when we deactivate with
/// .notifyOthersOnDeactivation. So every duck/unduck is:
///   pause silent engine -> deactivate -> change category -> activate -> resume engine
/// The gap is a few milliseconds; far too short for iOS to suspend us.
///
/// The silent engine exists purely to keep the process alive in the background
/// (UIBackgroundModes = audio only keeps apps alive while they are playing).
/// It renders zeros, mixes with others, and never ducks anyone by itself.
final class CueAudioController: NSObject, AVSpeechSynthesizerDelegate {
  typealias Emit = ([String: Any?]) -> Void

  private let session = AVAudioSession.sharedInstance()
  private let synth = AVSpeechSynthesizer()
  private let engine = AVAudioEngine()
  private let player = AVAudioPlayerNode()
  private var silentBuffer: AVAudioPCMBuffer?
  private var engineWired = false

  private(set) var isSessionRunning = false
  private var isDucked = false
  private var completions: [ObjectIdentifier: () -> Void] = [:]
  private var pendingUnduck: DispatchWorkItem?
  private let emit: Emit

  /// Short tail after speech so the last syllable is not clipped and two
  /// back-to-back cues ("Run for 1 minute." + "Halfway there.") share one duck.
  private let unduckDelay: TimeInterval = 0.35
  /// Safety net in case the synthesizer never calls back.
  private let speechTimeout: TimeInterval = 15

  init(emit: @escaping Emit) {
    self.emit = emit
    super.init()
    synth.delegate = self
    synth.usesApplicationAudioSession = true

    let nc = NotificationCenter.default
    nc.addObserver(self, selector: #selector(onInterruption(_:)),
                   name: AVAudioSession.interruptionNotification, object: session)
    nc.addObserver(self, selector: #selector(onEngineConfigChange(_:)),
                   name: .AVAudioEngineConfigurationChange, object: engine)
    nc.addObserver(self, selector: #selector(onMediaServicesReset(_:)),
                   name: AVAudioSession.mediaServicesWereResetNotification, object: session)
  }

  deinit {
    NotificationCenter.default.removeObserver(self)
  }

  // MARK: Session lifecycle

  func startSession() throws {
    guard !isSessionRunning else { return }
    // If a cue is already playing (ducked), leave that configuration alone;
    // unduck() will switch to the mixable config when speech ends.
    if !isDucked {
      try configure(ducking: false)
      try session.setActive(true)
    }
    isSessionRunning = true
    do {
      try startSilence()
    } catch {
      isSessionRunning = false
      throw error
    }
  }

  func stopSession() {
    guard isSessionRunning || isDucked else { return }
    pendingUnduck?.cancel()
    isSessionRunning = false
    isDucked = false
    stopSilence()
    try? session.setActive(false, options: .notifyOthersOnDeactivation)
  }

  // MARK: Speech

  func speak(_ text: String, completion: @escaping () -> Void) {
    duck()

    let utterance = AVSpeechUtterance(string: text)
    utterance.rate = AVSpeechUtteranceDefaultSpeechRate
    utterance.voice = AVSpeechSynthesisVoice(language: AVSpeechSynthesisVoice.currentLanguageCode())
    utterance.preUtteranceDelay = 0.15 // let the duck ramp down before the first word
    completions[ObjectIdentifier(utterance)] = completion
    synth.speak(utterance)

    DispatchQueue.main.asyncAfter(deadline: .now() + speechTimeout) { [weak self] in
      self?.finish(utterance)
    }
  }

  func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
    DispatchQueue.main.async { self.finish(utterance) }
  }

  func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
    DispatchQueue.main.async { self.finish(utterance) }
  }

  private func finish(_ utterance: AVSpeechUtterance) {
    guard let done = completions.removeValue(forKey: ObjectIdentifier(utterance)) else { return }
    done()
    if completions.isEmpty { scheduleUnduck() }
  }

  // MARK: Ducking

  private func duck() {
    pendingUnduck?.cancel()
    pendingUnduck = nil
    guard !isDucked else { return }
    do {
      try reactivate(ducking: true)
      isDucked = true
    } catch {
      emit(["type": "error", "message": "duck failed: \(error.localizedDescription)"])
      // Still try to speak on whatever session we have.
      try? session.setActive(true)
      resumeSilenceIfNeeded()
    }
  }

  private func scheduleUnduck() {
    pendingUnduck?.cancel()
    let work = DispatchWorkItem { [weak self] in self?.unduck() }
    pendingUnduck = work
    DispatchQueue.main.asyncAfter(deadline: .now() + unduckDelay, execute: work)
  }

  private func unduck() {
    guard isDucked, completions.isEmpty, !synth.isSpeaking else { return }
    isDucked = false
    if isSessionRunning {
      do {
        try reactivate(ducking: false)
      } catch {
        emit(["type": "error", "message": "unduck failed: \(error.localizedDescription)"])
      }
    } else {
      // Speaking outside a workout session (e.g. a test cue): just release.
      try? session.setActive(false, options: .notifyOthersOnDeactivation)
    }
  }

  private func reactivate(ducking: Bool) throws {
    pauseSilence()
    // Deactivating with notifyOthers is what tells YouTube to restore volume.
    try? session.setActive(false, options: .notifyOthersOnDeactivation)
    try configure(ducking: ducking)
    try session.setActive(true)
    resumeSilenceIfNeeded()
  }

  private func configure(ducking: Bool) throws {
    if ducking {
      // .duckOthers implies mixing; YouTube keeps playing, just quieter.
      try session.setCategory(.playback, mode: .voicePrompt, options: [.duckOthers])
    } else {
      try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
    }
  }

  // MARK: Silent keep-alive

  private func startSilence() throws {
    if !engineWired {
      let format = AVAudioFormat(standardFormatWithSampleRate: 44_100, channels: 2)!
      engine.attach(player)
      engine.connect(player, to: engine.mainMixerNode, format: format)
      let frames = AVAudioFrameCount(format.sampleRate) // 1 second
      let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frames)!
      buffer.frameLength = frames
      if let channels = buffer.floatChannelData {
        for c in 0..<Int(format.channelCount) {
          channels[c].update(repeating: 0, count: Int(frames))
        }
      }
      silentBuffer = buffer
      engineWired = true
    }
    engine.prepare()
    try engine.start()
    if let buffer = silentBuffer {
      player.scheduleBuffer(buffer, at: nil, options: .loops, completionHandler: nil)
    }
    player.play()
  }

  private func pauseSilence() {
    if engine.isRunning { engine.pause() }
  }

  private func resumeSilenceIfNeeded() {
    guard isSessionRunning, !engine.isRunning else { return }
    do {
      try engine.start()
      if !player.isPlaying { player.play() }
    } catch {
      emit(["type": "error", "message": "silence resume failed: \(error.localizedDescription)"])
    }
  }

  private func stopSilence() {
    player.stop()
    engine.stop()
  }

  // MARK: System events

  @objc private func onInterruption(_ note: Notification) {
    guard let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
          let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
    DispatchQueue.main.async {
      switch type {
      case .began:
        // Phone call, Siri, alarm. The system has already deactivated us.
        self.isDucked = false
        self.emit(["type": "interruptionBegan"])
      case .ended:
        if self.isSessionRunning {
          self.isSessionRunning = false
          try? self.startSession()
        }
        self.emit(["type": "interruptionEnded"])
      @unknown default:
        break
      }
    }
  }

  @objc private func onEngineConfigChange(_ note: Notification) {
    // Headphones plugged/unplugged, Bluetooth route change: the engine stops itself.
    DispatchQueue.main.async {
      guard self.isSessionRunning else { return }
      self.stopSilence()
      try? self.startSilence()
      self.emit(["type": "routeChange"])
    }
  }

  @objc private func onMediaServicesReset(_ note: Notification) {
    DispatchQueue.main.async {
      let wasRunning = self.isSessionRunning
      self.isSessionRunning = false
      self.isDucked = false
      if wasRunning { try? self.startSession() }
      self.emit(["type": "error", "message": "media services were reset"])
    }
  }
}
