use std::env;
use std::path::{Path, PathBuf};

const STATIC_LIBS: [&str; 5] = ["whisper", "llama", "ggml", "ggml-cpu", "ggml-base"];

fn main() {
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let third_party = manifest_dir
        .join("../../../third_party")
        .canonicalize()
        .expect("third_party/ is missing; run `git submodule update --init --recursive`");
    for path in [
        "native/CMakeLists.txt",
        "../../../third_party/llama.cpp/include/llama.h",
        "../../../third_party/whisper.cpp/include/whisper.h",
    ] {
        println!("cargo:rerun-if-changed={path}");
    }

    let target_os = env::var("CARGO_CFG_TARGET_OS").unwrap();
    let mut cfg = cmake::Config::new(manifest_dir.join("native"));
    cfg.define("THIRD_PARTY_DIR", &third_party)
        .profile("Release")
        .no_build_target(true);
    if target_os == "android" {
        configure_android(&mut cfg);
    }
    let build_dir = cfg.build().join("build");

    for lib in STATIC_LIBS {
        let file = find_static_lib(&build_dir, lib)
            .unwrap_or_else(|| panic!("lib{lib} not found under {}", build_dir.display()));
        println!(
            "cargo:rustc-link-search=native={}",
            file.parent().unwrap().display()
        );
        println!("cargo:rustc-link-lib=static={lib}");
    }
    match target_os.as_str() {
        "android" => {
            println!("cargo:rustc-link-lib=dylib=c++_shared");
            println!("cargo:rustc-link-lib=dylib=log");
        }
        "macos" | "ios" => println!("cargo:rustc-link-lib=dylib=c++"),
        "windows" => {}
        _ => println!("cargo:rustc-link-lib=dylib=stdc++"),
    }
}

/// Points CMake at the NDK toolchain, matching the ABI and API level cargo-ndk builds for.
fn configure_android(cfg: &mut cmake::Config) {
    let ndk = ["ANDROID_NDK_HOME", "ANDROID_NDK_ROOT", "ANDROID_NDK"]
        .iter()
        .find_map(|v| env::var(v).ok())
        .expect("set ANDROID_NDK_HOME to build for Android");
    let abi = match env::var("CARGO_CFG_TARGET_ARCH").unwrap().as_str() {
        "aarch64" => "arm64-v8a",
        "x86_64" => "x86_64",
        "arm" => "armeabi-v7a",
        "x86" => "x86",
        other => panic!("unsupported Android architecture {other}"),
    };
    let api = env::var("CARGO_NDK_ANDROID_PLATFORM").unwrap_or_else(|_| "24".into());
    cfg.define(
        "CMAKE_TOOLCHAIN_FILE",
        Path::new(&ndk).join("build/cmake/android.toolchain.cmake"),
    )
    .define("ANDROID_ABI", abi)
    .define("ANDROID_PLATFORM", format!("android-{api}"))
    .define("ANDROID_STL", "c++_shared");
}

fn find_static_lib(dir: &Path, name: &str) -> Option<PathBuf> {
    let wanted = [format!("lib{name}.a"), format!("{name}.lib")];
    for entry in std::fs::read_dir(dir).ok()?.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if let Some(found) = find_static_lib(&path, name) {
                return Some(found);
            }
        } else if wanted
            .iter()
            .any(|w| path.file_name().is_some_and(|f| f == w.as_str()))
        {
            return Some(path);
        }
    }
    None
}
