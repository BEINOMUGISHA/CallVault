package com.callvault.database

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Entity representing a call record stored in the database.
 */
@Entity(tableName = "call_records")
data class CallRecordEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val phoneNumber: String,
    val filePath: String,
    val startTime: Long,
    val endTime: Long,
    val duration: Long, // in seconds
    val callType: String, // INCOMING, OUTGOING, MISSED
    val fileSize: Long, // in bytes
    val createdAt: Long = System.currentTimeMillis()
)
