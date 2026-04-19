#include <string>

#include <emscripten/bind.h>

namespace atlas {

struct ModuleInfo {
  std::string version;
  bool algorithmsReady;
  std::string status;
};

std::string ping() {
  return "atlas-wasm-ready";
}

ModuleInfo getModuleInfo() {
  return {
    "0.1.0",
    false,
    "Phase 23.1 scaffold ready",
  };
}

}  // namespace atlas

EMSCRIPTEN_BINDINGS(atlas_wasm_module) {
  using namespace emscripten;

  value_object<atlas::ModuleInfo>("ModuleInfo")
    .field("version", &atlas::ModuleInfo::version)
    .field("algorithmsReady", &atlas::ModuleInfo::algorithmsReady)
    .field("status", &atlas::ModuleInfo::status);

  function("ping", &atlas::ping);
  function("getModuleInfo", &atlas::getModuleInfo);
}
