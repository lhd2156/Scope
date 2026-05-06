using Microsoft.Extensions.DependencyInjection;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;

namespace Scope.Core.Infrastructure.AI;

public class ScopeAIService
{
    private readonly Kernel _kernel;
    private readonly IChatCompletionService _chat;

    public ScopeAIService(string ollamaBaseUrl = "http://ollama:11434", string model = "llama3.1")
    {
        var builder = Kernel.CreateBuilder();
#pragma warning disable SKEXP0070
        builder.AddOllamaChatCompletion(model, new Uri(ollamaBaseUrl));
#pragma warning restore SKEXP0070
        _kernel = builder.Build();
        _chat = _kernel.GetRequiredService<IChatCompletionService>();
    }

    /// <summary>
    /// Summarize a batch of notifications for a user.
    /// </summary>
    public async Task<string> SummarizeNotifications(IEnumerable<string> notifications)
    {
        var history = new ChatHistory();
        history.AddSystemMessage("You are a concise notification summarizer for a travel app. Summarize the following notifications into 1-2 sentences.");
        history.AddUserMessage(string.Join("\n", notifications));

        var result = await _chat.GetChatMessageContentAsync(history);
        return result.Content ?? "No summary available.";
    }

    /// <summary>
    /// Generate friend recommendations based on travel overlap.
    /// </summary>
    public async Task<string> SuggestFriends(string userProfile, IEnumerable<string> candidateProfiles)
    {
        var history = new ChatHistory();
        history.AddSystemMessage("You are a friend recommendation engine for a travel app. Based on travel history overlap, suggest which candidates would be good friends for the user. Be specific about shared interests.");
        history.AddUserMessage($"User profile:\n{userProfile}\n\nCandidates:\n{string.Join("\n---\n", candidateProfiles)}");

        var result = await _chat.GetChatMessageContentAsync(history);
        return result.Content ?? "No suggestions available.";
    }
}
