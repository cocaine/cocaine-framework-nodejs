#ifndef COCAINE_GENERIC_WORKER_HPP
#define COCAINE_GENERIC_WORKER_HPP

#include <cocaine/common.hpp>
#include <cocaine/rpc.hpp>
#include <cocaine/unique_id.hpp>
#include "uv++.h"

#include <cocaine/api/stream.hpp>

#include <nodejs/node.h>

namespace cocaine { namespace engine {

    struct worker_config_t {
      std::string app;
      std::string profile;
      std::string uuid;
    };

    class worker_t:
    public boost::noncopyable
    {
    public:
      worker_t(context_t& context,
               worker_config_t config);

      ~worker_t();

      void
      run();

      template<class Event, typename... Args>
      void
      send(Args&&... args);

    private:
      void
      on_event(uv::io&, int);
        
      void
      on_check(uv::prepare&, int);
        
      void
      on_heartbeat(uv::timer&, int);

      void
      on_disown(uv::timer&, int);

      void
      process();
        
      void
      terminate(io::rpc::suicide::reasons reason,
                const std::string& message);

    private:
      context_t& m_context;
      std::unique_ptr<logging::log_t> m_log;

      // Configuration
      const unique_id_t m_id;

      // Engine I/O
      io::unique_channel_t m_channel;
        
      // Event loop
      //uv::default_loop m_loop;

      //uv::io m_watcher;
      uv_poll_t* m_watcher_uv;
      
      //uv::prepare m_checker;
      uv_prepare_t* m_checker_uv;
        
      //uv::timer m_heartbeat_timer,
      //  m_disown_timer;
      uv_timer_t* m_hearbeat_timer_uv,
        m_disown_timer_uv;

      // The app

      std::unique_ptr<const manifest_t> m_manifest;
      std::unique_ptr<const profile_t> m_profile;
      std::unique_ptr<api::sandbox_t> m_sandbox;

      struct io_pair_t {
        boost::shared_ptr<api::stream_t> upstream;
        boost::shared_ptr<api::stream_t> downstream;
      };

#if BOOST_VERSION >= 103600
      typedef boost::unordered_map<
#else
        typedef std::map<
#endif
          unique_id_t,
          io_pair_t
          > stream_map_t;

      // Session streams.
      stream_map_t m_streams;
    };

    template<class Event, typename... Args>
    void
    worker_t::send(Args&&... args) {
      m_channel.send<Event>(std::forward<Args>(args)...);
    }
  }} // namespace cocaine::engine

#endif
