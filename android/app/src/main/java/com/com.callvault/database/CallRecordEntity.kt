package com.callvault.database

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Entity representing a call record stored in the local Room database.
 * v2: Added cloud sync fields (cloudStorageId, cloudRecordId, syncStatus)
 *     so local files can be purged after upload while retaining cloud references.
 */
@Entity(tableName = "call_records")
data class CallRecordEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val phoneNumber: String,
    val filePath: String,            // Empty string once purged from device
    val startTime: Long,
    val endTime: Long,
    val duration: Long,              // in seconds
    val callType: String,            // INCOMING, OUTGOING, MISSED
    val fileSize: Long,              // in bytes
    val createdAt: Long = System.currentTimeMillis(),
    // --- Cloud sync fields (added in v2) ---
    val cloudStorageId: String = "", // Supabase Storage path e.g. "userId/1234567890.mp3"
    val cloudRecordId: String = "",  // UUID row id in callvault_records table
    val syncStatus: String = "local_only" // local_only | pending | synced | failed
)
