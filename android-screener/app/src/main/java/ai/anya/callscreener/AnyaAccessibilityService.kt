package ai.anya.callscreener

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.os.Bundle
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.view.accessibility.AccessibilityWindowInfo

/**
 * ANYA ACCESSIBILITY SERVICE
 * ──────────────────────────────────────────────────────────────────────────────
 * This service runs in the background and gives ANYA the ability to:
 *   • Find UI elements (buttons, text fields, list items) in ANY open app
 *   • Type text into focused input fields
 *   • Click any UI element by text content
 *   • Perform global actions (back, home, recents, screenshot)
 *
 * WHY ACCESSIBILITY SERVICE?
 *   Android does not allow app-to-app UI control without root access EXCEPT
 *   through the official AccessibilityService API. This is how apps like
 *   Google Assistant, TalkBack, and Tasker automate other apps.
 *
 * KEY CAPABILITY: When ANYA gets a command like "send hello to papa in WhatsApp":
 *   1. AnyaJsBridge launches WhatsApp via Intent
 *   2. AnyaAccessibilityService waits for WhatsApp to appear
 *   3. It finds the search box → types "papa" → clicks first result
 *   4. It finds the message input → types "hello" → clicks send
 *   All within ~1 second of the command.
 *
 * PERMISSION REQUIRED:
 *   User must manually go to Settings > Accessibility > ANYA Neural AI > Enable
 *   We show a dialog guiding them there on first run.
 *
 * COMPANION: AnyaJsBridge delegates calls here via the static `instance`.
 */
class AnyaAccessibilityService : AccessibilityService() {

    companion object {
        /** Singleton reference — set on service connect, cleared on disconnect */
        @Volatile
        var instance: AnyaAccessibilityService? = null
            private set
    }

    // ── Lifecycle ──────────────────────────────────────────────────────────────

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this

