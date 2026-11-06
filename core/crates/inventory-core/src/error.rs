//! Errors returned to the UI through uniffi.

/// The item field a validation error refers to, so the UI can show it next to that field.
#[derive(Debug, Clone, Copy, PartialEq, Eq, uniffi::Enum)]
pub enum ItemField {
    Name,
    Location,
    Quantity,
    ExpirationDate,
}

#[derive(Debug, thiserror::Error, uniffi::Error)]
pub enum InventoryError {
    /// The caller's input breaks a rule; nothing was written.
    #[error("invalid {field:?}: {reason}")]
    Invalid { field: ItemField, reason: String },
    #[error("item {id} not found")]
    NotFound { id: i64 },
    /// SQLite or the file system failed. The UI treats this as fatal.
    #[error("storage error: {reason}")]
    Storage { reason: String },
}

impl InventoryError {
    pub(crate) fn invalid(field: ItemField, reason: impl Into<String>) -> Self {
        Self::Invalid {
            field,
            reason: reason.into(),
        }
    }

    pub(crate) fn storage(reason: impl Into<String>) -> Self {
        Self::Storage {
            reason: reason.into(),
        }
    }
}

impl From<rusqlite::Error> for InventoryError {
    fn from(error: rusqlite::Error) -> Self {
        Self::storage(error.to_string())
    }
}

impl From<std::io::Error> for InventoryError {
    fn from(error: std::io::Error) -> Self {
        Self::storage(error.to_string())
    }
}
