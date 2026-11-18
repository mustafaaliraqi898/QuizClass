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

    std::vector<std::string> nodeArgs;
    nodeArgs.reserve(values.size());
    for (const auto& value : values) {
        if (value.rfind("--env=", 0) == 0) {
            const std::string assignment = value.substr(6);
            const auto separator = assignment.find('=');
            if (separator == std::string::npos || separator == 0) return 2;
            const std::string key = assignment.substr(0, separator);
            const std::string val = assignment.substr(separator + 1);
            if (setenv(key.c_str(), val.c_str(), 1) != 0) return 3;
        } else {
            nodeArgs.push_back(value);
        }
    }

    if (nodeArgs.empty()) return 4;
    std::vector<char*> argv;
    argv.reserve(nodeArgs.size());
    for (auto& value : nodeArgs) argv.push_back(value.data());

    return static_cast<jint>(node::Start(static_cast<int>(argv.size()), argv.data()));
}
