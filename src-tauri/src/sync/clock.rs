//! Time, in the two shapes sync needs it.

use std::time::{SystemTime, UNIX_EPOCH};

/// Milliseconds since the epoch; the auto-sync loop compares these, never
/// displays them, so a clock that refuses to answer is worth no more than 0.
pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Now, as `Date.toISOString` would have written it.
pub fn time_now() -> String {
    let d = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    // The client compares these strings lexicographically, so the shape has to
    // match to the millisecond.
    let secs = d.as_secs() as i64;
    let ms = d.subsec_millis();
    let days = secs / 86_400;
    let rem = secs % 86_400;
    let (y, mo, da) = civil_from_days(days);
    format!(
        "{y:04}-{mo:02}-{da:02}T{:02}:{:02}:{:02}.{ms:03}Z",
        rem / 3600,
        (rem % 3600) / 60,
        rem % 60
    )
}

/// Howard Hinnant's civil-from-days algorithm; avoids pulling in a date crate
/// for the one timestamp this module needs.
fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (if m <= 2 { y + 1 } else { y }, m, d)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The algorithm is the only date arithmetic in the app, and a leap year is
    /// where such things break.
    #[test]
    fn civil_from_days_handles_leap_years_and_the_epoch() {
        assert_eq!(civil_from_days(0), (1970, 1, 1));
        assert_eq!(civil_from_days(59), (1970, 3, 1));
        assert_eq!(civil_from_days(19_782), (2024, 2, 29));
        assert_eq!(civil_from_days(-1), (1969, 12, 31));
    }

    /// The client sorts these strings, so the shape matters more than the value.
    #[test]
    fn time_now_reads_as_an_iso_timestamp() {
        let now = time_now();
        assert_eq!(now.len(), 24, "{now}");
        assert!(now.ends_with('Z') && now.as_bytes()[10] == b'T', "{now}");
        assert!(now.as_str() > "2026-01-01T00:00:00.000Z", "{now}");
    }
}
