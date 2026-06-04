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
type ProcessRunner = dyn Fn(&str, &[&str], &Path) -> CliResult<String>;
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
        .or(Some(connection_host))
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
    let create_statement = build_create_database_statement(&config.database);
    connection
        .simple_query(create_statement.as_str())
        .await?
        .into_results()
        .await?;
    Ok(())
}

fn build_create_database_statement(database: &str) -> String {
    let escaped_database_name = database.replace(']', "]]");
    let escaped_literal = database.replace('\'', "''");
    format!("IF DB_ID(N'{escaped_literal}') IS NULL CREATE DATABASE [{escaped_database_name}];")
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
    run_deploy_validate_with_runner(args, &run_process).await
}

async fn run_deploy_validate_with_runner(
    args: DeployValidateArgs,
    process_runner: &ProcessRunner,
) -> CliResult {
    print_banner("Scope deploy validation");

    let env_report = build_env_check_report(&args.env_file, &args.example_file)?;
    print_row("env file", args.env_file.display());
    print_row("compose file", args.compose_file.display());

    print_env_check_report(&env_report, true);

    let workspace = env::current_dir()?;
    let docker_version = process_runner("docker", &["version", "--format", "{{.Server.Version}}"], &workspace);
    match &docker_version {
        Ok(version) => print_row("docker", format!("reachable ({version})")),
        Err(error) => print_row("docker", format!("unavailable ({error})").red()),
    }

    let compose_services = process_runner(
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
    use std::{
        io::{Read, Write},
        net::TcpListener,
        sync::{Mutex, OnceLock},
        thread,
    };
    use tempfile::tempdir;

    fn global_env_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
    }

    fn http_response(status: u16, reason: &str, body: &str, content_type: &str) -> String {
        format!(
            "HTTP/1.1 {status} {reason}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        )
    }

    fn spawn_http_server(responses: Vec<String>) -> String {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind test server");
        let address = listener.local_addr().expect("server address");

        thread::spawn(move || {
            for response in responses {
                let (mut stream, _) = listener.accept().expect("accept request");
                let mut buffer = [0u8; 1024];
                let _ = stream.read(&mut buffer);
                stream.write_all(response.as_bytes()).expect("write response");
            }
        });

        format!("http://{address}")
    }

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
SA_PASSWORD=CHANGE_ME_STRONG_PASSWORD!\n\
CORE_JWT_SECRET=super-secret-256-bit-key-change-in-prod\n\
DJANGO_SECRET_KEY=django-insecure-change-me-in-prod\n\
AWS_ACCESS_KEY_ID=\n\
",
        )
        .expect("write example");
        fs::write(
            &env_file,
            "\
SA_PASSWORD=CHANGE_ME_STRONG_PASSWORD!\n\
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
        let empty = summarize_benchmark_results(&[], Duration::ZERO);
        assert_eq!(empty.average_ms, 0.0);
        assert_eq!(empty.requests_per_second, 0.0);
        assert_eq!(percentile(&[], 0.50), 0.0);

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

    #[test]
    fn app_context_new_resolves_default_configuration() {
        let context = AppContext::new();

        assert_eq!(context.config.services.len(), 4);
        assert_eq!(context.config.seed_directory, PathBuf::from("scripts/sql"));
        assert_eq!(context.config.env_file, PathBuf::from(".env"));
        assert_eq!(context.config.env_example_file, PathBuf::from(".env.example"));
    }

    #[tokio::test]
    async fn inspect_service_health_handles_success_unhealthy_invalid_and_transport_errors() {
        let healthy_url = spawn_http_server(vec![http_response(
            200,
            "OK",
            r#"{"data":{"status":"ok"},"service":"content"}"#,
            "application/json",
        )]);
        let unhealthy_url = spawn_http_server(vec![http_response(
            503,
            "Service Unavailable",
            r#"{"status":"degraded"}"#,
            "application/json",
        )]);
        let client = build_http_client(1.0).expect("client");

        let healthy = inspect_service_health(
            client.clone(),
            ServiceTarget {
                name: "content".to_string(),
                health_url: healthy_url,
            },
        )
        .await;
        assert!(healthy.healthy);
        assert_eq!(healthy.http_status, Some(200));
        assert_eq!(healthy.service_status.as_deref(), Some("ok"));
        assert!(healthy.detail.contains("status"));

        let unhealthy = inspect_service_health(
            client.clone(),
            ServiceTarget {
                name: "intel".to_string(),
                health_url: unhealthy_url,
            },
        )
        .await;
        assert!(!unhealthy.healthy);
        assert_eq!(unhealthy.http_status, Some(503));
        assert!(unhealthy.detail.contains("unexpected response"));

        let invalid = inspect_service_health(
            client.clone(),
            ServiceTarget {
                name: "broken".to_string(),
                health_url: "not a url".to_string(),
            },
        )
        .await;
        assert!(!invalid.healthy);
        assert!(invalid.detail.contains("invalid URL"));

        let transport = inspect_service_health(
            client,
            ServiceTarget {
                name: "offline".to_string(),
                health_url: "http://127.0.0.1:1/health".to_string(),
            },
        )
        .await;
        assert!(!transport.healthy);
        assert!(transport.detail.contains("request failed"));
    }

    #[tokio::test]
    async fn run_health_reports_all_services_healthy_and_fails_when_any_service_fails() {
        let services = (0..4)
            .map(|index| ServiceTarget {
                name: format!("svc-{index}"),
                health_url: spawn_http_server(vec![http_response(
                    200,
                    "OK",
                    r#"{"status":"healthy"}"#,
                    "application/json",
                )]),
            })
            .collect::<Vec<_>>();
        let context = AppContext {
            config: ScopeConfig {
                services,
                seed_directory: PathBuf::from("scripts/sql"),
                env_file: PathBuf::from(".env"),
                env_example_file: PathBuf::from(".env.example"),
            },
        };

        run_health(
            HealthArgs {
                verbose: true,
                timeout_seconds: 1.0,
            },
            &context,
        )
        .await
        .expect("healthy services should pass");

        let context = AppContext {
            config: ScopeConfig {
                services: vec![ServiceTarget {
                    name: "bad".to_string(),
                    health_url: spawn_http_server(vec![http_response(
                        200,
                        "OK",
                        r#"{"status":"degraded"}"#,
                        "application/json",
                    )]),
                }],
                seed_directory: PathBuf::from("scripts/sql"),
                env_file: PathBuf::from(".env"),
                env_example_file: PathBuf::from(".env.example"),
            },
        };
        let error = run_health(
            HealthArgs {
                verbose: false,
                timeout_seconds: 1.0,
            },
            &context,
        )
        .await
        .expect_err("unhealthy service should fail");
        assert!(error.to_string().contains("Health checks failed for: bad"));
    }

    #[tokio::test]
    async fn dispatch_routes_env_seed_and_benchmark_commands() {
        let directory = tempdir().expect("tempdir");
        let seed_dir = directory.path().join("seeds");
        fs::create_dir_all(seed_dir.join("core")).expect("seed dir");
        fs::write(seed_dir.join("core").join("001.sql"), "SELECT 1;\nGO\n").expect("seed file");
        let env_file = directory.path().join(".env");
        let example_file = directory.path().join(".env.example");
        fs::write(&env_file, "A=1\n").expect("env");
        fs::write(&example_file, "A=required\n").expect("example");
        let context = AppContext {
            config: ScopeConfig {
                services: vec![],
                seed_directory: seed_dir.clone(),
                env_file: env_file.clone(),
                env_example_file: example_file.clone(),
            },
        };

        dispatch(
            Command::Seed(SeedArgs {
                directory: Some(seed_dir),
                env_file: None,
                dry_run: true,
            }),
            &context,
        )
        .await
        .expect("seed dry run");

        dispatch(
            Command::Env(EnvArgs {
                command: EnvCommand::Check(EnvCheckArgs {
                    env_file,
                    example_file: example_file.clone(),
                    strict_placeholders: false,
                }),
            }),
            &context,
        )
        .await
        .expect("env check");

        dispatch(
            Command::Health(HealthArgs {
                verbose: false,
                timeout_seconds: 1.0,
            }),
            &context,
        )
        .await
        .expect("empty health service list should pass");

        let deploy_error = dispatch(
            Command::Deploy(DeployArgs {
                command: DeployCommand::Validate(DeployValidateArgs {
                    env_file: directory.path().join("missing.env"),
                    example_file: example_file.clone(),
                    compose_file: directory.path().join("missing-compose.yml"),
                    https_urls: vec![],
                    timeout_seconds: 1.0,
                }),
            }),
            &context,
        )
        .await
        .expect_err("missing deploy env should fail through dispatch");
        assert!(deploy_error.to_string().contains("Environment file does not exist"));

        let error = dispatch(
            Command::Benchmark(BenchmarkArgs {
                url: "http://127.0.0.1:1/".to_string(),
                method: "GET".to_string(),
                requests: 0,
                concurrency: 1,
                timeout_seconds: 1.0,
            }),
            &context,
        )
        .await
        .expect_err("zero requests should fail");
        assert!(error.to_string().contains("--requests"));
    }

    #[tokio::test]
    async fn run_seed_dry_run_uses_default_directory_and_reports_missing_sql() {
        let directory = tempdir().expect("tempdir");
        let seed_dir = directory.path().join("scripts").join("sql");
        fs::create_dir_all(seed_dir.join("content")).expect("seed dir");
        fs::write(seed_dir.join("content").join("001_content.sql"), "SELECT 1;\nGO\n").expect("sql");
        fs::write(seed_dir.join("ignore.txt"), "nope").expect("non-sql");
        let context = AppContext {
            config: ScopeConfig {
                services: vec![],
                seed_directory: seed_dir.clone(),
                env_file: directory.path().join(".env"),
                env_example_file: directory.path().join(".env.example"),
            },
        };

        run_seed(
            SeedArgs {
                directory: None,
                env_file: None,
                dry_run: true,
            },
            &context,
        )
        .await
        .expect("dry run should inspect SQL files");

        let missing = discover_seed_files(&directory.path().join("missing")).expect_err("missing dir");
        assert!(missing.to_string().contains("does not exist"));

        let empty = directory.path().join("empty");
        fs::create_dir(&empty).expect("empty dir");
        let error = discover_seed_files(&empty).expect_err("empty dir should fail");
        assert!(error.to_string().contains("No SQL files"));
    }

    #[test]
    fn seed_plan_counts_batches_and_sorts_unknown_services_last() {
        let directory = tempdir().expect("tempdir");
        let root = directory.path();
        fs::create_dir_all(root.join("zeta")).expect("zeta");
        fs::create_dir_all(root.join("core")).expect("core");
        fs::write(root.join("zeta").join("010_extra.sql"), "SELECT 1;\nGO\nSELECT 2;\n").expect("sql");
        fs::write(root.join("core").join("abc_core.sql"), "SELECT 1;\n").expect("sql");

        let entries = build_seed_plan(root).expect("plan");
        let names = entries
            .iter()
            .map(|entry| {
                (
                    entry
                        .path
                        .strip_prefix(root)
                        .expect("relative")
                        .to_string_lossy()
                        .replace('\\', "/"),
                    entry.batch_count,
                )
            })
            .collect::<Vec<_>>();

        assert_eq!(names[0], ("zeta/010_extra.sql".to_string(), 2));
        assert_eq!(names[1], ("core/abc_core.sql".to_string(), 1));
        assert_eq!(numeric_prefix("abc_core.sql"), u32::MAX);
    }

    #[test]
    fn database_config_resolves_connection_string_overrides_and_errors() {
        let directory = tempdir().expect("tempdir");
        let env_file = directory.path().join(".env");
        fs::write(
            &env_file,
            "\
SCOPE_SQL_CONNECTION_STRING=Server=db.example.test,1444;Database=ScopeDb;User Id=scope;Password=secret;TrustServerCertificate=True;
SCOPE_DB_HOST=override-host
SCOPE_DB_PORT=1555
SCOPE_DB_NAME=OverrideDb
SCOPE_DB_USER=override-user
SCOPE_DB_PASSWORD=override-pass
SCOPE_DB_TRUST_CERT=false
",
        )
        .expect("env");

        let (config, source) = resolve_database_config(Some(&env_file), Path::new(".env")).expect("db config");
        assert_eq!(source, env_file);
        assert_eq!(config.host, "override-host");
        assert_eq!(config.port, 1555);
        assert_eq!(config.database, "OverrideDb");
        assert_eq!(config.user, "override-user");
        assert_eq!(config.password, "override-pass");
        assert!(!config.trust_cert);
        assert_eq!(config.database_target(), "override-user@override-host:1555/OverrideDb");

        let env_file = directory.path().join("connection-only.env");
        fs::write(
            &env_file,
            "CORE_CONNECTION_STRING=Server=tcp:localhost:1434;Initial Catalog=CoreDb;Uid=sa;Pwd=from-connection;\n",
        )
        .expect("env");
        let (config, _) = resolve_database_config(Some(&env_file), Path::new(".env")).expect("db config");
        assert_eq!(config.host, "tcp:localhost");
        assert_eq!(config.port, 1434);
        assert_eq!(config.database, "CoreDb");
        assert_eq!(config.user, "sa");
        assert_eq!(config.password, "from-connection");

        let env_file = directory.path().join("bad.env");
        fs::write(&env_file, "SCOPE_DB_PORT=bad\nSA_PASSWORD=secret\n").expect("env");
        let error = resolve_database_config(Some(&env_file), Path::new(".env")).expect_err("bad port");
        assert!(error.to_string().contains("Invalid database port"));

        let env_file = directory.path().join("missing-password.env");
        fs::write(&env_file, "SCOPE_DB_HOST=localhost\n").expect("env");
        let error = resolve_database_config(Some(&env_file), Path::new(".env")).expect_err("password required");
        assert!(error.to_string().contains("No SQL password"));
    }

    #[test]
    fn server_port_and_u16_parsing_cover_common_sql_forms() {
        assert_eq!(parse_server_host_port("sqlserver,1433"), ("sqlserver".to_string(), Some(1433)));
        assert_eq!(parse_server_host_port("tcp:sqlserver:1444"), ("tcp:sqlserver".to_string(), Some(1444)));
        assert_eq!(parse_server_host_port("localhost,bad"), ("localhost,bad".to_string(), None));
        assert_eq!(parse_server_host_port("localhost:bad"), ("localhost:bad".to_string(), None));
        assert_eq!(parse_u16(" 8080 ", "port").expect("port"), 8080);
        assert!(parse_u16("bad", "port").is_err());
    }

    #[tokio::test]
    async fn sql_connection_helpers_surface_connection_errors_and_escape_database_names() {
        let config = DatabaseConfig {
            host: "127.0.0.1".to_string(),
            port: 1,
            database: "scope]prod's".to_string(),
            user: "sa".to_string(),
            password: "secret".to_string(),
            trust_cert: true,
        };

        let statement = build_create_database_statement(&config.database);
        assert_eq!(
            statement,
            "IF DB_ID(N'scope]prod''s') IS NULL CREATE DATABASE [scope]]prod's];"
        );
        assert!(connect_sql(&config).await.is_err());
        assert!(ensure_database_exists(&config).await.is_err());
    }

    #[tokio::test]
    async fn deploy_validation_covers_successful_process_checks_duplicate_ports_and_https_failures() {
        let directory = tempdir().expect("tempdir");
        let env_file = directory.path().join(".env");
        let example_file = directory.path().join(".env.example");
        let compose_file = directory.path().join("docker-compose.yml");
        fs::write(
            &example_file,
            "\
NGINX_PORT=8080
CORE_PORT=5001
SA_PASSWORD=change-me
CORE_JWT_SECRET=change-me
",
        )
        .expect("example");
        fs::write(
            &env_file,
            "\
NGINX_PORT=45671
CORE_PORT=45671
SA_PASSWORD=real-password
CORE_JWT_SECRET=real-secret
",
        )
        .expect("env");
        fs::write(&compose_file, "services: {}\n").expect("compose");
        let runner = |program: &str, args: &[&str], _working_directory: &Path| -> CliResult<String> {
            assert_eq!(program, "docker");
            if args.first() == Some(&"version") {
                Ok("29.0.0".to_string())
            } else if args.first() == Some(&"compose") {
                Ok("core\ncontent\n".to_string())
            } else {
                Err(boxed_error("unexpected docker command"))
            }
        };
        assert!(runner("docker", &["unknown"], directory.path())
            .expect_err("unknown fake docker command")
            .to_string()
            .contains("unexpected"));

        let error = run_deploy_validate_with_runner(
            DeployValidateArgs {
                env_file: env_file.clone(),
                example_file: example_file.clone(),
                compose_file: compose_file.clone(),
                https_urls: vec!["http://localhost/not-https".to_string()],
                timeout_seconds: 1.0,
            },
            &runner,
        )
        .await
        .expect_err("duplicates and http URL should fail");
        let message = error.to_string();
        assert!(message.contains("port conflicts"));
        assert!(message.contains("https certificate checks"));

        fs::write(
            &env_file,
            "\
NGINX_PORT=45671
CORE_PORT=45672
SA_PASSWORD=real-password
CORE_JWT_SECRET=real-secret
",
        )
        .expect("env");
        run_deploy_validate_with_runner(
            DeployValidateArgs {
                env_file: env_file.clone(),
                example_file: example_file.clone(),
                compose_file: compose_file.clone(),
                https_urls: vec![],
                timeout_seconds: 1.0,
            },
            &runner,
        )
        .await
        .expect("fake process runner and valid env should pass");

        let failing_runner = |_program: &str, _args: &[&str], _working_directory: &Path| -> CliResult<String> {
            Err(boxed_error("tool unavailable"))
        };
        let docker_error = run_deploy_validate_with_runner(
            DeployValidateArgs {
                env_file: env_file.clone(),
                example_file: example_file.clone(),
                compose_file: compose_file.clone(),
                https_urls: vec![],
                timeout_seconds: 1.0,
            },
            &failing_runner,
        )
        .await
        .expect_err("docker checks should fail when process runner fails");
        assert!(docker_error.to_string().contains("docker daemon"));

        let missing = run_deploy(
            DeployArgs {
                command: DeployCommand::Validate(DeployValidateArgs {
                    env_file: directory.path().join("missing.env"),
                    example_file,
                    compose_file,
                    https_urls: vec![],
                    timeout_seconds: 1.0,
                }),
            },
            &AppContext::new(),
        )
        .await
        .expect_err("missing env should fail through deploy dispatch");
        assert!(missing.to_string().contains("Environment file does not exist"));
    }

    #[test]
    fn port_checks_detect_listening_ports_and_invalid_values() {
        let listener = TcpListener::bind("127.0.0.1:0").expect("listener");
        let port = listener.local_addr().expect("address").port();
        let mut env_map = EnvMap::new();
        env_map.insert("CORE_PORT".to_string(), port.to_string());
        env_map.insert("CONTENT_PORT".to_string(), "1".to_string());

        let checks = build_port_checks(&env_map).expect("port checks");
        let core = checks.iter().find(|check| check.key == "CORE_PORT").expect("core port");
        let content = checks
            .iter()
            .find(|check| check.key == "CONTENT_PORT")
            .expect("content port");
        assert!(core.listening);
        assert!(!content.listening);

        env_map.insert("INTEL_PORT".to_string(), "not-a-port".to_string());
        assert!(build_port_checks(&env_map).is_err());
    }

    #[tokio::test]
    async fn benchmark_command_covers_success_failure_and_closed_semaphore_paths() {
        let success_url = spawn_http_server(vec![
            http_response(200, "OK", "one", "text/plain"),
            http_response(200, "OK", "two", "text/plain"),
            http_response(200, "OK", "three", "text/plain"),
        ]);

        run_benchmark(BenchmarkArgs {
            url: success_url,
            method: "GET".to_string(),
            requests: 3,
            concurrency: 2,
            timeout_seconds: 1.0,
        })
        .await
        .expect("successful benchmark");

        let failure_url = spawn_http_server(vec![http_response(503, "Service Unavailable", "down", "text/plain")]);
        let error = run_benchmark(BenchmarkArgs {
            url: failure_url,
            method: "GET".to_string(),
            requests: 1,
            concurrency: 5,
            timeout_seconds: 1.0,
        })
        .await
        .expect_err("failed benchmark");
        assert!(error.to_string().contains("Benchmark completed with 1 failure"));

        let error = run_benchmark(BenchmarkArgs {
            url: "http://127.0.0.1:1/".to_string(),
            method: "GET".to_string(),
            requests: 1,
            concurrency: 0,
            timeout_seconds: 1.0,
        })
        .await
        .expect_err("zero concurrency");
        assert!(error.to_string().contains("--concurrency"));

        let semaphore = Arc::new(Semaphore::new(1));
        semaphore.close();
        let closed = execute_benchmark_request(
            build_http_client(1.0).expect("client"),
            Method::GET,
            Url::parse("http://127.0.0.1:1/").expect("url"),
            semaphore,
        )
        .await;
        assert!(!closed.ok);
        assert_eq!(closed.detail, "benchmark semaphore closed");

        let request_error = execute_benchmark_request(
            build_http_client(0.0).expect("client"),
            Method::GET,
            Url::parse("http://127.0.0.1:1/").expect("url"),
            Arc::new(Semaphore::new(1)),
        )
        .await;
        assert!(!request_error.ok);
        assert_eq!(request_error.status_code, None);
    }

    #[tokio::test]
    async fn env_command_covers_success_and_failure_reports() {
        let directory = tempdir().expect("tempdir");
        let env_file = directory.path().join(".env");
        let example_file = directory.path().join(".env.example");
        fs::write(&example_file, "A=1\nSA_PASSWORD=change-me\nOPTIONAL=\n").expect("example");
        fs::write(&env_file, "A=2\nSA_PASSWORD=real-secret\n").expect("env");
        let context = AppContext::new();

        run_env(
            EnvArgs {
                command: EnvCommand::Check(EnvCheckArgs {
                    env_file: env_file.clone(),
                    example_file: example_file.clone(),
                    strict_placeholders: true,
                }),
            },
            &context,
        )
        .await
        .expect("env check success");

        fs::write(&env_file, "SA_PASSWORD=change-me\n").expect("env");
        let error = run_env_check(
            EnvCheckArgs {
                env_file,
                example_file,
                strict_placeholders: true,
            },
            &context,
        )
        .await
        .expect_err("missing and placeholder should fail");
        assert!(error.to_string().contains("Environment contract check failed"));
    }

    #[test]
    fn env_map_and_report_printing_cover_empty_and_populated_branches() {
        let directory = tempdir().expect("tempdir");
        let env_file = directory.path().join(".env");
        fs::write(
            &env_file,
            "\
# comment
PLAIN=value
DOUBLE=\"quoted\"
SINGLE='quoted'
=ignored
NO_EQUALS
",
        )
        .expect("env");
        let values = load_env_map(&env_file, false).expect("env map");
        assert_eq!(values.get("PLAIN"), Some(&"value".to_string()));
        assert_eq!(values.get("DOUBLE"), Some(&"quoted".to_string()));
        assert_eq!(values.get("SINGLE"), Some(&"quoted".to_string()));
        assert!(!values.contains_key(""));
        assert!(load_env_map(&directory.path().join("missing.env"), true).expect("missing ok").is_empty());
        assert!(load_env_map(&directory.path().join("missing.env"), false).is_err());

        let empty_report = EnvCheckReport {
            env_file: env_file.clone(),
            example_file: directory.path().join(".env.example"),
            missing_required: vec![],
            blank_required: vec![],
            extra_keys: vec![],
            placeholder_keys: vec![],
            populated_keys: values.len(),
        };
        print_env_check_report(&empty_report, false);

        let populated_report = EnvCheckReport {
            env_file,
            example_file: directory.path().join(".env.example"),
            missing_required: vec!["A".to_string()],
            blank_required: vec!["B".to_string()],
            extra_keys: vec!["C".to_string()],
            placeholder_keys: vec!["SA_PASSWORD".to_string()],
            populated_keys: 3,
        };
        assert!(populated_report.has_failures(false));
        assert!(populated_report.has_failures(true));
        print_env_check_report(&populated_report, false);
        print_env_check_report(&populated_report, true);
    }

    #[test]
    fn resolving_values_http_clients_processes_and_formatters_cover_edges() {
        let _guard = global_env_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let mut env_map = EnvMap::new();
        env_map.insert("FROM_MAP".to_string(), "map-value".to_string());
        env_map.insert("BLANK".to_string(), " ".to_string());
        env::remove_var("FROM_ENV");
        assert_eq!(resolve_value(&["BLANK", "FROM_MAP"], &env_map), Some("map-value".to_string()));
        env::set_var("FROM_ENV", " ");
        assert_eq!(resolve_value(&["FROM_ENV", "FROM_MAP"], &env_map), Some("map-value".to_string()));
        env::set_var("FROM_ENV", "env-value");
        assert_eq!(resolve_value(&["FROM_ENV", "FROM_MAP"], &env_map), Some("env-value".to_string()));
        env::remove_var("FROM_ENV");
        assert_eq!(resolve_value(&["MISSING"], &env_map), None);

        assert_eq!(env_or_default("MISSING_SCOPE_TEST_KEY", "fallback"), "fallback");
        env::set_var("SCOPE_TEST_PATH_KEY", "custom-path");
        assert_eq!(env_path_or_default("SCOPE_TEST_PATH_KEY", "fallback"), PathBuf::from("custom-path"));
        env::remove_var("SCOPE_TEST_PATH_KEY");
        assert_eq!(env_path_or_default("SCOPE_TEST_PATH_KEY", "fallback"), PathBuf::from("fallback"));

        let client = build_http_client(-1.0).expect("client");
        drop(client);

        #[cfg(windows)]
        {
            let output = run_process("cmd", &["/C", "echo hello"], Path::new(".")).expect("cmd success");
            assert_eq!(output, "hello");
            assert!(run_process("cmd", &["/C", "exit 7"], Path::new(".")).is_err());
            let stderr = run_process("cmd", &["/C", "echo noisy 1>&2 & exit 7"], Path::new("."))
                .expect_err("cmd stderr failure");
            assert!(stderr.to_string().contains("noisy"));
        }
        #[cfg(not(windows))]
        {
            let output = run_process("sh", &["-c", "printf hello"], Path::new(".")).expect("sh success");
            assert_eq!(output, "hello");
            assert!(run_process("sh", &["-c", "exit 7"], Path::new(".")).is_err());
        }
        assert!(run_process("definitely-not-a-scope-command", &[], Path::new(".")).is_err());

        assert_eq!(truncate("short\nline", 20), "short line");
        assert_eq!(truncate("abcdef", 3), "abc...");
        print_banner("Unit Banner");
        print_row("label", "value");
        assert_eq!(boxed_error("boom").to_string(), "boom");

        for value in [
            "",
            "change-me",
            "change_in_prod",
            "change-in-prod",
            "your-mapbox-token",
            "super-secret",
            "django-insecure-key",
            "CHANGE_ME_STRONG_PASSWORD!",
        ] {
            assert!(looks_like_placeholder(value));
        }
        assert!(!looks_like_placeholder("production-secret"));
    }
}
