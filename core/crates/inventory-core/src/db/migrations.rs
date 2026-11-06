//! Schema migrations. `PRAGMA user_version` holds the number of migrations applied; each
//! entry runs once, in order. Never edit a released migration: append a new one.

use rusqlite::{Connection, TransactionBehavior};

use crate::error::InventoryError;

const MIGRATIONS: &[&str] = &[
    // 1: items.
    // - AUTOINCREMENT: ids are never reused, even after the newest row is deleted, so a
    //   stale id (e.g. from a pending Llama action) can't silently hit a different item.
    // - quantity >= 1: an item whose quantity reaches 0 is deleted, never stored as 0.
    // - expiration_date is an ISO calendar date; NULL means the item does not expire.
    // - created_date is the UTC insert time, filled by SQLite.
    r#"
    CREATE TABLE items (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        name            TEXT    NOT NULL COLLATE NOCASE
                        CHECK (length(trim(name)) BETWEEN 1 AND 200),
        location        TEXT    NOT NULL COLLATE NOCASE
                        CHECK (length(trim(location)) BETWEEN 1 AND 100),
        quantity        INTEGER NOT NULL DEFAULT 1
                        CHECK (quantity >= 1),
        expiration_date TEXT    DEFAULT NULL
                        CHECK (expiration_date IS NULL OR date(expiration_date) IS expiration_date),
        created_date    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
                        CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', created_date) IS created_date)
    ) STRICT;

    CREATE INDEX items_location        ON items (location);
    CREATE INDEX items_expiration_date ON items (expiration_date) WHERE expiration_date IS NOT NULL;
    "#,
];

/// The schema version this build creates and understands.
pub(crate) const SCHEMA_VERSION: i64 = MIGRATIONS.len() as i64;

/// Applies pending migrations in one transaction, so a failure leaves the schema untouched.
pub(crate) fn migrate(conn: &mut Connection) -> Result<(), InventoryError> {
    let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let current: i64 = tx.pragma_query_value(None, "user_version", |row| row.get(0))?;
    if current > SCHEMA_VERSION {
        return Err(InventoryError::storage(format!(
            "database schema version {current} is newer than this app supports ({SCHEMA_VERSION})"
        )));
    }
    for sql in &MIGRATIONS[current as usize..] {
        tx.execute_batch(sql)?;
    }
    tx.pragma_update(None, "user_version", SCHEMA_VERSION)?;
    tx.commit()?;
    Ok(())
}
