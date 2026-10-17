//! Loopback HTTP and SSE server for the contract. Slice S1.

use crate::contract::{
    now_iso, CredentialRequest, ErrorBody, StartRequest, StateReply, Status, StopRequest,
    API_VERSION, SERVICE,
};
use crate::credentials::KeyStore;
use crate::engine::{Engine, EngineError};
use serde::{de::DeserializeOwned, Serialize};
use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};
use tiny_http::{Header, Method, Request, Response, Server};

const MAX_BODY: usize = 64 * 1024;
const PING_INTERVAL: Duration = Duration::from_secs(15);

pub struct ServerHandle {
    pub port: u16,
    server: Arc<Server>,
    stopping: Arc<AtomicBool>,
    worker: JoinHandle<()>,
}

impl ServerHandle {
    /// Stop accepting requests and join the HTTP and SSE workers.
    /// An idle SSE worker can take up to one ping interval to exit.
    pub fn shutdown(self) {
        self.stopping.store(true, Ordering::Release);
        self.server.unblock();
        let _ = self.worker.join();
    }
}

pub fn serve(
    engine: Engine,
    keys: Arc<dyn KeyStore>,
    private_mode: bool,
    port: u16,
) -> Result<ServerHandle, String> {
    serve_with_ping(engine, keys, private_mode, port, PING_INTERVAL)
}

/// `serve` with the SSE ping interval as a parameter, so tests do not wait 15 s.
fn serve_with_ping(
    engine: Engine,
    keys: Arc<dyn KeyStore>,
    private_mode: bool,
    port: u16,
    ping: Duration,
) -> Result<ServerHandle, String> {
    let server = Arc::new(Server::http(("127.0.0.1", port)).map_err(|e| e.to_string())?);
    let port = server.server_addr().to_ip().unwrap().port();
    let stopping = Arc::new(AtomicBool::new(false));
    let worker_server = server.clone();
    let worker_stopping = stopping.clone();
    let worker = thread::Builder::new()
        .name("scribe-http".into())
        .spawn(move || {
            let host = format!("127.0.0.1:{port}");
            let mut streams: Vec<JoinHandle<()>> = Vec::new();
            while !worker_stopping.load(Ordering::Acquire) {
                let request = match worker_server.recv() {
                    Ok(request) => request,
                    Err(_) => break,
                };
                // Release completed client threads without retaining their handles forever.
                let mut i = 0;
                while i < streams.len() {
                    if streams[i].is_finished() {
                        let _ = streams.swap_remove(i).join();
                    } else {
                        i += 1;
                    }
                }
                if !allowed(&request, &host) {
                    error(request, 403, "forbidden");
                } else if request.body_length().is_some_and(|len| len > MAX_BODY) {
                    error(request, 400, "bad_request");
                } else if request.url() == "/v1/events" && request.method() == &Method::Get {
                    let events = engine.subscribe();
                    let stopping = worker_stopping.clone();
                    if let Ok(worker) = thread::Builder::new()
                        .name("scribe-sse".into())
                        .spawn(move || stream_events(request, events, stopping, ping))
                    {
                        streams.push(worker);
                    }
                } else {
                    route(request, &engine, keys.as_ref(), private_mode);
                }
            }
            for stream in streams {
                let _ = stream.join();
            }
        })
        .map_err(|e| e.to_string())?;
    Ok(ServerHandle {
        port,
        server,
        stopping,
        worker,
    })
}

fn allowed(request: &Request, host: &str) -> bool {
    let mut hosts = request.headers().iter().filter(|h| h.field.equiv("Host"));
    !request.headers().iter().any(|h| h.field.equiv("Origin"))
        && hosts.next().is_some_and(|h| h.value.as_str() == host)
        && hosts.next().is_none()
}

fn header(name: &str, value: &str) -> Header {
    Header::from_bytes(name, value).unwrap()
}

fn json(request: Request, status: u16, value: &impl Serialize) {
    let response = Response::from_data(serde_json::to_vec(value).unwrap())
        .with_status_code(status)
        .with_header(header("Content-Type", "application/json"))
        .with_header(header("Cache-Control", "no-store"));
    // Client disconnects do not change the engine state.
    let _ = request.respond(response);
}

fn error(request: Request, status: u16, code: &str) {
    json(request, status, &ErrorBody { error: code.into() });
}

fn empty(request: Request) {
    let _ = request.respond(Response::empty(204).with_header(header("Cache-Control", "no-store")));
}

fn body<T: DeserializeOwned>(request: &mut Request) -> Result<T, ()> {
    let mut bytes = Vec::new();
    request
        .as_reader()
        .take((MAX_BODY + 1) as u64)
        .read_to_end(&mut bytes)
        .map_err(|_| ())?;
    if bytes.len() > MAX_BODY {
        return Err(());
    }
    serde_json::from_slice(&bytes).map_err(|_| ())
}

