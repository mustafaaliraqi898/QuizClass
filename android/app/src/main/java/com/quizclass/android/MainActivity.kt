package com.quizclass.android

import android.annotation.SuppressLint
import android.app.Activity
import android.os.Bundle
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.TextView
import java.io.File
import java.util.concurrent.Executors

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private val nodeExecutor = Executors.newSingleThreadExecutor()

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
                webView.loadUrl("http://127.0.0.1:3000")
                return
            }
            nodeStarted = true
        }

        val appRoot = File(filesDir, "quizclass-app")
        val copied = copyAssetsIfNeeded(appRoot)
        if (!copied) {
            showStartupError("تعذر تجهيز ملفات QuizClass.")
            return
        }

        nodeExecutor.execute {
            val dataDir = File(filesDir, "quizclass-data")
            dataDir.mkdirs()
            val env = arrayOf(
                "QUIZCLASS_APP_ROOT=${appRoot.absolutePath}",
                "QUIZCLASS_DATA_DIR=${dataDir.absolutePath}",
                "PORT=3000",
                "NODE_ENV=production"
            )
            val script = File(appRoot, "server.cjs").absolutePath
            startNodeWithArguments(arrayOf("node", script, *env))
        }

        webView.postDelayed({
            webView.loadUrl("http://127.0.0.1:3000")
        }, 1200)
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
        for (entry in entries) {
            copyAssetFolder("$assetPath/$entry", File(destination, entry))
        }
    }

    private fun showStartupError(message: String) {
        setContentView(TextView(this).apply { text = message; textSize = 18f; setPadding(32, 32, 32, 32) })
    }

    override fun onDestroy() {
        webView.stopLoading()
        webView.destroy()
        nodeExecutor.shutdown()
        super.onDestroy()
    }
}
