package com.quizclass.android

import android.annotation.SuppressLint
import android.app.Activity
import android.content.ContentValues
import android.content.Intent
import android.net.Uri
import android.os.Environment
import android.provider.MediaStore
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.widget.FrameLayout
import android.widget.Toast
import android.util.Base64
import android.content.res.Configuration
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
    private lateinit var rootLayout: FrameLayout
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var fullscreenCustomView: View? = null
    private var fullscreenCallback: WebChromeClient.CustomViewCallback? = null
    private var previousSystemUiVisibility: Int = 0

    companion object {
        private const val FILE_CHOOSER_REQUEST = 4102
        private const val FILE_MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    }
    private val nodeExecutor = Executors.newSingleThreadExecutor()
    private val readinessExecutor = Executors.newSingleThreadExecutor()

    external fun startNodeWithArguments(arguments: Array<String>): Int

    companion object {
        private const val FILE_CHOOSER_REQUEST = 4102
        private const val FILE_MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        @Volatile private var nodeStarted = false
        init {
            System.loadLibrary("node")
            System.loadLibrary("native-lib")
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        rootLayout = FrameLayout(this)
        webView = WebView(this)
        rootLayout.addView(webView, FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ))
        setContentView(rootLayout)
        configureWebView()
        startEmbeddedNode()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        // Keep CSS sizing predictable across Android phones, Google TV, and smartboards.
        webView.settings.useWideViewPort = true
        webView.settings.loadWithOverviewMode = false
        webView.settings.textZoom = 100
        webView.settings.builtInZoomControls = false
        webView.settings.displayZoomControls = false
        webView.settings.allowFileAccess = false
        webView.addJavascriptInterface(QuizClassFileBridge(), "QuizClassNative")
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView?,
                callback: ValueCallback<Array<Uri>>?,
                params: FileChooserParams?
            ): Boolean {
                filePathCallback?.onReceiveValue(null)
                filePathCallback = callback
                val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = FILE_MIME_XLSX
                    putExtra(Intent.EXTRA_MIME_TYPES, arrayOf(FILE_MIME_XLSX, "application/vnd.ms-excel"))
                }
                return try {
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST)
                    true
                } catch (_: Exception) {
                    filePathCallback?.onReceiveValue(null)
                    filePathCallback = null
                    Toast.makeText(this@MainActivity, "تعذر فتح ملفات الجهاز", Toast.LENGTH_SHORT).show()
                    false
                }
            }

            override fun onShowCustomView(view: View?, callback: CustomViewCallback?) {
                if (view == null) return
                if (fullscreenCustomView != null) {
                    callback?.onCustomViewHidden()
                    return
                }
                fullscreenCustomView = view
                fullscreenCallback = callback
                previousSystemUiVisibility = window.decorView.systemUiVisibility
                (view.parent as? ViewGroup)?.removeView(view)
                webView.visibility = View.GONE
                rootLayout.addView(view, FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                ))
                window.addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)
                window.decorView.systemUiVisibility = (
                    View.SYSTEM_UI_FLAG_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                )
            }

            override fun onHideCustomView() {
                val view = fullscreenCustomView ?: return
                rootLayout.removeView(view)
                fullscreenCustomView = null
                webView.visibility = View.VISIBLE
                window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)
                window.decorView.systemUiVisibility = previousSystemUiVisibility
                fullscreenCallback?.onCustomViewHidden()
                fullscreenCallback = null
            }
        }
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                if (isLargeLandscapeDisplay()) {
                    view?.evaluateJavascript(
                        "document.documentElement.classList.add('qc-large-screen');",
                        null
                    )
                }
            }
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == FILE_CHOOSER_REQUEST) {
            val result = if (resultCode == RESULT_OK) {
                data?.data?.let { arrayOf(it) }
            } else null
            filePathCallback?.onReceiveValue(result)
            filePathCallback = null
        }
    }

    private inner class QuizClassFileBridge {
        @JavascriptInterface
        fun saveBase64File(fileName: String, mimeType: String, base64Data: String) {
            try {
                val bytes = Base64.decode(base64Data, Base64.DEFAULT)
                val values = ContentValues().apply {
                    put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
                    put(MediaStore.MediaColumns.MIME_TYPE, mimeType)
                    put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/QuizClass")
                }
                val uri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                    ?: throw IllegalStateException("تعذر إنشاء ملف التنزيل")
                contentResolver.openOutputStream(uri)?.use { it.write(bytes) }
                    ?: throw IllegalStateException("تعذر حفظ الملف")
                runOnUiThread {
                    Toast.makeText(this@MainActivity, "تم حفظ القالب داخل التنزيلات / QuizClass", Toast.LENGTH_LONG).show()
                }
            } catch (_: Exception) {
                runOnUiThread {
                    Toast.makeText(this@MainActivity, "تعذر حفظ ملف Excel", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private fun isLargeLandscapeDisplay(): Boolean {
        val config = resources.configuration
        val isTelevision = (config.uiMode and Configuration.UI_MODE_TYPE_MASK) ==
            Configuration.UI_MODE_TYPE_TELEVISION
        val isWideLandscape = config.orientation == Configuration.ORIENTATION_LANDSCAPE &&
            config.screenWidthDp >= 800
        return isTelevision || isWideLandscape
    }

    private fun startEmbeddedNode() {
        synchronized(MainActivity::class.java) {
            if (nodeStarted) {
                waitForServerAndLoad()
                return
            }
        }

        val appRoot = File(filesDir, "quizclass-app")
        if (!copyAssetsIfNeeded(appRoot)) {
            showStartupError("تعذر تجهيز ملفات QuizClass.")
            return
        }

        synchronized(MainActivity::class.java) {
            if (nodeStarted) {
                waitForServerAndLoad()
                return
            }
            nodeStarted = true
        }

        val dataDir = File(noBackupFilesDir, "quizclass-data")
        val tempDir = File(cacheDir, "node-tmp")
        val compileCacheDir = File(cacheDir, "node-compile-cache")
        dataDir.mkdirs()
        tempDir.mkdirs()
        compileCacheDir.mkdirs()
        val script = File(appRoot, "server.cjs").absolutePath

        nodeExecutor.execute {
            startNodeWithArguments(arrayOf(
                "node",
                "--cwd=${appRoot.absolutePath}",
                "--env=QUIZCLASS_APP_ROOT=${appRoot.absolutePath}",
                "--env=QUIZCLASS_DATA_DIR=${dataDir.absolutePath}",
                "--env=TMPDIR=${tempDir.absolutePath}",
                "--env=HOME=${filesDir.absolutePath}",
                "--env=NODE_COMPILE_CACHE=${compileCacheDir.absolutePath}",
                "--env=NODE_COMPILE_CACHE_PORTABLE=1",
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
                    // Server is still starting; retry below.
                }
                if (!ready) Thread.sleep(500)
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
        filePathCallback?.onReceiveValue(null)
        filePathCallback = null
        fullscreenCustomView?.let { rootLayout.removeView(it) }
        fullscreenCustomView = null
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
