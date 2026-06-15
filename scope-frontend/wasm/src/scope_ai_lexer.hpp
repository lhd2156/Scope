#pragma once

#include <cctype>
#include <cstddef>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <utility>
#include <vector>

namespace scope {
namespace wasm {
namespace lexer {

struct Token {
  std::string type;
  std::string value;
  std::string normalized;
  int start;
  int end;
};

inline const std::unordered_set<std::string>& stopWords() {
  static const std::unordered_set<std::string> words = {
    "a", "an", "and", "around", "at", "can", "could", "for", "from", "in", "into", "it",
    "me", "my", "of", "on", "please", "pls", "that", "the", "this", "to", "with", "you",
  };
  return words;
}

inline const std::unordered_map<std::string, std::string>& keywordTypes() {
  static const std::unordered_map<std::string, std::string> types = {
    {"map", "map_keyword"},
    {"zoom", "zoom_keyword"},
    {"zooming", "zoom_keyword"},
    {"in", "zoom_direction"},
    {"into", "zoom_direction"},
    {"out", "zoom_direction"},
    {"reset", "map_control"},
    {"fit", "map_control"},
    {"locate", "map_control"},
    {"center", "map_control"},
    {"recenter", "map_control"},
    {"focus", "map_control"},
    {"show", "map_control"},
    {"switch", "map_control"},
    {"change", "map_control"},
    {"turn", "map_control"},
    {"toggle", "map_control"},
    {"light", "map_style"},
    {"bright", "map_style"},
    {"dark", "map_style"},
    {"save", "document_action"},
    {"share", "document_action"},
    {"invite", "document_action"},
    {"add", "document_action"},
    {"public", "document_action"},
    {"publish", "document_action"},
    {"private", "document_action"},
    {"unpublish", "document_action"},
    {"rename", "document_action"},
    {"name", "document_action"},
    {"title", "document_action"},
    {"call", "document_action"},
    {"delete", "document_action"},
    {"remove", "document_action"},
    {"clear", "document_action"},
    {"discard", "document_action"},
    {"confirm", "document_action"},
    {"start", "endpoint_keyword"},
    {"starting", "endpoint_keyword"},
    {"end", "endpoint_keyword"},
    {"destination", "endpoint_keyword"},
    {"final", "endpoint_keyword"},
    {"finish", "endpoint_keyword"},
    {"viewer", "role"},
    {"view", "role"},
    {"editor", "role"},
    {"edit", "role"},
  };
  return types;
}

inline const std::unordered_map<std::string, std::string>& aliases() {
  static const std::unordered_map<std::string, std::string> values = {
    {"mapp", "map"},
    {"mpa", "map"},
    {"maap", "map"},
    {"mappp", "map"},
    {"zom", "zoom"},
    {"zomm", "zoom"},
    {"zoome", "zoom"},
    {"zoomigng", "zooming"},
    {"zoomingg", "zooming"},
    {"into", "in"},
    {"cneter", "center"},
    {"centar", "center"},
    {"cener", "center"},
    {"reecenter", "recenter"},
    {"swtich", "switch"},
    {"swich", "switch"},
    {"swithc", "switch"},
    {"toggel", "toggle"},
    {"toggl", "toggle"},
    {"lokate", "locate"},
    {"lcoate", "locate"},
    {"locat", "locate"},
    {"fitt", "fit"},
    {"sahre", "share"},
    {"shrae", "share"},
    {"shar", "share"},
    {"shre", "share"},
    {"invte", "invite"},
    {"inivte", "invite"},
    {"invtie", "invite"},
    {"renmae", "rename"},
    {"reanme", "rename"},
    {"publc", "public"},
    {"pubilc", "public"},
    {"publci", "public"},
    {"publsh", "publish"},
    {"publsih", "publish"},
    {"privte", "private"},
    {"prvate", "private"},
    {"privat", "private"},
    {"privtae", "private"},
    {"viwer", "viewer"},
    {"vewer", "viewer"},
    {"edtor", "editor"},
    {"editr", "editor"},
    {"delte", "delete"},
    {"deleet", "delete"},
    {"delet", "delete"},
    {"remvoe", "remove"},
    {"cnfirm", "confirm"},
    {"resset", "reset"},
    {"reser", "reset"},
    {"strt", "start"},
    {"sstart", "start"},
    {"dest", "destination"},
    {"destnation", "destination"},
    {"destinaton", "destination"},
    {"destiantion", "destination"},
    {"destinatoin", "destination"},
    {"ligt", "light"},
    {"lite", "light"},
    {"brite", "bright"},
    {"brigth", "bright"},
    {"drak", "dark"},
  };
  return values;
}

inline bool isLexemeCharacter(char rawCharacter) {
  const auto character = static_cast<unsigned char>(rawCharacter);
  return std::isalnum(character) || rawCharacter == '@' || rawCharacter == '.' || rawCharacter == '_' ||
         rawCharacter == '\'' || rawCharacter == '-';
}

inline std::string normalizeLexeme(const std::string& value) {
  std::string normalized;
  normalized.reserve(value.size());

  for (const auto rawCharacter : value) {
    const auto character = static_cast<unsigned char>(rawCharacter);
    normalized.push_back(static_cast<char>(std::tolower(character)));
  }

  while (!normalized.empty() && normalized.front() == '\'') {
    normalized.erase(normalized.begin());
  }

  while (!normalized.empty() && normalized.back() == '\'') {
    normalized.pop_back();
  }

  const auto& aliasValues = aliases();
  const auto alias = aliasValues.find(normalized);
  if (alias != aliasValues.end()) {
    return alias->second;
  }

  return normalized;
}

inline bool isEmailLexeme(const std::string& value) {
  const auto atPosition = value.find('@');
  if (atPosition == std::string::npos || atPosition == 0 || atPosition + 1 >= value.size()) {
    return false;
  }

  return value.find('@', atPosition + 1) == std::string::npos &&
         value.find('.', atPosition + 1) != std::string::npos;
}

inline bool isHandleLexeme(const std::string& value) {
  if (value.size() < 2 || value[0] != '@' || value.find('.') != std::string::npos) {
    return false;
  }

  for (std::size_t index = 1; index < value.size(); ++index) {
    const auto character = static_cast<unsigned char>(value[index]);
    if (!std::isalnum(character) && value[index] != '_' && value[index] != '-') {
      return false;
    }
  }

  return true;
}

inline bool isNumberLexeme(const std::string& normalized) {
  bool sawDigit = false;
  bool sawDecimal = false;

  for (const auto rawCharacter : normalized) {
    const auto character = static_cast<unsigned char>(rawCharacter);
    if (std::isdigit(character)) {
      sawDigit = true;
      continue;
    }

    if (rawCharacter == '.' && !sawDecimal) {
      sawDecimal = true;
      continue;
    }

    return false;
  }

  return sawDigit;
}

inline std::string classifyLexeme(const std::string& value, const std::string& normalized) {
  if (isNumberLexeme(normalized)) {
    return "number";
  }

  if (isEmailLexeme(value)) {
    return "email";
  }

  if (isHandleLexeme(value)) {
    return "handle";
  }

  const auto& types = keywordTypes();
  const auto keywordType = types.find(normalized);
  if (keywordType != types.end()) {
    return keywordType->second;
  }

  const auto& words = stopWords();
  if (words.find(normalized) != words.end()) {
    return "filler";
  }

  return "word";
}

inline bool isPlaceCandidate(const Token& token) {
  return (token.type == "word" || token.type == "number") && token.normalized.size() > 1;
}

inline void appendPlaceSpans(std::vector<Token>& results, const std::vector<Token>& tokens) {
  std::size_t index = 0;

  while (index < tokens.size()) {
    if (!isPlaceCandidate(tokens[index])) {
      ++index;
      continue;
    }

    const auto startIndex = index;
    auto endIndex = index;
    ++index;

    while (index < tokens.size() && isPlaceCandidate(tokens[index])) {
      endIndex = index;
      ++index;
    }

    if (endIndex <= startIndex) {
      continue;
    }

    Token span;
    span.type = "place_span";
    span.start = tokens[startIndex].start;
    span.end = tokens[endIndex].end;

    for (auto tokenIndex = startIndex; tokenIndex <= endIndex; ++tokenIndex) {
      if (!span.value.empty()) {
        span.value += " ";
        span.normalized += " ";
      }

      span.value += tokens[tokenIndex].value;
      span.normalized += tokens[tokenIndex].normalized;
    }

    results.push_back(std::move(span));
  }
}

inline std::vector<Token> tokenize(const std::string& input) {
  std::vector<Token> tokens;
  std::size_t index = 0;

  while (index < input.size()) {
    while (index < input.size() && !isLexemeCharacter(input[index])) {
      ++index;
    }

    if (index >= input.size()) {
      break;
    }

    const auto start = index;
    while (index < input.size() && isLexemeCharacter(input[index])) {
      ++index;
    }

    const auto end = index;
    const auto value = input.substr(start, end - start);
    const auto normalized = normalizeLexeme(value);
    if (normalized.empty()) {
      continue;
    }

    tokens.push_back(Token {
      classifyLexeme(value, normalized),
      value,
      normalized,
      static_cast<int>(start),
      static_cast<int>(end),
    });
  }

  auto results = tokens;
  appendPlaceSpans(results, tokens);
  return results;
}

}  // namespace lexer
}  // namespace wasm
}  // namespace scope
