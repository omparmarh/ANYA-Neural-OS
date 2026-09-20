package ai.anya.callscreener

import android.app.role.RoleManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val urlInput = findViewById<EditText>(R.id.serverUrlInput)
        val saveBtn = findViewById<Button>(R.id.btnSaveServer)
        val requestRoleBtn = findViewById<Button>(R.id.btnRequestRole)

        // Default to live ANYA backend
        urlInput.setText("https://anya-telephony-backend.onrender.com")

        saveBtn.setOnClickListener {
            val prefs = getSharedPreferences("ANYA_PREFS", Context.MODE_PRIVATE)
            prefs.edit().putString("SERVER_URL", urlInput.text.toString()).apply()
            Toast.makeText(this, "ANYA Backend URL Saved!", Toast.LENGTH_SHORT).show()
        }

        requestRoleBtn.setOnClickListener {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val roleManager = getSystemService(RoleManager::class.java)
                if (roleManager != null && roleManager.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING)) {
                    val intent = roleManager.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING)
                    startActivityForResult(intent, 1001)
                }
            } else {
                Toast.makeText(this, "Call screening active automatically on Android 9 and below", Toast.LENGTH_LONG).show()
            }
        }
    }
}
