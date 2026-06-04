#import <Capacitor/Capacitor.h>

CAP_PLUGIN(NativeUploadPlugin, "NativeUpload",
    CAP_PLUGIN_METHOD(isAvailable, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(compressAndUpload, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(backgroundUpload, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(requestNotificationPermission, CAPPluginReturnPromise);
)
