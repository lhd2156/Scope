use std::{
    collections::{BTreeMap, BTreeSet},
    env,
    error::Error,
    fmt::Display,
    fs,
    io,
    net::{SocketAddr, TcpStream as StdTcpStream},
    path::{Path, PathBuf},
    process::Command as ProcessCommand,
    sync::Arc,
    time::{Duration, Instant},
};

use clap::{Args, Parser, Subcommand};
use colored::Colorize;
use futures::future::join_all;
use reqwest::{Client, Method, Url};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tiberius::{AuthMethod, Client as SqlClient, Config as SqlConfig};
use tokio::{net::TcpStream, sync::Semaphore};
use tokio_util::compat::{Compat, TokioAsyncWriteCompatExt};

type CliResult<T = ()> = Result<T, Box<dyn Error + Send + Sync>>;
type EnvMap = BTreeMap<String, String>;
type SqlConnection = SqlClient<Compat<TcpStream>>;

const SENSITIVE_ENV_KEYS: &[&str] = &[
    "SA_PASSWORD",
    "DB_PASSWORD",
    "CORE_JWT_SECRET",
    "DJANGO_SECRET_KEY",
    "FLASK_SECRET_KEY",
    "VITE_MAPBOX_TOKEN",
];
const DEFAULT_TIMEOUT_SECONDS: f64 = 5.0;

#[derive(Parser, Debug)]
#[command(
    name = "scope",
    bin_name = "scope",
    version,
    about = "Scope cross-service operations CLI"
)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand, Debug)]
enum Command {
    /// Check service health across Scope backends
    Health(HealthArgs),
    /// Execute Scope SQL seed files
    Seed(SeedArgs),
    /// Deployment-oriented tooling
    Deploy(DeployArgs),
    /// Run lightweight HTTP benchmarks against Scope endpoints
    Benchmark(BenchmarkArgs),
    /// Environment-file validation commands
    Env(EnvArgs),
}

#[derive(Args, Debug)]
struct HealthArgs {
    /// Show the resolved health-check URLs and response details
    #[arg(long, default_value_t = false)]
    verbose: bool,

    /// Timeout per health request in seconds
    #[arg(long, default_value_t = DEFAULT_TIMEOUT_SECONDS)]
    timeout_seconds: f64,
}

#[derive(Args, Debug)]
struct SeedArgs {
    /// Seed directory to inspect or execute
    #[arg(long)]
    directory: Option<PathBuf>,

    /// Environment file used to resolve DB settings when process env is incomplete
    #[arg(long)]
    env_file: Option<PathBuf>,

    /// Print planned work without executing SQL
    #[arg(long, default_value_t = false)]
    dry_run: bool,
}

#[derive(Args, Debug)]
struct DeployArgs {
    #[command(subcommand)]
    command: DeployCommand,
}

#[derive(Subcommand, Debug)]
enum DeployCommand {
    /// Validate deploy prerequisites from the current workspace
    Validate(DeployValidateArgs),
}

#[derive(Args, Debug)]
struct DeployValidateArgs {
    /// Environment file to validate before deployment
    #[arg(long, default_value = ".env")]
    env_file: PathBuf,

    /// Example file used as the contract
    #[arg(long, default_value = ".env.example")]
    example_file: PathBuf,

    /// Compose file that should render successfully
    #[arg(long, default_value = "docker-compose.yml")]
    compose_file: PathBuf,

    /// Optional HTTPS endpoints whose TLS handshake should succeed
    #[arg(long = "https-url")]
    https_urls: Vec<String>,

    /// Timeout per HTTPS certificate probe in seconds
    #[arg(long, default_value_t = DEFAULT_TIMEOUT_SECONDS)]
    timeout_seconds: f64,
}

#[derive(Args, Debug)]
struct BenchmarkArgs {
    /// Target URL to benchmark
    #[arg(long)]
    url: String,

    /// HTTP method to prepare for requests
    #[arg(long, default_value = "GET")]
    method: String,

    /// Total number of requests to schedule
    #[arg(long, default_value_t = 50)]
    requests: usize,

    /// Number of concurrent workers to plan
    #[arg(long, default_value_t = 10)]
    concurrency: usize,

    /// Timeout per request in seconds
    #[arg(long, default_value_t = DEFAULT_TIMEOUT_SECONDS)]
    timeout_seconds: f64,
}

#[derive(Args, Debug)]
struct EnvArgs {
    #[command(subcommand)]
    command: EnvCommand,
}

#[derive(Subcommand, Debug)]
enum EnvCommand {
    /// Compare .env against .env.example
    Check(EnvCheckArgs),
}

#[derive(Args, Debug)]
struct EnvCheckArgs {
    /// Environment file to inspect
    #[arg(long, default_value = ".env")]
    env_file: PathBuf,

    /// Example file used as the contract
    #[arg(long, default_value = ".env.example")]
    example_file: PathBuf,

