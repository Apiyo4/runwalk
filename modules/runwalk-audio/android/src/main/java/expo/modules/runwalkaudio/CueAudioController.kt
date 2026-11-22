package expo.modules.runwalkaudio

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.util.Locale
import java.util.UUID

/**
 * Android counterpart of the iOS controller.
 *
 * Ducking: request AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK before speaking and
 * abandon it afterwards. YouTube (and the system auto-ducker on Android 8+)
 * lowers its volume while we hold focus and restores it when we release.
 *
 * Background survival: NOT handled yet. On Android, a backgrounded app can be
 * throttled or killed; a production build should start a foreground service
 * (type mediaPlayback) in startSession(). See ARCHITECTURE.md, "Android gaps".
 * startSession/stopSession already exist so the JS side will not change.
 */
class CueAudioController(
  context: Context,
  private val emit: (Map<String, Any?>) -> Unit,
) : TextToSpeech.OnInitListener {
  private val appContext = context.applicationContext
  private val audioManager = appContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
  private val main = Handler(Looper.getMainLooper())

  private val attributes: AudioAttributes = AudioAttributes.Builder()
    .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
    .build()

  private var tts: TextToSpeech? = TextToSpeech(appContext, this)
  private var ttsReady = false
  private val queuedBeforeReady = mutableListOf<Pair<String, String>>() // id to text
  private val completions = mutableMapOf<String, () -> Unit>()

  private var focusRequest: AudioFocusRequest? = null
  private var hasFocus = false
  private val abandonRunnable = Runnable { abandonFocusIfIdle() }

  var isSessionRunning = false
    private set

  fun startSession() {
    isSessionRunning = true
  }

  fun stopSession() {
    isSessionRunning = false
  }

  override fun onInit(status: Int) {
    main.post {
      val engine = tts
      if (status == TextToSpeech.SUCCESS && engine != null) {
        engine.setAudioAttributes(attributes)
        engine.language = Locale.getDefault()
        engine.setOnUtteranceProgressListener(listener)
        ttsReady = true
        queuedBeforeReady.forEach { (id, text) -> engine.speak(text, TextToSpeech.QUEUE_ADD, null, id) }
      } else {
        emit(mapOf("type" to "error", "message" to "TextToSpeech init failed: $status"))
        queuedBeforeReady.forEach { (id, _) -> finish(id) }
      }
      queuedBeforeReady.clear()
    }
  }

  fun speak(text: String, onDone: () -> Unit) {
    main.post {
      val id = UUID.randomUUID().toString()
      completions[id] = onDone
      main.removeCallbacks(abandonRunnable)
      requestFocus()
      if (ttsReady) {
        tts?.speak(text, TextToSpeech.QUEUE_ADD, null, id)
      } else {
        queuedBeforeReady.add(id to text)
      }
      main.postDelayed({ finish(id) }, 15_000L) // safety net
    }
  }

  private val listener = object : UtteranceProgressListener() {
    override fun onStart(utteranceId: String?) {}
    override fun onDone(utteranceId: String?) { utteranceId?.let { main.post { finish(it) } } }
    @Deprecated("Deprecated in Java")
    override fun onError(utteranceId: String?) { utteranceId?.let { main.post { finish(it) } } }
    override fun onError(utteranceId: String?, errorCode: Int) { utteranceId?.let { main.post { finish(it) } } }
  }

  private fun finish(id: String) {
    val done = completions.remove(id) ?: return
    done()
    if (completions.isEmpty()) {
      main.removeCallbacks(abandonRunnable)
      main.postDelayed(abandonRunnable, 350L)
    }
  }

  private fun requestFocus() {
    if (hasFocus) return
    val result = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
        .setAudioAttributes(attributes)
        .setOnAudioFocusChangeListener { }
        .build()
      focusRequest = request
      audioManager.requestAudioFocus(request)
    } else {
      @Suppress("DEPRECATION")
      audioManager.requestAudioFocus(null, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
    }
    hasFocus = result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
  }

  private fun abandonFocusIfIdle() {
    if (!hasFocus || completions.isNotEmpty()) return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      focusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
    } else {
      @Suppress("DEPRECATION")
      audioManager.abandonAudioFocus(null)
    }
    hasFocus = false
  }

  fun shutdown() {
    main.removeCallbacksAndMessages(null)
    completions.values.forEach { it() }
    completions.clear()
    abandonFocusIfIdle()
    tts?.shutdown()
    tts = null
  }
}
