
#include "common.hpp"

namespace cocaine { namespace engine {

    void SetErrno(uv_err_t err) {
      HandleScope scope;
      if (errno_sym.IsEmpty()) {
        errno_sym = NODE_PSYMBOL("errno");
      }
      if (err.code == UV_UNKNOWN) {
        char errno_buf[100];
        snprintf(errno_buf, 100, "Unknown system errno %d", err.sys_errno_);
        Context::GetCurrent()->Global()->Set(errno_sym, String::New(errno_buf));
      } else {
        Context::GetCurrent()->Global()->Set(errno_sym,
                                             String::NewSymbol(uv_err_name(err)));
      }
    }
    
} // namespace cocaine::engine


