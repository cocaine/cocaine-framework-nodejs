
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
    Persistent<String> onheartbeat_sym;

    void SetErrno(uv_err_t err);
    void NodeWorkerInitialize(Handle<Object> target);

    class NodeWorker;
    class Stream;
    class WriteReq;
    class ShutdownReq;
  }
} // namespace cocaine::engine


#endif
  
