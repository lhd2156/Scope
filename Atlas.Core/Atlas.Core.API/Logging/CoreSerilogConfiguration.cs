using Atlas.Core.Domain.Constants;
using Serilog;
using Serilog.Formatting.Compact;

namespace Atlas.Core.API.Logging;

public static class CoreSerilogConfiguration
{
    public static LoggerConfiguration ApplyCoreDefaults(this LoggerConfiguration configuration)
        => configuration
            .MinimumLevel.Information()
            .Enrich.FromLogContext()
            .Enrich.WithProperty(CoreLogging.ServicePropertyName, CoreLogging.ServiceName)
            .WriteTo.Console(new RenderedCompactJsonFormatter());
}
