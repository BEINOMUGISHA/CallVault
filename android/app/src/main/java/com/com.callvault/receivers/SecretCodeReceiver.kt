package com.callvault.receivers

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.callvault.MainActivity

class SecretCodeReceiver : BroadcastReceiver() {
    private val TAG = "SecretCodeReceiver"

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        Log.d(TAG, "SecretCodeReceiver onReceive: action=$action")

        if (action == "android.provider.Telephony.SECRET_CODE") {
            Log.d(TAG, "Secret code dialed! Launching CallVault MainActivity.")
            
            val launchIntent = Intent(context, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            context.startActivity(launchIntent)
        }
    }
}