        // Configure which events to receive
        val info = AccessibilityServiceInfo().apply {
            eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED or
                         AccessibilityEvent.TYPE_VIEW_FOCUSED or
                         AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED or
                         AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            flags = AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS or
                    AccessibilityServiceInfo.FLAG_REQUEST_ENHANCED_WEB_ACCESSIBILITY
            notificationTimeout = 100
        }
        serviceInfo = info
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // We react on-demand (via method calls from AnyaJsBridge), not via events.
        // Could add event-driven triggers here later (e.g., detect incoming call UI).
    }

    override fun onInterrupt() {
        // Service was interrupted
    }

    override fun onUnbind(intent: android.content.Intent?): Boolean {
        instance = null
        return super.onUnbind(intent)
    }

    // ── Public API (called by AnyaJsBridge) ────────────────────────────────────

    /**
     * Type text into the currently focused input field.
     * Uses ACTION_SET_TEXT for instant text setting (no character-by-character simulation).
     */
    fun typeText(text: String) {
        val focusedNode = findFocusedInputField()
        if (focusedNode != null) {
            val args = Bundle()
            args.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
            focusedNode.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
            focusedNode.recycle()
        } else {
            // Fallback: try to find any visible EditText and set text in it
            val root = rootInActiveWindow ?: return
            val editText = findFirstEditText(root)
            if (editText != null) {
                val args = Bundle()
                args.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
                editText.performAction(AccessibilityNodeInfo.ACTION_FOCUS)
                editText.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
                editText.recycle()
            }
            root.recycle()
        }
    }

    /**
     * Click the first UI element whose text or content description contains [text].
     * Useful for: clicking a contact name, tapping "Send", tapping a button label.
     */
    fun clickNodeWithText(text: String) {
        val root = rootInActiveWindow ?: return
        val node = findNodeByText(root, text)
        if (node != null) {
            node.performAction(AccessibilityNodeInfo.ACTION_CLICK)
            node.recycle()
        }
        root.recycle()
    }

    /**
     * Click the SEND button in the currently-open chat app.
     * Tries common send button text/descriptions across WhatsApp, Telegram, Messages etc.
     */
    fun clickSendButton() {
        val root = rootInActiveWindow ?: return
        val sendLabels = listOf("Send", "send", "SEND", "→", "➤", "Send message")
        for (label in sendLabels) {
            val node = findNodeByText(root, label)
            if (node != null) {
                node.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                node.recycle()
                break
            }
        }
        root.recycle()
    }

    /**
     * Simulate pressing the BACK button globally.
     */
    fun performGlobalBack() {
        performGlobalAction(GLOBAL_ACTION_BACK)
    }

    /**
     * Simulate pressing the HOME button globally.
     */
    fun performGlobalHome() {
        performGlobalAction(GLOBAL_ACTION_HOME)
    }

    /**
     * WhatsApp-specific: search for a contact by name.
     * 1. Tap the search icon in WhatsApp
     * 2. Type the contact name
     * 3. Click the first result
     */
    fun searchWhatsAppContact(name: String) {
        val root = rootInActiveWindow ?: return
        // Try to find and click the search icon/button
        val searchNode = findNodeByText(root, "Search") ?: findNodeByContentDesc(root, "Search")
        searchNode?.performAction(AccessibilityNodeInfo.ACTION_CLICK)
        searchNode?.recycle()
        root.recycle()

        // Post-delayed: type name after search field opens
        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
            typeText(name)
        }, 400)
    }

    /**
     * After typing a contact name in WhatsApp search, click the first result.
     */
    fun clickFirstSearchResult() {
        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
            val root = rootInActiveWindow ?: return@postDelayed
            // WhatsApp contact results are in a list — look for the first clickable item
            val firstResult = findFirstClickableListItem(root)
            firstResult?.performAction(AccessibilityNodeInfo.ACTION_CLICK)
            firstResult?.recycle()
            root.recycle()
        }, 600)
    }

    // ── Private Node Search Helpers ────────────────────────────────────────────

    private fun findFocusedInputField(): AccessibilityNodeInfo? {
        val root = rootInActiveWindow ?: return null
        return root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
    }

    private fun findFirstEditText(root: AccessibilityNodeInfo): AccessibilityNodeInfo? {
        if (root.className?.toString()?.contains("EditText") == true) return root
        for (i in 0 until root.childCount) {
            val child = root.getChild(i) ?: continue
            val found = findFirstEditText(child)
            if (found != null) return found
            child.recycle()
        }
        return null
    }

    private fun findNodeByText(root: AccessibilityNodeInfo, text: String): AccessibilityNodeInfo? {
        val results = root.findAccessibilityNodeInfosByText(text)
        return results?.firstOrNull { it.isClickable || it.isEnabled }
    }

    private fun findNodeByContentDesc(root: AccessibilityNodeInfo, desc: String): AccessibilityNodeInfo? {
        if (root.contentDescription?.toString()?.contains(desc, ignoreCase = true) == true && root.isClickable) {
            return root
        }
        for (i in 0 until root.childCount) {
            val child = root.getChild(i) ?: continue
            val found = findNodeByContentDesc(child, desc)
            if (found != null) return found
            child.recycle()
        }
        return null
    }

    private fun findFirstClickableListItem(root: AccessibilityNodeInfo): AccessibilityNodeInfo? {
        // Skip the search input itself, look for list items below it
        for (i in 0 until root.childCount) {
            val child = root.getChild(i) ?: continue
            val cls = child.className?.toString() ?: ""
            if (child.isClickable && (cls.contains("LinearLayout") || cls.contains("RelativeLayout") ||
                        cls.contains("ConstraintLayout") || cls.contains("View"))) {
                if (child.childCount > 0) return child
            }
            val found = findFirstClickableListItem(child)
            if (found != null) {
                child.recycle()
                return found
            }
            child.recycle()
        }
        return null
    }
}
