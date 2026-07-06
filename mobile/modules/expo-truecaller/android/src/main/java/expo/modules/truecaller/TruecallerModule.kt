package expo.modules.truecaller

import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import androidx.fragment.app.FragmentActivity
import com.truecaller.android.sdk.legacy.TruecallerSDK
import com.truecaller.android.sdk.legacy.TruecallerSdkScope
import com.truecaller.android.sdk.legacy.ITrueCallback
import com.truecaller.android.sdk.legacy.TrueError
import com.truecaller.android.sdk.common.models.TrueProfile

class TruecallerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoTruecaller")

    AsyncFunction("verify") { promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.reject("NO_ACTIVITY", "No current activity found", null)
        return@AsyncFunction
      }

      if (activity !is FragmentActivity) {
        promise.reject("WRONG_ACTIVITY", "FragmentActivity required", null)
        return@AsyncFunction
      }

      activity.runOnUiThread {
        try {
          val callback = object : ITrueCallback {
            override fun onSuccessProfileShared(trueProfile: TrueProfile) {
              val requestId = trueProfile.requestNonce ?: ""
              val phoneNumber = trueProfile.phoneNumber ?: ""
              if (requestId.isNotEmpty() && phoneNumber.isNotEmpty()) {
                promise.resolve(
                  mapOf(
                    "requestId" to requestId,
                    "phoneNumber" to phoneNumber
                  )
                )
              } else {
                promise.reject("INVALID_DATA", "Missing requestId or phoneNumber from Truecaller", null)
              }
            }

            override fun onFailureProfileShared(trueError: TrueError) {
              promise.reject(
                CodedException("TRUECALLER_FAILED: Truecaller verification failed (error=${trueError.errorType})")
              )
            }

            override fun onVerificationRequired(trueError: TrueError) {
              promise.reject(
                "VERIFICATION_REQUIRED",
                "Truecaller requires SMS-based verification",
                null
              )
            }
          }

          val scope = TruecallerSdkScope.Builder(activity, callback)
            .sdkOptions(TruecallerSdkScope.SDK_OPTION_WITH_OTP)
            .consentMode(TruecallerSdkScope.CONSENT_MODE_POPUP)
            .build()

          TruecallerSDK.init(scope)
          TruecallerSDK.getInstance().getUserProfile(activity)
        } catch (e: Exception) {
          promise.reject("INIT_ERROR", e.message ?: "Failed to initialize Truecaller SDK", null)
        }
      }
    }
  }
}
