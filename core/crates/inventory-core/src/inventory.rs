//! The home inventory: items stored in SQLite, validated before every write.

use std::path::Path;
use std::sync::{Arc, Mutex, MutexGuard};

use chrono::NaiveDate;
use rusqlite::{Connection, OptionalExtension, Row, TransactionBehavior, params};

use crate::db;
use crate::error::{InventoryError, ItemField};

pub const MAX_NAME_CHARS: usize = 200;
pub const MAX_LOCATION_CHARS: usize = 100;
pub const MAX_QUANTITY: u32 = 999_999;

const COLUMNS: &str = "id, name, location, quantity, expiration_date, created_date";

/// A stored item.
#[derive(Debug, Clone, PartialEq, Eq, uniffi::Record)]
pub struct Item {
    pub id: i64,
    pub name: String,
    pub location: String,
    /// Always at least 1: an item whose quantity reaches 0 is deleted.
    pub quantity: u32,
    /// `YYYY-MM-DD`, or `None` if the item does not expire.
    pub expiration_date: Option<String>,
    /// UTC insert time, `YYYY-MM-DDTHH:MM:SS.SSSZ`.
    pub created_date: String,
}

/// An item to add. The created date is set by the database.
#[derive(Debug, Clone, PartialEq, Eq, uniffi::Record)]
pub struct NewItem {
    pub name: String,
    pub location: String,
    pub quantity: u32,
    /// `YYYY-MM-DD`, or `None` if the item does not expire.
    pub expiration_date: Option<String>,
}

#[derive(uniffi::Object)]
pub struct Inventory {
    conn: Mutex<Connection>,
}

#[uniffi::export]
impl Inventory {
    /// Opens (creating parent directories and the file if needed) and migrates the
    /// database at `path`.
    #[uniffi::constructor]
    pub fn open(path: String) -> Result<Arc<Self>, InventoryError> {
        let conn = db::open(Path::new(&path))?;
        Ok(Arc::new(Self {
            conn: Mutex::new(conn),
        }))
    }

    /// Validates and inserts an item, and returns it as stored. A location that matches an
    /// existing one case-insensitively is stored with the existing spelling.
    pub fn add_item(&self, item: NewItem) -> Result<Item, InventoryError> {
        let item = validate_new_item(&item)?;
        let mut conn = self.lock()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let location = existing_location_spelling(&tx, &item.location, None)?;
        let stored = tx.query_row(
            &format!(
                "INSERT INTO items (name, location, quantity, expiration_date)
                 VALUES (?1, ?2, ?3, ?4) RETURNING {COLUMNS}"
            ),
            params![item.name, location, item.quantity, item.expiration_date],
            item_from_row,
        )?;
        tx.commit()?;
        Ok(stored)
    }

    /// Replaces an item's name, location, quantity and expiration date, validated as for
    /// `add_item`, and returns it as stored. The created date is kept. Quantity 0 is
    /// rejected: removing an item is `delete_item`. Unknown id → `NotFound`.
    pub fn update_item(&self, id: i64, item: NewItem) -> Result<Item, InventoryError> {
        let item = validate_new_item(&item)?;
        let mut conn = self.lock()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        // Ignores the item's own row, so renaming "Fridge" to "fridge" on the only item
        // there takes effect instead of keeping the old spelling.
        let location = existing_location_spelling(&tx, &item.location, Some(id))?;
        let stored = tx
            .query_row(
                &format!(
                    "UPDATE items SET name = ?2, location = ?3, quantity = ?4,
                     expiration_date = ?5 WHERE id = ?1 RETURNING {COLUMNS}"
                ),
                params![id, item.name, location, item.quantity, item.expiration_date],
                item_from_row,
            )
            .optional()?
            .ok_or(InventoryError::NotFound { id })?;
        tx.commit()?;
        Ok(stored)
    }

    /// Deletes an item. Unknown id → `NotFound`.
    pub fn delete_item(&self, id: i64) -> Result<(), InventoryError> {
        match self
            .lock()?
            .execute("DELETE FROM items WHERE id = ?1", [id])?
        {
            0 => Err(InventoryError::NotFound { id }),
            _ => Ok(()),
        }
    }

