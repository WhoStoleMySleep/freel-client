//! The shapes that go over the wire, matching the server field for field.

use serde::{Deserialize, Serialize};

/// Wire rows, matching the server's shapes field for field.
///
/// Tombstones travel too — unlike a backup, which is a snapshot of what the
/// user has, a sync payload must carry deletions or they would never reach the
/// other device.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub archived: bool,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default)]
    pub deleted_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub project_id: String,
    pub title: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub link: String,
    pub rate_type: String,
    pub rate: f64,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default)]
    pub deleted_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimeEntry {
    pub id: String,
    pub task_id: String,
    pub day_key: String,
    pub minutes: f64,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default)]
    pub deleted_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Invoice {
    pub id: String,
    pub number: String,
    #[serde(default)]
    pub project_name: String,
    pub day_key: String,
    pub status: String,
    #[serde(default)]
    pub factual: Option<f64>,
    pub total: f64,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default)]
    pub deleted_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InvoiceItem {
    pub id: String,
    pub invoice_id: String,
    pub title: String,
    #[serde(default)]
    pub project_name: String,
    pub minutes: f64,
    pub amount: f64,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default)]
    pub deleted_at: Option<String>,
}

/// Preferences worth carrying between devices. `invoice_seq`, the device code
/// and the running timer stay put: the first two keep invoice numbers unique
/// per device, and a timer belongs to the machine it was started on.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub theme_mode: String,
    pub currency: String,
    pub default_rate: f64,
    #[serde(default)]
    pub compact_task_form: bool,
    pub updated_at: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Payload {
    pub settings: Option<Settings>,
    pub projects: Vec<Project>,
    pub tasks: Vec<Task>,
    pub time_entries: Vec<TimeEntry>,
    pub invoices: Vec<Invoice>,
    pub invoice_items: Vec<InvoiceItem>,
}

#[derive(Debug, Deserialize)]
pub struct ServerError {
    pub error: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatus {
    pub url: String,
    pub email: String,
    pub connected: bool,
    pub last_sync_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResult {
    pub sent: usize,
    pub received: usize,
    pub last_sync_at: String,
}

impl Payload {
    /// How many rows the payload carries — what the UI reports as sent or
    /// received. Settings are a single row that always travels, so they are
    /// left out of the count.
    pub fn rows(&self) -> usize {
        self.projects.len()
            + self.tasks.len()
            + self.time_entries.len()
            + self.invoices.len()
            + self.invoice_items.len()
    }
}
