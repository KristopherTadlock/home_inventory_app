//! Date phrases resolved with Duckling.

use chrono::{DateTime, FixedOffset, NaiveDate};
use duckling::{
    Context, DimensionKind, DimensionValue, Lang, Locale, Options, TimePoint, TimeValue, parse,
};

/// Resolves an English date phrase ("Oct 27 2027", "next Friday", "in 2 weeks") to
/// `YYYY-MM-DD`, relative to `today` (`YYYY-MM-DD`, the device's local date). Returns
/// `None` for empty or unrecognised text, or a malformed `today`.
#[uniffi::export]
pub fn parse_expiration_date(text: String, today: String) -> Option<String> {
    let text = text.trim();
    if text.is_empty() {
        return None;
    }
    let today = NaiveDate::parse_from_str(today.trim(), "%Y-%m-%d").ok()?;
    // Noon keeps relative phrases clear of day boundaries. `today` is already the local
    // date, so resolving in UTC gives the right calendar day.
    let noon = today.and_hms_opt(12, 0, 0)?.and_utc().fixed_offset();
    resolve_date(text, noon)
}

/// Resolves an English date expression to `YYYY-MM-DD` relative to `now`.
pub(crate) fn resolve_date(text: &str, now: DateTime<FixedOffset>) -> Option<String> {
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

    fn tuesday_3_nov_2026() -> DateTime<FixedOffset> {
        DateTime::parse_from_rfc3339("2026-11-03T10:00:00-08:00").unwrap()
    }

    fn parse(text: &str) -> Option<String> {
        parse_expiration_date(text.to_string(), "2026-11-03".to_string())
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
    fn parses_expiration_phrases_relative_to_today() {
        assert_eq!(parse("October 27th 2027").as_deref(), Some("2027-10-27"));
        assert_eq!(parse("Oct 27 2027").as_deref(), Some("2027-10-27"));
        assert_eq!(parse("tomorrow").as_deref(), Some("2026-11-04"));
        assert_eq!(parse("next Friday").as_deref(), Some("2026-11-13"));
        assert_eq!(parse("in 2 weeks").as_deref(), Some("2026-11-17"));
        assert_eq!(parse("  in 2 weeks  ").as_deref(), Some("2026-11-17"));
    }

    #[test]
    fn unparseable_expiration_is_none() {
        assert_eq!(parse(""), None);
        assert_eq!(parse("   "), None);
        assert_eq!(parse("banana"), None);
        assert_eq!(
            parse_expiration_date("tomorrow".to_string(), "not a date".to_string()),
            None
        );
    }
}
