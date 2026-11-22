import ExpoModulesCore

/// JS entry point. All work happens on the main queue so AVAudioSession and
/// AVSpeechSynthesizer calls are never made from two threads at once.
public final class RunWalkAudioModule: Module {
  private lazy var controller = CueAudioController { [weak self] body in
    self?.sendEvent("onAudioEvent", body)
  }

  public func definition() -> ModuleDefinition {
    Name("RunWalkAudio")

    Events("onAudioEvent")

    /// Call when a workout starts or resumes. Configures a mixable playback
    /// session and starts a silent audio loop so iOS keeps RunWalk running
    /// (and its JS timers ticking) while YouTube is in the foreground.
    AsyncFunction("startSession") { () throws -> Void in
      try self.controller.startSession()
    }.runOnQueue(.main)

    /// Call on pause, end, or completion (after the final cue finishes).
    AsyncFunction("stopSession") { () -> Void in
      self.controller.stopSession()
    }.runOnQueue(.main)

    /// Speaks `text`, ducking other audio. Resolves when speech has finished.
    AsyncFunction("speak") { (text: String, promise: Promise) in
      self.controller.speak(text) { promise.resolve(nil) }
    }.runOnQueue(.main)

    AsyncFunction("isSessionActive") { () -> Bool in
      self.controller.isSessionRunning
    }.runOnQueue(.main)

    OnDestroy {
      DispatchQueue.main.async { self.controller.stopSession() }
    }
  }
}
