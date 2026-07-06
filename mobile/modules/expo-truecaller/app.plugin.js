const { withAndroidManifest } = require("expo/config-plugins");

module.exports = function withTruecaller(config) {
  return withAndroidManifest(config, (manifestConfig) => {
    const clientId = manifestConfig.extra?.trucallerClientId;
    if (!clientId) return manifestConfig;

    const androidManifest = manifestConfig.modResults;
    const application = androidManifest.manifest?.application?.[0];
    if (!application) return manifestConfig;

    application["meta-data"] = application["meta-data"] || [];

    const hasClientId = application["meta-data"].some(
      (item) => item.$["android:name"] === "com.truecaller.sdk.ClientId"
    );

    if (!hasClientId) {
      application["meta-data"].push({
        $: {
          "android:name": "com.truecaller.sdk.ClientId",
          "android:value": clientId,
        },
      });
    }

    return manifestConfig;
  });
};
