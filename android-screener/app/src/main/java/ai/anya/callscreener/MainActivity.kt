package ai.anya.callscreener

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebResourceRequest
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView

    companion object {
        private const val OVERLAY_PERMISSION_REQUEST = 1001
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView.webViewClient = object : WebViewClientCompat() {
            override fun shouldInterceptRequest(view: WebView, url: String) =
                assetLoader.shouldInterceptRequest(Uri.parse(url))

            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest) =
                assetLoader.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
                handleUriScheme(request.url.toString())

            @Deprecated("Deprecated in Java")
            override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean =
                handleUriScheme(url)
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                request.grant(request.resources)
            }
        }

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.cacheMode = WebSettings.LOAD_DEFAULT
        webView.settings.allowFileAccess = true
        webView.settings.allowContentAccess = true
        webView.settings.mediaPlaybackRequiresUserGesture = false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            webView.settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        }

        // ── Inject AnyaJsBridge so JS can call native Android actions ──────────
        val bridge = AnyaJsBridge(this)
        webView.addJavascriptInterface(bridge, "AnyaBridge")

        setContentView(webView)
        WebView.setWebContentsDebuggingEnabled(true)
        webView.loadUrl("https://appassets.androidplatform.net/assets/index.html")

        // ── Handle "startLiveMode" intent from JS ──────────────────────────────
        // The React app can trigger native overlay by posting a message or via bridge.
        // This is also triggered if activity was re-started with an extra from bridge.
        handleIntentExtras(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIntentExtras(intent)
    }

    /**
     * Check intent extras from the JS bridge to start/stop overlay service.
     */
    private fun handleIntentExtras(intent: Intent?) {
        when (intent?.getStringExtra("action")) {
            "startLiveMode" -> startLiveMode()
            "stopLiveMode"  -> stopLiveMode()
        }
    }

    /**
     * Start the floating overlay service (after checking permissions).
     * Called when user taps LIVE MODE in the React UI and the JS bridge
     * uses a flag to request overlay start — or called directly from JS.
     */
    fun startLiveMode() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            // Show rationale and open the Settings page
            AlertDialog.Builder(this)
                .setTitle("ANYA Live Mode — Permission Needed")
                .setMessage(
                    "To float ANYA's avatar above other apps, ANYA needs the " +
                    "'Display over other apps' permission.\n\nTap OK to open Settings."
                )
                .setPositiveButton("Open Settings") { _, _ ->
                    val intent = Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:$packageName")
                    )
                    startActivityForResult(intent, OVERLAY_PERMISSION_REQUEST)
                }
                .setNegativeButton("Cancel", null)
                .show()
            return
        }

        // Permission granted — start the foreground overlay service
        val serviceIntent = Intent(this, AnyaOverlayService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent)
        } else {
            startService(serviceIntent)
        }
        Toast.makeText(this, "ANYA Live Mode activated! Avatar is floating.", Toast.LENGTH_SHORT).show()
    }

    fun stopLiveMode() {
        stopService(Intent(this, AnyaOverlayService::class.java))
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == OVERLAY_PERMISSION_REQUEST) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && Settings.canDrawOverlays(this)) {
                // Permission was just granted, retry
                startLiveMode()
            } else {
                Toast.makeText(this, "Permission not granted — Live Mode unavailable", Toast.LENGTH_LONG).show()
                // Notify web layer
                webView.evaluateJavascript("window.__anyaOverlayPermissionDenied?.();", null)
            }
        }
    }

    private fun handleUriScheme(url: String): Boolean {
        if (url.contains("appassets.androidplatform.net")) return false

        val isHttp = url.startsWith("http://") || url.startsWith("https://")
        if (isHttp) {
            try {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                startActivity(intent)
                return true
            } catch (e: Exception) { return false }
        } else {
            try {
                val intent = if (url.startsWith("intent://")) {
                    Intent.parseUri(url, Intent.URI_INTENT_SCHEME)
                } else {
                    Intent(Intent.ACTION_VIEW, Uri.parse(url))
                }
                startActivity(intent)
                return true
            } catch (e: ActivityNotFoundException) {
                try {
                    if (url.startsWith("intent://")) {
                        val parsedIntent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME)
                        val fallbackUrl = parsedIntent.getStringExtra("browser_fallback_url")
                        if (fallbackUrl != null) {
                            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(fallbackUrl)))
                            return true
                        }
                    }
                    val appName = when {
                        url.contains("whatsapp") -> "WhatsApp"
                        url.contains("instagram") -> "Instagram"
                        url.contains("spotify") -> "Spotify"
                        else -> "App"
                    }
                    Toast.makeText(this, "$appName is not installed", Toast.LENGTH_SHORT).show()
                } catch (ex: Exception) {}
                return true
            } catch (e: Exception) { return true }
        }
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}

