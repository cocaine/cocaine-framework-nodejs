
#ifndef NOCOCAINE_COMMON_HPP
#define NOCOCAINE_COMMON_HPP

#include <nodejs/node.h>
#include <nodejs/node_buffer.h>

#include <cocaine/common.hpp>
#include <cocaine/io.hpp>
#include <cocaine/rpc.hpp>
#include <cocaine/unique_id.hpp>
#include <cocaine/context.hpp>
#include <cocaine/logging.hpp>
#include <cocaine/manifest.hpp>
#include <cocaine/profile.hpp>

#include <cocaine/traits.hpp>
#include <cocaine/traits/unique_id.hpp>
#include <cocaine/traits/json.hpp>

#include <boost/filesystem/path.hpp>
#include "ngx-queue.h"

using namespace cocaine;
using namespace cocaine::engine;
using namespace cocaine::io;
using namespace cocaine::logging;
using namespace v8;
using namespace node;

namespace cocaine { namespace engine {

    extern Persistent<FunctionTemplate> stream_constructor;
    extern Persistent<FunctionTemplate> worker_constructor;

    extern Persistent<String> onread_sym;
    extern Persistent<String> oncomplete_sym;
    extern Persistent<String> errno_sym;
    extern Persistent<String> buffer_sym;
    extern Persistent<String> domain_sym;
    extern Persistent<String> process_sym;
    extern Persistent<String> bytes_sym;
    extern Persistent<String> write_queue_size_sym;
    extern Persistent<String> onconnection_sym;
    extern Persistent<String> heartbeat_sym;
    extern Persistent<String> onheartbeat_sym;
    extern Persistent<String> onshutdown_sym;

    void SetErrno(uv_err_t err);
    void NodeWorkerInitialize(Handle<Object> target);

    class NodeWorker;
    class Stream;
    class WriteReq;
    class ShutdownReq;
  }
} // namespace cocaine::engine


#endif
  
