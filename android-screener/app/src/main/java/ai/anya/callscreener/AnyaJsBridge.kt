package ai.anya.callscreener

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.widget.Toast
import org.json.JSONObject

/**
 * ANYA JS BRIDGE — @JavascriptInterface bridge from WebView JS to Android native
 * ──────────────────────────────────────────────────────────────────────────────
 * Injected into the WebView as `window.AnyaBridge`.
 * JS can call any @JavascriptInterface method directly:
 *   window.AnyaBridge.launchApp("com.whatsapp")
 *   window.AnyaBridge.openWhatsApp("Papa", "Hello!")
 *   window.AnyaBridge.nativeCommand('{"action":"type","text":"Hello"}')
 *
 * All methods run on the JS thread. For UI updates, post to main thread.
 */
class AnyaJsBridge(
    private val context: Context,
    private val overlayService: AnyaOverlayService? = null
) {

    private val prefs: SharedPreferences =
        context.getSharedPreferences("anya_overlay_prefs", Context.MODE_PRIVATE)

    // ── 1. App Launching ───────────────────────────────────────────────────────

    @JavascriptInterface
    fun launchApp(packageName: String) {
        try {
            val intent = context.packageManager.getLaunchIntentForPackage(packageName)
                ?: throw ActivityNotFoundException("Package $packageName not found")
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        } catch (e: ActivityNotFoundException) {
            // Try Play Store fallback
            try {
                val storeIntent = Intent(Intent.ACTION_VIEW,
                    Uri.parse("market://details?id=$packageName")).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(storeIntent)
            } catch (e2: Exception) {
                showToast("App not installed: $packageName")
            }
        } catch (e: Exception) {
            showToast("Failed to open app")
        }
    }

    @JavascriptInterface
    fun openUrl(url: String) {
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            showToast("Could not open URL")
        }
    }

    // ── 2. WhatsApp Deep Link ─────────────────────────────────────────────────

    /**
     * Open WhatsApp and search for a contact, optionally pre-fill a message.
     * Uses the wa.me deep link which opens WhatsApp directly.
     * If message is non-empty, the chat compose window opens with it pre-filled.
     * The user or AccessibilityService then sends it.
     */
    @JavascriptInterface
    fun openWhatsApp(contact: String, message: String) {
        try {
            // Strategy 1: direct phone number if it looks like one
            val cleanContact = contact.replace(Regex("[^0-9+]"), "")
            if (cleanContact.length >= 7) {
                val encodedMsg = Uri.encode(message)
                val uri = Uri.parse("https://wa.me/$cleanContact?text=$encodedMsg")
                val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    setPackage("com.whatsapp") // force WhatsApp, not browser
                }
                context.startActivity(intent)
                return
            }

            // Strategy 2: search by name — open WhatsApp then accessibility does the rest
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                setPackage("com.whatsapp")
                putExtra(Intent.EXTRA_TEXT, message)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        } catch (e: ActivityNotFoundException) {
            showToast("WhatsApp is not installed")
        } catch (e: Exception) {
            // Fallback: just open WhatsApp main screen
            launchApp("com.whatsapp")
        }
    }

    // ── 3. Phone & SMS ────────────────────────────────────────────────────────

    @JavascriptInterface
    fun makeCall(phoneNumber: String) {
        try {
            val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:${Uri.encode(phoneNumber)}")).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            showToast("Could not open dialer")
        }
    }

    @JavascriptInterface
    fun sendSms(phoneNumber: String, body: String) {
        try {
            val intent = Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:${Uri.encode(phoneNumber)}")).apply {
                putExtra("sms_body", body)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            showToast("Could not open SMS")
        }
    }

    // ── 4. Accessibility actions (delegated to AnyaAccessibilityService) ──────

    @JavascriptInterface
    fun typeInApp(text: String) {
        AnyaAccessibilityService.instance?.typeText(text)
            ?: showToast("Accessibility not enabled")
    }

    @JavascriptInterface
    fun clickElement(text: String) {
        AnyaAccessibilityService.instance?.clickNodeWithText(text)
            ?: showToast("Accessibility not enabled")
    }

    @JavascriptInterface
    fun pressBack() {
        AnyaAccessibilityService.instance?.performGlobalBack()
    }

    @JavascriptInterface
    fun pressHome() {
        AnyaAccessibilityService.instance?.performGlobalHome()
    }

    @JavascriptInterface
    fun takeScreenshot() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            AnyaAccessibilityService.instance?.performGlobalAction(
                android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_TAKE_SCREENSHOT
            )
        }
    }

    @JavascriptInterface
    fun scrollDown() {
        AnyaAccessibilityService.instance?.performGlobalAction(
            android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_ACCESSIBILITY_ALL_APPS
        )
    }

    // ── 5. Unified command router ─────────────────────────────────────────────

    /**
     * Central JSON-based command router.
     * JS calls: window.AnyaBridge.nativeCommand('{"action":"openApp","app":"com.whatsapp"}')
     * Supported actions: openApp, openUrl, openWhatsApp, makeCall, sendSms, typeInApp,
     *                    clickElement, pressBack, pressHome, screenshot, minimizeOverlay, closeOverlay
     */
    @JavascriptInterface
    fun nativeCommand(json: String) {
        try {
            val obj = JSONObject(json)
            when (val action = obj.optString("action")) {
                "openApp"        -> launchApp(obj.optString("packageName", ""))
                "openUrl"        -> openUrl(obj.optString("url", ""))
                "openWhatsApp"   -> openWhatsApp(obj.optString("contact", ""), obj.optString("message", ""))
                "makeCall"       -> makeCall(obj.optString("phone", ""))
                "sendSms"        -> sendSms(obj.optString("phone", ""), obj.optString("body", ""))
                "typeInApp"      -> typeInApp(obj.optString("text", ""))
                "clickElement"   -> clickElement(obj.optString("text", ""))
                "pressBack"      -> pressBack()
                "pressHome"      -> pressHome()
                "screenshot"     -> takeScreenshot()
                "minimizeOverlay"-> overlayService?.minimizeToAvatar()
                "closeOverlay"   -> overlayService?.stopSelf()
                else             -> showToast("Unknown action: $action")
            }
        } catch (e: Exception) {
            showToast("Command parse error: ${e.message}")
        }
    }

    // ── 6. Permission helpers ─────────────────────────────────────────────────

    @JavascriptInterface
    fun hasOverlayPermission(): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) Settings.canDrawOverlays(context) else true

    @JavascriptInterface
    fun requestOverlayPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(context)) {
            val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:${context.packageName}")).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        }
    }

    @JavascriptInterface
    fun hasAccessibilityPermission(): Boolean =
        AnyaAccessibilityService.instance != null

    @JavascriptInterface
    fun requestAccessibilityPermission() {
        val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
        showToast("Enable 'ANYA Neural AI' in Accessibility Services")
    }

    // ── 7. Overlay position persistence ──────────────────────────────────────

    @JavascriptInterface
    fun saveDragPosition(x: Int, y: Int) {
        prefs.edit().putInt("avatar_x", x).putInt("avatar_y", y).apply()
    }

    @JavascriptInterface
    fun getSavedPositionX(): Int = prefs.getInt("avatar_x", -1)

    @JavascriptInterface
    fun getSavedPositionY(): Int = prefs.getInt("avatar_y", -1)

    // ── 8. Overlay window control ─────────────────────────────────────────────

    @JavascriptInterface
    fun minimizeOverlay() {
        overlayService?.minimizeToAvatar()
    }

    @JavascriptInterface
    fun closeOverlay() {
        overlayService?.stopSelf()
    }

    // ── Helper ─────────────────────────────────────────────────────────────────
    private fun showToast(msg: String) {
        android.os.Handler(android.os.Looper.getMainLooper()).post {
            Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
        }
    }
}
