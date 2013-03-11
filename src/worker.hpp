
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

using namespace cocaine;
using namespace cocaine::engine;
using namespace cocaine::io;
using namespace cocaine::logging;
using namespace v8;
using namespace node;

namespace fs = boost::filesystem;

namespace cocaine { namespace engine {
    
    struct worker_config_t {
      std::string app;
      std::string profile;
      std::string uuid;
    };

    class NodeWorker:
    public boost::noncopyable,
    public ObjectWrap {
      enum class state_t: int{
        start, running, shutdown, stop};
      typedef state_t st;

      context_t&                      m_context;
      std::unique_ptr<logging::log_t> m_log;
      unique_id_t                     m_id;

      state_t m_state;
      bool m_shutdown_pending;
      bool m_shutdown_done;
      bool m_stop_pending;
      bool m_stop_done;

      std::string m_endpoint;
      io::socket_t m_channel;
        
      uv_loop_t    *m_loop;
      //uv_check_t   *m_check;
      uv_poll_t    *m_watcher;
      uv_prepare_t *m_prepare;

      // The app

      std::unique_ptr<const manifest_t> m_manifest;
      std::unique_ptr<const profile_t>  m_profile;

      //std::list<std::shared_ptr<Stream::Shared>> m_writing_q;
      //std::list<std::shared_ptr<Stream::Shared>> m_prepare_q;
      
      ngx_queue m_writing_q;
      ngx_queue m_pending_q;

      bool m_want_write;
      bool m_want_prepare;

      // Session streams.
      typedef std::map<
        uint64_t,
        std::shared_ptr<Stream::Shared>
      > stream_map_t;
      
      stream_map_t m_streams;

      //================

      NodeWorker(context_t& context,
                 worker_config_t config);

      ~NodeWorker();

      static void
      Initialize(Handle<Object> target);

      static Handle<Value>
      New(const Arguments &args);


      static void
      uv_on_check(uv_check_t *hdl, int status);

      static void
      uv_on_prepare(uv_prepare_t *hdl, int status);

      static void
      uv_on_event(uv_poll_t *hdl,int status, int events);

      void
      process_prepare();

      void
      process_writable();

      void
      process_readable();


      //==== js->c api ====

      static Handle<Value>
      Listen(const Arguments &args);

      static Handle<Value>
      Heartbeat(const Arguments &args);

      static Handle<Value>
      Shutdown(const Arguments &args);
      
      static Handle<Value>
      Stop(const Arguments &args);

      //==== js completion helpers

      void
      OnConnection(Stream *s);

      void
      OnHeartbeat();

      //==== loop callbacks

      void
      on_invoke(io::message_t &message);

      void
      on_chunk(io::message_t &message);

      void
      on_choke(io::message_t &message);

      void
      on_shutdown();

      void
      on_stop();

      void
      on_terminate();

      void on_heartbeat();

      //================

      int
      listen();

      void
      terminate(rpc::suicide::reasons reason,
                const std::string& message);

      void
      set_want_write(bool want);

      void
      set_want_prepare(bool want);

      void
      update_watchers_state();

      void
      writing_enq(Stream *s);

      void
      writing_deq(Stream *s);

      void
      pending_enq(Stream *s);

      void
      pending_deq(Stream *s);

      void
      stream_remove(Stream *s);      

      template<class Eevnt, typename... Args>
      std::string
      pack_msg(Args&&... args);
    
      template<class Event, typename... Args>
      bool
      send(Args&&... args);

      bool
      send_raw(std::string &blob,int flags = 0);

    };
    
  }
} 


