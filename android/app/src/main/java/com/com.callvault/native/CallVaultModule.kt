package com.callvault.native

import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.util.Log
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.callvault.database.AppDatabase
import com.callvault.database.CallRecordEntity
import com.callvault.services.CallRecordingService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.io.File
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

class CallVaultModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    private val TAG = "CallVaultModule"
    private val db = AppDatabase.getInstance(reactContext)
    private val coroutineScope = CoroutineScope(Dispatchers.IO)
    private var mediaPlayer: MediaPlayer? = null

    override fun getName(): String {
        return "CallVaultModule"
    }

    @ReactMethod
    fun startService(autoRecord: Boolean, recordIncoming: Boolean, recordOutgoing: Boolean, promise: Promise) {
        try {
            saveSettingsToPrefs(autoRecord, recordIncoming, recordOutgoing)
            
            val intent = Intent(reactApplicationContext, CallRecordingService::class.java).apply {
                action = "START_SERVICE"
                putExtra("autoRecord", autoRecord)
                putExtra("recordIncoming", recordIncoming)
                putExtra("recordOutgoing", recordOutgoing)
            }
            ContextCompat.startForegroundService(reactApplicationContext, intent)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error starting service: ${e.message}", e)
            promise.reject("START_SERVICE_FAILED", e.message, e)
        }
    }

    @ReactMethod
    fun stopService(promise: Promise) {
        try {
            val intent = Intent(reactApplicationContext, CallRecordingService::class.java).apply {
                action = "STOP_SERVICE"
            }
            reactApplicationContext.stopService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping service: ${e.message}", e)
            promise.reject("STOP_SERVICE_FAILED", e.message, e)
        }
    }

    @ReactMethod
    fun updateSettings(autoRecord: Boolean, recordIncoming: Boolean, recordOutgoing: Boolean, promise: Promise) {
        try {
            saveSettingsToPrefs(autoRecord, recordIncoming, recordOutgoing)
            
            // If service is running, update its active configuration
            if (CallRecordingService.isServiceRunning) {
                CallRecordingService.instance?.callStateManager?.updateSettings(autoRecord, recordIncoming, recordOutgoing)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error updating settings: ${e.message}", e)
            promise.reject("UPDATE_SETTINGS_FAILED", e.message, e)
        }
    }

    @ReactMethod
    fun isServiceRunning(promise: Promise) {
        promise.resolve(CallRecordingService.isServiceRunning)
    }

    @ReactMethod
    fun getSettings(promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences("CallVaultSettings", Context.MODE_PRIVATE)
            val map = Arguments.createMap().apply {
                putBoolean("autoRecord", prefs.getBoolean("autoRecord", true))
                putBoolean("recordIncoming", prefs.getBoolean("recordIncoming", true))
                putBoolean("recordOutgoing", prefs.getBoolean("recordOutgoing", true))
                putBoolean("appVisible", prefs.getBoolean("appVisible", true))
            }
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("GET_SETTINGS_FAILED", e.message, e)
        }
    }

    @ReactMethod
    fun setAppVisible(visible: Boolean, promise: Promise) {
        try {
            val context = reactApplicationContext
            val packageManager = context.packageManager
            val componentName = android.content.ComponentName(context, "com.callvault.MainActivityAlias")
            val state = if (visible) {
                android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_ENABLED
            } else {
                android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_DISABLED
            }
            packageManager.setComponentEnabledSetting(
                componentName,
                state,
                android.content.pm.PackageManager.DONT_KILL_APP
            )
            // Save state to Shared Preferences so we can query it
            val prefs = context.getSharedPreferences("CallVaultSettings", Context.MODE_PRIVATE)
            prefs.edit().putBoolean("appVisible", visible).apply()
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error setting app visibility: ${e.message}", e)
            promise.reject("SET_VISIBLE_FAILED", e.message, e)
        }
    }

    @ReactMethod
    fun isAppVisible(promise: Promise) {
        try {
            val context = reactApplicationContext
            val prefs = context.getSharedPreferences("CallVaultSettings", Context.MODE_PRIVATE)
            promise.resolve(prefs.getBoolean("appVisible", true))
        } catch (e: Exception) {
            promise.reject("IS_VISIBLE_FAILED", e.message, e)
        }
    }

    @ReactMethod
    fun getCallRecords(promise: Promise) {
        coroutineScope.launch {
            try {
                val records = db.callRecordDao().getAll()
                promise.resolve(mapRecordsToWritableArray(records))
            } catch (e: Exception) {
                promise.reject("GET_RECORDS_FAILED", e.message, e)
            }
        }
    }

    @ReactMethod
    fun searchCallRecords(query: String, promise: Promise) {
        coroutineScope.launch {
            try {
                val records = db.callRecordDao().search(query)
                promise.resolve(mapRecordsToWritableArray(records))
            } catch (e: Exception) {
                promise.reject("SEARCH_RECORDS_FAILED", e.message, e)
            }
        }
    }

    @ReactMethod
    fun deleteCallRecord(id: Double, promise: Promise) {
        coroutineScope.launch {
            try {
                val recordId = id.toLong()
                val record = db.callRecordDao().getById(recordId)
                if (record != null) {
                    // 1. Delete the physical file
                    if (record.filePath.isNotEmpty()) {
                        val file = File(record.filePath)
                        if (file.exists()) {
                            val deleted = file.delete()
                            Log.d(TAG, "Physical file deleted: $deleted for path: ${record.filePath}")
                        }
                    }
                    // 2. Delete database entry
                    db.callRecordDao().delete(record)
                    promise.resolve(true)
                } else {
                    promise.reject("RECORD_NOT_FOUND", "Record with id $id not found in database.")
                }
            } catch (e: Exception) {
                promise.reject("DELETE_RECORD_FAILED", e.message, e)
            }
        }
    }

    @ReactMethod
    fun renameCallRecord(id: Double, newName: String, promise: Promise) {
        coroutineScope.launch {
            try {
                val recordId = id.toLong()
                val record = db.callRecordDao().getById(recordId)
                if (record != null) {
                    val oldFile = File(record.filePath)
                    if (oldFile.exists()) {
                        val parentDir = oldFile.parentFile
                        val extension = oldFile.extension
                        var cleanName = newName.replace(Regex("[^a-zA-Z0-9_-]"), "").ifEmpty { "renamed_call" }
                        val newFileName = "$cleanName.$extension"
                        val newFile = File(parentDir, newFileName)

                        if (oldFile.renameTo(newFile)) {
                            val updatedRecord = record.copy(filePath = newFile.absolutePath)
                            db.callRecordDao().insert(updatedRecord)
                            promise.resolve(true)
                        } else {
                            promise.reject("RENAME_FAILED", "Failed to rename file in file system.")
                        }
                    } else {
                        promise.reject("FILE_NOT_FOUND", "Associated physical file does not exist.")
                    }
                } else {
                    promise.reject("RECORD_NOT_FOUND", "Record with id $id not found.")
                }
            } catch (e: Exception) {
                promise.reject("RENAME_RECORD_FAILED", e.message, e)
            }
        }
    }

    @ReactMethod
    fun getStorageUsage(promise: Promise) {
        coroutineScope.launch {
            try {
                val totalBytes = db.callRecordDao().getTotalStorageUsed() ?: 0L
                val totalCount = db.callRecordDao().getTotalRecordingsCount()
                val map = Arguments.createMap().apply {
                    putDouble("totalBytes", totalBytes.toDouble())
                    putInt("totalCount", totalCount)
                }
                promise.resolve(map)
            } catch (e: Exception) {
                promise.reject("GET_STORAGE_USAGE_FAILED", e.message, e)
            }
        }
    }

    @ReactMethod
    fun getTodayCallsCount(promise: Promise) {
        coroutineScope.launch {
            try {
                val calendar = Calendar.getInstance().apply {
                    set(Calendar.HOUR_OF_DAY, 0)
                    set(Calendar.MINUTE, 0)
                    set(Calendar.SECOND, 0)
                    set(Calendar.MILLISECOND, 0)
                }
                val todayStart = calendar.timeInMillis
                val count = db.callRecordDao().getCallsCountSince(todayStart)
                promise.resolve(count)
            } catch (e: Exception) {
                promise.reject("GET_TODAY_CALLS_FAILED", e.message, e)
            }
        }
    }

    private fun saveSettingsToPrefs(autoRecord: Boolean, recordIncoming: Boolean, recordOutgoing: Boolean) {
        val prefs = reactApplicationContext.getSharedPreferences("CallVaultSettings", Context.MODE_PRIVATE)
        prefs.edit().apply {
            putBoolean("autoRecord", autoRecord)
            putBoolean("recordIncoming", recordIncoming)
            putBoolean("recordOutgoing", recordOutgoing)
            apply()
        }
    }

    private fun mapRecordsToWritableArray(records: List<CallRecordEntity>): WritableArray {
        val array = Arguments.createArray()
        for (record in records) {
            val map = Arguments.createMap().apply {
                putDouble("id", record.id.toDouble())
                putString("phoneNumber", record.phoneNumber)
                putString("filePath", record.filePath)
                putDouble("startTime", record.startTime.toDouble())
                putDouble("endTime", record.endTime.toDouble())
                putDouble("duration", record.duration.toDouble())
                putString("callType", record.callType)
                putDouble("fileSize", record.fileSize.toDouble())
                putDouble("createdAt", record.createdAt.toDouble())
            }
            array.pushMap(map)
        }
        return array
    }

    @ReactMethod
    fun playAudio(filePath: String, promise: Promise) {
        try {
            stopAudioInternal()
            mediaPlayer = MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .build()
                )
                setDataSource(filePath)
                prepare()
                start()
            }
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error playing audio: ${e.message}", e)
            promise.reject("PLAY_FAILED", e.message, e)
        }
    }

    @ReactMethod
    fun pauseAudio(promise: Promise) {
        try {
            mediaPlayer?.let {
                if (it.isPlaying) {
                    it.pause()
                }
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("PAUSE_FAILED", e.message, e)
        }
    }

    @ReactMethod
    fun resumeAudio(promise: Promise) {
        try {
            mediaPlayer?.let {
                if (!it.isPlaying) {
                    it.start()
                }
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("RESUME_FAILED", e.message, e)
        }
    }

    @ReactMethod
    fun stopAudio(promise: Promise) {
        try {
            stopAudioInternal()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STOP_FAILED", e.message, e)
        }
    }

    private fun stopAudioInternal() {
        mediaPlayer?.let {
            try {
                if (it.isPlaying) {
                    it.stop()
                }
            } catch (e: Exception) {
                // Ignore if not initialized
            }
            it.release()
        }
        mediaPlayer = null
    }

    @ReactMethod
    fun seekAudio(positionMs: Double, promise: Promise) {
        try {
            mediaPlayer?.let {
                it.seekTo(positionMs.toInt())
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SEEK_FAILED", e.message, e)
        }
    }

    @ReactMethod
    fun getAudioPlaybackState(promise: Promise) {
        try {
            val map = Arguments.createMap()
            mediaPlayer?.let {
                map.putBoolean("isPlaying", it.isPlaying)
                map.putInt("currentPosition", it.currentPosition)
                map.putInt("duration", it.duration)
            } ?: run {
                map.putBoolean("isPlaying", false)
                map.putInt("currentPosition", 0)
                map.putInt("duration", 0)
            }
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("PLAYBACK_STATE_FAILED", e.message, e)
        }
    }

    @ReactMethod
    fun shareCallRecord(id: Double, promise: Promise) {
        coroutineScope.launch {
            try {
                val recordId = id.toLong()
                val record = db.callRecordDao().getById(recordId)
                if (record != null) {
                    val file = File(record.filePath)
                    if (file.exists()) {
                        val context = reactApplicationContext
                        val uri = FileProvider.getUriForFile(
                            context,
                            "${context.packageName}.fileprovider",
                            file
                        )
                        val intent = Intent(Intent.ACTION_SEND).apply {
                            type = "audio/*"
                            putExtra(Intent.EXTRA_STREAM, uri)
                            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        }
                        val chooser = Intent.createChooser(intent, "Share Call Recording").apply {
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        }
                        context.startActivity(chooser)
                        promise.resolve(true)
                    } else {
                        promise.reject("FILE_NOT_FOUND", "Associated physical file does not exist.")
                    }
                } else {
                    promise.reject("RECORD_NOT_FOUND", "Record not found.")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error sharing call record: ${e.message}", e)
                promise.reject("SHARE_FAILED", e.message, e)
            }
        }
    }

    @ReactMethod
    fun isIgnoringBatteryOptimizations(promise: Promise) {
        try {
            val pm = reactApplicationContext.getSystemService(Context.POWER_SERVICE) as PowerManager
            val packageName = reactApplicationContext.packageName
            val ignoring = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                pm.isIgnoringBatteryOptimizations(packageName)
            } else {
                true
            }
            promise.resolve(ignoring)
        } catch (e: Exception) {
            promise.reject("BATTERY_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun requestIgnoreBatteryOptimizations(promise: Promise) {
        try {
            val packageName = reactApplicationContext.packageName
            val intent = Intent(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:$packageName")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("BATTERY_REQUEST_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun openAutoStartSettings(promise: Promise) {
        try {
            val context = reactApplicationContext
            val manufacturer = android.os.Build.MANUFACTURER.lowercase()
            val intent = Intent()
            val packageName = context.packageName

            when (manufacturer) {
                "xiaomi" -> intent.component = android.content.ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity")
                "oppo" -> intent.component = android.content.ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity")
                "vivo" -> intent.component = android.content.ComponentName("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity")
                "huawei", "honor" -> intent.component = android.content.ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity")
                else -> {
                    intent.action = android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS
                    intent.data = Uri.parse("package:$packageName")
                }
            }

            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

            // Resolve activity before launching
            val pm = context.packageManager
            if (intent.resolveActivity(pm) != null) {
                context.startActivity(intent)
                promise.resolve(true)
            } else {
                // Fallback to generic details page
                val fallbackIntent = Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.parse("package:$packageName")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(fallbackIntent)
                promise.resolve(true)
            }
        } catch (e: Exception) {
            promise.reject("AUTO_START_ERROR", e.message, e)
        }
    }
}
