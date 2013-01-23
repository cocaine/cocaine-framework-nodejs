
#ifndef __NOCOCAINE_WORKER_HPP__
#define __NOCOCAINE_WORKER_HPP__


#include <nodejs/node.h>
#include <nodejs/node_buffer.h>
#include <cocaine/common.hpp>
#include <cocaine/rpc.hpp>
#include <cocaine/unique_id.hpp>
#include <cocaine/context.hpp>
#include <cocaine/logging.hpp>
#include <cocaine/manifest.hpp>
#include <cocaine/profile.hpp>

#include <cocaine/api/sandbox.hpp>

#include <cocaine/traits/unique_id.hpp>
#include <cocaine/traits.hpp>
#include <cocaine/traits/json.hpp>

#include <boost/filesystem/path.hpp>

using namespace cocaine;
using namespace cocaine::engine;
using namespace cocaine::io;
using namespace cocaine::logging;
using namespace v8;
using namespace node;

namespace fs = boost::filesystem;


#if BOOST_VERSION >= 103600
#  define MAP_TYPE boost::unordered_map
#else
#  define MAP_TYPE std::map
#endif

namespace cocaine { namespace engine {

    class Stream;
    
    struct worker_config_t {
      std::string app;
      std::string profile;
      std::string uuid;
    };

    class worker_t:
    public boost::noncopyable, public ObjectWrap
    {
      context_t&                      m_context;
      std::unique_ptr<logging::log_t> m_log;
      unique_id_t                     m_id;

      io::unique_channel_t m_channel;
        
      // Event loop
      uv_loop_t    *m_loop;
      uv_poll_t    *m_watcher_uv;
      uv_prepare_t *m_checker_uv;
      uv_timer_t   *m_heartbeat_timer_uv;
      uv_timer_t   *m_disown_timer_uv;

      // The app

      std::unique_ptr<const manifest_t> m_manifest;
      std::unique_ptr<const profile_t>  m_profile;
      std::unique_ptr<api::sandbox_t>   m_sandbox;

      // Session streams.
      typedef MAP_TYPE <
        unique_id_t,
        boost::shared_ptr<Stream::Shared>
        > stream_map_t;
      
      stream_map_t m_streams;
      
    public:
      worker_t(context_t& context,
               worker_config_t config);

      ~worker_t();

      void
      run();

      template<class Event, typename... Args>
      void
      send(Args&&... args) {
        m_channel.send<Event>(std::forward<Args>(args)...);
      }

      //---- js->c api ----
      
      static Handle<Value>
      New(const Arguments &args);
      
      static Handle<Value>
      Run(const Arguments &args);

      //---- c->js callbacks ----

      void
      on_open(std::string &event, Stream *s);
      
      void
      on_stop();

      //----------------

      static void
      Initialize(Handle<Object> target);

    private:

      void
      on_event();
      
      static void
      uv_on_event(uv_poll_t* handle, int status, int events);
        
      static void
      uv_on_check(uv_prepare_t*,int);
        
      static void
      uv_on_heartbeat(uv_timer_t*,int);

      static void
      uv_on_disown(uv_timer_t*,int);

      void
      process();
        
      void
      terminate(io::rpc::suicide::reasons reason,
                const std::string& message);

    };

  }
} // namespace cocaine::engine


#endif

