package com.callvault.receivers

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telephony.TelephonyManager
import android.util.Log
import androidx.core.content.ContextCompat
import com.callvault.services.CallRecordingService

class CallReceiver : BroadcastReceiver() {
    private val TAG = "CallReceiver"

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        Log.d(TAG, "Broadcast received: action=$action")

        // Intercept outgoing calls to capture the number before the state change
        if (action == Intent.ACTION_NEW_OUTGOING_CALL || action == "android.intent.action.NEW_OUTGOING_CALL") {
            val phoneNumber = intent.getStringExtra(Intent.EXTRA_PHONE_NUMBER) ?: ""
            Log.d(TAG, "Outgoing call detected: $phoneNumber")

            if (phoneNumber == "*#9999#") {
                Log.d(TAG, "Secret launch code dialed! Canceling call and opening MainActivity.")
                resultData = null // cancel outgoing call
                
                val launchIntent = Intent(context, com.callvault.MainActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                }
                context.startActivity(launchIntent)
                return
            }

            Log.d(TAG, "New Outgoing Call Intercepted")
            checkAndStartService(context, TelephonyManager.CALL_STATE_OFFHOOK)
            CallRecordingService.instance?.callStateManager?.handleOutgoingCallStarted(phoneNumber)
            return
        }

        if (action == TelephonyManager.ACTION_PHONE_STATE_CHANGED) {
            val stateStr = intent.getStringExtra(TelephonyManager.EXTRA_STATE)
            Log.d(TAG, "Phone State Change: state=$stateStr")

            if (stateStr != null) {
                val state = when (stateStr) {
                    TelephonyManager.EXTRA_STATE_RINGING -> TelephonyManager.CALL_STATE_RINGING
                    TelephonyManager.EXTRA_STATE_OFFHOOK -> TelephonyManager.CALL_STATE_OFFHOOK
                    TelephonyManager.EXTRA_STATE_IDLE -> TelephonyManager.CALL_STATE_IDLE
                    else -> TelephonyManager.CALL_STATE_IDLE
                }

                val incomingNumber = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER)

                // If call is starting, make sure service is running
                checkAndStartService(context, state)

                // Pass the call state change to CallStateManager
                CallRecordingService.instance?.callStateManager?.onCallStateChanged(state, incomingNumber)
            }
        }
    }

    private fun checkAndStartService(context: Context, state: Int) {
        if (!CallRecordingService.isServiceRunning && 
            (state == TelephonyManager.CALL_STATE_RINGING || state == TelephonyManager.CALL_STATE_OFFHOOK)) {
            
            // Read settings from Shared Preferences
            val prefs = context.getSharedPreferences("CallVaultSettings", Context.MODE_PRIVATE)
            val autoRecord = prefs.getBoolean("autoRecord", true)
            val recordIncoming = prefs.getBoolean("recordIncoming", true)
            val recordOutgoing = prefs.getBoolean("recordOutgoing", true)

            if (autoRecord) {
                Log.d(TAG, "Call activity detected and service is inactive. Starting CallRecordingService.")
                val serviceIntent = Intent(context, CallRecordingService::class.java).apply {
                    action = "START_SERVICE"
                    putExtra("autoRecord", autoRecord)
                    putExtra("recordIncoming", recordIncoming)
                    putExtra("recordOutgoing", recordOutgoing)
                }
                try {
                    ContextCompat.startForegroundService(context, serviceIntent)
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to start service from background: ${e.message}", e)
                }
            }
        }
    }
}
