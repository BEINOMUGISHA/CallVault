package com.callvault.recording

import android.content.Context
import android.telephony.TelephonyManager
import android.util.Log
import com.callvault.database.AppDatabase
import com.callvault.database.CallRecordEntity
import com.callvault.services.CallRecordingService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class CallStateManager(private val context: Context) {
    private val TAG = "CallStateManager"
    private val recordingManager = RecordingManager(context)
    private val db = AppDatabase.getInstance(context)
    private val coroutineScope = CoroutineScope(Dispatchers.IO)

    // Call state variables
    private var isIncomingCall = false
    private var lastCallState = TelephonyManager.CALL_STATE_IDLE
    private var callActive = false
    private var callStartTime: Long = 0
    private var phoneNumber: String = "Unknown"
    private var isAutoRecordEnabled = true
    private var recordIncoming = true
    private var recordOutgoing = true

    /**
     * Update settings from React Native side
     */
    fun updateSettings(autoRecord: Boolean, incoming: Boolean, outgoing: Boolean) {
        this.isAutoRecordEnabled = autoRecord
        this.recordIncoming = incoming
        this.recordOutgoing = outgoing
        Log.d(TAG, "Settings updated: autoRecord=$autoRecord, incoming=$incoming, outgoing=$outgoing")
    }

    /**
     * Invoked when CallReceiver detects a new outgoing call.
     */
    fun handleOutgoingCallStarted(number: String) {
        phoneNumber = "Anonymous"
        isIncomingCall = false
        Log.d(TAG, "Outgoing call detected (Anonymous)")
    }

    /**
     * Process phone state changes from incoming intents or listeners.
     */
    fun onCallStateChanged(state: Int, number: String?) {
        Log.d(TAG, "onCallStateChanged: state=$state")
        phoneNumber = "Anonymous"

        if (state == lastCallState) {
            return
        }

        when (state) {
            TelephonyManager.CALL_STATE_RINGING -> {
                // Incoming call is ringing
                isIncomingCall = true
                phoneNumber = "Anonymous"
                callStartTime = System.currentTimeMillis()
                Log.d(TAG, "Ringing... Incoming call detected (Anonymous)")
            }

            TelephonyManager.CALL_STATE_OFFHOOK -> {
                // Call answered (either incoming answered, or outgoing dialing)
                Log.d(TAG, "Call Offhook. Incoming: $isIncomingCall")
                
                // If it was idle and becomes offhook without ringing, it's outgoing
                if (lastCallState == TelephonyManager.CALL_STATE_IDLE) {
                    isIncomingCall = false
                    callStartTime = System.currentTimeMillis()
                }

                val shouldRecord = isAutoRecordEnabled && (
                    (isIncomingCall && recordIncoming) || (!isIncomingCall && recordOutgoing)
                )

                if (shouldRecord) {
                    val filePath = recordingManager.startRecording(phoneNumber)
                    if (filePath != null) {
                        callActive = true
                        CallRecordingService.instance?.updateForegroundServiceType(true)
                        callStartTime = System.currentTimeMillis() // start recording time
                        Log.d(TAG, "Call recording started at: $filePath")
                    } else {
                        Log.e(TAG, "Failed to start recording.")
                    }
                } else {
                    Log.d(TAG, "Skipping call recording based on settings.")
                }
            }

            TelephonyManager.CALL_STATE_IDLE -> {
                // Call ended
                Log.d(TAG, "Call Idle. callActive: $callActive, wasIncoming: $isIncomingCall")

                if (callActive) {
                    val result = recordingManager.stopRecording()
                    if (result != null) {
                        saveRecord(
                            number = phoneNumber,
                            filePath = result.filePath,
                            startTime = callStartTime,
                            endTime = result.endTime,
                            duration = result.duration,
                            fileSize = result.fileSize,
                            type = if (isIncomingCall) "INCOMING" else "OUTGOING"
                        )
                    }
                    callActive = false
                    CallRecordingService.instance?.updateForegroundServiceType(false)
                } else if (lastCallState == TelephonyManager.CALL_STATE_RINGING) {
                    // Ringing then idle means missed call
                    Log.d(TAG, "Missed call detected (Anonymous)")
                    saveRecord(
                        number = phoneNumber,
                        filePath = "",
                        startTime = callStartTime,
                        endTime = System.currentTimeMillis(),
                        duration = 0,
                        fileSize = 0,
                        type = "MISSED"
                    )
                }

                // Reset state
                phoneNumber = "Anonymous"
                isIncomingCall = false
                callActive = false
            }
        }
        lastCallState = state
    }

    private fun saveRecord(
        number: String,
        filePath: String,
        startTime: Long,
        endTime: Long,
        duration: Long,
        fileSize: Long,
        type: String
    ) {
        coroutineScope.launch {
            try {
                val record = CallRecordEntity(
                    phoneNumber = number,
                    filePath = filePath,
                    startTime = startTime,
                    endTime = endTime,
                    duration = duration,
                    fileSize = fileSize,
                    callType = type
                )
                val id = db.callRecordDao().insert(record)
                Log.d(TAG, "Call record saved in database with ID: $id")
            } catch (e: Exception) {
                Log.e(TAG, "Error saving call record to database: ${e.message}", e)
            }
        }
    }

    fun isRecordingActive(): Boolean {
        return callActive
    }
}
