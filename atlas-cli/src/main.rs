use std::{error::Error, fmt::Display, path::PathBuf};

use clap::{Args, Parser, Subcommand};
use colored::Colorize;
use reqwest::{Client, Method, Url};
use serde::{Deserialize, Serialize};

type CliResult<T = ()> = Result<T, Box<dyn Error>>;

#[derive(Parser, Debug)]
#[command(
    name = "atlas",
    bin_name = "atlas",
    version,
    about = "Atlas cross-service operations CLI"
)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand, Debug)]
enum Command {
    /// Check service health across Atlas backends
    Health(HealthArgs),
    /// Execute Atlas SQL seed files
    Seed(SeedArgs),
    /// Deployment-oriented tooling
    Deploy(DeployArgs),
    /// Run lightweight HTTP benchmarks against Atlas endpoints
    Benchmark(BenchmarkArgs),
    /// Environment-file validation commands
    Env(EnvArgs),
}

#[derive(Args, Debug)]
struct HealthArgs {
    /// Show the resolved health-check URLs
    #[arg(long, default_value_t = false)]
    verbose: bool,
}

#[derive(Args, Debug)]
struct SeedArgs {
    /// Seed directory to inspect or execute
    #[arg(long)]
    directory: Option<PathBuf>,

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
    /// Run the pre-deployment checklist scaffold
    Validate(DeployValidateArgs),
}

#[derive(Args, Debug)]
struct DeployValidateArgs {
    /// Environment file to validate before deployment
    #[arg(long, default_value = ".env")]
    env_file: PathBuf,
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AtlasConfig {
    services: Vec<ServiceTarget>,
    seed_directory: PathBuf,
    env_file: PathBuf,
    env_example_file: PathBuf,
}

impl Default for AtlasConfig {
    fn default() -> Self {
        Self {
            services: vec![
                ServiceTarget {
                    name: "core".to_string(),
                    health_url: "http://localhost:5001/api/core/health".to_string(),
                },
                ServiceTarget {
                    name: "content".to_string(),
                    health_url: "http://localhost:5002/api/content/health".to_string(),
                },
                ServiceTarget {
                    name: "intel".to_string(),
                    health_url: "http://localhost:5003/api/intel/health".to_string(),
                },
            ],
            seed_directory: PathBuf::from("seeds"),
            env_file: PathBuf::from(".env"),
            env_example_file: PathBuf::from(".env.example"),
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
    client: Client,
    config: AtlasConfig,
}

impl AppContext {
    fn new() -> CliResult<Self> {
        let client = Client::builder()
            .user_agent(format!(
                "{}/{}",
                env!("CARGO_PKG_NAME"),
                env!("CARGO_PKG_VERSION")
            ))
            .build()?;

        Ok(Self {
            client,
            config: AtlasConfig::default(),
        })
    }
}

#[tokio::main]
async fn main() -> CliResult {
    let cli = Cli::parse();
    let context = AppContext::new()?;
    dispatch(cli.command, &context).await
}

async fn dispatch(command: Command, context: &AppContext) -> CliResult {
    match command {
        Command::Health(args) => run_health(args, context).await,
        Command::Seed(args) => run_seed(args, context).await,
        Command::Deploy(args) => run_deploy(args, context).await,
        Command::Benchmark(args) => run_benchmark(args, context).await,
        Command::Env(args) => run_env(args, context).await,
    }
}

async fn run_health(args: HealthArgs, context: &AppContext) -> CliResult {
    print_banner("Atlas service health scaffold");

    for service in &context.config.services {
        let url = service.parsed_url()?;
        let request = context.client.get(url.clone()).build()?;

        print_row(
            &service.name,
            format!("{} {}", "ready".green().bold(), request.url()),
        );

        if args.verbose {
            print_row("method", request.method());
        }
    }

    println!(
        "{}",
        "Phase 24.2 will execute these checks concurrently and report live status."
            .yellow()
            .bold()
    );

    Ok(())
}

async fn run_seed(args: SeedArgs, context: &AppContext) -> CliResult {
    let directory = args
        .directory
        .unwrap_or_else(|| context.config.seed_directory.clone());

    print_banner("Atlas seed scaffold");
    print_row("directory", directory.display());
    print_row("mode", if args.dry_run { "dry-run" } else { "execute" });
    print_row(
        "notes",
        "Phase 24.3 will parse ordered SQL files from the Atlas seeds/ directory.",
    );

    Ok(())
}

async fn run_deploy(args: DeployArgs, context: &AppContext) -> CliResult {
    match args.command {
        DeployCommand::Validate(validate_args) => run_deploy_validate(validate_args, context).await,
    }
}

async fn run_deploy_validate(args: DeployValidateArgs, context: &AppContext) -> CliResult {
    print_banner("Atlas deploy validate scaffold");
    print_row("env file", args.env_file.display());
    print_row("contract", context.config.env_example_file.display());
    print_row(
        "checks",
        "Phase 24.4 will verify env vars, Docker availability, ports, and certificates.",
    );

    Ok(())
}

async fn run_benchmark(args: BenchmarkArgs, context: &AppContext) -> CliResult {
    let method = parse_method(&args.method)?;
    let url = Url::parse(&args.url)?;
    let request = context.client.request(method.clone(), url.clone()).build()?;

    print_banner("Atlas benchmark scaffold");
    print_row("request", format!("{} {}", method, request.url()));
    print_row("requests", args.requests);
    print_row("concurrency", args.concurrency);
    print_row(
        "notes",
        "Phase 24.5 will turn this scaffold into configurable async load testing.",
    );

    Ok(())
}

async fn run_env(args: EnvArgs, context: &AppContext) -> CliResult {
    match args.command {
        EnvCommand::Check(check_args) => run_env_check(check_args, context).await,
    }
}

async fn run_env_check(args: EnvCheckArgs, context: &AppContext) -> CliResult {
    print_banner("Atlas env check scaffold");
    print_row("env file", args.env_file.display());
    print_row("example file", args.example_file.display());
    print_row("default contract", context.config.env_example_file.display());
    print_row(
        "notes",
        "Phase 24.6 will compare missing and extra variables against the example contract.",
    );

    Ok(())
}

fn parse_method(method: &str) -> CliResult<Method> {
    Ok(Method::from_bytes(method.as_bytes())?)
}

fn print_banner(title: &str) {
    println!("{}", title.bold().bright_white());
    println!("{}", "=".repeat(title.len()).bright_black());
}

fn print_row(label: &str, value: impl Display) {
    println!("{} {}", format!("{label}:").cyan().bold(), value);
}

#[cfg(test)]
mod tests {
    use super::*;
    use clap::Parser;

    #[test]
    fn parses_health_command() {
        let cli = Cli::try_parse_from(["atlas", "health", "--verbose"]).expect("health should parse");

        match cli.command {
            Command::Health(args) => assert!(args.verbose),
            _ => panic!("expected health command"),
        }
    }

    #[test]
    fn parses_nested_subcommands() {
        let cli = Cli::try_parse_from(["atlas", "deploy", "validate"]).expect("deploy validate should parse");

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
    fn default_config_has_three_valid_service_urls() {
        let config = AtlasConfig::default();

        assert_eq!(config.services.len(), 3);
        for service in config.services {
            assert!(service.parsed_url().is_ok(), "invalid URL for {}", service.name);
        }
    }

    #[test]
    fn parses_http_methods_for_benchmark_scaffold() {
        assert_eq!(parse_method("GET").expect("GET should parse"), Method::GET);
        assert!(parse_method("NOT VALID").is_err());
    }
}

