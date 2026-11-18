#include <jni.h>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>
#include "node.h"

extern "C"
JNIEXPORT jint JNICALL
Java_com_quizclass_android_MainActivity_startNodeWithArguments(
    JNIEnv* env,
    jobject,
    jobjectArray arguments
) {
    const jsize count = env->GetArrayLength(arguments);
    std::vector<std::string> values;
    values.reserve(static_cast<size_t>(count));

    for (jsize i = 0; i < count; ++i) {
        auto item = static_cast<jstring>(env->GetObjectArrayElement(arguments, i));
        const char* chars = env->GetStringUTFChars(item, nullptr);
        values.emplace_back(chars ? chars : "");
        if (chars) env->ReleaseStringUTFChars(item, chars);
        env->DeleteLocalRef(item);
    }

    std::vector<char*> argv;
    argv.reserve(values.size());
    for (auto& value : values) argv.push_back(value.data());

    return static_cast<jint>(node::Start(static_cast<int>(argv.size()), argv.data()));
}
