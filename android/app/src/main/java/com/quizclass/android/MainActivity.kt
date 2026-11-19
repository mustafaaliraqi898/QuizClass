package com.quizclass.android

import android.app.Activity
import android.content.Intent
import android.graphics.Typeface
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class MainActivity : Activity() {
    private val nodeExecutor = Executors.newSingleThreadExecutor()
    private val readinessExecutor = Executors.newSingleThreadExecutor()

    private lateinit var statusText: TextView
    private lateinit var openBrowserButton: Button
    @Volatile private var serverReady = false
    private var browserLaunchAttempted = false

    external fun startNodeWithArguments(arguments: Array<String>): Int

    companion object {
        private const val APP_URL = "http://127.0.0.1:3000"
        @Volatile private var nodeStarted = false

        init {
            System.loadLibrary("node")
            System.loadLibrary("native-lib")
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        showStatusScreen()
        startEmbeddedNode()
    }

    private fun showStatusScreen() {
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(36, 36, 36, 36)
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        val title = TextView(this).apply {
            text = "QuizClass"
            textSize = 28f
            setTypeface(null, Typeface.BOLD)
            gravity = Gravity.CENTER
        }
        statusText = TextView(this).apply {
            text = "جارٍ تشغيل خادم التطبيق..."
            textSize = 17f
            gravity = Gravity.CENTER
            setPadding(0, 24, 0, 24)
        }
        openBrowserButton = Button(this).apply {
            text = "فتح QuizClass في المتصفح"
            isEnabled = false
            setOnClickListener { launchExternalBrowser() }
        }

        container.addView(title)
        container.addView(statusText)
        container.addView(openBrowserButton)
        setContentView(container)
    }

    private fun startEmbeddedNode() {
        synchronized(MainActivity::class.java) {
            if (nodeStarted) {
                waitForServerAndOpenBrowser()
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
                waitForServerAndOpenBrowser()
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
        waitForServerAndOpenBrowser()
    }

    private fun waitForServerAndOpenBrowser() {
        readinessExecutor.execute {
            var ready = false
            repeat(60) {
                if (ready) return@repeat
                try {
                    val connection = URL("$APP_URL/health").openConnection() as HttpURLConnection
                    connection.connectTimeout = 500
                    connection.readTimeout = 500
                    connection.requestMethod = "GET"
                    ready = connection.responseCode == 200
                    connection.disconnect()
                } catch (_: Exception) {
                    // The embedded server is still starting.
                }
                if (!ready) Thread.sleep(500)
            }

            runOnUiThread {
                if (ready) {
                    serverReady = true
                    statusText.text = "الخادم يعمل. سيتم فتح QuizClass في المتصفح الخارجي."
                    openBrowserButton.isEnabled = true
                    if (!browserLaunchAttempted) {
                        browserLaunchAttempted = true
                        launchExternalBrowser()
                    }
                } else {
                    showStartupError("تعذر تشغيل خادم QuizClass المحلي. أعد فتح التطبيق.")
                }
            }
        }
    }

    private fun launchExternalBrowser() {
        if (!serverReady) {
            Toast.makeText(this, "انتظر حتى يكتمل تشغيل التطبيق", Toast.LENGTH_SHORT).show()
            return
        }

        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(APP_URL))
            startActivity(intent)
            statusText.text = "QuizClass يعمل في المتصفح. اترك هذا التطبيق مفتوحاً أثناء الاستخدام."
        } catch (_: Exception) {
            statusText.text = "لم يتم العثور على متصفح. افتح Chrome يدوياً واكتب العنوان التالي:"
            Toast.makeText(this, APP_URL, Toast.LENGTH_LONG).show()
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
        if (!::statusText.isInitialized) return
        statusText.text = message
        openBrowserButton.isEnabled = false
    }

    override fun onDestroy() {
        readinessExecutor.shutdownNow()
        // Keep the embedded Node server process-scoped while the external browser is in use.
        nodeExecutor.shutdown()
        super.onDestroy()
    }
}
