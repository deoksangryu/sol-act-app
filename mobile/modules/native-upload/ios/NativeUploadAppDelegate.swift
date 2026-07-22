import ExpoModulesCore
import UIKit

/// 백그라운드 URLSession 완료 이벤트를 받도록 AppDelegate에 훅.
/// Expo가 AppDelegate를 소유하므로 expo-module.config.json의 appDelegateSubscribers로 등록된다.
public class NativeUploadAppDelegate: ExpoAppDelegateSubscriber {
    public func application(_ application: UIApplication,
                            didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        BackgroundUploader.shared.activate()  // 재실행 시 세션 재부착
        return true
    }

    /// OS가 백그라운드 업로드 완료를 전달하려 앱을 깨울 때.
    public func application(_ application: UIApplication,
                            handleEventsForBackgroundURLSession identifier: String,
                            completionHandler: @escaping () -> Void) {
        if identifier == BackgroundUploader.sessionIdentifier {
            BackgroundUploader.shared.backgroundCompletionHandler = completionHandler
            BackgroundUploader.shared.activate()
        } else {
            completionHandler()
        }
    }
}
