package com.solact.academy;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.solact.academy.plugins.nativeupload.NativeUploadPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeUploadPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
