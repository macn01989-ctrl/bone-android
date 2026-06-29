package com.bone.app;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.animation.ObjectAnimator;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.animation.DecelerateInterpolator;

import androidx.core.splashscreen.SplashScreen;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final long SPLASH_HOLD_MS = 520L;
    private static final long SPLASH_EXIT_FADE_MS = 860L;
    private boolean keepSplashOnScreen = true;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        getWindow().setWindowAnimations(0);
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        splashScreen.setKeepOnScreenCondition(() -> keepSplashOnScreen);
        splashScreen.setOnExitAnimationListener(splashScreenView -> {
            ObjectAnimator fadeOut = ObjectAnimator.ofFloat(
                    splashScreenView.getView(),
                    View.ALPHA,
                    1f,
                    0f
            );
            fadeOut.setInterpolator(new DecelerateInterpolator());
            fadeOut.setDuration(SPLASH_EXIT_FADE_MS);
            fadeOut.addListener(new AnimatorListenerAdapter() {
                @Override
                public void onAnimationEnd(Animator animation) {
                    splashScreenView.remove();
                }
            });
            fadeOut.start();
        });

        registerPlugin(ApplePoolPlugin.class);
        registerPlugin(ExternalMusicPlugin.class);
        registerPlugin(ImageActionsPlugin.class);
        registerPlugin(NativeHttpPlugin.class);
        super.onCreate(savedInstanceState);
        overridePendingTransition(0, 0);

        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            keepSplashOnScreen = false;
        }, SPLASH_HOLD_MS);
    }
}
