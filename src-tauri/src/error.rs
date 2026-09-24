//! One error type for everything the Rust side can fail at.

use serde::{Serialize, Serializer};

/// A failure worth telling the user about.
///
/// Variants carry the cause rather than a pre-rendered string so a caller can
/// still match on what went wrong; the webview only ever sees the message.
#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("База данных не загружена")]
    DbUnavailable,

    #[error("{0}")]
    Db(#[from] sqlx::Error),

    /// Names the row that broke, so a half-applied restore can be explained.
    #[error("{row}: {source}")]
    Row { row: String, source: sqlx::Error },

    #[error("нет связи с сервером: {0}")]
    Unreachable(reqwest::Error),

    #[error("непонятный ответ сервера: {0}")]
    BadResponse(reqwest::Error),

    #[error("не удалось создать HTTP-клиент: {0}")]
    HttpClient(String),

    /// Whatever the server itself said, passed through untouched.
    #[error("{0}")]
    Server(String),

    #[error("нет подключения к серверу")]
    NotConnected,

    #[error("сессия недействительна, войдите заново")]
    SessionExpired,

    #[error("{0}")]
    Io(#[from] std::io::Error),

    #[error("{0}")]
    Tauri(#[from] tauri::Error),
}

impl Error {
    /// Attaches the row a database error happened on.
    pub fn row(row: impl Into<String>) -> impl FnOnce(sqlx::Error) -> Self {
        move |source| Self::Row {
            row: row.into(),
            source,
        }
    }
}

/// A command's error reaches JavaScript as a plain string: the UI shows the
/// message and has nothing to branch on.
impl Serialize for Error {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

pub type Result<T, E = Error> = std::result::Result<T, E>;
