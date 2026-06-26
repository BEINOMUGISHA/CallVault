package com.callvault.receivers

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.content.ContextCompat
import com.callvault.services.CallRecordingService

class BootReceiver : BroadcastReceiver() {
    private val TAG = "BootReceiver"

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        Log.d(TAG, "BootReceiver received action: $action")

        if (action == Intent.ACTION_BOOT_COMPLETED || 
            action == "android.intent.action.BOOT_COMPLETED" ||
            action == "android.intent.action.QUICKBOOT_POWERON" ||
            action == "com.htc.intent.action.QUICKBOOT_POWERON" ||
            action == "android.intent.action.REBOOT") {
            // Read settings from Shared Preferences
            val prefs = context.getSharedPreferences("CallVaultSettings", Context.MODE_PRIVATE)
            val autoRecord = prefs.getBoolean("autoRecord", true)
            val recordIncoming = prefs.getBoolean("recordIncoming", true)
            val recordOutgoing = prefs.getBoolean("recordOutgoing", true)

            if (autoRecord) {
                Log.d(TAG, "Auto-record is enabled. Restarting Foreground Service after reboot.")
                val serviceIntent = Intent(context, CallRecordingService::class.java).apply {
                    this.action = "START_SERVICE"
                    putExtra("autoRecord", autoRecord)
                    putExtra("recordIncoming", recordIncoming)
                    putExtra("recordOutgoing", recordOutgoing)
                }
                try {
                    ContextCompat.startForegroundService(context, serviceIntent)
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to start service on boot: ${e.message}", e)
                }
            } else {
                Log.d(TAG, "Auto-record is disabled. Service will not be started.")
            }
        }
    }
}
