//! On-device core exported to React Native through uniffi. Inventory logic comes later;
//! for now the API proves that every native dependency is linked and callable.

use std::path::Path;

use chrono::{DateTime, FixedOffset, Utc};
use duckling::{
    Context, DimensionKind, DimensionValue, Lang, Locale, Options, TimePoint, TimeValue, parse,
};

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
        duckling_tomorrow: resolve_date("tomorrow", Utc::now().fixed_offset()),
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

/// Resolves an English date expression to `YYYY-MM-DD` relative to `now`.
fn resolve_date(text: &str, now: DateTime<FixedOffset>) -> Option<String> {
    let locale = Locale::new(Lang::EN, None);
    let context = Context::new(now, locale);
    let entity = parse(
        text,
        &locale,
        &[DimensionKind::Time],
        &context,
        &Options::default(),
    )
    .into_iter()
    .next()?;
    match entity.value {
        DimensionValue::Time(TimeValue::Single { value, .. }) => Some(match value {
            TimePoint::Naive { value, .. } => value.date().to_string(),
            TimePoint::Instant { value, .. } => value.date_naive().to_string(),
        }),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn tuesday_3_nov_2026() -> DateTime<FixedOffset> {
        DateTime::parse_from_rfc3339("2026-11-03T10:00:00-08:00").unwrap()
    }

    #[test]
    fn sqlite_is_bundled() {
        assert!(sqlite_version().unwrap().starts_with("3."));
    }

    #[test]
    fn duckling_resolves_expiry_phrases() {
        let now = tuesday_3_nov_2026();
        assert_eq!(resolve_date("tomorrow", now).as_deref(), Some("2026-11-04"));
        assert_eq!(
            resolve_date("next Friday", now).as_deref(),
            Some("2026-11-13")
        );
        assert_eq!(
            resolve_date("in 3 weeks", now).as_deref(),
            Some("2026-11-24")
        );
        assert_eq!(
            resolve_date("5 Jan 2027", now).as_deref(),
            Some("2027-01-05")
        );
        assert_eq!(resolve_date("no date here", now), None);
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