    /// Treat placeholder secrets as failures instead of warnings
    #[arg(long, default_value_t = false)]
    strict_placeholders: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ScopeConfig {
    services: Vec<ServiceTarget>,
    seed_directory: PathBuf,
    env_file: PathBuf,
    env_example_file: PathBuf,
}

impl Default for ScopeConfig {
    fn default() -> Self {
        Self {
            services: vec![
                ServiceTarget {
                    name: "core".to_string(),
                    health_url: env_or_default(
                        "SCOPE_CORE_HEALTH_URL",
                        "http://localhost:5001/api/core/health",
                    ),
                },
                ServiceTarget {
                    name: "content".to_string(),
                    health_url: env_or_default(
                        "SCOPE_CONTENT_HEALTH_URL",
                        "http://localhost:5002/api/content/health",
                    ),
                },
                ServiceTarget {
                    name: "intel".to_string(),
                    health_url: env_or_default(
                        "SCOPE_INTEL_HEALTH_URL",
                        "http://localhost:5003/api/intel/health",
                    ),
                },
                ServiceTarget {
                    name: "scope-metrics".to_string(),
                    health_url: env_or_default(
                        "SCOPE_METRICS_HEALTH_URL",
                        "http://localhost:9090/healthz",
                    ),
                },
            ],
            seed_directory: env_path_or_default("SCOPE_SEED_DIRECTORY", "scripts/sql"),
            env_file: env_path_or_default("SCOPE_ENV_FILE", ".env"),
            env_example_file: env_path_or_default("SCOPE_ENV_EXAMPLE_FILE", ".env.example"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ServiceTarget {
    name: String,
    health_url: String,
}

impl ServiceTarget {
    fn parsed_url(&self) -> CliResult<Url> {
        Ok(Url::parse(&self.health_url)?)
    }
}

struct AppContext {
    config: ScopeConfig,
}

impl AppContext {
    fn new() -> Self {
        Self {
            config: ScopeConfig::default(),
        }
    }
}

#[derive(Debug)]
struct HealthCheckResult {
    name: String,
    url: String,
    http_status: Option<u16>,
    service_status: Option<String>,
    healthy: bool,
    duration_ms: u128,
    detail: String,
}

#[derive(Debug, Clone)]
struct DatabaseConfig {
    host: String,
    port: u16,
    database: String,
    user: String,
    password: String,
    trust_cert: bool,
}

#[derive(Debug)]
struct SeedPlanEntry {
    path: PathBuf,
    batch_count: usize,
}

#[derive(Debug)]
struct EnvCheckReport {
    env_file: PathBuf,
    example_file: PathBuf,
    missing_required: Vec<String>,
    blank_required: Vec<String>,
    extra_keys: Vec<String>,
    placeholder_keys: Vec<String>,
    populated_keys: usize,
}

#[derive(Debug)]
struct PortCheckResult {
    key: String,
    port: u16,
    listening: bool,
}

#[derive(Debug)]
struct HttpsCheckResult {
    url: String,
    detail: String,
}

#[derive(Debug, Clone)]
struct BenchmarkRequestResult {
    status_code: Option<u16>,
    ok: bool,
    duration_ms: f64,
    detail: String,
}

#[derive(Debug)]
struct BenchmarkSummary {
    total_requests: usize,
    success_count: usize,
    failure_count: usize,
    min_ms: f64,
    average_ms: f64,
    p50_ms: f64,
    p90_ms: f64,
    p99_ms: f64,
    max_ms: f64,
    requests_per_second: f64,
    status_counts: BTreeMap<String, usize>,
}

#[tokio::main]
async fn main() -> CliResult {
    let cli = Cli::parse();
    let context = AppContext::new();
    dispatch(cli.command, &context).await
}

async fn dispatch(command: Command, context: &AppContext) -> CliResult {
    match command {
        Command::Health(args) => run_health(args, context).await,
        Command::Seed(args) => run_seed(args, context).await,
        Command::Deploy(args) => run_deploy(args, context).await,
        Command::Benchmark(args) => run_benchmark(args).await,
        Command::Env(args) => run_env(args, context).await,
    }
}

async fn run_health(args: HealthArgs, context: &AppContext) -> CliResult {
    let client = build_http_client(args.timeout_seconds)?;
    print_banner("Scope service health");

    let checks = context
        .config
        .services
        .iter()
        .cloned()
        .map(|service| inspect_service_health(client.clone(), service));
    let results = join_all(checks).await;

    for result in &results {
        let label = if result.healthy {
            "PASS".green().bold()
        } else {
            "FAIL".red().bold()
        };
        print_row(
            &result.name,
            format!(
                "{} {} [{} ms]",
                label,
                result
                    .service_status
                    .as_deref()
                    .unwrap_or("unknown")
                    .to_string()
                    .bold(),
                result.duration_ms
            ),
        );

        if args.verbose {
            print_row("url", &result.url);
            if let Some(http_status) = result.http_status {
                print_row("http", http_status);
            }
            print_row("detail", &result.detail);
        }
    }

    let failures: Vec<&HealthCheckResult> = results.iter().filter(|result| !result.healthy).collect();
    if !failures.is_empty() {
        let failed_services = failures
            .iter()
            .map(|failure| failure.name.as_str())
            .collect::<Vec<_>>()
            .join(", ");
        return Err(boxed_error(format!(
            "Health checks failed for: {failed_services}"
        )));
    }

    println!(
        "{}",
        format!("{} services are healthy.", results.len())
            .green()
            .bold()
    );
    Ok(())
}

async fn inspect_service_health(client: Client, service: ServiceTarget) -> HealthCheckResult {
    let started_at = Instant::now();
    let url = service.health_url.clone();

    let build_failure = |detail: String, duration_ms: u128| HealthCheckResult {
        name: service.name.clone(),
        url: url.clone(),
        http_status: None,
        service_status: None,
        healthy: false,
        duration_ms,
        detail,
    };

    let parsed_url = match service.parsed_url() {
        Ok(parsed_url) => parsed_url,
        Err(error) => {
            return build_failure(
                format!("invalid URL: {error}"),
                started_at.elapsed().as_millis(),
            )
        }
    };

    match client.get(parsed_url.clone()).send().await {
        Ok(response) => {
            let http_status = response.status().as_u16();
            let http_ok = response.status().is_success();
            let body_text = match response.text().await {
                Ok(body_text) => body_text,
                Err(error) => {
                    return HealthCheckResult {
                        name: service.name,
                        url,
                        http_status: Some(http_status),
                        service_status: None,
                        healthy: false,
                        duration_ms: started_at.elapsed().as_millis(),
                        detail: format!("unable to read response body: {error}"),
                    }
                }
            };

            let parsed_body = serde_json::from_str::<Value>(&body_text).ok();
            let service_status = parsed_body
                .as_ref()
                .and_then(extract_status_label)
                .map(str::to_string);
            let healthy = http_ok
                && service_status
                    .as_deref()
                    .map(is_healthy_status)
                    .unwrap_or(false);

            HealthCheckResult {
                name: service.name,
                url,
                http_status: Some(http_status),
                service_status,
                healthy,
                duration_ms: started_at.elapsed().as_millis(),
                detail: if healthy {
                    truncate(&body_text, 120)
                } else {
                    format!("unexpected response: {}", truncate(&body_text, 160))
                },
            }
        }
        Err(error) => build_failure(
            format!("request failed: {error}"),
            started_at.elapsed().as_millis(),
        ),
    }
}

async fn run_seed(args: SeedArgs, context: &AppContext) -> CliResult {
    let directory = args
        .directory
        .unwrap_or_else(|| context.config.seed_directory.clone());
    let entries = build_seed_plan(&directory)?;

    print_banner("Scope SQL seeding");
    print_row("directory", directory.display());
    print_row("files", entries.len());
    print_row(
        "mode",
        if args.dry_run { "dry-run" } else { "execute" },
    );

    for entry in &entries {
        print_row(
            &entry.path.display().to_string(),
            format!("{} batch(es)", entry.batch_count),
        );
    }

    if args.dry_run {
        println!("{}", "Dry run complete.".yellow().bold());
        return Ok(());
    }

    let (database_config, env_source) =
        resolve_database_config(args.env_file.as_deref(), &context.config.env_file)?;

    print_row("database", database_config.database_target());
    print_row("env source", env_source.display());

    ensure_database_exists(&database_config).await?;
    let mut connection = connect_sql(&database_config).await?;

    let mut executed_batches = 0usize;
    for entry in &entries {
        let sql = fs::read_to_string(&entry.path)?;
        for (batch_index, batch) in split_sql_batches(&sql).into_iter().enumerate() {
            connection
                .simple_query(batch.as_str())
                .await
                .map_err(|error| {
                    boxed_error(format!(
                        "failed to execute {} batch {}: {error}",
                        entry.path.display(),
                        batch_index + 1
                    ))
                })?
                .into_results()
                .await
                .map_err(|error| {
                    boxed_error(format!(
                        "failed to consume {} batch {} results: {error}",
                        entry.path.display(),
                        batch_index + 1
                    ))
                })?;
            executed_batches += 1;
        }
    }

    println!(
        "{}",
        format!(
            "Seed execution complete: {} file(s), {} batch(es).",
            entries.len(),
            executed_batches
        )
        .green()
        .bold()
    );

    Ok(())
}

fn build_seed_plan(directory: &Path) -> CliResult<Vec<SeedPlanEntry>> {
    let files = discover_seed_files(directory)?;
    let mut entries = Vec::with_capacity(files.len());

    for path in files {
        let sql = fs::read_to_string(&path)?;
        let batch_count = split_sql_batches(&sql).len();
        entries.push(SeedPlanEntry { path, batch_count });
    }

    Ok(entries)
}

fn discover_seed_files(directory: &Path) -> CliResult<Vec<PathBuf>> {
    if !directory.exists() {
        return Err(boxed_error(format!(
            "Seed directory does not exist: {}",
            directory.display()
        )));
    }

    let mut files = Vec::new();
    collect_sql_files(directory, &mut files)?;
    if files.is_empty() {
        return Err(boxed_error(format!(
            "No SQL files found in {}",
            directory.display()
        )));
    }

    files.sort_by_key(|path| seed_sort_key(path, directory));
    Ok(files)
}

fn collect_sql_files(directory: &Path, files: &mut Vec<PathBuf>) -> CliResult {
    for entry in fs::read_dir(directory)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            collect_sql_files(&path, files)?;
            continue;
        }

        let is_sql = path
            .extension()
            .and_then(|extension| extension.to_str())
            .map(|extension| extension.eq_ignore_ascii_case("sql"))
            .unwrap_or(false);
        if is_sql {
            files.push(path);
        }
    }

    Ok(())
}

fn seed_sort_key(path: &Path, root: &Path) -> (u32, u32, String) {
    let relative = path.strip_prefix(root).unwrap_or(path);
    let components = relative
        .components()
        .map(|component| component.as_os_str().to_string_lossy().to_string())
        .collect::<Vec<_>>();
    let service_name = components.first().map(String::as_str).unwrap_or_default();
    let service_order = match service_name {
        "core" => 0,
        "content" => 1,
        "intel" => 2,
        _ => 99,
    };
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default()
        .to_lowercase();

    (
        numeric_prefix(&file_name),
        service_order,
        relative.to_string_lossy().replace('\\', "/").to_lowercase(),
    )
}

fn numeric_prefix(value: &str) -> u32 {
    let digits = value
        .chars()
        .take_while(|character| character.is_ascii_digit())
        .collect::<String>();
    digits.parse::<u32>().unwrap_or(u32::MAX)
}

fn split_sql_batches(sql: &str) -> Vec<String> {
    let mut batches = Vec::new();
    let mut current = Vec::new();

    for line in sql.lines() {
        if line.trim().eq_ignore_ascii_case("GO") {
            let batch = current.join("\n").trim().to_string();
            if !batch.is_empty() {
                batches.push(batch);
            }
            current.clear();
            continue;
        }

        current.push(line.to_string());
    }

    let trailing = current.join("\n").trim().to_string();
    if !trailing.is_empty() {
        batches.push(trailing);
    }

    batches
}

fn resolve_database_config(
    selected_env_file: Option<&Path>,
    default_env_file: &Path,
) -> CliResult<(DatabaseConfig, PathBuf)> {
    let env_path = selected_env_file.unwrap_or(default_env_file).to_path_buf();
    let env_map = load_env_map(&env_path, true)?;
    let connection_map = resolve_value(
        &[
            "SCOPE_SQL_CONNECTION_STRING",
            "CORE_DB_CONNECTION",
            "CORE_CONNECTION_STRING",
            "ConnectionStrings__CoreDatabase",
        ],
        &env_map,
    )
    .map(|raw| parse_connection_string(&raw))
    .unwrap_or_default();

    let (connection_host, connection_port) = connection_map
        .get("server")
        .map(|server| parse_server_host_port(server))
        .unwrap_or_else(|| ("localhost".to_string(), None));

    let host = resolve_value(&["SCOPE_DB_HOST", "DB_HOST"], &env_map)
        .or_else(|| Some(connection_host))
        .unwrap_or_else(|| "localhost".to_string());
    let port = resolve_value(&["SCOPE_DB_PORT", "DB_PORT"], &env_map)
        .map(|value| parse_u16(&value, "database port"))
        .transpose()?
        .or(connection_port)
        .unwrap_or(1433);
    let database = resolve_value(&["SCOPE_DB_NAME", "DB_NAME"], &env_map)
        .or_else(|| {
            connection_map
                .get("database")
                .cloned()
                .or_else(|| connection_map.get("initial catalog").cloned())
        })
        .unwrap_or_else(|| "scope".to_string());
    let user = resolve_value(&["SCOPE_DB_USER", "DB_USER"], &env_map)
        .or_else(|| {
            connection_map
                .get("user id")
                .cloned()
                .or_else(|| connection_map.get("uid").cloned())
        })
        .unwrap_or_else(|| "sa".to_string());
    let password = resolve_value(&["SCOPE_DB_PASSWORD", "DB_PASSWORD", "SA_PASSWORD"], &env_map)
        .or_else(|| {
            connection_map
                .get("password")
                .cloned()
                .or_else(|| connection_map.get("pwd").cloned())
        })
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| boxed_error("No SQL password found in process env, .env, or connection string"))?;
    let trust_cert = resolve_value(&["SCOPE_DB_TRUST_CERT"], &env_map)
        .map(|value| !matches!(value.trim().to_ascii_lowercase().as_str(), "false" | "0" | "no"))
        .unwrap_or(true);

    Ok((
        DatabaseConfig {
            host,
            port,
            database,
            user,
            password,
            trust_cert,
        },
        env_path,
    ))
}

fn parse_connection_string(raw: &str) -> EnvMap {
    let mut values = EnvMap::new();
    for segment in raw.split(';') {
        let trimmed = segment.trim();
        if trimmed.is_empty() {
            continue;
        }

        let mut parts = trimmed.splitn(2, '=');
        let key = parts
            .next()
            .unwrap_or_default()
            .trim()
            .to_ascii_lowercase();
        let value = parts.next().unwrap_or_default().trim().to_string();
        if !key.is_empty() {
            values.insert(key, value);
        }
    }

    values
}

fn parse_server_host_port(raw: &str) -> (String, Option<u16>) {
    let trimmed = raw.trim();
    let value = if let Some((host, port)) = trimmed.rsplit_once(',') {
        if let Ok(parsed_port) = port.trim().parse::<u16>() {
            return (host.trim().to_string(), Some(parsed_port));
        }
        trimmed
    } else {
        trimmed
    };

    if let Some((host, port)) = value.rsplit_once(':') {
        if let Ok(parsed_port) = port.trim().parse::<u16>() {
            return (host.trim().to_string(), Some(parsed_port));
        }
    }

    (value.trim().to_string(), None)
}

fn parse_u16(value: &str, label: &str) -> CliResult<u16> {
    value
        .trim()
        .parse::<u16>()
        .map_err(|error| boxed_error(format!("Invalid {label} '{value}': {error}")))
}

impl DatabaseConfig {
    fn database_target(&self) -> String {
        format!("{}@{}:{}/{}", self.user, self.host, self.port, self.database)
    }
}

async fn ensure_database_exists(config: &DatabaseConfig) -> CliResult {
    let mut master_config = config.clone();
    master_config.database = "master".to_string();
    let mut connection = connect_sql(&master_config).await?;
    let escaped_database_name = config.database.replace(']', "]]");
    let escaped_literal = config.database.replace('\'', "''");
    let create_statement = format!(
        "IF DB_ID(N'{escaped_literal}') IS NULL CREATE DATABASE [{escaped_database_name}];"
    );
    connection
        .simple_query(create_statement.as_str())
        .await?
        .into_results()
        .await?;
    Ok(())
}

async fn connect_sql(config: &DatabaseConfig) -> CliResult<SqlConnection> {
    let mut sql_config = SqlConfig::new();
    sql_config.host(&config.host);
    sql_config.port(config.port);
    sql_config.authentication(AuthMethod::sql_server(&config.user, &config.password));
    sql_config.database(&config.database);
    if config.trust_cert {
        sql_config.trust_cert();
    }

    let tcp = TcpStream::connect(sql_config.get_addr()).await?;
    tcp.set_nodelay(true)?;
    let connection = SqlClient::connect(sql_config, tcp.compat_write()).await?;
    Ok(connection)
}

async fn run_deploy(args: DeployArgs, context: &AppContext) -> CliResult {
    match args.command {
        DeployCommand::Validate(validate_args) => run_deploy_validate(validate_args, context).await,
    }
}

async fn run_deploy_validate(args: DeployValidateArgs, _context: &AppContext) -> CliResult {
    print_banner("Scope deploy validation");

    let env_report = build_env_check_report(&args.env_file, &args.example_file)?;
    print_row("env file", args.env_file.display());
    print_row("compose file", args.compose_file.display());

    print_env_check_report(&env_report, true);

    let workspace = env::current_dir()?;
    let docker_version = run_process("docker", &["version", "--format", "{{.Server.Version}}"], &workspace);
    match &docker_version {
        Ok(version) => print_row("docker", format!("reachable ({version})")),
        Err(error) => print_row("docker", format!("unavailable ({error})").red()),
    }

    let compose_services = run_process(
        "docker",
        &[
            "compose",
            "-f",
            args.compose_file.to_string_lossy().as_ref(),
            "config",
            "--services",
        ],
        &workspace,
    );
    match &compose_services {
        Ok(services) => print_row(
            "compose",
            format!(
                "{} service(s) resolved",
                services.lines().filter(|line| !line.trim().is_empty()).count()
            ),
        ),
        Err(error) => print_row("compose", format!("failed ({error})").red()),
    }

    let env_map = load_env_map(&args.env_file, false)?;
    let port_checks = build_port_checks(&env_map)?;
    let mut duplicate_ports = BTreeSet::new();
    let mut seen_ports = BTreeMap::<u16, String>::new();
    for port_check in &port_checks {
        if let Some(previous_key) = seen_ports.insert(port_check.port, port_check.key.clone()) {
            duplicate_ports.insert(format!(
                "{} and {} both use {}",
                previous_key, port_check.key, port_check.port
            ));
        }
        print_row(
            &format!("port {}", port_check.key),
            format!(
                "{} ({})",
                port_check.port,
                if port_check.listening {
                    "listening"
                } else {
                    "not listening"
                }
            ),
        );
    }

    if duplicate_ports.is_empty() {
        print_row("port conflicts", "none");
    } else {
        for duplicate in &duplicate_ports {
            print_row("port conflict", duplicate.red());
        }
    }

    let mut https_failures = Vec::new();
    if args.https_urls.is_empty() {
        print_row("https checks", "skipped");
    } else {
        let client = build_http_client(args.timeout_seconds)?;
        for https_url in &args.https_urls {
            match validate_https_url(&client, https_url).await {
                Ok(result) => {
                    print_row("https", format!("{} ({})", result.url, result.detail));
                }
                Err(error) => {
                    let detail = format!("{https_url} ({error})");
                    print_row("https", detail.red());
                    https_failures.push(detail);
                }
            }
        }
    }

    let mut failures = Vec::new();
    if env_report.has_failures(true) {
        failures.push("environment contract".to_string());
    }
    if docker_version.is_err() {
        failures.push("docker daemon".to_string());
    }
    if compose_services.is_err() {
        failures.push("docker compose config".to_string());
    }
    if !duplicate_ports.is_empty() {
        failures.push("port conflicts".to_string());
    }
    if !https_failures.is_empty() {
        failures.push("https certificate checks".to_string());
    }

    if !failures.is_empty() {
        return Err(boxed_error(format!(
            "Deploy validation failed: {}",
            failures.join(", ")
        )));
    }

    println!("{}", "Deploy validation passed.".green().bold());
    Ok(())
}

fn build_port_checks(env_map: &EnvMap) -> CliResult<Vec<PortCheckResult>> {
    let mut checks = Vec::new();
    for key in [
        "NGINX_PORT",
        "SCOPE_METRICS_PORT",
        "SQLSERVER_PORT",
        "ZOOKEEPER_PORT",
        "KAFKA_PORT",
        "CORE_PORT",
        "CONTENT_PORT",
        "INTEL_PORT",
        "FRONTEND_PORT",
    ] {
        if let Some(value) = env_map.get(key) {
            let port = parse_u16(value, key)?;
            checks.push(PortCheckResult {
                key: key.to_string(),
                port,
                listening: is_local_port_listening(port),
            });
        }
    }
    Ok(checks)
}

fn is_local_port_listening(port: u16) -> bool {
    let address = SocketAddr::from(([127, 0, 0, 1], port));
    StdTcpStream::connect_timeout(&address, Duration::from_millis(200)).is_ok()
}

async fn validate_https_url(client: &Client, raw_url: &str) -> CliResult<HttpsCheckResult> {
    let url = Url::parse(raw_url)?;
    if url.scheme() != "https" {
        return Err(boxed_error(format!(
            "expected an https:// URL, received {}",
            url
        )));
    }

    let response = client.get(url.clone()).send().await?;
    Ok(HttpsCheckResult {
        url: url.to_string(),
        detail: format!("HTTP {}", response.status()),
    })
}

async fn run_benchmark(args: BenchmarkArgs) -> CliResult {
    if args.requests == 0 {
        return Err(boxed_error("--requests must be greater than zero"));
    }
    if args.concurrency == 0 {
        return Err(boxed_error("--concurrency must be greater than zero"));
    }

    let method = parse_method(&args.method)?;
    let url = Url::parse(&args.url)?;
    let concurrency = args.concurrency.min(args.requests);
    let client = build_http_client(args.timeout_seconds)?;

    print_banner("Scope benchmark");
    print_row("request", format!("{} {}", method, url));
    print_row("requests", args.requests);
    print_row("concurrency", concurrency);

    let semaphore = Arc::new(Semaphore::new(concurrency));
    let started_at = Instant::now();
    let tasks = (0..args.requests)
        .map(|_| {
            let client = client.clone();
            let method = method.clone();
            let url = url.clone();
            let semaphore = semaphore.clone();
            tokio::spawn(async move {
                execute_benchmark_request(client, method, url, semaphore).await
            })
        })
        .collect::<Vec<_>>();

    let mut results = Vec::with_capacity(args.requests);
    for task in join_all(tasks).await {
        results.push(task.map_err(|error| boxed_error(format!("benchmark task failed: {error}")))?);
    }

    let summary = summarize_benchmark_results(&results, started_at.elapsed());
    print_row("total", summary.total_requests);
    print_row("success", summary.success_count);
    print_row("failures", summary.failure_count);
    print_row(
        "latency",
        format!(
            "min {:.1} ms | avg {:.1} ms | p50 {:.1} ms | p90 {:.1} ms | p99 {:.1} ms | max {:.1} ms",
            summary.min_ms,
            summary.average_ms,
            summary.p50_ms,
            summary.p90_ms,
            summary.p99_ms,
            summary.max_ms
        ),
    );
    print_row("throughput", format!("{:.2} req/s", summary.requests_per_second));
    for (status, count) in &summary.status_counts {
        print_row(&format!("status {status}"), count);
    }

    if summary.failure_count > 0 {
        let failures = results
            .iter()
            .filter(|result| !result.ok)
            .map(|result| result.detail.as_str())
            .collect::<Vec<_>>()
            .join(", ");
        return Err(boxed_error(format!(
            "Benchmark completed with {} failure(s): {}",
            summary.failure_count, failures
        )));
    }

    Ok(())
}

async fn execute_benchmark_request(
    client: Client,
    method: Method,
    url: Url,
    semaphore: Arc<Semaphore>,
) -> BenchmarkRequestResult {
    let _permit = match semaphore.acquire_owned().await {
        Ok(permit) => permit,
        Err(_) => {
            return BenchmarkRequestResult {
                status_code: None,
                ok: false,
                duration_ms: 0.0,
                detail: "benchmark semaphore closed".to_string(),
            }
        }
    };

    let started_at = Instant::now();
    match client.request(method, url).send().await {
        Ok(response) => {
            let status = response.status();
            let _ = response.bytes().await;
            BenchmarkRequestResult {
                status_code: Some(status.as_u16()),
                ok: status.is_success(),
                duration_ms: started_at.elapsed().as_secs_f64() * 1000.0,
                detail: format!("HTTP {}", status.as_u16()),
            }
        }
        Err(error) => BenchmarkRequestResult {
            status_code: None,
            ok: false,
            duration_ms: started_at.elapsed().as_secs_f64() * 1000.0,
            detail: error.to_string(),
        },
    }
}

fn summarize_benchmark_results(
    results: &[BenchmarkRequestResult],
    elapsed: Duration,
) -> BenchmarkSummary {
    let mut latencies = results
        .iter()
        .map(|result| result.duration_ms)
        .collect::<Vec<_>>();
    latencies.sort_by(|left, right| left.total_cmp(right));

    let success_count = results.iter().filter(|result| result.ok).count();
    let failure_count = results.len().saturating_sub(success_count);
    let total_duration = latencies.iter().sum::<f64>();
    let average_ms = if latencies.is_empty() {
        0.0
    } else {
        total_duration / latencies.len() as f64
    };

    let mut status_counts = BTreeMap::new();
    for result in results {
        let key = result
            .status_code
            .map(|status| status.to_string())
            .unwrap_or_else(|| "error".to_string());
        *status_counts.entry(key).or_insert(0) += 1;
    }

    BenchmarkSummary {
        total_requests: results.len(),
        success_count,
        failure_count,
        min_ms: *latencies.first().unwrap_or(&0.0),
        average_ms,
        p50_ms: percentile(&latencies, 0.50),
        p90_ms: percentile(&latencies, 0.90),
        p99_ms: percentile(&latencies, 0.99),
        max_ms: *latencies.last().unwrap_or(&0.0),
        requests_per_second: if elapsed.as_secs_f64() > 0.0 {
            results.len() as f64 / elapsed.as_secs_f64()
        } else {
            0.0
        },
        status_counts,
    }
}

fn percentile(sorted_values: &[f64], ratio: f64) -> f64 {
    if sorted_values.is_empty() {
        return 0.0;
    }

    let index = ((sorted_values.len() - 1) as f64 * ratio).round() as usize;
    sorted_values[index]
}

async fn run_env(args: EnvArgs, context: &AppContext) -> CliResult {
    match args.command {
        EnvCommand::Check(check_args) => run_env_check(check_args, context).await,
    }
}

async fn run_env_check(args: EnvCheckArgs, _context: &AppContext) -> CliResult {
    print_banner("Scope env contract");
    let report = build_env_check_report(&args.env_file, &args.example_file)?;
    print_env_check_report(&report, args.strict_placeholders);

    if report.has_failures(args.strict_placeholders) {
        return Err(boxed_error("Environment contract check failed"));
    }

    println!("{}", "Environment contract check passed.".green().bold());
    Ok(())
}

fn build_env_check_report(env_file: &Path, example_file: &Path) -> CliResult<EnvCheckReport> {
    let actual = load_env_map(env_file, false)?;
    let example = load_env_map(example_file, false)?;
    let required_keys = example
        .iter()
        .filter_map(|(key, value)| {
            if value.trim().is_empty() {
                None
            } else {
                Some(key.clone())
            }
        })
        .collect::<Vec<_>>();

    let missing_required = required_keys
        .iter()
        .filter(|key| !actual.contains_key(key.as_str()))
        .cloned()
        .collect::<Vec<_>>();
    let blank_required = required_keys
        .iter()
        .filter(|key| {
            actual
                .get(key.as_str())
                .map(|value| value.trim().is_empty())
                .unwrap_or(false)
        })
        .cloned()
        .collect::<Vec<_>>();
    let extra_keys = actual
        .keys()
        .filter(|key| !example.contains_key(key.as_str()))
        .cloned()
        .collect::<Vec<_>>();
    let placeholder_keys = SENSITIVE_ENV_KEYS
        .iter()
        .filter_map(|key| {
            if blank_required.iter().any(|blank_key| blank_key == key) {
                return None;
            }
            let actual_value = actual.get(*key)?;
            let example_value = example.get(*key)?;
            if actual_value == example_value || looks_like_placeholder(actual_value) {
                Some((*key).to_string())
            } else {
                None
            }
        })
        .collect::<Vec<_>>();

    Ok(EnvCheckReport {
        env_file: env_file.to_path_buf(),
        example_file: example_file.to_path_buf(),
        missing_required,
        blank_required,
        extra_keys,
        placeholder_keys,
        populated_keys: actual.len(),
    })
}

impl EnvCheckReport {
    fn has_failures(&self, strict_placeholders: bool) -> bool {
        !self.missing_required.is_empty()
            || !self.blank_required.is_empty()
            || (strict_placeholders && !self.placeholder_keys.is_empty())
    }
}

fn print_env_check_report(report: &EnvCheckReport, strict_placeholders: bool) {
    print_row("env", report.env_file.display());
    print_row("example", report.example_file.display());
    print_row("keys loaded", report.populated_keys);

    if report.missing_required.is_empty() {
        print_row("missing required", "none");
    } else {
        print_row(
            "missing required",
            report.missing_required.join(", ").red().bold(),
        );
    }

    if report.blank_required.is_empty() {
        print_row("blank required", "none");
    } else {
        print_row(
            "blank required",
            report.blank_required.join(", ").red().bold(),
        );
    }

    if report.extra_keys.is_empty() {
        print_row("extra keys", "none");
    } else {
        print_row("extra keys", report.extra_keys.join(", ").yellow());
    }

    if report.placeholder_keys.is_empty() {
        print_row("placeholder secrets", "none");
    } else {
        let colorized = if strict_placeholders {
            report.placeholder_keys.join(", ").red().bold().to_string()
        } else {
            report.placeholder_keys.join(", ").yellow().to_string()
        };
        print_row("placeholder secrets", colorized);
    }
}

fn looks_like_placeholder(value: &str) -> bool {
    let normalized = value.trim().to_ascii_lowercase();
    normalized.is_empty()
        || normalized.contains("change-me")
        || normalized.contains("change_in_prod")
        || normalized.contains("change-in-prod")
        || normalized.contains("your-mapbox-token")
        || normalized.contains("super-secret")
        || normalized.contains("insecure")
        || normalized.contains("scope_dev_2026")
}

fn parse_method(method: &str) -> CliResult<Method> {
    Ok(Method::from_bytes(method.as_bytes())?)
}

fn extract_status_label(payload: &Value) -> Option<&str> {
    payload
        .get("status")
        .and_then(Value::as_str)
        .or_else(|| payload.get("data")?.get("status")?.as_str())
}

fn is_healthy_status(status: &str) -> bool {
    matches!(status.trim().to_ascii_lowercase().as_str(), "healthy" | "ok")
}

fn load_env_map(path: &Path, missing_ok: bool) -> CliResult<EnvMap> {
    if !path.exists() {
        if missing_ok {
            return Ok(EnvMap::new());
        }

        return Err(boxed_error(format!(
            "Environment file does not exist: {}",
            path.display()
        )));
    }

    let contents = fs::read_to_string(path)?;
    let mut values = EnvMap::new();
    for raw_line in contents.lines() {
        let line = raw_line.trim();
        if line.is_empty() || line.starts_with('#') || !line.contains('=') {
            continue;
        }

        let mut parts = line.splitn(2, '=');
        let key = parts.next().unwrap_or_default().trim();
        let value = parts
            .next()
            .unwrap_or_default()
            .trim()
            .trim_matches('"')
            .trim_matches('\'')
            .to_string();

        if !key.is_empty() {
            values.insert(key.to_string(), value);
        }
    }

    Ok(values)
}

fn resolve_value(keys: &[&str], env_map: &EnvMap) -> Option<String> {
    for key in keys {
        if let Ok(value) = env::var(key) {
            if !value.trim().is_empty() {
                return Some(value);
            }
        }

        if let Some(value) = env_map.get(*key) {
            if !value.trim().is_empty() {
                return Some(value.clone());
            }
        }
    }

    None
}

fn build_http_client(timeout_seconds: f64) -> CliResult<Client> {
    let timeout = if timeout_seconds <= 0.0 {
        Duration::from_secs_f64(DEFAULT_TIMEOUT_SECONDS)
    } else {
        Duration::from_secs_f64(timeout_seconds)
    };

    Ok(Client::builder()
        .timeout(timeout)
        .user_agent(format!(
            "{}/{}",
            env!("CARGO_PKG_NAME"),
            env!("CARGO_PKG_VERSION")
        ))
        .build()?)
}

fn run_process(program: &str, args: &[&str], working_directory: &Path) -> CliResult<String> {
    let output = ProcessCommand::new(program)
        .args(args)
        .current_dir(working_directory)
        .output()
        .map_err(|error| boxed_error(format!("{program} failed to start: {error}")))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        Ok(stdout)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(boxed_error(format!(
            "{program} {:?} failed: {}",
            args,
            if stderr.is_empty() {
                "unknown error"
            } else {
                stderr.as_str()
            }
        )))
    }
}

fn env_or_default(key: &str, default: &str) -> String {
    env::var(key).unwrap_or_else(|_| default.to_string())
}

fn env_path_or_default(key: &str, default: &str) -> PathBuf {
    env::var_os(key)
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(default))
}

