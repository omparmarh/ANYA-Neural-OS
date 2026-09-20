package ai.anya.callscreener

import android.os.Build
import android.telecom.Call
import android.telecom.CallScreeningService
import android.util.Log
import androidx.annotation.RequiresApi

@RequiresApi(Build.VERSION_CODES.N)
class AnyaCallScreeningService : CallScreeningService() {

    override fun onScreenCall(callDetails: Call.Details) {
        val phoneNumber = callDetails.handle?.schemeSpecificPart ?: "Unknown"
        Log.d("ANYA_SCREENER", "Incoming call detected on personal mobile: $phoneNumber")

        // Construct screening response:
        // We tell Android to allow the call to connect to ANYA's WebRTC audio bridge
        val response = CallResponse.Builder()
            .setDisallowCall(false) // Don't block, screen via ANYA
            .setRejectCall(false)
            .setSilenceCall(true)  // Silence standard ringtone while ANYA screens
            .setSkipCallLog(false)
            .setSkipNotification(false)
            .build()

        respondToCall(callDetails, response)
    }
}