fn state_reply(request: Request, state: Result<crate::contract::State, EngineError>) {
    match state {
        Ok(state) => json(request, 200, &StateReply::new(state)),
        Err(EngineError::InvalidState(_)) => error(request, 409, "invalid_state"),
    }
}

fn route(mut request: Request, engine: &Engine, keys: &dyn KeyStore, private_mode: bool) {
    match (request.url(), request.method()) {
        ("/v1/status", Method::Get) => {
            let status = Status {
                service: SERVICE.into(),
                api_version: API_VERSION,
                state: engine.state(),
                sampled_at: now_iso(),
                groq_key: keys.get().is_some()
                    || std::env::var_os("GROQ_API_KEY").is_some_and(|key| !key.is_empty()),
                private_mode,
            };
            json(request, 200, &status);
        }
        ("/v1/start", Method::Post) => match body::<StartRequest>(&mut request) {
            Ok(command) => state_reply(request, engine.start(command.mode, None)),
            Err(()) => error(request, 400, "bad_request"),
        },
        ("/v1/stop", Method::Post) => match body::<StopRequest>(&mut request) {
            Ok(command) => state_reply(request, engine.stop(command.paste)),
            Err(()) => error(request, 400, "bad_request"),
        },
        ("/v1/credentials/groq", Method::Put) => {
            match body::<CredentialRequest>(&mut request) {
                Ok(command) if !command.key.is_empty() => {
                    if keys.set(&command.key).is_ok() {
                        empty(request);
                    } else {
                        // Store errors can contain secrets. Return only a fixed code.
                        error(request, 500, "store_error");
                    }
                }
                _ => error(request, 400, "bad_request"),
            }
        }
        ("/v1/credentials/groq", Method::Delete) => {
            if keys.delete().is_ok() {
                empty(request);
            } else {
                error(request, 500, "store_error");
            }
        }
        ("/v1/status" | "/v1/start" | "/v1/stop" | "/v1/events" | "/v1/credentials/groq", _) => {
            error(request, 405, "method_not_allowed");
        }
        _ => error(request, 404, "not_found"),
    }
}

