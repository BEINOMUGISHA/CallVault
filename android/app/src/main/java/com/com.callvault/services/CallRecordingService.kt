package com.callvault.services

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import com.callvault.MainActivity
import com.callvault.recording.CallStateManager

class CallRecordingService : Service() {
    private val TAG = "CallRecordingService"
    private val CHANNEL_ID = "callvault_service_channel"
    private val NOTIFICATION_ID = 1001
    
    private var wakeLock: PowerManager.WakeLock? = null
    var callStateManager: CallStateManager? = null
        private set

    companion object {
        @Volatile
        var isServiceRunning = false
            private set

        @Volatile
        var instance: CallRecordingService? = null
            private set
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
        isServiceRunning = true
        callStateManager = CallStateManager(this)
        
        // Acquire Wakelock to prevent CPU from sleeping during recording
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "CallVault::RecordingWakeLock").apply {
            acquire(10 * 60 * 1000L) // limit max 10 minutes per acquire just in case, but usually we handle release manually
        }
        
        createNotificationChannel()
        Log.d(TAG, "Foreground Service created.")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "onStartCommand received action: ${intent?.action}")
        
        // Setup Foreground Notification
        val notification = createNotification()
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        intent?.let {
            when (it.action) {
                "START_SERVICE" -> {
                    // Start or update settings
                    val autoRecord = it.getBooleanExtra("autoRecord", true)
                    val recordIncoming = it.getBooleanExtra("recordIncoming", true)
                    val recordOutgoing = it.getBooleanExtra("recordOutgoing", true)
                    callStateManager?.updateSettings(autoRecord, recordIncoming, recordOutgoing)
                }
                "UPDATE_SETTINGS" -> {
                    val autoRecord = it.getBooleanExtra("autoRecord", true)
                    val recordIncoming = it.getBooleanExtra("recordIncoming", true)
                    val recordOutgoing = it.getBooleanExtra("recordOutgoing", true)
                    callStateManager?.updateSettings(autoRecord, recordIncoming, recordOutgoing)
                }
                "STOP_SERVICE" -> {
                    stopForeground(true)
                    stopSelf()
                }
            }
        }

        // START_STICKY ensures service restarts if killed by system
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        isServiceRunning = false
        instance = null
        
        if (wakeLock?.isHeld == true) {
            wakeLock?.release()
        }
        
        Log.d(TAG, "Foreground Service destroyed.")
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "CallVault Call Recording Service"
            val descriptionText = "Monitors and records call sessions automatically."
            val importance = NotificationManager.IMPORTANCE_MIN
            val channel = NotificationChannel(CHANNEL_ID, name, importance).apply {
                description = descriptionText
            }
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(): Notification {
        val notificationIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            notificationIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("CallVault Active")
            .setContentText("Call recording service is running in background")
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setOngoing(true)
            .build()
    }
}
