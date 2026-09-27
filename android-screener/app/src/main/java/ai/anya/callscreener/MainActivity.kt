package ai.anya.callscreener

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebResourceRequest
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView.webViewClient = object : WebViewClientCompat() {
            override fun shouldInterceptRequest(
                view: WebView,
                url: String
            ) = assetLoader.shouldInterceptRequest(Uri.parse(url))

            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ) = assetLoader.shouldInterceptRequest(request.url)

            // Override for Android 24+ (WebResourceRequest)
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                return handleUriScheme(request.url.toString())
            }

            // Override for older Android versions
            @Deprecated("Deprecated in Java")
            override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
                return handleUriScheme(url)
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                // Grant camera, microphone, and other requested web permissions automatically
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

        setContentView(webView)
        WebView.setWebContentsDebuggingEnabled(true)
        webView.loadUrl("https://appassets.androidplatform.net/assets/index.html")
    }

    private fun handleUriScheme(url: String): Boolean {
        if (url.contains("appassets.androidplatform.net")) {
            return false
        }

        val isHttp = url.startsWith("http://") || url.startsWith("https://")
        if (isHttp) {
            // For standard external HTTP links, open them in the external browser
            try {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                startActivity(intent)
                return true
            } catch (e: Exception) {
                return false
            }
        } else {
            // For custom schemes (whatsapp://, instagram://, tel:, sms:, intent://, etc.)
            try {
                val intent = if (url.startsWith("intent://")) {
                    Intent.parseUri(url, Intent.URI_INTENT_SCHEME)
                } else {
                    Intent(Intent.ACTION_VIEW, Uri.parse(url))
                }
                startActivity(intent)
                return true
            } catch (e: ActivityNotFoundException) {
                // If native app is not installed, try to extract package and open Play Store
                try {
                    if (url.startsWith("intent://")) {
                        val parsedIntent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME)
                        val fallbackUrl = parsedIntent.getStringExtra("browser_fallback_url")
                        if (fallbackUrl != null) {
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(fallbackUrl))
                            startActivity(intent)
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
            } catch (e: Exception) {
                return true
            }
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
