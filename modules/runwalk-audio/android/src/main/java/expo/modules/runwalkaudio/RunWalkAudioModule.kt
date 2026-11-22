package expo.modules.runwalkaudio

import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class RunWalkAudioModule : Module() {
  private var controller: CueAudioController? = null

  private fun ctrl(): CueAudioController {
    controller?.let { return it }
    val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
    return CueAudioController(context) { body -> sendEvent("onAudioEvent", body) }.also { controller = it }
  }

  override fun definition() = ModuleDefinition {
    Name("RunWalkAudio")

    Events("onAudioEvent")

    AsyncFunction("startSession") {
      ctrl().startSession()
    }

    AsyncFunction("stopSession") {
      controller?.stopSession()
    }

    AsyncFunction("speak") { text: String, promise: Promise ->
      ctrl().speak(text) { promise.resolve(null) }
    }

    AsyncFunction("isSessionActive") {
      controller?.isSessionRunning ?: false
    }

    OnDestroy {
      controller?.shutdown()
      controller = null
    }
  }
}
