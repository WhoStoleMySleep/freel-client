//! The requests themselves: one shared client, one place that reads a failure.

use std::sync::OnceLock;
use std::time::Duration;

use serde::Deserialize;
use serde_json::json;

use crate::error::{Error, Result};

use super::local::{Device, Session};
use super::wire::{Payload, ServerError};

/// What the sign-in form collected.
///
/// Deliberately not `Debug`: the password must not be formattable into a log.
pub struct Credentials {
    pub email: String,
    pub password: String,
}

/// Trailing slashes would produce `//sync`, which some proxies reject.
pub(super) fn endpoint(base: &str, path: &str) -> String {
    format!("{}/{}", base.trim_end_matches('/'), path)
}

/// A whole exchange, not a single packet: a large first sync legitimately
/// takes seconds, while a dead server must not hold the loop forever.
const TIMEOUT: Duration = Duration::from_secs(30);

/// The process-wide HTTP client.
///
/// A `Client` owns its connection pool, so building one per request meant the
/// auto-sync loop paid for a fresh TCP and TLS handshake — and a new idle pool
/// to drop — on every exchange. Cloning shares the pool instead.
pub(super) fn client() -> Result<reqwest::Client> {
    static CLIENT: OnceLock<std::result::Result<reqwest::Client, String>> = OnceLock::new();
    CLIENT
        .get_or_init(|| {
            reqwest::Client::builder()
                .timeout(TIMEOUT)
                .build()
                .map_err(|e| e.to_string())
        })
        .clone()
        .map_err(Error::HttpClient)
}

/// Whatever the server said went wrong, or the bare status if it said nothing.
async fn failure(res: reqwest::Response) -> Error {
    let status = res.status();
    match res.json::<ServerError>().await {
        Ok(e) => Error::Server(e.error),
        Err(_) => Error::Server(format!("сервер ответил {status}")),
    }
}

/// Creates the account. A registration returns no token — the caller logs in next.
pub async fn register(url: &str, creds: &Credentials) -> Result<()> {
    let res = client()?
        .post(endpoint(url, "auth/register"))
        .json(&json!({ "email": creds.email, "password": creds.password }))
        .send()
        .await
        .map_err(Error::Unreachable)?;

    if res.status().is_success() {
        Ok(())
    } else {
        Err(failure(res).await)
    }
}

/// Signs in and returns the token the exchange will be carried on.
pub async fn login(url: &str, creds: &Credentials, device: &Device) -> Result<String> {
    let res = client()?
        .post(endpoint(url, "auth/login"))
        .json(&json!({
            "email": creds.email,
            "password": creds.password,
            "deviceId": device.id,
            "deviceName": device.code,
        }))
        .send()
        .await
        .map_err(Error::Unreachable)?;

    if !res.status().is_success() {
        return Err(failure(res).await);
    }

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct LoginResponse {
        token: String,
    }
    let body: LoginResponse = res.json().await.map_err(Error::BadResponse)?;
    Ok(body.token)
}

/// Sends what this device holds and returns what the server has for it.
///
/// A rejected token comes back as [`Error::SessionExpired`]; the caller is the
/// one that knows how to forget it.
pub async fn exchange(session: &Session, local: &Payload) -> Result<Payload> {
    let res = client()?
        .post(endpoint(&session.url, "sync"))
        .bearer_auth(&session.token)
        .json(local)
        .send()
        .await
        .map_err(Error::Unreachable)?;

    if res.status() == reqwest::StatusCode::UNAUTHORIZED {
        return Err(Error::SessionExpired);
    }
    if !res.status().is_success() {
        return Err(failure(res).await);
    }
    res.json().await.map_err(Error::BadResponse)
}
