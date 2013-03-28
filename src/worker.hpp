
#ifndef NOCOCAINE_WORKER_HPP
#define NOCOCAINE_WORKER_HPP


#include "common.hpp"
#include "stream.hpp"

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
      uv_check_t   *m_check;
      uv_poll_t    *m_watcher;
      bool m_watcher_enabled;
      
      uv_prepare_t *m_prepare;
      bool m_prepare_enabled;

      uv_timer_t *m_timer;

      // The app

      std::unique_ptr<const manifest_t> m_manifest;
      std::unique_ptr<const profile_t>  m_profile;

      //std::list<std::shared_ptr<Stream::Shared>> m_writing_q;
      //std::list<std::shared_ptr<Stream::Shared>> m_prepare_q;
      
      ngx_queue_t m_writing_q;
      ngx_queue_t m_pending_q;

      bool m_want_write;
      bool m_want_prepare;

      // Session streams.
      typedef std::map<
        uint64_t,
        std::shared_ptr<Stream::Shared>
      > stream_map_t;
      
      stream_map_t m_streams;

      //================
      
    public:

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
      uv_on_timer(uv_timer_t *hdl, int status);

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

      static Handle<Value>
      LogDebug(const Arguments &args);
      static Handle<Value>
      LogInfo(const Arguments &args);
      static Handle<Value>
      LogWarning(const Arguments &args);
      static Handle<Value>
      LogError(const Arguments &args);

      //==== js completion helpers

      void
      OnConnection(Stream *s);

      void
      OnHeartbeat();

      void
      OnShutdown();

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

      void
      terminate(rpc::suicide::reasons reason,
                const std::string& message);

    private:
      int
      listen();

      void
      set_want_write(bool want);

      void
      set_want_prepare(bool want);

      void
      update_watchers_state();
      
    public:

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

      template<class Event, typename... Args>
      std::string
      pack_msg(Args&&... args);
    
      template<class Event, typename... Args>
      bool
      send(Args&&... args);

      bool
      send_raw(std::string &blob,int flags = 0);

    };
    
    template<class Event, typename... Args>
    std::string
    NodeWorker::pack_msg(Args&&... args) {
      return io::codec::pack<Event>(std::forward<Args>(args)...);
    }
    
    template<class Event, typename... Args>
    bool
    NodeWorker::send(Args&&... args) {
      return m_channel.send(io::codec::pack<Event>(std::forward<Args>(args)...));
    }

  }
}


#endif
