package com.bone.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ApplePoolPlugin.class);
        registerPlugin(ExternalMusicPlugin.class);
        registerPlugin(ImageActionsPlugin.class);
        registerPlugin(NativeHttpPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
