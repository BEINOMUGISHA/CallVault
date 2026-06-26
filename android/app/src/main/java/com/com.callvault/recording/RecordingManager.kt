package com.callvault.recording

import android.content.Context
import android.media.MediaRecorder
import android.os.Build
import android.util.Log
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class RecordingManager(private val context: Context) {
    private val TAG = "RecordingManager"
    private var mediaRecorder: MediaRecorder? = null
    var isRecording = false
        private set

    var currentFilePath: String? = null
        private set

    var currentStartTime: Long = 0
        private set

    /**
     * Starts call recording for the specified phone number.
     * Records audio via MediaRecorder.AudioSource.MIC.
     * Returns the absolute path of the generated recording file.
     */
    fun startRecording(phoneNumber: String): String? {
        if (isRecording) {
            Log.w(TAG, "Already recording. Stopping active recording first.")
            stopRecording()
        }

        val directory = getStorageDir()
        if (directory == null) {
            Log.e(TAG, "Failed to create storage directory.")
            return null
        }

        // Generate filename: YYYY-MM-DD_HH-mm-ss.mp3
        val timestamp = SimpleDateFormat("yyyy-MM-dd_HH-mm-ss", Locale.getDefault()).format(Date())
        val fileName = "${timestamp}.mp3"
        val file = File(directory, fileName)
        currentFilePath = file.absolutePath
        currentStartTime = System.currentTimeMillis()

        Log.d(TAG, "Starting call recording to: $currentFilePath")

        try {
            mediaRecorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(context)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }.apply {
                // Use VOICE_RECOGNITION source to record both sides of call on modern Android
                setAudioSource(MediaRecorder.AudioSource.VOICE_RECOGNITION)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setAudioSamplingRate(44100)
                setAudioEncodingBitRate(128000)
                setOutputFile(file.absolutePath)
                prepare()
                start()
            }
            isRecording = true
            return currentFilePath
        } catch (e: Exception) {
            Log.e(TAG, "Error starting MediaRecorder: ${e.message}", e)
            mediaRecorder?.reset()
            mediaRecorder?.release()
            mediaRecorder = null
            isRecording = false
            currentFilePath = null
            return null
        }
    }

    /**
     * Stops the active call recording.
     * Returns a RecordingResult object containing file details or null on failure.
     */
    fun stopRecording(): RecordingResult? {
        if (!isRecording || mediaRecorder == null) {
            Log.w(TAG, "stopRecording called but not recording.")
            return null
        }

        val endTime = System.currentTimeMillis()
        val durationMs = endTime - currentStartTime
        val durationSec = durationMs / 1000

        Log.d(TAG, "Stopping call recording. Duration: $durationSec seconds")

        try {
            mediaRecorder?.stop()
        } catch (e: RuntimeException) {
            Log.e(TAG, "RuntimeException stopping MediaRecorder (file might be empty or call too short)", e)
            deleteFile(currentFilePath)
            resetState()
            return null
        } finally {
            mediaRecorder?.release()
            mediaRecorder = null
        }

        val path = currentFilePath
        resetState()

        if (path != null) {
            val file = File(path)
            if (file.exists()) {
                val size = file.length()
                if (size > 0) {
                    return RecordingResult(path, durationSec, size, endTime)
                } else {
                    file.delete()
                }
            }
        }
        return null
    }

    private fun resetState() {
        isRecording = false
        currentFilePath = null
        currentStartTime = 0
    }

    private fun deleteFile(path: String?) {
        if (path != null) {
            val file = File(path)
            if (file.exists()) {
                file.delete()
            }
        }
    }

    /**
     * Creates nested directory structures CallVault/YYYY/MM
     * in the app's external files directory: Android/data/com.callvault/files/
     */
    private fun getStorageDir(): File? {
        val rootDir = context.getExternalFilesDir(null) ?: return null
        val year = SimpleDateFormat("yyyy", Locale.getDefault()).format(Date())
        val month = SimpleDateFormat("MM", Locale.getDefault()).format(Date())
        val path = "CallVault" + File.separator + year + File.separator + month
        val dir = File(rootDir, path)
        if (!dir.exists()) {
            val created = dir.mkdirs()
            if (!created) {
                Log.e(TAG, "Failed to create directory structure: ${dir.absolutePath}")
                return null
            }
        }
        return dir
    }
}

/**
 * Result data class returned after successfully completing a recording.
 */
data class RecordingResult(
    val filePath: String,
    val duration: Long, // seconds
    val fileSize: Long, // bytes
    val endTime: Long // epoch ms
)
