//! On-device core exported to React Native through uniffi: the home inventory stored in
//! SQLite, date phrase resolution, and a self-check proving every native dependency is
//! linked and callable.

use std::path::Path;

use chrono::Utc;

mod dates;
mod db;
mod error;
mod inventory;

pub use dates::parse_expiration_date;
pub use error::{InventoryError, ItemField};
pub use inventory::{Inventory, Item, NewItem};

uniffi::setup_scaffolding!();

/// One value from each linked engine.
#[derive(Debug, uniffi::Record)]
pub struct SelfCheck {
    pub sqlite_version: String,
    /// Duckling's resolution of "tomorrow", as `YYYY-MM-DD` (UTC).
    pub duckling_tomorrow: Option<String>,
    pub llama_system_info: String,
    pub whisper_system_info: String,
}

#[uniffi::export]
pub fn self_check() -> SelfCheck {
    SelfCheck {
        sqlite_version: sqlite_version().unwrap_or_else(|e| format!("error: {e}")),
        duckling_tomorrow: dates::resolve_date("tomorrow", Utc::now().fixed_offset()),
        llama_system_info: inference_sys::llama_system_info(),
        whisper_system_info: inference_sys::whisper_system_info(),
    }
}

/// Whether each engine accepts its model file.
#[derive(Debug, uniffi::Record)]
pub struct ModelProbe {
    pub llama: bool,
    pub whisper: bool,
}

#[uniffi::export]
pub fn probe_models(llama_path: String, whisper_path: String) -> ModelProbe {
    ModelProbe {
        llama: inference_sys::llama_model_loads(Path::new(&llama_path)),
        whisper: inference_sys::whisper_model_loads(Path::new(&whisper_path)),
    }
}

fn sqlite_version() -> rusqlite::Result<String> {
    rusqlite::Connection::open_in_memory()?
        .query_row("SELECT sqlite_version()", [], |row| row.get(0))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn sqlite_is_bundled() {
        assert!(sqlite_version().unwrap().starts_with("3."));
    }

    #[test]
    fn self_check_reaches_every_engine() {
        let check = self_check();
        assert!(check.sqlite_version.starts_with("3."));
        assert!(check.duckling_tomorrow.is_some());
        assert!(!check.llama_system_info.is_empty());
        assert!(!check.whisper_system_info.is_empty());
    }

    #[test]
    #[ignore = "needs scripts/fetch-models.sh"]
    fn bundled_models_load() {
        let models = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../models");
        let probe = probe_models(
            models
                .join("Llama-3.2-1B-Instruct-Q4_K_M.gguf")
                .display()
                .to_string(),
            models.join("ggml-small-q5_1.bin").display().to_string(),
        );
        assert!(probe.llama && probe.whisper, "{probe:?}");
    }
}