fn stream_events(
    request: Request,
    events: mpsc::Receiver<crate::contract::Event>,
    stopping: Arc<AtomicBool>,
    ping: Duration,
) {
    let mut writer = request.into_writer();
    if writer
        .write_all(b"HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n")
        .and_then(|()| writer.flush())
        .is_err()
    {
        return;
    }
    let mut next_ping = Instant::now() + ping;
    while !stopping.load(Ordering::Acquire) {
        if Instant::now() >= next_ping {
            if writer
                .write_all(b": ping\n\n")
                .and_then(|()| writer.flush())
                .is_err()
            {
                break;
            }
            next_ping = Instant::now() + ping;
        }
        let result = match events.recv_timeout(next_ping.saturating_duration_since(Instant::now()))
        {
            Ok(event) => {
                let mut value = serde_json::to_value(event).unwrap();
                value["service"] = SERVICE.into();
                value["apiVersion"] = API_VERSION.into();
                writeln!(writer, "data: {value}\n")
            }
            Err(mpsc::RecvTimeoutError::Timeout) => continue,
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
        };
        if result.and_then(|()| writer.flush()).is_err() {
            break;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::contract::{Event, State};
    use crate::credentials::{KeyStore, MemoryKeyStore};
    use crate::engine::fakes::{engine, FakeRecorder};
    use serde_json::{json, Value};
    use std::io::{BufRead, BufReader};
    use std::net::{TcpListener, TcpStream};

    const TEST_PING: Duration = Duration::from_millis(50);

    struct TestServer(Option<ServerHandle>);

    impl TestServer {
        fn new() -> Self {
            Self::with_keys(Arc::new(MemoryKeyStore::default()))
        }

        fn with_keys(keys: Arc<dyn KeyStore>) -> Self {
            let (engine, _) = engine(
                FakeRecorder {
                    duration_ms: 1000,
                    ..Default::default()
                },
                Ok("hello"),
            );
            Self(Some(
                serve_with_ping(engine, keys, true, 0, TEST_PING).unwrap(),
            ))
        }

        fn port(&self) -> u16 {
            self.0.as_ref().unwrap().port
        }

        fn connect(&self) -> TcpStream {
            let stream = TcpStream::connect(("127.0.0.1", self.port())).unwrap();
            stream
                .set_read_timeout(Some(Duration::from_secs(20)))
                .unwrap();
            stream
                .set_write_timeout(Some(Duration::from_secs(2)))
                .unwrap();
            stream
        }

        fn request(&self, method: &str, path: &str, body: &str) -> Reply {
            self.raw(&format!(
                "{method} {path} HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nConnection: close\r\nContent-Length: {}\r\n\r\n{body}",
                self.port(), body.len(),
            ))
        }

        fn raw(&self, request: &str) -> Reply {
            let mut stream = self.connect();
            stream.write_all(request.as_bytes()).unwrap();
            let mut response = String::new();
            stream.read_to_string(&mut response).unwrap();
            let (headers, body) = response.split_once("\r\n\r\n").unwrap();
            let status = headers.split_whitespace().nth(1).unwrap().parse().unwrap();
            let headers = headers.to_ascii_lowercase();
            assert!(headers.contains("cache-control: no-store"));
            if status == 204 {
                assert!(body.is_empty());
                assert!(!headers.contains("content-type:"));
            } else {
                assert!(headers.contains("content-type: application/json"));
            }
            Reply {
                status,
                body: if body.is_empty() {
                    Value::Null
                } else {
                    serde_json::from_str(body).unwrap()
                },
            }
        }
    }

    impl Drop for TestServer {
        fn drop(&mut self) {
            self.0.take().unwrap().shutdown();
        }
    }

    struct Reply {
        status: u16,
        body: Value,
    }

    impl Reply {
        fn error(&self, status: u16, code: &str) {
            assert_eq!(self.status, status);
            assert_eq!(self.body, json!({"error": code}));
        }
    }

    #[test]
    fn status_and_credentials() {
        let server = TestServer::new();
        let env_key = std::env::var_os("GROQ_API_KEY").is_some_and(|key| !key.is_empty());
        let reply = server.request("GET", "/v1/status", "");
        assert_eq!(reply.status, 200);
        let status: Status = serde_json::from_value(reply.body).unwrap();
        assert_eq!(status.service, SERVICE);
        assert_eq!(status.api_version, API_VERSION);
        assert_eq!(status.state, State::Ready);
        assert_eq!(status.sampled_at.len(), 24);
        assert!(status.sampled_at.ends_with('Z'));
        assert!(status.private_mode);
        assert_eq!(status.groq_key, env_key);
        assert_eq!(
            server
                .request("PUT", "/v1/credentials/groq", r#"{"key":"test-key"}"#)
                .status,
            204
        );
        let status = server.request("GET", "/v1/status", "").body;
        assert_eq!(status["groqKey"], true);
        assert!(!status.to_string().contains("test-key"));
        for _ in 0..2 {
            assert_eq!(
                server.request("DELETE", "/v1/credentials/groq", "").status,
                204
            );
            assert_eq!(
                server.request("GET", "/v1/status", "").body["groqKey"],
                env_key
            );
        }
    }

    struct FailingStore;

    impl KeyStore for FailingStore {
        fn get(&self) -> Option<String> {
            None
        }
        fn set(&self, _key: &str) -> Result<(), String> {
            Err("secret store detail".into())
        }
        fn delete(&self) -> Result<(), String> {
            Err("secret store detail".into())
        }
    }

    #[test]
    fn store_failure_returns_fixed_code() {
        let server = TestServer::with_keys(Arc::new(FailingStore));
        server
            .request("PUT", "/v1/credentials/groq", r#"{"key":"test-key"}"#)
            .error(500, "store_error");
        server
            .request("DELETE", "/v1/credentials/groq", "")
            .error(500, "store_error");
    }

    #[test]
    fn start_then_stop() {
        let server = TestServer::new();
        for (path, command, state) in [
            ("/v1/start", r#"{"mode":"hold"}"#, State::Listening),
            ("/v1/stop", r#"{"paste":true}"#, State::Processing),
        ] {
            let reply = server.request("POST", path, command);
            assert_eq!(reply.status, 200);
            assert_eq!(
                serde_json::from_value::<StateReply>(reply.body).unwrap(),
                StateReply::new(state)
            );
        }
    }

    #[test]
    fn invalid_state() {
        let server = TestServer::new();
        server
            .request("POST", "/v1/stop", r#"{"paste":false}"#)
            .error(409, "invalid_state");
        assert_eq!(
            server
                .request("POST", "/v1/start", r#"{"mode":"toggle"}"#)
                .status,
            200
        );
        server
            .request("POST", "/v1/start", r#"{"mode":"hold"}"#)
            .error(409, "invalid_state");
    }

    #[test]
    fn origin_is_forbidden_before_routing() {
        let server = TestServer::new();
        for origin in ["https://example.com", "null", ""] {
            server.raw(&format!(
                "GET /unknown HTTP/1.1\r\nHost: 127.0.0.1:{}\r\noRiGiN: {origin}\r\nConnection: close\r\n\r\n", server.port(),
            )).error(403, "forbidden");
        }
    }

    #[test]
    fn wrong_or_missing_host_is_forbidden() {
        let server = TestServer::new();
        for host in [
            format!("localhost:{}", server.port()),
            "127.0.0.1:1".into(),
            String::new(),
        ] {
            server
                .raw(&format!(
                    "GET /v1/status HTTP/1.1\r\nHost: {host}\r\nConnection: close\r\n\r\n",
                ))
                .error(403, "forbidden");
        }
        server
            .raw("GET /v1/status HTTP/1.1\r\nConnection: close\r\n\r\n")
            .error(403, "forbidden");
    }

    #[test]
    fn unknown_path() {
        TestServer::new()
            .request("GET", "/unknown", "")
            .error(404, "not_found");
    }

    #[test]
    fn wrong_methods() {
        let server = TestServer::new();
        for path in [
            "/v1/status",
            "/v1/start",
            "/v1/stop",
            "/v1/events",
            "/v1/credentials/groq",
        ] {
            server
                .request("PATCH", path, "")
                .error(405, "method_not_allowed");
        }
    }

    #[test]
    fn bad_json_and_missing_fields() {
        let server = TestServer::new();
        for (path, command) in [
            ("/v1/start", "{"),
            ("/v1/start", "{}"),
            ("/v1/start", r#"{"mode":"other"}"#),
            ("/v1/stop", "{}"),
            ("/v1/stop", r#"{"paste":"true"}"#),
        ] {
            server
                .request("POST", path, command)
                .error(400, "bad_request");
        }
    }

    #[test]
    fn empty_or_missing_key() {
        let server = TestServer::new();
        for command in [r#"{"key":""}"#, "{}", "null", "{"] {
            server
                .request("PUT", "/v1/credentials/groq", command)
                .error(400, "bad_request");
        }
    }

    #[test]
    fn oversized_body() {
        let server = TestServer::new();
        let body = format!(r#"{{"key":"{}"}}"#, "x".repeat(MAX_BODY));
        server
            .request("PUT", "/v1/credentials/groq", &body)
            .error(400, "bad_request");
        server.raw(&format!(
            "PUT /v1/credentials/groq HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nConnection: close\r\nTransfer-Encoding: chunked\r\n\r\n{:x}\r\n{body}\r\n0\r\n\r\n", server.port(), body.len(),
        )).error(400, "bad_request");
        assert_eq!(server.request("GET", "/v1/status", "").status, 200);
    }

    #[test]
    fn occupied_port_fails() {
        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let (engine, _) = engine(FakeRecorder::default(), Ok(""));
        assert!(serve(
            engine,
            Arc::new(MemoryKeyStore::default()),
            false,
            listener.local_addr().unwrap().port()
        )
        .is_err());
    }

    fn read_line(reader: &mut impl BufRead) -> String {
        let mut line = String::new();
        reader.read_line(&mut line).unwrap();
        line
    }

    #[test]
    fn sse_streams_state_and_pings_then_shuts_down() {
        let server = TestServer::new();
        let mut stream = server.connect();
        write!(
            stream,
            "GET /v1/events HTTP/1.1\r\nHost: 127.0.0.1:{}\r\n\r\n",
            server.port()
        )
        .unwrap();
        let mut reader = BufReader::new(stream);
        let mut headers = String::new();
        loop {
            let line = read_line(&mut reader);
            if line == "\r\n" {
                break;
            }
            assert!(!line.is_empty());
            headers.push_str(&line);
        }
        assert!(headers.contains("200 OK"));
        assert!(headers.contains("Content-Type: text/event-stream"));
        assert!(headers.contains("Cache-Control: no-store"));
        assert_eq!(
            server
                .request("POST", "/v1/start", r#"{"mode":"hold"}"#)
                .status,
            200
        );
        // A ping may arrive before the event, so skip pings until the data line.
        let value: Value = loop {
            let line = read_line(&mut reader);
            if let Some(data) = line.strip_prefix("data: ") {
                break serde_json::from_str(data).unwrap();
            }
            assert_eq!(line, ": ping\n");
        };
        assert_eq!(value["service"], SERVICE);
        assert_eq!(value["apiVersion"], API_VERSION);
        assert!(matches!(
            serde_json::from_value::<Event>(value).unwrap(),
            Event::State {
                state: State::Listening,
                ..
            }
        ));
        assert_eq!(read_line(&mut reader), "\n");
        assert_eq!(read_line(&mut reader), ": ping\n");
        // Shutdown must return even with an SSE client connected.
        drop(server);
    }
}
