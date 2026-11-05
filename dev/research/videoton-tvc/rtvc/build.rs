fn main() {
    println!("cargo:rerun-if-changed=assets/rtvc-app-icon.ico");

    #[cfg(windows)]
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        winres::WindowsResource::new()
            .set_icon("assets/rtvc-app-icon.ico")
            .compile()
            .expect("failed to embed the RTVC Windows icon");
    }

    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows")
        && std::env::var("CARGO_CFG_TARGET_ENV").as_deref() == Ok("msvc")
    {
        println!("cargo:rustc-link-arg-bin=rtvc=/STACK:8388608");
    }
}
