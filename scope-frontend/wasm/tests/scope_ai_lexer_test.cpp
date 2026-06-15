#include "scope_ai_lexer.hpp"

#include <cstdlib>
#include <iostream>
#include <string>
#include <vector>

namespace {

struct ExpectedToken {
  std::string type;
  std::string value;
  std::string normalized;
  int start;
  int end;
};

bool matches(const scope::wasm::lexer::Token& actual, const ExpectedToken& expected) {
  return actual.type == expected.type
      && actual.value == expected.value
      && actual.normalized == expected.normalized
      && actual.start == expected.start
      && actual.end == expected.end;
}

}  // namespace

int main() {
  const auto tokens = scope::wasm::lexer::tokenize("zoomigng into Dallas TX, then invite @Maya edtor");
  const std::vector<ExpectedToken> expected = {
    {"zoom_keyword", "zoomigng", "zooming", 0, 8},
    {"zoom_direction", "into", "in", 9, 13},
    {"word", "Dallas", "dallas", 14, 20},
    {"word", "TX", "tx", 21, 23},
    {"word", "then", "then", 25, 29},
    {"document_action", "invite", "invite", 30, 36},
    {"handle", "@Maya", "@maya", 37, 42},
    {"role", "edtor", "editor", 43, 48},
    {"place_span", "Dallas TX then", "dallas tx then", 14, 29},
  };

  if (tokens.size() != expected.size()) {
    std::cerr << "Expected " << expected.size() << " tokens, received " << tokens.size() << '\n';
    return EXIT_FAILURE;
  }

  for (std::size_t index = 0; index < expected.size(); ++index) {
    if (!matches(tokens[index], expected[index])) {
      std::cerr << "Token mismatch at index " << index << '\n';
      return EXIT_FAILURE;
    }
  }

  return EXIT_SUCCESS;
}