    /// All items, or those whose name contains `query` case-insensitively. An empty or
    /// whitespace-only query returns all items. Ordered by expiration date (soonest first,
    /// non-expiring last), then name, then id.
    pub fn list_items(&self, query: Option<String>) -> Result<Vec<Item>, InventoryError> {
        let pattern = query
            .as_deref()
            .map(str::trim)
            .filter(|q| !q.is_empty())
            .map(|q| format!("%{}%", escape_like(q)));
        let conn = self.lock()?;
        let mut stmt = conn.prepare_cached(&format!(
            "SELECT {COLUMNS} FROM items
             WHERE ?1 IS NULL OR name LIKE ?1 ESCAPE '\\'
             ORDER BY expiration_date IS NULL, expiration_date, name, id"
        ))?;
        let items = stmt
            .query_map([pattern], item_from_row)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(items)
    }

    /// Sets an item's quantity. A quantity of 0 deletes the item and returns `None`;
    /// otherwise returns the updated item.
    pub fn set_item_quantity(
        &self,
        id: i64,
        quantity: u32,
    ) -> Result<Option<Item>, InventoryError> {
        validate_quantity(quantity)?;
        let conn = self.lock()?;
        if quantity == 0 {
            return match conn.execute("DELETE FROM items WHERE id = ?1", [id])? {
                0 => Err(InventoryError::NotFound { id }),
                _ => Ok(None),
            };
        }
        conn.query_row(
            &format!("UPDATE items SET quantity = ?2 WHERE id = ?1 RETURNING {COLUMNS}"),
            params![id, quantity],
            item_from_row,
        )
        .optional()?
        .map(Some)
        .ok_or(InventoryError::NotFound { id })
    }

    /// Distinct locations in use, alphabetical (case-insensitive).
    pub fn list_locations(&self) -> Result<Vec<String>, InventoryError> {
        let conn = self.lock()?;
        let mut stmt =
            conn.prepare_cached("SELECT DISTINCT location FROM items ORDER BY location")?;
        let locations = stmt
            .query_map([], |row| row.get(0))?
            .collect::<Result<Vec<String>, _>>()?;
        Ok(locations)
    }
}

impl Inventory {
    fn lock(&self) -> Result<MutexGuard<'_, Connection>, InventoryError> {
        self.conn
            .lock()
            .map_err(|_| InventoryError::storage("database lock poisoned by an earlier panic"))
    }
}

fn item_from_row(row: &Row<'_>) -> rusqlite::Result<Item> {
    Ok(Item {
        id: row.get(0)?,
        name: row.get(1)?,
        location: row.get(2)?,
        quantity: row.get(3)?,
        expiration_date: row.get(4)?,
        created_date: row.get(5)?,
    })
}

/// Validated, normalised fields of a `NewItem`.
struct ValidItem {
    name: String,
    location: String,
    quantity: u32,
    expiration_date: Option<String>,
}

fn validate_new_item(item: &NewItem) -> Result<ValidItem, InventoryError> {
    let name = validate_text(&item.name, ItemField::Name, "Item", MAX_NAME_CHARS)?;
    let location = validate_text(
        &item.location,
        ItemField::Location,
        "Location",
        MAX_LOCATION_CHARS,
    )?;
    if item.quantity == 0 {
        return Err(InventoryError::invalid(
            ItemField::Quantity,
            "Quantity must be at least 1",
        ));
    }
    validate_quantity(item.quantity)?;
    let expiration_date = item
        .expiration_date
        .as_deref()
        .map(validate_date)
        .transpose()?;
    Ok(ValidItem {
        name,
        location,
        quantity: item.quantity,
        expiration_date,
    })
}

/// The stored spelling of a location matching `location` case-insensitively, ignoring the
/// item `except`, or `location` itself if there is none.
fn existing_location_spelling(
    conn: &Connection,
    location: &str,
    except: Option<i64>,
) -> Result<String, InventoryError> {
    Ok(conn
        .query_row(
            "SELECT location FROM items WHERE location = ?1 AND id IS NOT ?2
             ORDER BY id LIMIT 1",
            params![location, except],
            |row| row.get(0),
        )
        .optional()?
        .unwrap_or_else(|| location.to_string()))
}

