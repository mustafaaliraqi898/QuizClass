plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.quizclass.android"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.quizclass.android"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
        val targetAbi = providers.gradleProperty("quizclassAbi").orElse("arm64-v8a").get()
        require(targetAbi == "arm64-v8a" || targetAbi == "armeabi-v7a") {
            "Unsupported QuizClass Android ABI: $targetAbi"
        }
        ndk {
            abiFilters += listOf(targetAbi)
        }
        externalNativeBuild {
            cmake {
                cppFlags += "-std=c++20"
            }
        }
    }

    sourceSets["main"].assets.srcDir("src/main/assets")
    externalNativeBuild {
        cmake {
            path = file("src/main/cpp/CMakeLists.txt")
            version = "3.22.1"
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}
