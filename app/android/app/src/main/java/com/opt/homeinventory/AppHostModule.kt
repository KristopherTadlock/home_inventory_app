package com.opt.homeinventory

import android.os.Process
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil

/** Implements the AppHost Turbo Module spec (app/src/platform/NativeAppHost.ts). */
class AppHostModule(reactContext: ReactApplicationContext) : NativeAppHostSpec(reactContext) {

  override fun getName(): String = NAME

  override fun getTypedExportedConstants(): Map<String, Any> =
      mapOf(
          // Android's conventional location for app databases: /data/data/<package>/databases.
          "databaseDir" to reactApplicationContext.getDatabasePath(NAME).parentFile!!.absolutePath,
      )

  override fun exitApp() {
    UiThreadUtil.runOnUiThread {
      // Removing the task first keeps the app out of recents. Killing the process is
      // needed because finishing the root activity alone may leave the process (and its
      // failed database handle) alive.
      reactApplicationContext.currentActivity?.finishAndRemoveTask()
      Process.killProcess(Process.myPid())
    }
  }

  companion object {
    const val NAME = "AppHost"
  }
}
