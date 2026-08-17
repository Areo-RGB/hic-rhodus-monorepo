package com.example

import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Bundle
import android.util.Log
import android.view.ViewGroup
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import com.example.ui.theme.MyApplicationTheme

class MainActivity : ComponentActivity() {
  private var nearbyManager: NearbyManager? = null
  private var activeWebView: WebView? = null

  private val requestPermissionLauncher = registerForActivityResult(
    ActivityResultContracts.RequestMultiplePermissions()
  ) { permissions ->
    val allGranted = permissions.entries.all { it.value }
    val jsCall = "window.onNearbyPermissionsResult && window.onNearbyPermissionsResult($allGranted);"
    activeWebView?.evaluateJavascript(jsCall, null)
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    // Force update 2
    enableEdgeToEdge()

    try {
      nearbyManager = NearbyManager(this, null)
    } catch (e: Throwable) {
      Log.e("MainActivity", "Failed to create NearbyManager", e)
    }

    setContent {
      MyApplicationTheme {
        HicRhodusWebView(
          url = "file:///android_asset/index.html",
          nearbyManager = nearbyManager,
          onWebViewCreated = { activeWebView = it },
          modifier = Modifier.fillMaxSize()
        )
      }
    }
  }

  override fun onDestroy() {
    super.onDestroy()
    nearbyManager?.stopNearby()
  }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun HicRhodusWebView(
  url: String, 
  nearbyManager: NearbyManager?,
  onWebViewCreated: (WebView) -> Unit = {},
  modifier: Modifier = Modifier
) {
  var webViewRef by remember { mutableStateOf<WebView?>(null) }
  var canGoBack by remember { mutableStateOf(false) }

  BackHandler(enabled = canGoBack) {
    webViewRef?.goBack()
  }

  AndroidView(
    factory = { context ->
      WebView(context).apply {
        layoutParams = ViewGroup.LayoutParams(
          ViewGroup.LayoutParams.MATCH_PARENT,
          ViewGroup.LayoutParams.MATCH_PARENT
        )
        setBackgroundColor(Color.BLACK)

        webViewClient = object : WebViewClient() {
          override fun onPageFinished(view: WebView?, url: String?) {
            super.onPageFinished(view, url)
            canGoBack = view?.canGoBack() == true
            nearbyManager?.setWebView(view)
          }

          override fun onReceivedError(
            view: WebView?,
            request: WebResourceRequest?,
            error: WebResourceError?
          ) {
            super.onReceivedError(view, request, error)
            Log.e("HicRhodusWebView", "Load error [${request?.url}]: ${error?.description}")
          }
        }

        webChromeClient = object : WebChromeClient() {
          override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
            Log.d("HicRhodusJS", "${consoleMessage?.message()} -- line ${consoleMessage?.lineNumber()} (${consoleMessage?.sourceId()})")
            return true
          }
        }

        settings.apply {
          javaScriptEnabled = true
          domStorageEnabled = true
          databaseEnabled = true
          allowFileAccess = true
          allowContentAccess = true
          allowFileAccessFromFileURLs = true
          allowUniversalAccessFromFileURLs = true
          useWideViewPort = true
          loadWithOverviewMode = true
          cacheMode = WebSettings.LOAD_NO_CACHE
          mediaPlaybackRequiresUserGesture = false
          mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        }

        clearCache(true)

        nearbyManager?.let { manager ->
          manager.setWebView(this)
          addJavascriptInterface(manager, "AndroidNearby")
        }

        onWebViewCreated(this)
        loadUrl(url)
        webViewRef = this
      }
    },
    modifier = modifier,
    update = { webView ->
      webViewRef = webView
      nearbyManager?.setWebView(webView)
    }
  )
}
