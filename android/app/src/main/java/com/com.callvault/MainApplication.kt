package com.callvault

import android.app.Application
import android.content.res.Configuration

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactPackage
import com.facebook.react.ReactHost
import com.facebook.react.common.ReleaseLevel
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ExpoReactHostFactory

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    ExpoReactHostFactory.getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Register our native CallVault module
          add(com.callvault.native.CallVaultPackage())
        }
    )
  }

  override fun onCreate() {
    super.onCreate()
    DefaultNewArchitectureEntryPoint.releaseLevel = try {
      ReleaseLevel.valueOf(BuildConfig.REACT_NATIVE_RELEASE_LEVEL.uppercase())
    } catch (e: IllegalArgumentException) {
      ReleaseLevel.STABLE
    }
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
    scheduleServiceWatchdog()
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
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
