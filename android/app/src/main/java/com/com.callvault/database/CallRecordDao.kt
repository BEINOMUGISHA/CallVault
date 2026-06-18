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
}
