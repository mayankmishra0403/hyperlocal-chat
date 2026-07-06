package expo.modules.truecaller

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import com.truecaller.android.sdk.TruecallerSdk
import com.truecaller.android.sdk.TruecallerSdkCallback
import com.truecaller.android.sdk.VerificationData
import com.truecaller.android.sdk.TruecallerError

class TruecallerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoTruecaller")

    AsyncFunction("verify") { clientId: String, promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.reject("NO_ACTIVITY", "No current activity found")
        return@AsyncFunction
      }

      activity.runOnUiThread {
        try {
          TruecallerSdk.init(
            activity,
            clientId,
            object : TruecallerSdkCallback {
              override fun onSuccess(result: VerificationData?) {
                val requestId = result?.requestId?.toString() ?: ""
                val phoneNumber = result?.phoneNumber ?: ""
                if (requestId.isNotEmpty() && phoneNumber.isNotEmpty()) {
                  promise.resolve(
                    mapOf(
                      "requestId" to requestId,
                      "phoneNumber" to phoneNumber
                    )
                  )
                } else {
                  promise.reject("INVALID_DATA", "Missing requestId or phoneNumber from Truecaller")
                }
              }

              override fun onFailure(errorData: TruecallerError?) {
                promise.reject(
                  "TRUECALLER_FAILED",
                  errorData?.message ?: "Verification failed"
                )
              }

              override fun onVerificationRequired() {
                promise.reject(
                  "VERIFICATION_REQUIRED",
                  "Truecaller requires SMS-based verification"
                )
              }
            }
          )
        } catch (e: Exception) {
          promise.reject("INIT_ERROR", e.message ?: "Failed to initialize Truecaller SDK")
        }
      }
    }
  }
}
