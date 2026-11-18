package com.quizclass.android

import android.annotation.SuppressLint
import android.app.Activity
import android.os.Bundle
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.TextView
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private val nodeExecutor = Executors.newSingleThreadExecutor()
    private val readinessExecutor = Executors.newSingleThreadExecutor()

    external fun startNodeWithArguments(arguments: Array<String>): Int

    companion object {
        init {
            System.loadLibrary("node")
            System.loadLibrary("native-lib")
        }
        @Volatile private var nodeStarted = false
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        setContentView(webView)
        configureWebView()
        startEmbeddedNode()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = false
        webView.webViewClient = WebViewClient()
    }

    private fun startEmbeddedNode() {
        synchronized(MainActivity::class.java) {
            if (nodeStarted) {
                waitForServerAndLoad()
                return
            }
            nodeStarted = true
        }

        val appRoot = File(filesDir, "quizclass-app")
        if (!copyAssetsIfNeeded(appRoot)) {
            showStartupError("تعذر تجهيز ملفات QuizClass.")
            return
        }

        val dataDir = File(filesDir, "quizclass-data")
        dataDir.mkdirs()
        val script = File(appRoot, "server.cjs").absolutePath

        nodeExecutor.execute {
            startNodeWithArguments(arrayOf(
                "node",
                "--env=QUIZCLASS_APP_ROOT=${appRoot.absolutePath}",
                "--env=QUIZCLASS_DATA_DIR=${dataDir.absolutePath}",
                "--env=PORT=3000",
                "--env=NODE_ENV=production",
                script
            ))
        }
        waitForServerAndLoad()
    }

    private fun waitForServerAndLoad() {
        readinessExecutor.execute {
            var ready = false
            repeat(60) {
                if (ready) return@repeat
                try {
                    val connection = URL("http://127.0.0.1:3000/health").openConnection() as HttpURLConnection
                    connection.connectTimeout = 500
                    connection.readTimeout = 500
                    connection.requestMethod = "GET"
                    ready = connection.responseCode == 200
                    connection.disconnect()
                } catch (_: Exception) {
                    Thread.sleep(500)
                }
            }
            runOnUiThread {
                if (ready) webView.loadUrl("http://127.0.0.1:3000")
                else showStartupError("تعذر تشغيل خادم QuizClass المحلي. أعد فتح التطبيق.")
            }
        }
    }

    private fun copyAssetsIfNeeded(target: File): Boolean {
        return try {
            if (File(target, "server.cjs").exists() && File(target, "dist/index.html").exists()) return true
            target.deleteRecursively()
            target.mkdirs()
            copyAssetFolder("quizclass", target)
            File(target, "server.cjs").exists() && File(target, "dist/index.html").exists()
        } catch (_: Exception) {
            false
        }
    }

    private fun copyAssetFolder(assetPath: String, destination: File) {
        val entries = assets.list(assetPath) ?: emptyArray()
        if (entries.isEmpty()) {
            destination.parentFile?.mkdirs()
            assets.open(assetPath).use { input -> destination.outputStream().use(input::copyTo) }
            return
        }
        destination.mkdirs()
        for (entry in entries) copyAssetFolder("$assetPath/$entry", File(destination, entry))
    }

    private fun showStartupError(message: String) {
        setContentView(TextView(this).apply {
            text = message
            textSize = 18f
            setPadding(32, 32, 32, 32)
        })
    }

    override fun onDestroy() {
        if (::webView.isInitialized) {
            webView.stopLoading()
            webView.destroy()
        }
        readinessExecutor.shutdownNow()
        // The embedded Node runtime is process-scoped and is intentionally not restarted here.
        nodeExecutor.shutdown()
        super.onDestroy()
    }
}
