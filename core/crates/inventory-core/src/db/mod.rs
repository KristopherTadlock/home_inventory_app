//! Opening and configuring the SQLite database.

mod migrations;

use std::fs;
use std::path::Path;
use std::time::Duration;

use rusqlite::Connection;

use crate::error::InventoryError;

#[cfg(test)]
pub(crate) use migrations::SCHEMA_VERSION;

/// Opens (creating the file and its parent directories if needed) and migrates the
/// database at `path`.
pub(crate) fn open(path: &Path) -> Result<Connection, InventoryError> {
    if let Some(parent) = path.parent().filter(|p| !p.as_os_str().is_empty()) {
        fs::create_dir_all(parent)?;
    }
    let mut conn = Connection::open(path)?;
    configure(&conn)?;
    migrations::migrate(&mut conn)?;
    Ok(conn)
}

#[cfg(test)]
pub(crate) fn open_in_memory() -> Result<Connection, InventoryError> {
    let mut conn = Connection::open_in_memory()?;
    configure(&conn)?;
    migrations::migrate(&mut conn)?;
    Ok(conn)
}

fn configure(conn: &Connection) -> Result<(), InventoryError> {
    // journal_mode reports the resulting mode, so it needs the "and check" variant. This is
    // also the first statement that reads the file, so a non-database file fails here.
    conn.pragma_update_and_check(None, "journal_mode", "WAL", |row| row.get::<_, String>(0))?;
    conn.pragma_update(None, "foreign_keys", true)?;
    conn.busy_timeout(Duration::from_secs(2))?;
    Ok(())
}
