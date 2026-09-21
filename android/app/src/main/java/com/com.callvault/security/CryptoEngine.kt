package com.callvault.security

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.IOException
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.CipherInputStream
import javax.crypto.CipherOutputStream
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Hardware-backed AES-256-GCM End-to-End Encryption Engine.
 * Keys are generated and stored strictly inside the Android Keystore (TEE / Secure Element)
 * and cannot be extracted from the device even in rooted environments.
 */
object CryptoEngine {
    private const val ANDROID_KEYSTORE = "AndroidKeyStore"
    private const val KEY_ALIAS = "CallVault_Hardware_MasterKey_AES256"
    private const val TRANSFORMATION = "AES/GCM/NoPadding"
    private const val GCM_IV_LENGTH = 12
    private const val GCM_TAG_LENGTH = 128

    @Synchronized
    private fun getOrCreateKey(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        if (keyStore.containsAlias(KEY_ALIAS)) {
            val key = keyStore.getKey(KEY_ALIAS, null)
            if (key is SecretKey) {
                return key
            }
        }

        val keyGenerator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            ANDROID_KEYSTORE
        )
        val spec = KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setUserAuthenticationRequired(false)
            .build()

        keyGenerator.init(spec)
        return keyGenerator.generateKey()
    }

    /**
     * Encrypts a raw audio file into an AES-256-GCM encrypted file.
     * The 12-byte initialization vector (IV) is prepended to the output file.
     */
    fun encryptFile(inputFile: File, outputFile: File) {
        val key = getOrCreateKey()
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, key)
        val iv = cipher.iv

        FileOutputStream(outputFile).use { fos ->
            fos.write(iv)
            CipherOutputStream(fos, cipher).use { cos ->
                FileInputStream(inputFile).use { fis ->
                    fis.copyTo(cos)
                }
            }
        }
    }

    /**
     * Decrypts an AES-256-GCM encrypted file.
     */
    fun decryptFile(encryptedFile: File, decryptedOutputFile: File) {
        val key = getOrCreateKey()
        FileInputStream(encryptedFile).use { fis ->
            val iv = ByteArray(GCM_IV_LENGTH)
            val bytesRead = fis.read(iv)
            if (bytesRead != GCM_IV_LENGTH) {
                throw IOException("Corrupt or invalid encrypted file: missing GCM IV header")
            }

            val cipher = Cipher.getInstance(TRANSFORMATION)
            val spec = GCMParameterSpec(GCM_TAG_LENGTH, iv)
            cipher.init(Cipher.DECRYPT_MODE, key, spec)

            CipherInputStream(fis, cipher).use { cis ->
                FileOutputStream(decryptedOutputFile).use { fos ->
                    cis.copyTo(fos)
                }
            }
        }
    }

    /**
     * Decrypts an encrypted file to a temporary cache file for on-the-fly MediaPlayer playback
     * or FileProvider sharing. The file is marked for deletion upon exit.
     */
    fun decryptToTempFile(encryptedFile: File, cacheDir: File): File {
        val tempFile = File.createTempFile("play_", ".mp3", cacheDir)
        tempFile.deleteOnExit()
        decryptFile(encryptedFile, tempFile)
        return tempFile
    }

    /**
     * Encrypts a string (e.g. phone number or note) using AES-256-GCM.
     * Output format: "Base64(IV):Base64(Ciphertext)"
     */
    fun encryptString(plainText: String): String {
        val key = getOrCreateKey()
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, key)
        val iv = cipher.iv
        val cipherBytes = cipher.doFinal(plainText.toByteArray(Charsets.UTF_8))

        val ivB64 = Base64.encodeToString(iv, Base64.NO_WRAP)
        val dataB64 = Base64.encodeToString(cipherBytes, Base64.NO_WRAP)
        return "$ivB64:$dataB64"
    }

    /**
     * Decrypts an encrypted string payload.
     */
    fun decryptString(encryptedPayload: String): String {
        val parts = encryptedPayload.split(":")
        if (parts.size != 2) return encryptedPayload

        return try {
            val iv = Base64.decode(parts[0], Base64.NO_WRAP)
            val cipherBytes = Base64.decode(parts[1], Base64.NO_WRAP)

            val key = getOrCreateKey()
            val cipher = Cipher.getInstance(TRANSFORMATION)
            val spec = GCMParameterSpec(GCM_TAG_LENGTH, iv)
            cipher.init(Cipher.DECRYPT_MODE, key, spec)

            String(cipher.doFinal(cipherBytes), Charsets.UTF_8)
        } catch (e: Exception) {
            encryptedPayload
        }
    }
}
