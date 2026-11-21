package com.arefeicaohoje.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.window.OnBackInvokedDispatcher;

/**
 * Casca WebView do "A refeição hoje é...".
 * A interface é o site publicado no GitHub Pages; aqui só carregamos o site,
 * tratamos o botão Voltar como "voltar" no histórico do WebView e expomos uma
 * pequena ponte JS (window.AndroidApp) para manter a tela acesa, compartilhar,
 * copiar e vibrar.
 */
public class MainActivity extends Activity {

    private static final int COR_FUNDO = Color.rgb(0x23, 0x16, 0x0f);
    private WebView web;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle salvo) {
        super.onCreate(salvo);

        FrameLayout raiz = new FrameLayout(this);
        raiz.setBackgroundColor(COR_FUNDO);
        // Android 15 desenha atrás das barras do sistema: afastamos o conteúdo delas
        raiz.setOnApplyWindowInsetsListener((v, insets) -> {
            int topo, base;
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets i = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime());
                topo = i.top; base = i.bottom;
                v.setPadding(i.left, topo, i.right, base);
            } else {
                v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                        insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });

        web = new WebView(this);
        web.setBackgroundColor(COR_FUNDO);
        raiz.addView(web, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(raiz);

        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) WebView.setWebContentsDebuggingEnabled(true);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);                  // localStorage: favoritos, histórico, lista...
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);  // sons da abertura sem precisar tocar antes
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setTextZoom(100);
        s.setSupportMultipleWindows(false);

        web.addJavascriptInterface(new Ponte(), "AndroidApp");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (ehDoSite(u)) return false;
                // YouTube, Wikimedia etc.: abre no app/navegador do celular
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (ActivityNotFoundException ignorada) { }
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError erro) {
                if (req.isForMainFrame()) view.loadUrl("file:///android_asset/offline.html");
            }
        });

        registrarVoltar();

        if (salvo != null) web.restoreState(salvo);
        else web.loadUrl(BuildConfig.SITE_URL);
    }

    private boolean ehDoSite(Uri u) {
        Uri site = Uri.parse(BuildConfig.SITE_URL);
        return "file".equals(u.getScheme())
                || (site.getHost() != null && site.getHost().equalsIgnoreCase(u.getHost()));
    }

    /** Voltar do Android = voltar no histórico do WebView; sem histórico, sai do app. */
    private void registrarVoltar() {
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::voltar);
        }
    }

    private void voltar() {
        if (web != null && web.canGoBack()) web.goBack();
        else finish();
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() { voltar(); }   // Android 12 e anteriores

    @Override
    protected void onSaveInstanceState(Bundle saida) {
        super.onSaveInstanceState(saida);
        if (web != null) web.saveState(saida);
    }

    @Override
    protected void onDestroy() {
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }

    /** Métodos chamados pelo JavaScript do site (rodam numa thread de fundo). */
    private class Ponte {
        @JavascriptInterface
        public void telaAcesa(boolean ligar) {
            runOnUiThread(() -> {
                if (ligar) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            });
        }

        @JavascriptInterface
        public void compartilhar(String texto) {
            runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_SEND);
                i.setType("text/plain");
                i.putExtra(Intent.EXTRA_TEXT, texto);
                startActivity(Intent.createChooser(i, "Compartilhar lista"));
            });
        }

        @JavascriptInterface
        public void copiar(String texto) {
            ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("A refeição hoje é...", texto));
        }

        @JavascriptInterface
        public void vibrar(long ms) {
            Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v == null || !v.hasVibrator()) return;
            v.vibrate(VibrationEffect.createOneShot(Math.max(1, ms), VibrationEffect.DEFAULT_AMPLITUDE));
        }

        @JavascriptInterface
        public String versao() { return BuildConfig.VERSION_NAME; }
    }
}
