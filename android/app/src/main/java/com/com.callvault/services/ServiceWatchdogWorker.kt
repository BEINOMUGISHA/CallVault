package com.callvault.services

import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.content.ContextCompat
import androidx.work.Worker
import androidx.work.WorkerParameters

/**
 * Self-healing WorkManager Watchdog.
 * Runs periodically in the background via Android's JobScheduler.
 * If the Foreground Service was killed by an aggressive OEM battery killer,
 * this watchdog verifies settings and revives the recording engine.
 */
class ServiceWatchdogWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    private val TAG = "ServiceWatchdogWorker"

    override fun doWork(): Result {
        try {
            val prefs = applicationContext.getSharedPreferences("CallVaultSettings", Context.MODE_PRIVATE)
            val autoRecord = prefs.getBoolean("autoRecord", true)
            val recordIncoming = prefs.getBoolean("recordIncoming", true)
            val recordOutgoing = prefs.getBoolean("recordOutgoing", true)

            if (autoRecord && !CallRecordingService.isServiceRunning) {
                Log.w(TAG, "Watchdog detected CallRecordingService is DOWN while autoRecord is ENABLED. Reviving service...")
                val intent = Intent(applicationContext, CallRecordingService::class.java).apply {
                    action = "START_SERVICE"
                    putExtra("autoRecord", autoRecord)
                    putExtra("recordIncoming", recordIncoming)
                    putExtra("recordOutgoing", recordOutgoing)
                }
                ContextCompat.startForegroundService(applicationContext, intent)
            } else {
                Log.d(TAG, "Watchdog check: service running=${CallRecordingService.isServiceRunning}, autoRecord=$autoRecord")
            }

            return Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "Watchdog error: ${e.message}", e)
            return Result.retry()
        }
    }
}
