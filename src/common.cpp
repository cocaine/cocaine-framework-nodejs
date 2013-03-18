
#include "common.hpp"
#include "stream.hpp"
#include "worker.hpp"

namespace cocaine { namespace engine {


    Persistent<FunctionTemplate> stream_constructor;
    Persistent<FunctionTemplate> worker_constructor;

    Persistent<String> onread_sym;
    Persistent<String> oncomplete_sym;
    Persistent<String> errno_sym;
    Persistent<String> buffer_sym;
    Persistent<String> domain_sym;
    Persistent<String> process_sym;
    Persistent<String> bytes_sym;
    Persistent<String> write_queue_size_sym;
    Persistent<String> onconnection_sym;
    Persistent<String> heartbeat_sym;
    Persistent<String> onshutdown_sym;
    Persistent<String> onheartbeat_sym;

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
    
    void NodeWorkerInitialize(Handle<Object> target) {

#ifdef _DEBUG
      ::freopen("/tmp/cocaine.log","a",stdout);
      ::freopen("/tmp/cocaine.log","a",stderr);
#else
      ::daemon(0,0);
#endif
      Stream::Initialize(target);
      NodeWorker::Initialize(target);

    }
  }

} // namespace cocaine::engine


NODE_MODULE(cocaine, cocaine::engine::NodeWorkerInitialize);