fn truncate(value: &str, max_len: usize) -> String {
    if value.chars().count() <= max_len {
        return value.replace('\n', " ");
    }

    value.chars().take(max_len).collect::<String>().replace('\n', " ") + "..."
}

fn print_banner(title: &str) {
    println!("{}", title.bold().bright_white());
    println!("{}", "=".repeat(title.len()).bright_black());
}

fn print_row(label: &str, value: impl Display) {
    println!("{} {}", format!("{label}:").cyan().bold(), value);
}

fn boxed_error(message: impl Into<String>) -> Box<dyn Error + Send + Sync> {
    Box::new(io::Error::other(message.into()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use clap::Parser;
    use tempfile::tempdir;

    #[test]
    fn parses_health_command() {
        let cli = Cli::try_parse_from(["scope", "health", "--verbose"]).expect("health should parse");

        match cli.command {
            Command::Health(args) => assert!(args.verbose),
            _ => panic!("expected health command"),
        }
    }

    #[test]
    fn parses_nested_subcommands() {
        let cli =
            Cli::try_parse_from(["scope", "deploy", "validate"]).expect("deploy validate should parse");

        match cli.command {
            Command::Deploy(args) => match args.command {
                DeployCommand::Validate(validate_args) => {
                    assert_eq!(validate_args.env_file, PathBuf::from(".env"));
                }
            },
            _ => panic!("expected deploy command"),
        }
    }

    #[test]
    fn default_config_has_four_valid_service_urls() {
        let config = ScopeConfig::default();

        assert_eq!(config.services.len(), 4);
        for service in config.services {
            assert!(service.parsed_url().is_ok(), "invalid URL for {}", service.name);
        }
    }

    #[test]
    fn parses_http_methods_for_benchmark_command() {
        assert_eq!(parse_method("GET").expect("GET should parse"), Method::GET);
        assert!(parse_method("NOT VALID").is_err());
    }

    #[test]
    fn split_sql_batches_respects_go_boundaries() {
        let sql = "SELECT 1\nGO\n\nSELECT 2\n go \nSELECT 3\n";
        let batches = split_sql_batches(sql);

        assert_eq!(batches, vec!["SELECT 1", "SELECT 2", "SELECT 3"]);
    }

    #[test]
    fn split_sql_batches_matches_seed_style_go_lines() {
        let sql = "SELECT 1;\nGO\nSELECT 2;\nGO\n";
        let batches = split_sql_batches(sql);

        assert_eq!(batches, vec!["SELECT 1;", "SELECT 2;"]);
    }

    #[test]
    fn seed_files_are_sorted_by_phase_then_service() {
        let directory = tempdir().expect("tempdir");
        let root = directory.path();
        fs::create_dir_all(root.join("core")).expect("core dir");
        fs::create_dir_all(root.join("content")).expect("content dir");
        fs::create_dir_all(root.join("intel")).expect("intel dir");

        for relative in [
            "content/002_content_seed_data.sql",
            "intel/001_intel_schema.sql",
            "core/002_core_seed_data.sql",
            "content/001_content_schema.sql",
            "core/001_core_schema.sql",
            "intel/002_intel_seed_data.sql",
        ] {
            fs::write(root.join(relative), "SELECT 1;\nGO\n").expect("write sql");
        }

        let discovered = discover_seed_files(root).expect("discover files");
        let relative = discovered
            .iter()
            .map(|path| {
                path.strip_prefix(root)
                    .expect("relative path")
                    .to_string_lossy()
                    .replace('\\', "/")
            })
            .collect::<Vec<_>>();

        assert_eq!(
            relative,
            vec![
                "core/001_core_schema.sql",
                "content/001_content_schema.sql",
                "intel/001_intel_schema.sql",
                "core/002_core_seed_data.sql",
                "content/002_content_seed_data.sql",
                "intel/002_intel_seed_data.sql",
            ]
        );
    }

    #[test]
    fn env_check_report_flags_missing_blank_and_placeholder_values() {
        let directory = tempdir().expect("tempdir");
        let env_file = directory.path().join(".env");
        let example_file = directory.path().join(".env.example");

        fs::write(
            &example_file,
            "\
SA_PASSWORD=Scope_Dev_2026!\n\
CORE_JWT_SECRET=super-secret-256-bit-key-change-in-prod\n\
DJANGO_SECRET_KEY=django-insecure-change-me-in-prod\n\
AWS_ACCESS_KEY_ID=\n\
",
        )
        .expect("write example");
        fs::write(
            &env_file,
            "\
SA_PASSWORD=Scope_Dev_2026!\n\
DJANGO_SECRET_KEY=\n\
EXTRA_KEY=1\n\
",
        )
        .expect("write env");

        let report = build_env_check_report(&env_file, &example_file).expect("report");

        assert_eq!(report.missing_required, vec!["CORE_JWT_SECRET"]);
        assert_eq!(report.blank_required, vec!["DJANGO_SECRET_KEY"]);
        assert_eq!(report.extra_keys, vec!["EXTRA_KEY"]);
        assert_eq!(report.placeholder_keys, vec!["SA_PASSWORD"]);
    }

    #[test]
    fn parses_sql_server_connection_strings() {
        let parsed = parse_connection_string(
            "Server=sqlserver,1433;Database=ScopeDb;User Id=sa;Password=secret;TrustServerCertificate=True;",
        );

        assert_eq!(parsed.get("server"), Some(&"sqlserver,1433".to_string()));
        assert_eq!(parsed.get("database"), Some(&"ScopeDb".to_string()));
        assert_eq!(parsed.get("user id"), Some(&"sa".to_string()));
        assert_eq!(parsed.get("password"), Some(&"secret".to_string()));
    }

    #[test]
    fn extracts_status_from_health_payloads() {
        let top_level = serde_json::json!({ "status": "healthy" });
        let nested = serde_json::json!({ "data": { "status": "healthy" } });

        assert_eq!(extract_status_label(&top_level), Some("healthy"));
        assert_eq!(extract_status_label(&nested), Some("healthy"));
        assert!(extract_status_label(&serde_json::json!({ "ok": true })).is_none());
        assert!(is_healthy_status("healthy"));
        assert!(is_healthy_status("ok"));
        assert!(!is_healthy_status("degraded"));
    }

    #[test]
    fn benchmark_summary_calculates_percentiles_and_status_counts() {
        let summary = summarize_benchmark_results(
            &[
                BenchmarkRequestResult {
                    status_code: Some(200),
                    ok: true,
                    duration_ms: 10.0,
                    detail: "HTTP 200".to_string(),
                },
                BenchmarkRequestResult {
                    status_code: Some(200),
                    ok: true,
                    duration_ms: 20.0,
                    detail: "HTTP 200".to_string(),
                },
                BenchmarkRequestResult {
                    status_code: Some(503),
                    ok: false,
                    duration_ms: 30.0,
                    detail: "HTTP 503".to_string(),
                },
                BenchmarkRequestResult {
                    status_code: None,
                    ok: false,
                    duration_ms: 40.0,
                    detail: "timeout".to_string(),
                },
            ],
            Duration::from_secs(2),
        );

        assert_eq!(summary.total_requests, 4);
        assert_eq!(summary.success_count, 2);
        assert_eq!(summary.failure_count, 2);
        assert_eq!(summary.min_ms, 10.0);
        assert_eq!(summary.max_ms, 40.0);
        assert_eq!(summary.p50_ms, 30.0);
        assert_eq!(summary.p90_ms, 40.0);
        assert_eq!(summary.status_counts.get("200"), Some(&2));
        assert_eq!(summary.status_counts.get("503"), Some(&1));
        assert_eq!(summary.status_counts.get("error"), Some(&1));
    }
}
