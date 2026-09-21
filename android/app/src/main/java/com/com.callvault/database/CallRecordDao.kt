package com.callvault.database

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update

@Dao
interface CallRecordDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(record: CallRecordEntity): Long

    @Delete
    suspend fun delete(record: CallRecordEntity)

    @Query("DELETE FROM call_records WHERE id = :id")
    suspend fun deleteById(id: Long): Int

    @Query("SELECT * FROM call_records WHERE id = :id")
    suspend fun getById(id: Long): CallRecordEntity?

    @Query("SELECT * FROM call_records ORDER BY createdAt DESC")
    suspend fun getAll(): List<CallRecordEntity>

    @Query("SELECT * FROM call_records WHERE phoneNumber LIKE '%' || :query || '%' ORDER BY createdAt DESC")
    suspend fun search(query: String): List<CallRecordEntity>

    @Query("SELECT SUM(fileSize) FROM call_records")
    suspend fun getTotalStorageUsed(): Long?

    @Query("SELECT COUNT(*) FROM call_records")
    suspend fun getTotalRecordingsCount(): Int

    @Query("SELECT COUNT(*) FROM call_records WHERE createdAt >= :startTime")
    suspend fun getCallsCountSince(startTime: Long): Int

    // --- Cloud sync queries (added in v2) ---

    /** Returns all records that still need to be uploaded to cloud storage. */
    @Query("SELECT * FROM call_records WHERE syncStatus = 'local_only' OR syncStatus = 'pending' OR syncStatus = 'failed' ORDER BY createdAt DESC")
    suspend fun getPendingSync(): List<CallRecordEntity>

    /** Returns all records that have been successfully synced to cloud. */
    @Query("SELECT * FROM call_records WHERE syncStatus = 'synced' ORDER BY createdAt DESC")
    suspend fun getSyncedRecords(): List<CallRecordEntity>

    /** Updates cloud reference fields and marks local file path as purged. */
    @Query("UPDATE call_records SET cloudStorageId = :cloudStorageId, cloudRecordId = :cloudRecordId, syncStatus = :syncStatus, filePath = '' WHERE id = :id")
    suspend fun updateSyncStatus(id: Long, cloudStorageId: String, cloudRecordId: String, syncStatus: String)

    /** Marks a record as pending upload (e.g. just recorded, awaiting WiFi). */
    @Query("UPDATE call_records SET syncStatus = 'pending' WHERE id = :id")
    suspend fun markPending(id: Long)
}
