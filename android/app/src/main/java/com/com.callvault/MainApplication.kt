package com.callvault

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          add(com.callvault.native.CallVaultPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
    scheduleServiceWatchdog()
  }

  private fun scheduleServiceWatchdog() {
    try {
      val watchdogRequest = androidx.work.PeriodicWorkRequestBuilder<com.callvault.services.ServiceWatchdogWorker>(
        15, java.util.concurrent.TimeUnit.MINUTES
      ).build()

      androidx.work.WorkManager.getInstance(this).enqueueUniquePeriodicWork(
        "CallVault_ServiceWatchdog",
        androidx.work.ExistingPeriodicWorkPolicy.KEEP,
        watchdogRequest
      )
    } catch (e: Exception) {
      android.util.Log.e("MainApplication", "Failed to schedule service watchdog: ${e.message}")
    }
  }
}