fn validate_text(
    value: &str,
    field: ItemField,
    label: &str,
    max_chars: usize,
) -> Result<String, InventoryError> {
    let value = value.trim();
    if value.is_empty() {
        return Err(InventoryError::invalid(
            field,
            format!("{label} is required"),
        ));
    }
    if value.chars().count() > max_chars {
        return Err(InventoryError::invalid(
            field,
            format!("{label} must be at most {max_chars} characters"),
        ));
    }
    Ok(value.to_string())
}

fn validate_quantity(quantity: u32) -> Result<(), InventoryError> {
    if quantity > MAX_QUANTITY {
        return Err(InventoryError::invalid(
            ItemField::Quantity,
            format!("Quantity must be at most {MAX_QUANTITY}"),
        ));
    }
    Ok(())
}

/// Accepts `YYYY-MM-DD` for a real calendar date and returns it in canonical form.
fn validate_date(value: &str) -> Result<String, InventoryError> {
    NaiveDate::parse_from_str(value.trim(), "%Y-%m-%d")
        .map(|date| date.format("%Y-%m-%d").to_string())
        .map_err(|_| {
            InventoryError::invalid(
                ItemField::ExpirationDate,
                "Expiration date must be a valid YYYY-MM-DD date",
            )
        })
}

/// Escapes LIKE wildcards so user text matches literally (with `ESCAPE '\'`).
fn escape_like(text: &str) -> String {
    let mut escaped = String::with_capacity(text.len());
    for c in text.chars() {
        if matches!(c, '\\' | '%' | '_') {
            escaped.push('\\');
        }
        escaped.push(c);
    }
    escaped
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{DateTime, Utc};

    fn inventory() -> Inventory {
        Inventory {
            conn: Mutex::new(db::open_in_memory().unwrap()),
        }
    }

    fn new_item(name: &str, location: &str) -> NewItem {
        NewItem {
            name: name.to_string(),
            location: location.to_string(),
            quantity: 1,
            expiration_date: None,
        }
    }

    fn expiring(name: &str, date: &str) -> NewItem {
        NewItem {
            expiration_date: Some(date.to_string()),
            ..new_item(name, "Fridge")
        }
    }

    fn names(items: &[Item]) -> Vec<&str> {
        items.iter().map(|item| item.name.as_str()).collect()
    }

    fn assert_invalid<T>(result: Result<T, InventoryError>, expected: ItemField) {
        match result {
            Err(InventoryError::Invalid { field, .. }) => assert_eq!(field, expected),
            Err(other) => panic!("expected Invalid({expected:?}), got {other:?}"),
            Ok(_) => panic!("expected Invalid({expected:?}), got Ok"),
        }
    }

    fn assert_storage<T>(result: Result<T, InventoryError>) {
        match result {
            Err(InventoryError::Storage { .. }) => {}
            Err(other) => panic!("expected Storage, got {other:?}"),
            Ok(_) => panic!("expected Storage, got Ok"),
        }
    }

    fn raw_insert(inventory: &Inventory, columns: &str, values: &str) -> rusqlite::Result<usize> {
        inventory.lock().unwrap().execute(
            &format!("INSERT INTO items ({columns}) VALUES ({values})"),
            [],
        )
    }

    // --- migrations -------------------------------------------------------------------

    #[test]
    fn fresh_database_reaches_current_schema_version() {
        let inventory = inventory();
        let version: i64 = inventory
            .lock()
            .unwrap()
            .pragma_query_value(None, "user_version", |row| row.get(0))
            .unwrap();
        assert_eq!(version, db::SCHEMA_VERSION);
    }

    #[test]
    fn reopening_keeps_items_and_does_not_rerun_migrations() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("nested/inventory.sqlite3");
        let path = path.to_str().unwrap().to_string();

        Inventory::open(path.clone())
            .unwrap()
            .add_item(new_item("Hammer", "Garage"))
            .unwrap();
        let reopened = Inventory::open(path).unwrap();
        assert_eq!(names(&reopened.list_items(None).unwrap()), ["Hammer"]);
    }

    #[test]
    fn newer_schema_version_is_refused() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("inventory.sqlite3");
        Connection::open(&path)
            .unwrap()
            .pragma_update(None, "user_version", db::SCHEMA_VERSION + 1)
            .unwrap();
        assert_storage(Inventory::open(path.to_str().unwrap().to_string()));
    }

    // --- add_item ---------------------------------------------------------------------

    #[test]
    fn add_item_applies_defaults_and_created_date() {
        let inventory = inventory();
        let before = Utc::now();
        let item = inventory.add_item(new_item("Hammer", "Garage")).unwrap();
        let after = Utc::now();

        assert_eq!(item.name, "Hammer");
        assert_eq!(item.location, "Garage");
        assert_eq!(item.quantity, 1);
        assert_eq!(item.expiration_date, None);
        let created: DateTime<Utc> = item.created_date.parse().unwrap();
        assert!(item.created_date.ends_with('Z'), "{}", item.created_date);
        // created_date has millisecond precision.
        assert!(created >= before - chrono::Duration::milliseconds(1) && created <= after);
        assert_eq!(inventory.list_items(None).unwrap(), [item]);
    }

    #[test]
    fn add_item_trims_text_and_canonicalises_date() {
        let inventory = inventory();
        let item = inventory
            .add_item(NewItem {
                name: "  Milk 1 gallon ".to_string(),
                location: " Fridge ".to_string(),
                quantity: 2,
                expiration_date: Some(" 2027-10-27 ".to_string()),
            })
            .unwrap();
        assert_eq!(item.name, "Milk 1 gallon");
        assert_eq!(item.location, "Fridge");
        assert_eq!(item.quantity, 2);
        assert_eq!(item.expiration_date.as_deref(), Some("2027-10-27"));
    }

    #[test]
    fn add_item_reuses_existing_location_spelling() {
        let inventory = inventory();
        inventory.add_item(new_item("Milk", "Fridge")).unwrap();
        let item = inventory.add_item(new_item("Eggs", "fRIDGE")).unwrap();
        assert_eq!(item.location, "Fridge");
        assert_eq!(inventory.list_locations().unwrap(), ["Fridge"]);
    }

    #[test]
    fn add_item_rejects_invalid_fields() {
        let inventory = inventory();
        assert_invalid(
            inventory.add_item(new_item("   ", "Garage")),
            ItemField::Name,
        );
        assert_invalid(
            inventory.add_item(new_item(&"x".repeat(MAX_NAME_CHARS + 1), "Garage")),
            ItemField::Name,
        );
        assert_invalid(
            inventory.add_item(new_item("Hammer", "")),
            ItemField::Location,
        );
        assert_invalid(
            inventory.add_item(new_item("Hammer", &"x".repeat(MAX_LOCATION_CHARS + 1))),
            ItemField::Location,
        );
        for quantity in [0, MAX_QUANTITY + 1] {
            assert_invalid(
                inventory.add_item(NewItem {
                    quantity,
                    ..new_item("Hammer", "Garage")
                }),
                ItemField::Quantity,
            );
        }
        for date in ["2027-02-30", "27/10/2027", "next Friday", ""] {
            assert_invalid(
                inventory.add_item(expiring("Milk", date)),
                ItemField::ExpirationDate,
            );
        }
        assert!(inventory.list_items(None).unwrap().is_empty());
    }

    #[test]
    fn length_limits_count_characters_not_bytes() {
        let inventory = inventory();
        let name = "é".repeat(MAX_NAME_CHARS);
        assert_eq!(
            inventory.add_item(new_item(&name, "Pantry")).unwrap().name,
            name
        );
    }

    // --- schema guards ----------------------------------------------------------------

    #[test]
    fn schema_rejects_invalid_rows() {
        let inventory = inventory();
        let cols = "name, location, quantity";
        assert!(raw_insert(&inventory, cols, "'Milk', 'Fridge', 1").is_ok());
        assert!(raw_insert(&inventory, cols, "'Milk', 'Fridge', 0").is_err());
        assert!(raw_insert(&inventory, cols, "'Milk', 'Fridge', -1").is_err());
        assert!(raw_insert(&inventory, cols, "'Milk', 'Fridge', 'two'").is_err());
        assert!(raw_insert(&inventory, cols, "'Milk', 'Fridge', 1.5").is_err());
        assert!(raw_insert(&inventory, cols, "'  ', 'Fridge', 1").is_err());
        assert!(raw_insert(&inventory, cols, "'Milk', '', 1").is_err());
        let cols = "name, location, expiration_date";
        assert!(raw_insert(&inventory, cols, "'Milk', 'Fridge', '2027-10-27'").is_ok());
        assert!(raw_insert(&inventory, cols, "'Milk', 'Fridge', '2027-02-30'").is_err());
        assert!(raw_insert(&inventory, cols, "'Milk', 'Fridge', 'Oct 27'").is_err());
        let cols = "name, location, created_date";
        assert!(
            raw_insert(
                &inventory,
                cols,
                "'Milk', 'Fridge', '2026-11-05T10:00:00.000Z'"
            )
            .is_ok()
        );
        assert!(raw_insert(&inventory, cols, "'Milk', 'Fridge', '2026-11-05'").is_err());
        assert!(raw_insert(&inventory, cols, "'Milk', 'Fridge', 'yesterday'").is_err());
    }

    // --- list_items -------------------------------------------------------------------

    #[test]
    fn search_matches_partial_names_case_insensitively() {
        let inventory = inventory();
        for name in ["Milk 1 gallon", "Almond milk", "Hammer"] {
            inventory.add_item(new_item(name, "Kitchen")).unwrap();
        }
        let search = |q: &str| {
            names(&inventory.list_items(Some(q.to_string())).unwrap())
                .into_iter()
                .map(str::to_string)
                .collect::<Vec<_>>()
        };
        assert_eq!(search("MIL"), ["Almond milk", "Milk 1 gallon"]);
        assert_eq!(search(" ham "), ["Hammer"]);
        assert_eq!(search("1 gal"), ["Milk 1 gallon"]);
        assert!(search("bread").is_empty());
        assert_eq!(search("   ").len(), 3);
        assert_eq!(inventory.list_items(None).unwrap().len(), 3);
    }

    #[test]
    fn search_treats_like_wildcards_literally() {
        let inventory = inventory();
        for name in ["50% off soap", "500 g flour", "a_b", "axb", r"back\slash"] {
            inventory.add_item(new_item(name, "Pantry")).unwrap();
        }
        let search = |q: &str| inventory.list_items(Some(q.to_string())).unwrap();
        assert_eq!(names(&search("50%")), ["50% off soap"]);
        assert_eq!(names(&search("a_b")), ["a_b"]);
        assert_eq!(names(&search(r"k\s")), [r"back\slash"]);
        assert!(search("%").len() == 1 && search("_").len() == 1);
    }

    #[test]
    fn items_are_ordered_by_expiration_then_name() {
        let inventory = inventory();
        inventory.add_item(new_item("hammer", "Garage")).unwrap();
        inventory
            .add_item(expiring("Yogurt", "2026-11-20"))
            .unwrap();
        inventory.add_item(new_item("Batteries", "Garage")).unwrap();
        inventory.add_item(expiring("Milk", "2026-11-09")).unwrap();
        inventory.add_item(expiring("eggs", "2026-11-20")).unwrap();
        assert_eq!(
            names(&inventory.list_items(None).unwrap()),
            ["Milk", "eggs", "Yogurt", "Batteries", "hammer"]
        );
    }

    #[test]
    fn locations_are_distinct_and_alphabetical() {
        let inventory = inventory();
        for (name, location) in [("Milk", "Fridge"), ("Hammer", "garage"), ("Eggs", "Fridge")] {
            inventory.add_item(new_item(name, location)).unwrap();
        }
        inventory.add_item(new_item("Rice", "Pantry")).unwrap();
        assert_eq!(
            inventory.list_locations().unwrap(),
            ["Fridge", "garage", "Pantry"]
        );
    }

    // --- set_item_quantity ------------------------------------------------------------

    #[test]
    fn set_item_quantity_updates_or_deletes_at_zero() {
        let inventory = inventory();
        let milk = inventory.add_item(new_item("Milk", "Fridge")).unwrap();
        let rice = inventory.add_item(new_item("Rice", "Pantry")).unwrap();

        let updated = inventory.set_item_quantity(milk.id, 3).unwrap().unwrap();
        assert_eq!(
            updated,
            Item {
                quantity: 3,
                ..milk.clone()
            }
        );

        assert_eq!(inventory.set_item_quantity(milk.id, 0).unwrap(), None);
        assert_eq!(inventory.list_items(None).unwrap(), [rice]);
    }

    #[test]
    fn ids_of_deleted_items_are_never_reused() {
        let inventory = inventory();
        let milk = inventory.add_item(new_item("Milk", "Fridge")).unwrap();
        let rice = inventory.add_item(new_item("Rice", "Pantry")).unwrap();

        // Deleting the newest row is the case where a plain INTEGER PRIMARY KEY would hand
        // its id to the next insert.
        inventory.set_item_quantity(rice.id, 0).unwrap();
        let eggs = inventory.add_item(new_item("Eggs", "Fridge")).unwrap();

        assert!(eggs.id > rice.id && rice.id > milk.id);
        // A stale reference to the deleted item finds nothing instead of changing Eggs.
        assert!(matches!(
            inventory.set_item_quantity(rice.id, 5),
            Err(InventoryError::NotFound { .. })
        ));
        assert_eq!(
            names(&inventory.list_items(None).unwrap()),
            ["Eggs", "Milk"]
        );
        assert_eq!(inventory.list_items(None).unwrap()[0].quantity, 1);
    }

    #[test]
    fn set_item_quantity_reports_unknown_items_and_bad_quantities() {
        let inventory = inventory();
        for quantity in [0, 5] {
            assert!(matches!(
                inventory.set_item_quantity(42, quantity),
                Err(InventoryError::NotFound { id: 42 })
            ));
        }
        let milk = inventory.add_item(new_item("Milk", "Fridge")).unwrap();
        assert_invalid(
            inventory.set_item_quantity(milk.id, MAX_QUANTITY + 1),
            ItemField::Quantity,
        );
    }

    // --- update_item ------------------------------------------------------------------

    #[test]
    fn update_item_replaces_fields_and_keeps_id_and_created_date() {
        let inventory = inventory();
        let milk = inventory.add_item(new_item("Milk", "Fridge")).unwrap();
        let rice = inventory.add_item(new_item("Rice", "Pantry")).unwrap();

        let updated = inventory
            .update_item(
                milk.id,
                NewItem {
                    name: "  Oat milk ".to_string(),
                    location: " Pantry ".to_string(),
                    quantity: 4,
                    expiration_date: Some(" 2027-01-05 ".to_string()),
                },
            )
            .unwrap();

        assert_eq!(
            updated,
            Item {
                id: milk.id,
                name: "Oat milk".to_string(),
                location: "Pantry".to_string(),
                quantity: 4,
                expiration_date: Some("2027-01-05".to_string()),
                created_date: milk.created_date.clone(),
            }
        );
        assert_eq!(inventory.list_items(None).unwrap(), [updated, rice]);
    }

    #[test]
    fn update_item_can_clear_the_expiration_date() {
        let inventory = inventory();
        let milk = inventory.add_item(expiring("Milk", "2026-11-09")).unwrap();
        let updated = inventory
            .update_item(milk.id, new_item("Milk", "Fridge"))
            .unwrap();
        assert_eq!(updated.expiration_date, None);
    }

    #[test]
    fn update_item_reuses_other_items_location_spelling_but_not_its_own() {
        let inventory = inventory();
        let milk = inventory.add_item(new_item("Milk", "Fridge")).unwrap();
        let hammer = inventory.add_item(new_item("Hammer", "Garage")).unwrap();

        // Another item already uses "Fridge", so its spelling wins.
        let moved = inventory
            .update_item(hammer.id, new_item("Hammer", "FRIDGE"))
            .unwrap();
        assert_eq!(moved.location, "Fridge");

        // Hammer is the only item in "Garage", so respelling it is not undone by its own
        // stored spelling.
        inventory
            .update_item(hammer.id, new_item("Hammer", "Garage"))
            .unwrap();
        let respelled = inventory
            .update_item(hammer.id, new_item("Hammer", "garage"))
            .unwrap();
        assert_eq!(respelled.location, "garage");
        assert_eq!(inventory.list_locations().unwrap(), ["Fridge", "garage"]);
        assert_eq!(inventory.list_items(None).unwrap().len(), 2);
        assert_eq!(
            inventory
                .update_item(milk.id, new_item("Milk", "fridge"))
                .unwrap()
                .location,
            "fridge"
        );
    }

    #[test]
    fn update_item_rejects_invalid_fields_and_changes_nothing() {
        let inventory = inventory();
        let milk = inventory.add_item(expiring("Milk", "2026-11-09")).unwrap();
        assert_invalid(
            inventory.update_item(milk.id, new_item(" ", "Fridge")),
            ItemField::Name,
        );
        assert_invalid(
            inventory.update_item(milk.id, new_item("Milk", "")),
            ItemField::Location,
        );
        for quantity in [0, MAX_QUANTITY + 1] {
            assert_invalid(
                inventory.update_item(
                    milk.id,
                    NewItem {
                        quantity,
                        ..new_item("Milk", "Fridge")
                    },
                ),
                ItemField::Quantity,
            );
        }
        assert_invalid(
            inventory.update_item(milk.id, expiring("Milk", "2027-02-30")),
            ItemField::ExpirationDate,
        );
        assert_eq!(inventory.list_items(None).unwrap(), [milk]);
    }

    #[test]
    fn update_item_reports_unknown_items() {
        let inventory = inventory();
        assert!(matches!(
            inventory.update_item(42, new_item("Milk", "Fridge")),
            Err(InventoryError::NotFound { id: 42 })
        ));
        assert!(inventory.list_items(None).unwrap().is_empty());
    }

    // --- delete_item ------------------------------------------------------------------

    #[test]
    fn delete_item_removes_only_that_item() {
        let inventory = inventory();
        let milk = inventory.add_item(new_item("Milk", "Fridge")).unwrap();
        let rice = inventory.add_item(new_item("Rice", "Pantry")).unwrap();

        inventory.delete_item(milk.id).unwrap();

        assert_eq!(inventory.list_items(None).unwrap(), [rice]);
        assert_eq!(inventory.list_locations().unwrap(), ["Pantry"]);
        assert!(matches!(
            inventory.delete_item(milk.id),
            Err(InventoryError::NotFound { .. })
        ));
        assert!(matches!(
            inventory.update_item(milk.id, new_item("Milk", "Fridge")),
            Err(InventoryError::NotFound { .. })
        ));
    }

    // --- storage failures -------------------------------------------------------------

    #[test]
    fn uncreatable_directory_is_a_storage_error() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("not-a-directory");
        std::fs::write(&file, b"x").unwrap();
        let path = file.join("inventory.sqlite3");
        assert_storage(Inventory::open(path.to_str().unwrap().to_string()));
    }

    #[test]
    fn non_database_file_is_a_storage_error() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("inventory.sqlite3");
        std::fs::write(&path, vec![b'x'; 4096]).unwrap();
        assert_storage(Inventory::open(path.to_str().unwrap().to_string()));
    }

    #[test]
    fn failed_write_is_a_storage_error_and_changes_nothing() {
        let inventory = inventory();
        let milk = inventory.add_item(new_item("Milk", "Fridge")).unwrap();
        let set_query_only = |on: bool| {
            inventory
                .lock()
                .unwrap()
                .pragma_update(None, "query_only", on)
                .unwrap()
        };

        set_query_only(true);
        assert_storage(inventory.add_item(new_item("Rice", "Pantry")));
        assert_storage(inventory.set_item_quantity(milk.id, 2));
        assert_storage(inventory.set_item_quantity(milk.id, 0));
        assert_storage(inventory.update_item(milk.id, new_item("Oat milk", "Pantry")));
        assert_storage(inventory.delete_item(milk.id));
        set_query_only(false);

        assert_eq!(inventory.list_items(None).unwrap(), [milk]);
    }
}
