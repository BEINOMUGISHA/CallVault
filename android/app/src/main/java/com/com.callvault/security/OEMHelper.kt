package com.callvault.security

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.util.Log

/**
 * Handles OEM-specific battery killer defenses (Xiaomi, Samsung, Huawei, Oppo, Vivo, OnePlus)
 * and requests Android Doze mode whitelist exemptions.
 */
object OEMHelper {
    private const val TAG = "OEMHelper"

    /**
     * Checks if the app is already whitelisted from Android Doze mode / battery optimization.
     */
    fun isBatteryOptimizationIgnored(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
            pm?.isIgnoringBatteryOptimizations(context.packageName) ?: false
        } else {
            true
        }
    }

    /**
     * Requests the user to whitelist the app from Android Battery Optimization (Doze Mode).
     */
    fun requestBatteryOptimizationExemption(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
            if (pm?.isIgnoringBatteryOptimizations(context.packageName) == false) {
                try {
                    val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                        data = Uri.parse("package:${context.packageName}")
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    context.startActivity(intent)
                } catch (e: Exception) {
                    Log.w(TAG, "Direct ignore battery optimization intent failed, falling back: ${e.message}")
                    try {
                        val fallback = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        }
                        context.startActivity(fallback)
                    } catch (e2: Exception) {
                        Log.e(TAG, "Cannot open battery optimization settings: ${e2.message}")
                    }
                }
            }
        }
    }

    /**
     * Opens manufacturer-specific Autostart and Background Running management screens.
     */
    fun openAutoStartPermissionMenu(context: Context): Boolean {
        val manufacturer = Build.MANUFACTURER.lowercase()
        val intents = mutableListOf<Intent>()

        when {
            manufacturer.contains("xiaomi") || manufacturer.contains("redmi") || manufacturer.contains("poco") -> {
                intents.add(Intent().apply {
                    component = ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity")
                })
                intents.add(Intent().apply {
                    component = ComponentName("com.miui.securitycenter", "com.miui.powerkeeper.ui.HiddenAppsConfigActivity")
                })
            }
            manufacturer.contains("samsung") -> {
                intents.add(Intent().apply {
                    component = ComponentName("com.samsung.android.lool", "com.samsung.android.sm.ui.battery.BatteryActivity")
                })
                intents.add(Intent().apply {
                    component = ComponentName("com.samsung.android.sm", "com.samsung.android.sm.app.dashboard.SmartManagerDashBoardActivity")
                })
            }
            manufacturer.contains("huawei") || manufacturer.contains("honor") -> {
                intents.add(Intent().apply {
                    component = ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity")
                })
                intents.add(Intent().apply {
                    component = ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.optimize.bootstart.BootStartActivity")
                })
            }
            manufacturer.contains("oppo") || manufacturer.contains("realme") -> {
                intents.add(Intent().apply {
                    component = ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity")
                })
                intents.add(Intent().apply {
                    component = ComponentName("com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity")
                })
            }
            manufacturer.contains("vivo") || manufacturer.contains("iqoo") -> {
                intents.add(Intent().apply {
                    component = ComponentName("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity")
                })
                intents.add(Intent().apply {
                    component = ComponentName("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager")
                })
            }
            manufacturer.contains("oneplus") -> {
                intents.add(Intent().apply {
                    component = ComponentName("com.oneplus.security", "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity")
                })
            }
            manufacturer.contains("transsion") || manufacturer.contains("tecno") || manufacturer.contains("infinix") -> {
                intents.add(Intent().apply {
                    component = ComponentName("com.transsion.phonemaster", "com.cyin.himgr.widget.activity.MainSettingActivity")
                })
            }
        }

        // Standard App Info Settings page as generic fallback
        intents.add(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.parse("package:${context.packageName}")
        })

        for (intent in intents) {
            try {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(intent)
                return true
            } catch (e: Exception) {
                Log.d(TAG, "Intent failed for component: ${intent.component}, trying next...")
            }
        }

        return false
    }
}
