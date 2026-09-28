package ai.anya.callscreener

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import androidx.core.app.NotificationCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import android.net.Uri
import android.webkit.WebResourceRequest

/**
 * ANYA OVERLAY SERVICE
 * ──────────────────────────────────────────────────────────────────────────────
 * A foreground Service that creates a system-level WindowManager overlay window.
 * This window floats above ALL other apps (including the home screen) because it
 * uses TYPE_APPLICATION_OVERLAY and SYSTEM_ALERT_WINDOW permission.
 *
 * WHAT IT DOES:
 *   • Creates a small, draggable WebView window that runs the ANYA overlay UI
 *     (LiveOverlayAvatar + LiveOverlayPanel rendered inside the WebView)
 *   • Handles drag gestures natively for smooth 60fps dragging
 *   • Injects AnyaJsBridge so the web UI can call native Android actions
 *   • Snaps avatar to left/right edge on release
 *   • Runs as a foreground service with persistent notification so Android
 *     doesn't kill it when the user navigates to other apps
 *
 * STARTED BY: MainActivity when user taps "LIVE MODE" button, via:
 *   Intent(context, AnyaOverlayService::class.java).also { startService(it) }
 */
class AnyaOverlayService : Service() {

    private lateinit var windowManager: WindowManager
    private lateinit var overlayView: View
    private lateinit var overlayWebView: WebView
    private lateinit var layoutParams: WindowManager.LayoutParams

    private val CHANNEL_ID = "anya_overlay_channel"
    private val NOTIFICATION_ID = 1001

    // Avatar size in dp (converted to px at runtime)
    private val AVATAR_DP = 80

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification())
        createOverlayWindow()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY // Restart if killed
    }

    override fun onDestroy() {
        super.onDestroy()
        try { windowManager.removeView(overlayView) } catch (_: Exception) {}
    }

    // ── Notification ──────────────────────────────────────────────────────────

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "ANYA Live Mode",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "ANYA is floating over your screen in Live Mode"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        val stopIntent = Intent(this, AnyaOverlayService::class.java).apply {
            action = "STOP_OVERLAY"
        }
        val stopPendingIntent = PendingIntent.getService(
            this, 0, stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("ANYA Live Mode Active")
            .setContentText("Tap to stop Live Mode")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop", stopPendingIntent)
            .build()
    }

    // ── Overlay Window Creation ────────────────────────────────────────────────

    private fun createOverlayWindow() {
        val density = resources.displayMetrics.density
        val avatarSizePx = (AVATAR_DP * density).toInt()

        // Restore last saved position or default to bottom-right
        val prefs = getSharedPreferences("anya_overlay_prefs", Context.MODE_PRIVATE)
        val savedX = prefs.getInt("avatar_x", -1)
        val savedY = prefs.getInt("avatar_y", -1)

        val displayWidth = resources.displayMetrics.widthPixels
        val displayHeight = resources.displayMetrics.heightPixels

        val initX = if (savedX >= 0) savedX else displayWidth - avatarSizePx - 12
        val initY = if (savedY >= 0) savedY else (displayHeight * 0.75).toInt()

        // WindowManager layout params for system overlay
        val windowType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        else
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE

        layoutParams = WindowManager.LayoutParams(
            avatarSizePx,
            avatarSizePx,
            windowType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = initX
            y = initY
        }

        // Build WebView for the overlay UI
        overlayWebView = buildOverlayWebView()
        overlayView = overlayWebView

        // Native drag handler — faster than touch events inside WebView
        var dragStartX = 0f
        var dragStartY = 0f
        var layoutStartX = 0
        var layoutStartY = 0
        var hasMoved = false

        overlayView.setOnTouchListener { v, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    dragStartX = event.rawX
                    dragStartY = event.rawY
                    layoutStartX = layoutParams.x
                    layoutStartY = layoutParams.y
                    hasMoved = false
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = (event.rawX - dragStartX).toInt()
                    val dy = (event.rawY - dragStartY).toInt()
                    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) hasMoved = true
                    layoutParams.x = (layoutStartX + dx).coerceIn(0, displayWidth - avatarSizePx)
                    layoutParams.y = (layoutStartY + dy).coerceIn(60, displayHeight - avatarSizePx - 60)
                    try { windowManager.updateViewLayout(overlayView, layoutParams) } catch (_: Exception) {}
                    true
                }
                MotionEvent.ACTION_UP -> {
                    if (!hasMoved) {
                        // Tap — toggle focusable so WebView can receive touch events for mic button
                        toggleFocusable(expand = true)
                        overlayWebView.evaluateJavascript("window.__anyaOverlayTap?.();", null)
                    } else {
                        // Drag end — snap to nearest edge
                        val mid = displayWidth / 2
                        layoutParams.x = if (layoutParams.x + avatarSizePx / 2 < mid) 12 else displayWidth - avatarSizePx - 12
                        try { windowManager.updateViewLayout(overlayView, layoutParams) } catch (_: Exception) {}
                        // Save position
                        prefs.edit()
                            .putInt("avatar_x", layoutParams.x)
                            .putInt("avatar_y", layoutParams.y)
                            .apply()
                    }
                    true
                }
                else -> false
            }
        }

        windowManager.addView(overlayView, layoutParams)
    }

    // ── WebView Setup ─────────────────────────────────────────────────────────

    private fun buildOverlayWebView(): WebView {
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        val wv = WebView(this)

        wv.webViewClient = object : WebViewClientCompat() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest) =
                assetLoader.shouldInterceptRequest(request.url)
            override fun shouldInterceptRequest(view: WebView, url: String) =
                assetLoader.shouldInterceptRequest(Uri.parse(url))
        }

        wv.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                request.grant(request.resources)
            }
        }

        wv.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = true
            allowContentAccess = true
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            }
        }

        // Inject JS bridge so overlay web UI can call native
        val bridge = AnyaJsBridge(this, this@AnyaOverlayService)
        wv.addJavascriptInterface(bridge, "AnyaBridge")

        // Load the overlay-specific page (index.html with ?overlayMode=1)
        wv.loadUrl("https://appassets.androidplatform.net/assets/index.html?overlayMode=1")

        return wv
    }

    // ── Window State Helpers ──────────────────────────────────────────────────

    /**
     * Toggle between compact avatar mode (FLAG_NOT_FOCUSABLE — passthrough touches)
     * and expanded panel mode (focusable — WebView handles its own touch events).
     */
    fun toggleFocusable(expand: Boolean) {
        if (expand) {
            // Remove FLAG_NOT_FOCUSABLE so the panel WebView receives touch/keyboard
            layoutParams.flags = layoutParams.flags and WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE.inv()
            val density = resources.displayMetrics.density
            layoutParams.width = (320 * density).toInt()
            layoutParams.height = WindowManager.LayoutParams.WRAP_CONTENT
        } else {
            layoutParams.flags = layoutParams.flags or WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
            val avatarSizePx = (AVATAR_DP * resources.displayMetrics.density).toInt()
            layoutParams.width = avatarSizePx
            layoutParams.height = avatarSizePx
        }
        try { windowManager.updateViewLayout(overlayView, layoutParams) } catch (_: Exception) {}
    }

    /** Collapse expanded panel back to small avatar */
    fun minimizeToAvatar() {
        toggleFocusable(expand = false)
        overlayWebView.evaluateJavascript("window.__anyaOverlayCollapse?.();", null)
    }
}
